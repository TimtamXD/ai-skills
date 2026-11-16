---
name: acknowledging-user-flow
description: Use whenever work touches something a person sees or does in an app (a screen, a step, wording, a setting, a notification). Design the flow in Claude Design first, have the design lead, UI/UX expert and the experts for that topic review it, build from the agreed design, and open replies with the [acknowledging-user-flow] line naming the experts consulted.
---

# Acknowledging user flow

If people see it or do it, it's designed before it's built. Code follows the agreed design, not the other way round.

## Open replies with the tag

In replies about user-flow work, put this exact line, in bold, emojis included, on the line after `**✅ [acknowledging-code-quality] 🧪**`. Follow it on the same line with the experts consulted:

`**🧭 [acknowledging-user-flow] 🎨** Experts: design lead, UI/UX, accountant, …`

Only use the tag when all of these are true:
- the design came first,
- the design artifact is up to date,
- the named experts reviewed it.

If a flow was built before its design, or an expert was skipped, say so in the same reply. If the work changes no flow (a rules change, a refactor with identical screens), write `Experts: none, no flow change`.

## 1. Design first, in Claude Design

1. **Find the flow's home.** Add the work to the project's existing user-flow design artifact (its Claude Design canvas). Start a new artifact only if no existing one covers the flow.
2. **Draw every state, not just the happy path:** first run, normal, empty, loading, error, offline and undo. On phones, design at phone width first.
3. **Use real numbers from the person's data where you have them.** Mark unknowns as placeholders (`[rate]%`), never invented figures.
4. **Match the canvas's existing design language:** palette, type, spacing, components and tone.
5. **Put each change on its own board, named for the flow.** One short line under the title says what changed and why.

## 2. Review before build

Before anything is built, the design is reviewed by the design lead and the UI/UX expert, plus every expert whose topic the flow touches. For example:

| The flow involves | Bring in |
|---|---|
| Numbers on screen | an accountant, who checks every figure reconciles and nothing is counted twice |
| Money choices (budgets, savings, debt, investing) | budgeting and wealth experts |
| Wording, nudges, anything that could feel judgemental | a values or behavioural expert |
| Banks, logins, security, privacy, advice wording, regulation | a policy or compliance expert |
| Tax, interest or super | a tax expert |
| Rates, inflation or projections | an economics expert |
| Code for the flow | a clean code and architecture reviewer |

Run reviewers in parallel. Merge what they say into one list: agreed changes first, then real disagreements as decisions with a recommendation. Revise the boards, and only then build.

Decisions that change the person's money, data or security go to the person, put as one plain question with a recommended option.

## 3. Build from the design

- Build test-first (see `acknowledging-code-quality`). End-to-end and Playwright tests follow the designed flow, step by step, including its error and empty states.
- Where the built screen differs from the board, either fix the code or update the board, and say which.
- After building, check the built flow against the board at phone and desktop widths before calling it done.

## 4. Definition of done

- [ ] The flow is on the design artifact, with every state drawn
- [ ] The design lead, UI/UX and the topic experts reviewed it, and their changes are applied
- [ ] The person decided anything that changes their money, data or security
- [ ] It was built test-first from the design, and the built screens match the boards
- [ ] The reply opens with both tags and names the experts consulted
