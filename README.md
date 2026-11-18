# ai-skills

Tim's Claude skills: standing rules for how Claude builds software.

| Skill | What it does |
|---|---|
| [`acknowledging-code-quality`](skills/acknowledging-code-quality/SKILL.md) | Test-first TDD, tests a product manager can read, clean code and architecture, and a wcgw review of what will go wrong before work is called done. Every reply opens with `**✅ [acknowledging-code-quality] 🧪**`. |
| [`acknowledging-user-flow`](skills/acknowledging-user-flow/SKILL.md) | Anything a person sees or does is designed in Claude Design first, then reviewed by the design lead, UI/UX and the experts for that topic, then built from the design. Replies open with `**🧭 [acknowledging-user-flow] 🎨** Experts: …`. |
| [`finance-expert-panel`](skills/finance-expert-panel/SKILL.md) | Reviews personal-finance app work with the experts its topic needs (design, budgeting, wealth, UI/UX, values, accountant, tax, policy, economics, clean code), on Haiku, from one shared review pack, then merges their verdicts into one proposal. |

## Mods

| Mod | What it does |
|---|---|
| [`project-progress`](mods/project-progress/README.md) | A pane in Claude Code listing every project thread's progress, with items waiting on Tim first. Threads write small status files; the pane refreshes every 30 seconds. |

Install a mod at the prompt of a Claude Code terminal session:

```
/plugin install project-progress --marketplace TimtamXD/ai-skills
```

## Install

Copy a skill folder into your Claude skills directory:

```bash
git clone https://github.com/TimtamXD/ai-skills.git
mkdir -p ~/.claude/skills ~/.claude/agents
cp -r ai-skills/skills/* ~/.claude/skills/
cp ai-skills/agents/* ~/.claude/agents/
```

On Windows, copy the skill folders into `%USERPROFILE%\.claude\skills\` and the agents into `%USERPROFILE%\.claude\agents\`. Claude Code picks them up in new sessions. Each skill folder holds one `SKILL.md`. `acknowledging-code-quality` section 2a holds the rules that keep checks cheap on tokens: quiet output, narrow test runs while working, and heavy gates once per merge. `agents/` holds the `wcgw` agent that `acknowledging-code-quality` runs.
