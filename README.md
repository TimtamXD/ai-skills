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

One command on a new machine (Linux, macOS or WSL; on Windows use `py` for `python3`). It copies the skills, agents, hook and mod into `~/.claude`, merges the hook and env into `settings.json` (backing up the old one to `settings.json.bak`), and adds the token rules to `~/.claude/CLAUDE.md`. Running it again changes nothing twice.

```bash
git clone https://github.com/TimtamXD/ai-skills.git && python3 ai-skills/setup/install.py
```

Tests: `python3 -m unittest` in `setup/`.

Or copy a skill folder by hand:

```bash
git clone https://github.com/TimtamXD/ai-skills.git
mkdir -p ~/.claude/skills ~/.claude/agents
cp -r ai-skills/skills/* ~/.claude/skills/
cp ai-skills/agents/* ~/.claude/agents/
```

On Windows, copy the skill folders into `%USERPROFILE%\.claude\skills\` and the agents into `%USERPROFILE%\.claude\agents\`. Claude Code picks them up in new sessions. Each skill folder holds one `SKILL.md`. `acknowledging-code-quality` section 2a holds the rules that keep checks cheap on tokens: quiet output, narrow test runs while working, and heavy gates once per merge. Section 2b keeps a full build plus all tests under 10 minutes, with branches checking side by side. `agents/` holds the `wcgw` agent that `acknowledging-code-quality` runs.

## Token budget kit

Keeps long sessions from burning the usage limit. Set it up on every machine Claude Code runs on:

- **[rules/token-budget.md](rules/token-budget.md):** paste into `~/.claude/CLAUDE.md`. One task per thread, heed the long-session warning, lean subagents.
- **[hooks/long_session_warning](hooks/long_session_warning):** a `UserPromptSubmit` hook that acts on every prompt once a session carries over 150k tokens of context or has been open over 24 hours. In a project thread, a person's new message is handed to the coordinator for a fresh thread and the old thread resolves itself, with no button. In a plain Claude Code session it asks Claude for a bold warning and a button to a new session. Tests: `python3 -m unittest` in that folder.
- **[mods/run-meter](mods/run-meter):** a Claude Code mod with a pane of tasks, subagents and spend, plus a toast after each turn when the session is over 150k tokens, open over a day, or a 5-hour or weekly limit passes 80%. Tests: `claude plugin test mods/run-meter`.

Copy the hook to `~/.claude/hooks/long_session_warning/` and the mod to `~/.claude/mods/run-meter/`, then merge this into `~/.claude/settings.json` (on Windows, use `py` and full Windows paths):

```json
{
  "env": {
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "20",
    "CLAUDE_CODE_PLUGIN_DIRS": "/home/you/.claude/mods/run-meter"
  },
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "python3 -I /home/you/.claude/hooks/long_session_warning/long_session_warning.py", "timeout": 10 }] }
    ]
  }
}
```

`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=20` compacts at about 200k tokens on a 1M window.

### Cloud sessions (claude.ai/code)

A cloud session starts from a fresh container, so `~/.claude` there is empty. In the cloud environment's settings, add this to its setup script, which runs before Claude starts, so the hook and rules apply from the first prompt:

```bash
git clone --depth 1 https://github.com/TimtamXD/ai-skills.git /tmp/ai-skills && python3 /tmp/ai-skills/setup/install.py
```

### Chats on claude.ai and the Claude app

Web and app chats can't run hooks or read `CLAUDE.md`. Paste the text in [rules/claude-ai-profile.md](rules/claude-ai-profile.md) into claude.ai, Settings, Profile, "What personal preferences should Claude consider in responses?". It is a request, not a hook: nothing measures tokens there.
