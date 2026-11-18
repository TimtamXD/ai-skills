import { mock } from 'claude-code/testing'
import type { On } from 'claude-code'

import { NOW } from './builders'

export const STATUS_FOLDER = 'C:/Users/Arceu/repos/.claude-progress'

export const PANE = {
  plugin: 'project-progress',
  component: 'Pane',
  requestId: 'project-progress',
  props: {
    title: 'Project progress',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const QUIET_RUN = { stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }

export type ProgressWorld = {
  files: Map<string, string>
  statusLines: (string | undefined)[]
  isFolderMissing: boolean
  listedFolders: string[]
  commandsRun: string[][]
  isPullFailing: boolean
  clock: ReturnType<typeof mock.clock>
}

export function setUpProgressWorld(on: On): ProgressWorld {
  const world: ProgressWorld = {
    files: new Map(),
    statusLines: [],
    isFolderMissing: false,
    listedFolders: [],
    commandsRun: [],
    isPullFailing: false,
    clock: mock.clock(on, { now: NOW }),
  }
  on('command.register', () => ({ value: { command: 'progress' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, event) => ({ cwd: event.cwd }))
  on('ui.status', (_, event) => {
    world.statusLines.push(event.text)
    return { value: undefined }
  })
  on('fs.list', (_, event) => {
    world.listedFolders.push(event.path)
    if (world.isFolderMissing) throw new Error('ENOENT: no such folder')
    return {
      value: [...world.files.keys()].map(name => ({ name, kind: 'file' as const, size: 1, mtimeMs: NOW, isLink: false })),
    }
  })
  on('process.run', (_, event) => {
    world.commandsRun.push([...event.argv])
    return { value: { ...QUIET_RUN, exitCode: world.isPullFailing ? 1 : 0 } }
  })
  on('fs.read', (_, event) => ({
    value: world.files.get(event.path.split('/').pop() ?? '') ?? '',
  }))

  return world
}
