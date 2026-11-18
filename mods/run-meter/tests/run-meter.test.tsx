import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'run-meter',
  component: 'Pane',
  requestId: 'run-meter',
  props: {
    title: 'Run meter',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('tasks and a Haiku subagent show with their progress and cost', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  on('ui.status', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'run-meter' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', (_, e) =>
    e.tool === 'Agent'
      ? {
          result: {
            agentId: 'a1',
            resolvedModel: 'claude-haiku-5-5',
            totalDurationMs: 4000,
            totalTokens: 3_000_000,
            totalToolUseCount: 2,
            content: [],
            usage: {
              input_tokens: 1_000_000,
              output_tokens: 1_000_000,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0,
            },
          },
        }
      : { result: {} },
  )

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'Gather data', status: 'completed', activeForm: 'Gathering data' },
      { content: 'Run panel', status: 'in_progress', activeForm: 'Running panel' },
      { content: 'Merge verdicts', status: 'pending', activeForm: 'Merging verdicts' },
    ],
  })
  await $.tool.call({ tool: 'Agent', description: 'CPA review', prompt: 'review', model: 'haiku' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /1\/3/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /Running panel/ }))?.text).toContain('Running panel')
    // A long prompt (over 100K) on Haiku 5.5: 1M in at $0.50 + 1M out at $2.50.
    expect((await ui.find({ type: 'Text', text: /CPA review/ }))?.text).toContain('Haiku 5.5 · 2.00M · $3.00')
    await ui.unmount()
  }
})
