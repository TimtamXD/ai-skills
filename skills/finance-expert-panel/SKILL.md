---
name: finance-expert-panel
description: Run the expert reviewers a piece of Budget Companion (or any Australian personal-finance app) work needs, chosen by topic from a panel of ten, in parallel on Haiku at max effort from one shared review pack, then merge their verdicts into one proposal. The panel is a design lead, a budgeting-app expert, a wealth-growth expert, a UI/UX expert, a financial-values expert, a CPA accountant, an Australian tax expert, an Australian government-policy expert, an Australian economics expert and a clean code and architecture reviewer (always on for code). Use when asked to audit, trim, review, validate or "get the experts/subagents to look at" app features, flows, numbers, designs or Claude Design artboards.
---

# Finance expert panel

Ten reviewers look at the same work from different angles, in parallel, and you merge what they say into one proposal. They review; they never edit code, publish artifacts or post messages.

**Model and effort:** start every reviewer with `model: "haiku"` and `effort: "max"`. The user asked for this to keep token use down. Don't use a bigger model for the panel unless the user asks.

**Run only the reviewers the work needs.** Each reviewer re-reads the work, so ten reviewers cost about ten times one. Pick them from the topic rules below ("Who to run"). Run all ten only for a whole-app audit, or when Tim asks for the full panel. A tax question needs only the accountant and the tax expert; a code change with no screen or money rule needs only the clean code reviewer and the accountant.

## Who to run

| The work | Reviewers |
|---|---|
| Any code change | clean code and architecture, accountant (always) |
| A user-flow design or a built screen | design lead, UI/UX (always) |
| Numbers on screen, totals, reconciling | accountant |
| Budgets, buckets, pots, savings, debt | budgeting-app, wealth-growth |
| Wording, nudges, cuts to spending | financial-values |
| Pay, tax, super, deductions | tax |
| Banks, logins, privacy, advice wording, government schemes | government-policy |
| Interest rates, inflation, projections | economics |
| Whole-app audit, or Tim asks for the full panel | all ten |

Name the chosen reviewers in the reply, so it's clear who looked and who didn't.

## When to use it

- Auditing the app ("what should we cut, merge or move?").
- Validating a design before it is built (Claude Design artboards, mockups).
- Reviewing a built feature before it ships.

## What to give every reviewer

**Build one review pack first, and point every reviewer at it.** Before starting reviewers, write a single scratchpad file (or a few) with what they all need, so no reviewer re-derives it:
- `git diff --stat` and the diff itself, cut to the files under review (skip lockfiles, snapshots and generated code);
- the one-line results already saved from the final check run, the real-data gate and any old-vs-new comparison;
- the domain facts (category spend, accounts, rates, research files).

Start each one with the Agent tool, using `subagent_type: "general-purpose"`, `model: "haiku"`, `effort: "max"` and `run_in_background: true`. Put all the chosen reviewers in the same message. Each prompt includes:

1. **The ask, in one paragraph:** what is being reviewed and what decision it feeds.
2. **Where things are:**
   - **Repo:** the app's checkout and how to run commands in it (shell, Node version), from the project's CLAUDE.md or memory.
   - **Pages and logic:** where the pages, the plan engine, account setup and the values profile live.
   - **Dev server:** its local address, if one is running.
   - **Design reference:** the project's Claude Design canvases. Read them with the Artifact tool's `read` action, or pass local copies of the artboard files.
3. **Guardrails:** "READ-ONLY: do not edit, commit, publish or install anything. Do NOT call any mcp__hearthbot__ tools."
4. **Cost rules:** "Read the review pack first and trust its check results. Do not run tests, builds, the real-data gate, comparisons or a browser. Read other files only to prove a point, by grep or by line range, never a whole file over 300 lines or a whole log. Recompute only the figures the change touches."
5. **The return format:** a verdict, a MUST-FIX list (concrete, with file paths or artboard names), a NICE-TO-HAVE list, and for audits a KEEP / MERGE INTO / MOVE TO / CUT verdict per page or section. Keep it under 450 words, and write the full report to a scratchpad file if it is longer.

## The ten reviewers

| Reviewer | Lens |
|---|---|
| **Design lead** | Owns the Claude Design redesign. Checks visual hierarchy, consistency with the redesign and `DESIGN_SYSTEM.md`, information density, duplicate widgets, where a screen belongs in the navigation, and how it reads on a phone. |
| **Budgeting-app expert** | Knows YNAB, Up, Frollo, Monarch, Barefoot-style buckets and sinking funds. Checks the core loop (import → categorise → see where it went → plan → automate → track), duplicated plan models, sizing and detection rules, and whether bank-specific steps are correct (cite official bank pages, and mark anything unverified). |
| **Wealth-growth expert** | Checks saving comes first: safety net, goals, then investing. Looks at debt ordering, idle cash earning too little (bonus-rate conditions), net worth and savings rate, and whether a feature quietly crowds out goals. This is product feedback, never personal advice. |
| **UI/UX expert** | Checks task flows (first run, weekly check-in, overspend, import, setting a goal), clicks and dead ends, how many decisions each screen asks for, defaults, undo, empty and error states, accessibility (labels, 44px targets, contrast) and phone layout. |
| **Financial-values expert** | Brings behavioural finance and values-based planning. Checks that the app reflects what the user values, not only what they spend: protected "what matters" spending, guilt-free fun money, judgement-free language, and how the values quiz (`/values`, `money-profile.ts`, `nonNegotiable`) should rank suggestions and proposed cuts. Flags anything that feels restrictive enough to make people quit. |
| **Accountant (CPA)** | Makes sure the numbers are right. Every figure on every screen has to reconcile: monthly vs per-pay conversions, totals that add up to pay, nothing counted twice (transfers, refunds, shared and joint spending, a transaction counted in two buckets), rounding, and the same number shown everywhere. Checks the key figures against the saved real-data gate results, recomputes only the figures the change touches, and lists each mismatch with its source. |
| **Australian tax expert** | Checks the ATO side. Covers take-home pay (tax brackets for the financial year, Medicare levy and surcharge, HELP/HECS repayments), the super guarantee rate and salary sacrifice (concessional caps), private health rebate, deductions worth tracking (work-related, donations), and tax on side income or interest. Cites ato.gov.au and marks anything that changes by financial year. |
| **Australian government-policy expert** | Checks the policy and consumer-protection side. Covers ASIC/ASFA guidance (Moneysmart), BNPL and credit rules, Centrelink and other payments if relevant, super rules (preservation, First Home Super Saver), the First Home Guarantee and state first-home grants or stamp-duty concessions, and how to word general information without straying into personal advice. Cites official .gov.au sources. |
| **Australian economics expert** | Checks the assumptions. Covers RBA cash rate and where savings and loan rates are heading, CPI inflation and wage growth (ABS), rents and house prices, and whether projections, return rates, inflation and "real dollars" figures are sensible for Australia now. Cites RBA/ABS and gives a range, not a forecast. |
| **Clean code and architecture reviewer** | Checks the code and its tests. Was it written test-first, and do the tests cover the important failure modes? Can a product manager read each test and follow it? Are tests and code DRY and simple (KISS)? Is maths kept in pure, tested modules apart from data loading and UI? Are names clear, is logic duplicated, does string parsing stand in for structured data, and are rates or other changeable values hard-coded? |

**Every user-flow design review includes the design lead and the UI/UX expert, plus every expert whose topic the flow touches.** For example, numbers on screen bring in the accountant, money choices the budgeting and wealth experts, wording the values expert, and banks, logins, advice or privacy the policy expert. Run this review on the Claude Design boards before anything is built, as Tim asked on 2026-11-16, and start reviewer reports with `**🧭 [acknowledging-user-flow] 🎨**` after the code-quality line. In replies to Tim, follow that tag on the same line with the experts in use, e.g. `**🧭 [acknowledging-user-flow] 🎨** Experts: design lead, UI/UX, accountant, policy`.

**Every code review includes the clean code and architecture reviewer and the accountant**, alongside the reviewers whose topic it touches. Tim asked for this on 2026-11-14: tests matter more than the code, and every change is test-driven.

Put domain facts the reviewers need in the review pack, such as the user's category spend, accounts, or research files from the scratchpad (for example `bank-capabilities.md`). Don't let five reviewers re-derive the same facts.

## Merging

1. Wait for every reviewer's task notification. Never predict a result that hasn't arrived.
2. Put what all or most reviewers agree on first. Then list real disagreements as decisions, with your recommendation.
3. Write one proposal: target layout or design changes, what gets cut, what's added, suggested order, and the open decisions.
4. Show the proposal to the user and get their agreement before any large removal or build. Small, clearly agreed fixes can go ahead.
5. When the panel validates a Claude Design canvas, revise the artboards first and build after that.
6. One panel round per design and one per finished build. After fixes, re-run only the reviewers who raised a must-fix, with just the changed part in their pack.
