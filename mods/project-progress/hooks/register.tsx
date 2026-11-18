import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { orderForTim } from './ordering'
import { pullLatestStatuses, readStatusFolder } from './status-folder'
import { drawThreadRow } from './thread-row'
import { summarise } from './wording'

const PANE = 'project-progress'
const TITLE = 'Project progress'
const REFRESH_EVERY = 30_000

const snapshot = atom({ plugin: 'project-progress', key: 'snapshot' } as const, { threads: [], isFolderReadable: true, isPullFailing: false }, {
  shape: 'snapshot-2',
})

type RefreshSettings = { statusFolder: string; pullFromGit: boolean }

async function refresh($: EngineInterface, { statusFolder, pullFromGit }: RefreshSettings) {
  const isPullFailing = pullFromGit && !(await pullLatestStatuses($, statusFolder))
  const latest = { ...(await readStatusFolder($, statusFolder)), isPullFailing }
  await update($, snapshot, () => latest)
  $.ui.status(`Progress: ${summarise(orderForTim(latest.threads, await $.clock.now()))}`)
}

export const register: Register = (on, options) => {
  const statusFolder = String(options.statusFolder)
  const settings = { statusFolder, pullFromGit: options.pullFromGit === true }

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'progress', description: 'Show progress across all project threads' })
    void $.ui.open({ id: PANE, title: TITLE })
    await refresh($, settings)
    $.clock.every(REFRESH_EVERY, () => void refresh($, settings))

    return next(e)
  })

  on('command.run', { command: 'progress' }, async $ => {
    await refresh($, settings)
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Project progress pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text } = elements
    const { threads, isFolderReadable, isPullFailing } = await read($, snapshot)
    const now = await $.clock.now()
    const ordered = orderForTim(threads, now)

    if (!isFolderReadable) {
      return <Text dimColor>Can't read {statusFolder} yet. It appears once a thread writes its first status.</Text>
    }
    if (ordered.length === 0) return <Text dimColor>No status files yet in {statusFolder}</Text>

    return (
      <Box flexDirection="column">
        <Text bold>{summarise(ordered)}</Text>
        {isPullFailing && <Text dimColor>Couldn't pull the latest statuses, so these may be out of date.</Text>}
        {ordered.map(thread => drawThreadRow(elements, thread, now))}
      </Box>
    )
  })
}
