import { expect, mock, test } from 'claude-code/testing'

const ONE_HOUR = 3_600_000
const NOW = 200 * ONE_HOUR

type UsageReading = {
  contextTokens: number
  hoursOpen: number
  limits?: { kind: string; percentUsed: number }[]
}

async function finishTurnWith($: any, on: any, reading: UsageReading) {
  const toasts: string[] = []
  mock.clock(on, { now: NOW })
  mock.store(on)
  on('ui.status', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('command.register', () => ({ value: { command: 'run-meter' } }))
  on('session.start', (_: unknown, start: { cwd: string }) => ({ cwd: start.cwd }))
  on('turn.complete', () => ({ text: 'done' }))
  on('ui.toast', (_: unknown, toast: { text: string }) => {
    toasts.push(toast.text)
    return { value: undefined }
  })
  on('session.usage', () => ({
    value: {
      startedAt: NOW - reading.hoursOpen * ONE_HOUR,
      context: { tokens: reading.contextTokens, window: 1_000_000 },
      rateLimits: reading.limits ?? [],
    },
  }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete({ reason: 'answer', answer: 'done' })
  return toasts
}

test('a short fresh session shows no token warning', async ($, on) => {
  const toasts = await finishTurnWith($, on, { contextTokens: 90_000, hoursOpen: 1 })

  expect(toasts.filter(text => text.includes('⚠'))).toEqual([])
})

test('a session carrying over 150k tokens warns to start a new thread', async ($, on) => {
  const toasts = await finishTurnWith($, on, { contextTokens: 240_000, hoursOpen: 1 })

  expect(toasts.join(' ')).toContain('240k tokens')
  expect(toasts.join(' ')).toContain('new thread')
})

test('a session open for more than a day warns to start a new thread', async ($, on) => {
  const toasts = await finishTurnWith($, on, { contextTokens: 90_000, hoursOpen: 30 })

  expect(toasts.join(' ')).toContain('30 hours')
})

test('the 5-hour limit past 80% warns before it runs out', async ($, on) => {
  const toasts = await finishTurnWith($, on, {
    contextTokens: 90_000,
    hoursOpen: 1,
    limits: [{ kind: 'five_hour', percentUsed: 86 }],
  })

  expect(toasts.join(' ')).toContain('5-hour limit at 86%')
})

test('the weekly limit under 80% gives no warning', async ($, on) => {
  const toasts = await finishTurnWith($, on, {
    contextTokens: 90_000,
    hoursOpen: 1,
    limits: [{ kind: 'seven_day', percentUsed: 40 }],
  })

  expect(toasts.filter(text => text.includes('⚠'))).toEqual([])
})
