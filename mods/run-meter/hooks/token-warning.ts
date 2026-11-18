import type { EngineInterface } from 'claude-code'
import { decideTokenWarning } from './token-warning-rules'
import type { TokenWarningMemory } from './token-warning.types'

export async function warnWhenSessionIsHeavy($: EngineInterface, lastWarning: TokenWarningMemory) {
  const usage = await $.session.usage()
  const warning = decideTokenWarning(usage, await $.clock.now())
  if (warning === undefined || warning === lastWarning.text) return
  lastWarning.text = warning
  await $.ui.toast(warning)
}
