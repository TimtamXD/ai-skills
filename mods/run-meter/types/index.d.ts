export type TaskStatus = 'pending' | 'in_progress' | 'completed'

export type Task = { id: string; subject: string; status: TaskStatus }

export type Tokens = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type AgentRun = {
  id: string
  label: string
  agentType?: string
  model?: string
  status: 'running' | 'done' | 'failed'
  startedAt: number
  durationMs?: number
  tokens: Tokens
  usd: number
}

export type SkillRun = {
  name: string
  startedAt: number
  durationMs?: number
}

export type ModelSpend = { model: string; tokens: Tokens; usd: number }

// Calls to the ask_deepseek MCP tool (DeepSeek via OpenRouter). Billed by OpenRouter, so not in the engine's total.
export type DeepseekModel = { model: string; calls: number; input: number; output: number; usd: number }
export type DeepseekSpend = { calls: number; failed: number; models: DeepseekModel[]; lastAt?: number }

declare module 'claude-code' {
  interface PluginState {
    'run-meter': {
      tasks: Task[]
      agents: AgentRun[]
      skill: SkillRun | null
      spend: ModelSpend[]
      sessionUsd: number | null
      budget: number
      deepseek: DeepseekSpend
    }
  }
}
