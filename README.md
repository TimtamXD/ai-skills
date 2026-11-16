# ai-skills

Tim's Claude skills: standing rules for how Claude builds software.

| Skill | What it does |
|---|---|
| [`acknowledging-code-quality`](skills/acknowledging-code-quality/SKILL.md) | Test-first TDD, tests a product manager can read, and clean code and architecture. Every reply opens with `**✅ [acknowledging-code-quality] 🧪**`. |
| [`acknowledging-user-flow`](skills/acknowledging-user-flow/SKILL.md) | Anything a person sees or does is designed in Claude Design first, then reviewed by the design lead, UI/UX and the experts for that topic, then built from the design. Replies open with `**🧭 [acknowledging-user-flow] 🎨** Experts: …`. |

## Install

Copy a skill folder into your Claude skills directory:

```bash
git clone https://github.com/TimtamXD/ai-skills.git
cp -r ai-skills/skills/* ~/.claude/skills/
```

On Windows, copy the folders into `%USERPROFILE%\.claude\skills\`. Claude Code picks them up in new sessions. Each folder holds one `SKILL.md`.
