export type TokenWarningMemory = { text?: string }

export type UsageForWarning = {
  startedAt: number
  context: { tokens?: number }
  rateLimits?: { kind: string; percentUsed: number }[]
}
