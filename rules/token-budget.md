## One task per thread, lean subagents (token budget, 2026-11-18)

Long sessions burn the Max limit: on 2026-11-18, 68% of main-session tokens came from calls carrying over 400k of context, and one thread ran 23 days.

- **A new task gets a new thread or session.** When a message brings work unrelated to the current task, hand it off (a new thread via the coordinator, or a new session) instead of doing it in this one. Small follow-ups on the same task stay.
- **Heed the long-session warning.** A hook fires when a session carries over 150k tokens or has been open over a day. In a project thread, Claude hands the person's new message to the coordinator for a fresh thread and resolves the old thread itself, no button. In a plain Claude Code session, Claude puts a one-line warning first and offers a button to a new session.
- **Tag handoff titles so the chain is visible.** When a thread hands off to a fresh one, rename the old thread with prefix `[OLD-xx]` and title the new one `[NEW-xx]`, using one short tag per chain (for example `c1`, `t2`, `m3`). Earlier links keep `OLD`; only the live thread is `NEW`. Pick the next unused number for a new chain.
- **Builders and verifiers are lean.** Do builds and verifications in the main session unless Tim asks for a subagent. A subagent that builds or verifies runs on Sonnet, gets a short brief with file paths (not the history), stops after about 60 tool calls and reports what's left. Reviewers follow `finance-expert-panel` (Haiku, about 15 tool calls).
