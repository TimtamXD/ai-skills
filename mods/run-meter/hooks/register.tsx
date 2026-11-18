import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelUsage, Register } from 'claude-code'

import { warnWhenSessionIsHeavy } from './token-warning'
import type { TokenWarningMemory } from './token-warning.types'
import type { AgentRun, DeepseekSpend, ModelSpend, Task, TaskStatus, Tokens } from '../types'

const PANE = 'run-meter'
const TITLE = 'Run meter'

const tasks = atom({ plugin: 'run-meter', key: 'tasks' } as const, [])
const agents = atom({ plugin: 'run-meter', key: 'agents' } as const, [])
const skill = atom({ plugin: 'run-meter', key: 'skill' } as const, null)
const spend = atom({ plugin: 'run-meter', key: 'spend' } as const, [])
const sessionUsd = atom({ plugin: 'run-meter', key: 'sessionUsd' } as const, null)
const budget = atom({ plugin: 'run-meter', key: 'budget' } as const, 5)
const deepseek = atom({ plugin: 'run-meter', key: 'deepseek' } as const, { calls: 0, failed: 0, models: [] } as DeepseekSpend)

const DEEPSEEK_TOOL = 'mcp__deepseek__ask_deepseek'
// Fallback list prices (USD per million tokens, OpenRouter, 2026-11-12) when a reply carries no cost.
const DEEPSEEK_PRICES: [string, number, number][] = [
  ['v4.1-flash-1017', 0.3, 1.2],
  ['v4.1-flash', 0.022, 0.4],
  ['v4-pro', 0.955, 1.911],
  ['v4-flash', 0.09, 0.18],
  ['v3.2', 0.26, 0.38],
  ['r1-0528', 0.5, 2.15],
]

// The ask_deepseek reply ends "[model: <id>, tokens in/out: <n>/<n>, cost: $<usd>]".
function parseDeepseek(result: unknown): { model: string; input: number; output: number; usd: number } | undefined {
  const m = /\[model: ([^,\]]+), tokens in\/out: (\d+)\/(\d+)(?:, cost: \$([\d.eE+-]+))?\]/.exec(
    typeof result === 'string' ? result : JSON.stringify(result) ?? '',
  )
  if (!m || !m[1]) {
    return undefined
  }
  const model = m[1]
  const input = Number(m[2])
  const output = Number(m[3])
  const reported = m[4] === undefined ? NaN : Number(m[4])
  const p = DEEPSEEK_PRICES.find(([key]) => model.includes(key))
  const usd = Number.isFinite(reported) ? reported : p ? (input * p[1] + output * p[2]) / 1_000_000 : 0

  return { model, input, output, usd }
}

// List prices in USD per million tokens, from the claude-api skill (cached 2026-10-06).
// Cache writes are priced at the 5-minute rate (1.25x input).
type Price = { input: number; output: number; cacheRead: number; cacheWrite: number }
const price = (input: number, output: number, cacheRead: number): Price => ({
  input,
  output,
  cacheRead,
  cacheWrite: input * 1.25,
})
// Longest ids first, so `opus-5-5` matches before `opus-5`.
const PRICES: [string, Price][] = [
  ['fable-5-1', price(10, 50, 0.25)],
  ['mythos-5-1', price(10, 50, 0.25)],
  ['fable-5', price(10, 50, 1)],
  ['mythos-5', price(10, 50, 1)],
  ['opus-5-5', price(4, 20, 0.2)],
  ['opus-5', price(5, 25, 0.5)],
  ['opus-4-8', price(5, 25, 0.5)],
  ['opus-4-7', price(5, 25, 0.5)],
  ['opus-4-6', price(5, 25, 0.5)],
  ['sonnet-5-5', price(2, 10, 0.2)],
  ['sonnet-5', price(2, 10, 0.2)],
  ['sonnet-4-6', price(3, 15, 0.3)],
  ['haiku-5-5', price(0.1, 0.5, 0.01)],
  ['haiku-4-5', price(1, 5, 0.1)],
]
// Haiku 5.5 bills prompts over 100K tokens at 5x ($0.50 / $2.50).
const HAIKU_LONG_PROMPT = 100_000

const ZERO: Tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

function priceOf(model: string): Price | undefined {
  const id = model.toLowerCase()

  return PRICES.find(([key]) => id.includes(key))?.[1]
}

function tokensOf(usage: ModelUsage): Tokens {
  return {
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
  }
}

function addTokens(a: Tokens, b: Tokens): Tokens {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
  }
}

function totalOf(t: Tokens): number {
  return t.input + t.output + t.cacheRead + t.cacheWrite
}

// The cost of one request (or one summed run on a single model).
function costOf(model: string, t: Tokens): number {
  const p = priceOf(model)
  if (!p) {
    return 0
  }
  const prompt = t.input + t.cacheRead + t.cacheWrite
  const scale = model.includes('haiku-5-5') && prompt > HAIKU_LONG_PROMPT ? 5 : 1

  return (
    (scale *
      (t.input * p.input +
        t.output * p.output +
        t.cacheRead * p.cacheRead +
        t.cacheWrite * p.cacheWrite)) /
    1_000_000
  )
}

function shortModel(model: string): string {
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d+))?/.exec(model.toLowerCase())
  const family = m?.[1]
  if (!m || !family) {
    return model
  }
  const name = family.charAt(0).toUpperCase() + family.slice(1)

  return m[3] ? `${name} ${m[2]}.${m[3]}` : `${name} ${m[2]}`
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`

  return `${n}`
}

function fmtUsd(n: number): string {
  return n < 0.01 && n > 0 ? '<$0.01' : `$${n.toFixed(2)}`
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)

  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

function bar(done: number, total: number, width = 20): string {
  const filled = total === 0 ? 0 : Math.round((done / total) * width)

  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

// Green under half the budget, amber under 90%, red beyond.
function spendColor(usd: number, limit: number): 'success' | 'warning' | 'error' {
  const ratio = limit > 0 ? usd / limit : 0
  if (ratio < 0.5) return 'success'
  if (ratio < 0.9) return 'warning'

  return 'error'
}

type AgentResult = {
  agentId?: string
  resolvedModel?: string
  totalDurationMs?: number
  usage?: ModelUsage
  status?: string
}

// The status line entry: task bar, running agents, tokens and cost.
async function refreshStatus($: EngineInterface) {
  const list = await read($, tasks)
  const runs = await read($, agents)
  const models = await read($, spend)
  const engine = await read($, sessionUsd)
  const estimate = models.reduce((sum, m) => sum + m.usd, 0)
  const tokens = models.reduce((sum, m) => sum + totalOf(m.tokens), 0)
  const parts: string[] = []
  if (list.length > 0) {
    const done = list.filter(t => t.status === 'completed').length
    parts.push(`${bar(done, list.length, 8)} ${done}/${list.length}`)
  }
  const running = runs.filter(a => a.status === 'running').length
  if (running > 0) {
    parts.push(`${running} agent${running === 1 ? '' : 's'} running`)
  }
  parts.push(`${fmtTokens(tokens)} tok`)
  parts.push(fmtUsd(engine ?? estimate))
  const ds = await read($, deepseek)
  if (ds.calls > 0) {
    parts.push(`DeepSeek ${ds.calls}× ${fmtUsd(ds.models.reduce((sum, m) => sum + m.usd, 0))}`)
  }
  $.ui.status(parts.join(' · '))
}

async function setTasks($: EngineInterface, fn: (list: Task[]) => Task[]) {
  await update($, tasks, fn)
  await refreshStatus($)
}

export const register: Register = on => {
  // A subagent's loop id, mapped to the Agent call that spawned it.
  const loopToCall = new Map<string, string>()
  // Prompts of Agent calls not yet matched to a loop.
  const pendingPrompts = new Map<string, string>()
  const lastTokenWarning: TokenWarningMemory = {}

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'run-meter',
      description: 'Open the run meter; "budget <usd>" sets the colour budget, "clear" clears finished work',
    })
    const saved = Number(await $.store.get('budget'))
    if (saved > 0) {
      await update($, budget, () => saved)
    }
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'run-meter' }, async ($, e) => {
    const [verb, value] = e.args.trim().split(/\s+/)
    if (verb === 'budget') {
      const usd = Number(value?.replace('$', ''))
      if (!(usd > 0)) {
        return { text: 'Usage: /run-meter budget <usd>, for example /run-meter budget 5' }
      }
      await update($, budget, () => usd)
      await $.store.set('budget', usd)

      return { text: `Run meter budget set to ${fmtUsd(usd)}: green under 50%, amber under 90%, red beyond.` }
    }
    if (verb === 'clear') {
      await update($, agents, list => list.filter(a => a.status === 'running'))
      await update($, tasks, list => list.filter(t => t.status !== 'completed'))
      await update($, skill, current => (current?.durationMs === undefined ? current : null))
      await refreshStatus($)

      return { text: 'Cleared finished tasks, skills and agent runs.' }
    }
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Run meter opened.' }
  })

  // A typed slash command is most often a skill, such as /finance-expert-panel.
  on('prompt.submit', async ($, e, next) => {
    const m = /^\/([\w:.-]+)/.exec(e.text.trim())
    if (m && m[1] !== 'run-meter') {
      const now = await $.clock.now()
      await update($, skill, () => ({ name: m[1], startedAt: now }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, skill, () => ({ name: e.skill, startedAt: now }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId === undefined && ran.deny === undefined && !ran.isError) {
      const todos: Task[] = e.todos.map((todo, i) => ({
        id: `todo-${i}`,
        subject: todo.status === 'in_progress' ? todo.activeForm : todo.content,
        status: todo.status,
      }))
      await setTasks($, list => [...list.filter(t => !t.id.startsWith('todo-')), ...todos])
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)
    const id = (ran.result as { task?: { id?: string } } | undefined)?.task?.id
    if (e.agentId === undefined && id !== undefined && !ran.isError) {
      await setTasks($, list => [...list, { id: `task-${id}`, subject: e.subject, status: 'pending' }])
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId === undefined && ran.deny === undefined && !ran.isError) {
      const id = `task-${e.taskId}`
      await setTasks($, list =>
        e.status === 'deleted'
          ? list.filter(t => t.id !== id)
          : list.map(t =>
              t.id === id
                ? {
                    ...t,
                    subject: e.subject ?? t.subject,
                    status: (e.status as TaskStatus | undefined) ?? t.status,
                  }
                : t,
            ),
      )
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const id = e.tool_use_id
    const startedAt = await $.clock.now()
    const run: AgentRun = {
      id,
      label: e.description || e.subagent_type || 'Subagent',
      agentType: e.subagent_type,
      model: e.model,
      status: 'running',
      startedAt,
      tokens: ZERO,
      usd: 0,
    }
    pendingPrompts.set(e.prompt, id)
    await update($, agents, list => [...list, run].slice(-50))
    await refreshStatus($)

    const ran = await next(e)
    pendingPrompts.delete(e.prompt)
    const result = ran.result as AgentResult | undefined
    const now = await $.clock.now()
    await update($, agents, list =>
      list.map((a): AgentRun => {
        if (a.id !== id) {
          return a
        }
        if (ran.deny !== undefined || ran.isError) {
          return { ...a, status: 'failed', durationMs: now - a.startedAt }
        }
        if (!result?.usage) {
          // Launched in the background: it finishes at its own turn.complete.
          return a
        }
        const model = result.resolvedModel ?? a.model ?? ''
        const tokens = tokensOf(result.usage)

        return {
          ...a,
          status: 'done',
          model,
          tokens,
          usd: Math.max(a.usd, costOf(model, tokens)),
          durationMs: result.totalDurationMs ?? now - a.startedAt,
        }
      }),
    )
    await refreshStatus($)

    return ran
  }).catch(($, e, next) => next(e))

  // DeepSeek calls through the ask_deepseek MCP tool: tokens and cost come from the reply's footer.
  on('tool.call', { tool: DEEPSEEK_TOOL as never }, async ($, e, next) => {
    const ran = await next(e)
    const now = await $.clock.now()
    const used = ran.deny === undefined && !ran.isError ? parseDeepseek(ran.result) : undefined
    await update($, deepseek, (d: DeepseekSpend): DeepseekSpend => {
      if (!used) {
        return { ...d, failed: d.failed + 1, lastAt: now }
      }
      const has = d.models.some(m => m.model === used.model)
      const rows = has ? d.models : [...d.models, { model: used.model, calls: 0, input: 0, output: 0, usd: 0 }]

      return {
        calls: d.calls + 1,
        failed: d.failed,
        lastAt: now,
        models: rows.map(m =>
          m.model === used.model
            ? { ...m, calls: m.calls + 1, input: m.input + used.input, output: m.output + used.output, usd: m.usd + used.usd }
            : m,
        ),
      }
    })
    await refreshStatus($)

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined && !loopToCall.has(e.agentId)) {
      const callId = pendingPrompts.get(e.text)
      if (callId !== undefined) {
        loopToCall.set(e.agentId, callId)
      }
    }

    return next(e)
  })

  // Every model request, on the main loop and in subagents, with the model that answered.
  on('turn.step', async function* ($, e, next) {
    const step = yield* next(e)
    if (step.usage) {
      const model = step.usage.model || e.model
      const tokens = tokensOf(step.usage)
      const usd = costOf(model, tokens)
      await update($, spend, (list: ModelSpend[]) => {
        const has = list.some(m => m.model === model)
        const row = { model, tokens: ZERO, usd: 0 }

        return (has ? list : [...list, row]).map(m =>
          m.model === model ? { ...m, tokens: addTokens(m.tokens, tokens), usd: m.usd + usd } : m,
        )
      })
      const callId = e.agentId === undefined ? undefined : loopToCall.get(e.agentId)
      if (callId !== undefined) {
        await update($, agents, list =>
          list.map((a): AgentRun =>
            a.id === callId && a.status === 'running'
              ? { ...a, model, tokens: addTokens(a.tokens, tokens), usd: a.usd + usd }
              : a,
          ),
        )
      }
      await refreshStatus($)
    }

    return step
  })

  on('turn.complete', async ($, e, next) => {
    const now = await $.clock.now()
    if (e.agentId === undefined) {
      await update($, skill, current =>
        current && current.durationMs === undefined
          ? { ...current, durationMs: now - current.startedAt }
          : current,
      )
    } else {
      const callId = loopToCall.get(e.agentId)
      if (callId !== undefined) {
        await update($, agents, list =>
          list.map((a): AgentRun =>
            a.id === callId && a.status === 'running'
              ? { ...a, status: e.reason === 'answer' ? 'done' : 'failed', durationMs: now - a.startedAt }
              : a,
          ),
        )
        await refreshStatus($)
      }
    }

    const result = await next(e)
    if (e.agentId === undefined) await warnWhenSessionIsHeavy($, lastTokenWarning)
    return result
  })

  // The engine's own running total, as /cost has it.
  on('session.measure', async ($, e, next) => {
    if (e.cost && e.changed.includes('cost')) {
      const usd = e.cost.usd
      await update($, sessionUsd, () => usd)
      await refreshStatus($)
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, tasks)
    const runs = await read($, agents)
    const current = await read($, skill)
    const models = await read($, spend)
    const engine = await read($, sessionUsd)
    const limit = await read($, budget)
    const ds = await read($, deepseek)
    const dsUsd = ds.models.reduce((sum, m) => sum + m.usd, 0)
    const dsIn = ds.models.reduce((sum, m) => sum + m.input, 0)
    const dsOut = ds.models.reduce((sum, m) => sum + m.output, 0)
    const now = await $.clock.now()
    const width = Math.max(10, Math.min(30, (e.viewport?.columns ?? 40) - 16))

    const done = list.filter(t => t.status === 'completed').length
    const active = list.find(t => t.status === 'in_progress')
    const agentsDone = runs.filter(a => a.status !== 'running').length
    const estimate = models.reduce((sum, m) => sum + m.usd, 0)
    const total = engine ?? estimate
    const tokens = models.reduce((sum, m) => sum + totalOf(m.tokens), 0)
    const color = spendColor(total, limit)

    return (
      <Box flexDirection="column">
        <Text bold>Tasks</Text>
        {list.length === 0 ? (
          <Text dimColor>No task list yet.</Text>
        ) : (
          <Box flexDirection="column">
            <Box>
              <Text color={done === list.length ? 'success' : 'claude'}>{bar(done, list.length, width)}</Text>
              <Text>
                {' '}
                {done}/{list.length}
              </Text>
            </Box>
            {active && <Text color="warning">▸ {active.subject}</Text>}
          </Box>
        )}

        {current && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Skill</Text>
            <Text color={current.durationMs === undefined ? 'warning' : 'success'}>
              {current.durationMs === undefined ? '● ' : '✓ '}/{current.name}{' '}
              <Text dimColor>
                {current.durationMs === undefined
                  ? `running ${fmtDuration(now - current.startedAt)}`
                  : `done in ${fmtDuration(current.durationMs)}`}
              </Text>
            </Text>
          </Box>
        )}

        <Box flexDirection="column" marginTop={1}>
          <Text bold>Subagents</Text>
          {runs.length === 0 ? (
            <Text dimColor>None run yet.</Text>
          ) : (
            <Box flexDirection="column">
              <Box>
                <Text color={agentsDone === runs.length ? 'success' : 'claude'}>
                  {bar(agentsDone, runs.length, width)}
                </Text>
                <Text>
                  {' '}
                  {agentsDone}/{runs.length}
                </Text>
              </Box>
              {runs.slice(-Math.max(3, (e.viewport?.rows ?? 30) - 18)).map(a => (
                <Text
                  key={a.id}
                  color={a.status === 'running' ? 'warning' : a.status === 'failed' ? 'error' : undefined}
                  dimColor={a.status === 'done'}
                >
                  {a.status === 'running' ? '● ' : a.status === 'failed' ? '✗ ' : '✓ '}
                  {a.label}
                  {a.model ? ` · ${shortModel(a.model)}` : ''}
                  {` · ${fmtTokens(totalOf(a.tokens))} · ${fmtUsd(a.usd)}`}
                  {a.durationMs !== undefined ? ` · ${fmtDuration(a.durationMs)}` : ''}
                </Text>
              ))}
            </Box>
          )}
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text bold>Spend</Text>
          <Box>
            <Text color={color}>{bar(Math.min(total, limit), limit, width)}</Text>
            <Text color={color}>
              {' '}
              {fmtUsd(total)} of {fmtUsd(limit)}
            </Text>
          </Box>
          <Text dimColor>
            {fmtTokens(tokens)} tokens{engine === null ? ' · estimated from list prices' : ` · list-price estimate ${fmtUsd(estimate)}`}
          </Text>
          {models.map(m => (
            <Text key={m.model} dimColor>
              {shortModel(m.model)}: {fmtTokens(m.tokens.input + m.tokens.cacheRead + m.tokens.cacheWrite)} in
              {' · '}
              {fmtTokens(m.tokens.output)} out · {fmtUsd(m.usd)}
              {priceOf(m.model) ? '' : ' (no price on file)'}
            </Text>
          ))}
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text bold>DeepSeek</Text>
          {ds.calls === 0 && ds.failed === 0 ? (
            <Text dimColor>No ask_deepseek calls yet.</Text>
          ) : (
            <Box flexDirection="column">
              <Text color="claude">
                {ds.calls} call{ds.calls === 1 ? '' : 's'} · {fmtTokens(dsIn)} in · {fmtTokens(dsOut)} out · {fmtUsd(dsUsd)}
              </Text>
              {ds.models.map(m => (
                <Text key={m.model} dimColor>
                  {m.model.replace('deepseek/', '')}: {m.calls}× · {fmtTokens(m.input)} in · {fmtTokens(m.output)} out ·{' '}
                  {fmtUsd(m.usd)}
                </Text>
              ))}
              {ds.failed > 0 && <Text color="error">{ds.failed} failed call{ds.failed === 1 ? '' : 's'}</Text>}
              <Text dimColor>Billed by OpenRouter; not in the Claude total above.</Text>
            </Box>
          )}
        </Box>
      </Box>
    )
  })
}
