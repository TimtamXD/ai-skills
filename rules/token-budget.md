## One task per thread, lean subagents (token budget, 2026-11-18)

Long sessions burn the Max limit: on 2026-11-18, 68% of main-session tokens came from calls carrying over 400k of context, and one thread ran 23 days.

- **A new task gets a new thread or session.** When a message brings work unrelated to the current task, hand it off (a new thread via the coordinator, or a new session) instead of doing it in this one. Small follow-ups on the same task stay.
- **Heed the long-session warning.** A hook warns when a session carries over 150k tokens or has been open over a day. When it fires, put a one-line warning first in the reply and suggest a new thread for the next task.
- **Builders and verifiers are lean.** Do builds and verifications in the main session unless Tim asks for a subagent. A subagent that builds or verifies runs on Sonnet, gets a short brief with file paths (not the history), stops after about 60 tool calls and reports what's left. Reviewers follow `finance-expert-panel` (Haiku, about 15 tool calls).
