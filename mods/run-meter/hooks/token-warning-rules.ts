import type { UsageForWarning } from './token-warning.types'

const CONTEXT_WARNING_TOKENS = 150_000
const AGE_WARNING_HOURS = 24
const LIMIT_WARNING_PERCENT = 80
const ONE_HOUR = 3_600_000

const LIMIT_NAMES: Record<string, string> = {
  five_hour: '5-hour limit',
  seven_day: 'weekly limit',
  spend_limit: 'spend limit',
}

function describeContext(tokens: number | undefined): string | undefined {
  if (tokens === undefined || tokens < CONTEXT_WARNING_TOKENS) return undefined
  return `${Math.round(tokens / 1000)}k tokens of context`
}

function describeAge(startedAt: number, nowMs: number): string | undefined {
  const hoursOpen = Math.floor((nowMs - startedAt) / ONE_HOUR)
  return hoursOpen >= AGE_WARNING_HOURS ? `open ${hoursOpen} hours` : undefined
}

function describeLimits(limits: UsageForWarning['rateLimits']): string[] {
  return (limits ?? [])
    .filter(limit => limit.percentUsed >= LIMIT_WARNING_PERCENT)
    .map(limit => `${LIMIT_NAMES[limit.kind] ?? limit.kind} at ${Math.round(limit.percentUsed)}%`)
}

export function decideTokenWarning(usage: UsageForWarning, nowMs: number): string | undefined {
  const sessionProblems = [describeContext(usage.context.tokens), describeAge(usage.startedAt, nowMs)]
    .filter((problem): problem is string => problem !== undefined)
  const limitProblems = describeLimits(usage.rateLimits)
  if (sessionProblems.length === 0 && limitProblems.length === 0) return undefined
  const parts = [...sessionProblems, ...limitProblems].join(', ')
  const advice = sessionProblems.length > 0 ? 'start a new thread for the next task' : 'keep the next turns small'
  return `⚠ Long session: ${parts}. Every message re-reads it all, so ${advice}.`
}
