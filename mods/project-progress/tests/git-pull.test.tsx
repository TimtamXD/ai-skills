import { describe, expect, test } from 'claude-code/testing'

import { aStatusFile } from './builders'
import { PANE, setUpProgressWorld, STATUS_FOLDER } from './progress-world'

const START = { cwd: '/', surface: 'desktop', isInteractive: true } as const
const PULL_ON = { options: { pullFromGit: true } }

describe('pulling status files that cloud threads pushed to GitHub', () => {
  test('pulls the latest status files before reading them, when turned on', PULL_ON, async ($, on) => {
    const world = setUpProgressWorld(on)

    await $.session.start(START)

    expect(world.commandsRun).toContainEqual(['git', '-C', STATUS_FOLDER, 'pull', '--ff-only', '--quiet'])
  })

  test('runs no git command when pulling is off', async ($, on) => {
    const world = setUpProgressWorld(on)

    await $.session.start(START)

    expect(world.commandsRun).toEqual([])
  })

  test('still shows the last files and says the pull failed', PULL_ON, async ($, on) => {
    const world = setUpProgressWorld(on)
    world.isPullFailing = true
    world.files.set('good.json', aStatusFile({ title: 'Good thread' }))

    await $.session.start(START)

    const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
    expect(await ui.find({ type: 'Text', text: /Good thread/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /pull/ }))?.text).toBe(
      "Couldn't pull the latest statuses, so these may be out of date.",
    )
    await ui.unmount()
  })
})
