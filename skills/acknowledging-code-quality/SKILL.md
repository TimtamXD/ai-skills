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
2. **Red.** Write the failing tests first. Run them and confirm they fail for the right reason.
3. **Green.** Write the minimum code that makes them pass.
4. **Refactor.** Remove duplication, improve names and split responsibilities. Tests stay green throughout.
5. **Verify.** Run the full suite, linter, type checker and duplication check, then the wcgw review (section 9), before calling it done. Never report work as complete with failing or skipped tests.

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

- **Code explains itself; comments are the exception.**
  - Good names, separated responsibilities and simple code should make comments unnecessary.
  - Default to no comment: no headers restating a name, no section banners, no narration.
  - Comment only what is genuinely unexplainable without one (a non-obvious why, an outside constraint, a workaround with a link), in one short line.
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

Before calling a change done, and whenever someone asks for a wcgw review of a PR, branch or file, run the `wcgw` agent ([agents/wcgw.md](../../agents/wcgw.md)), one per PR, scoped to the change's own diff against its base. It reads other branches with `git show origin/<head>:<path>`, and doesn't check out branches or add worktrees. A fresh agent hasn't seen your reasoning, so it reads the change the way a reviewer will.

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
- [ ] Tests written first and seen failing
- [ ] Unit, integration, end-to-end and (for UI) Playwright coverage as appropriate
- [ ] A non-programmer could read the test names and bodies and follow them
- [ ] Full suite, linter, type checker and duplication check all pass, locally
- [ ] wcgw agent run on the diff; every breakage proven by a failing test, then fixed
- [ ] Full-word names, types apart from logic, short files and functions
- [ ] Dependencies point inward; no business logic in adapters
- [ ] No redundant comments

When reporting back, open with the tag. Then say what the tests cover (behaviours and failure modes), then the code change, then what the wcgw review found and what was done about each finding, then anything that wasn't test-first or was skipped.
