---
name: acknowledging-code-quality
description: Use for ANY coding request (new features, bug fixes, refactors, scripts) in any repo, and when asked for a wcgw review of a PR, branch or file. Test-first TDD, tests a product manager can read, clean code and clean architecture, a wcgw review of what will go wrong before work is called done, and every reply opens with the [acknowledging-code-quality] line so the person can see the rules are being followed.
---

# Acknowledging code quality

Tests matter more than the code. Code is written to make tests pass; the tests are the specification.

## Open every reply with the tag

Start every reply with this exact line, in bold, emojis included:

`**✅ [acknowledging-code-quality] 🧪**`

The line confirms that the rules below were followed. Only use it when that's true. If a step wasn't test-first, a check was skipped, or a test was changed, say so in the same reply. Never let the tag claim more than happened.

## 1. Workflow: TDD, every time

For every change, however small:

1. **List what could go wrong.** Before writing anything, list the failure modes; each becomes a test. Consider:
   - empty or null input
   - boundaries (0, 1, max)
   - invalid types and duplicates
   - timezones and locales
   - network failure, timeouts and partial failure
   - concurrency and permissions
   - large inputs
2. **Red.** Write the failing tests first. Run only those test files and confirm they fail for the right reason.
3. **Green.** Write the minimum code that makes them pass. Re-run only the affected test files.
4. **Refactor.** Remove duplication, improve names and split responsibilities. Tests stay green throughout (affected files only).
5. **Verify.** Run the full suite, linter, type checker and duplication check once, when the change is finished, then the wcgw review (section 9), before calling it done. Never report work as complete with failing or skipped tests.

**Real TDD, no faking.** A test written after its code, or one that passes the first time it runs, proves nothing.
- Run every new test before its code exists, and see it fail for the right reason: the missing behaviour, not a typo, a missing import or a broken setup.
- A test that passes on its first run is suspect. Break the code on purpose (or check out the code without the change) and confirm the test catches it, or rewrite the test until it can fail.
- Never write the code and its test together and call it test-first.
- If a slip happens, say so plainly, then redo it properly: take the code out, watch the test fail, put the code back.

A bug fix starts with a test that reproduces the bug. Every mistake becomes a rule plus a regression test, so that class of mistake can't come back.

## 2. Test layers

Use every layer the project needs, in pyramid proportions: many unit, fewer integration, few end-to-end.

- **Unit:** one behaviour of one unit, with no I/O, so it runs fast. Mock only at architectural boundaries (network, DB, clock, filesystem), never internal collaborators.
- **Integration:** real modules working together, with a real (or in-memory) DB, filesystem and HTTP layer.
- **End-to-end:** a full user journey through the running system.
- **Playwright:** for anything with a UI.
  - Cover user flows, validation, and error, empty and loading states.
  - Use role, label or text locators, never brittle CSS selectors.
  - No fixed sleeps; wait on conditions.

If a project lacks a layer it needs, set it up rather than skip it. Run the suites locally before every merge; don't spend CI minutes on full suites.

## 2a. Keep checks cheap

Every line a command prints is read again on every later turn, so noisy checks burn the usage limit. The rules stay; only the cost goes.

- **Quiet output, failures only.** Send every test, build and gate run to a log file and print a summary: the pass/fail counts plus at most 30 failure lines (`> run.log 2>&1; grep -E "FAIL|×|✘|Error" run.log | head -30; tail -3 run.log`). Use quiet reporters (`vitest --reporter=dot`, `playwright --reporter=dot`). Print a build's exit code and its errors, never the route table.
- **Never read a whole log.** No `cat` of a log, a test output or a saved tool result. Grep it, or read the last 30 lines. The same goes for an "output too large" file: grep it for what you need.
- **Run the narrowest check that answers the question.** While working, run the one or two test files you are changing. Run the full suite, build and Playwright once before merge, and again only if code changed after that run. If a run fails, re-run just the failing files until they pass, then the full suite once more.
- **Heavy gates run once per merge.** Real-data gates, old-vs-new comparisons and mutation runs are proof for the merge, not a loop. Run each once on the finished change (one clock and seed while developing, the full time-zone and seed sweep once at the end). Re-run only when the code they cover changed, and save the one-line result to a file so you, reviewers and the report reuse it instead of recomputing.
- **One setup step per run.** Generate clients (for example `prisma generate`) and push schemas once per check script, not in every sub-script.
- **Read diffs and files in pieces.** Start with `git diff --stat`, then read only the files or hunks you need (`git diff -- <file>`, `sed -n 120,200p`). Don't read a file over 300 lines in full; grep for the function first.
- **Prefer text over pictures.** In a browser, read the page as text (`read_page`, `get_page_text`). Take a screenshot only to check layout, one per width, at half scale.
- **Run the slow finishing steps side by side.** When the change is finished, start the final quiet check run in the background, and start the wcgw review and any expert reviewers in the same message. They read the diff, not the check output, so nobody waits on anybody.
- **Short status updates.** A progress note is one or two lines. The final report leads with the result and stays under about 150 words; it names what the tests cover, not every test.
- **Lean subagents.** Build and verify in the main session unless asked otherwise. A subagent gets a short brief with paths, not the conversation, runs on Sonnet (Haiku for reviews) and stops at about 60 tool calls. A new, unrelated task goes to a new thread or session.
- **Reuse, don't recompute.** When a number, a check result or a research fact already exists in a file or earlier message, cite it. Recompute only what the change touched.

## 3. Tests a product manager can read

- **Plain-English names:** each test's name says the behaviour it protects, e.g. `rejects a booking that ends before it starts`, not `test_validate_2`.
- **Arrange / Act / Assert:** structure every test this way (Given / When / Then), with the steps visibly separated.
- **One behaviour per test:** prefer one logical assertion.
- **Domain words and real values:** use realistic, meaningful values and worked examples ("$1,000 a month over 12 months is $12,000"), not restated formulas or `foo`, `x`, `123`.
- **Hide the noise:** put setup in well-named builders, fixtures and helpers, so the test body reads like a story.
- **No logic in tests:** no loops, conditionals or try/catch. Use parameterised tests for tables of cases.
- **Public behaviour only:** test through public interfaces, not private internals.
- **Independent and deterministic:** no order dependence; inject the clock and randomness.
- **Never weaken, skip or delete a test to make a change pass.** Fix the code, or explain in the commit why the test was wrong.

## 4. Don't repeat yourself; keep it simple

- **In code:** each piece of knowledge has one home. Extract on the second occurrence when it's the same concept, not merely similar-looking text. Constants that change (rates, thresholds, days per month) live in one place.
- **In tests:** DRY the setup (builders, fixtures, factories, page objects), but keep each test's intent explicit.
- **Automated duplication check:** add a duplication detector to the lint step and keep it passing.

## 5. Clean code

- **No comments: names do the explaining.**
  - No doc comments (`/** */`, docstrings) or inline comments. Business-like names for variables, functions, data classes and DB tables and columns carry the meaning instead.
  - If a comment seems needed, rename or split until it isn't. `/** The contrast ratio between an element's border and what it sits on, see-through layers blended in. */` goes; `borderContrastAgainstBlendedBackground(...)` says it.
  - The only exception is what no name can say (an outside constraint, a workaround with a link), in one short line starting `why:`. Tool directives (`eslint-disable`, `@ts-expect-error`) are fine.
  - Enforce it: add a lint or checker rule that fails on any other comment, with existing ones on a shrink-only list.
- **Names are full, readable words.**
  - Write `const recovery = computeRecovery(...)`, never `const r = ...`.
  - No single letters or abbreviations (`t`, `tx`, `amt`, `idx`, `acc`, `err`), including loop variables, callback parameters and destructured values.
  - Plain short words such as `id` are fine, and so are `x`/`y` for coordinates.
  - Booleans read as questions: `isExpired`, `hasAccess`.
- **Business names first:** use the domain's own words, so anyone who knows the business recognises every name.
- **Types and classes live in their own files, apart from logic.**
  - Interfaces, type aliases and enums go in a sibling types file (e.g. `recovery.ts` and `recovery.types.ts`).
  - Each class gets its own file.
  - A file holds either logic or type declarations, never both.
- **Short files and short functions:** files under about 300 lines, functions (UI components included) under about 50. Split by responsibility.
- **Single responsibility:** every module and function has one reason to change. Command–query separation. No hidden side effects.
- **Errors:** fail fast with specific errors and validate at boundaries. No swallowed exceptions.
- **No magic numbers or strings:** use named constants.
- **No dead or commented-out code.**
- **Shared UI components, DRY styling.** Build screens from shared, reusable UI components (`Card`, `MoneyFigure`, …) on shared theme tokens for colour, spacing and type, keeping the project's own styling system (e.g. Tailwind). No inline `style={{}}` objects and no repeated class strings or markup: anything used twice becomes one shared component. Enforce it with a lint rule.
- **Structure the data:** use structured data, not string parsing standing in for it.
- **Enforce with tools:** where a project can enforce these rules with a lint rule or a test, add one.

## 6. Clean architecture

- Dependencies point inward: domain ← use cases ← adapters (DB, HTTP, UI) ← frameworks. Domain code imports nothing from frameworks or I/O.
- Keep maths and business rules in pure, tested modules, apart from data loading and UI.
- Files live where they make sense: group code by business area, in a folder structure that reads like a map of the app. No grab-bag `utils` folders.
- When several screens show the same figure, compute it once and have them all read it, with a test that they agree.

## 7. OOP, when the codebase is OOP

- Follow SOLID and favour composition over inheritance.
- Tell, don't ask; keep interfaces small; inject dependencies.
- In functional or procedural codebases, follow that paradigm's idioms instead.

## 8. Refactoring existing code

1. Add characterisation tests that pin the current behaviour.
2. Refactor in small steps, running the tests after each one.
3. Never change behaviour and structure in the same step.
4. Commit in small, reviewable increments.

## 9. wcgw review: what will go wrong?

Before calling a change done, and whenever someone asks for a wcgw review of a PR, branch or file, run the `wcgw` agent ([agents/wcgw.md](../../agents/wcgw.md)), once per PR on the finished change, scoped to the change's own diff against its base. After fixing its findings, don't start a fresh full review: the new failing-then-passing tests prove the fixes. It reads other branches with `git show origin/<head>:<path>`, and doesn't check out branches or add worktrees. A fresh agent hasn't seen your reasoning, so it reads the change the way a reviewer will.

It only reads, reports only breakages it can prove from the spec, a test or a call site, and never suggests a fix. Finding nothing is a valid result.

Prove each breakage before acting on it:

1. If it's unsure whether it bites, such as a `Note:` that turns on data, check production data first.
2. Write a unit test that fails on the change's head.
3. On your own change, keep the test and fix the code (section 1). On someone else's PR, put the test and its failure output in the comment, then delete the test.
4. Skip the test only when the bug is obvious from reading the code.

A finding posted to a PR ends with `--wcgw` on its own line. Post nothing unless the person asks.

If the agent isn't installed or subagents aren't available, follow agents/wcgw.md yourself and say so.

## 10. Definition of done

- [ ] Failure modes listed, and each covered by a test
- [ ] Tests written first and seen failing for the right reason; none faked or written after the code
- [ ] Unit, integration, end-to-end and (for UI) Playwright coverage as appropriate
- [ ] A non-programmer could read the test names and bodies and follow them
- [ ] Full suite, linter, type checker and duplication check all pass, locally, in one final quiet run (section 2a)
- [ ] wcgw agent run on the diff; every breakage proven by a failing test, then fixed
- [ ] Full-word names, types apart from logic, short files and functions
- [ ] UI built from shared components on theme tokens; no inline styles or repeated styling
- [ ] Dependencies point inward; no business logic in adapters
- [ ] No comments beyond `why:` lines and tool directives; the no-comment check passes

When reporting back, open with the tag. Then say what the tests cover (behaviours and failure modes), then the code change, then what the wcgw review found and what was done about each finding, then anything that wasn't test-first or was skipped.
