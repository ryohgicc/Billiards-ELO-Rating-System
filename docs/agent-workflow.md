# Reusable Agent Workflow

This document is a reusable operating guide for AI agents and humans working in a software repository. Copy it into other projects as a baseline, then customize the project-specific commands, data model, deployment target, and risk areas.

## How To Reuse

When adding this workflow to another project:
- Replace command examples with the project's real install, test, lint, build, migration, and deploy commands.
- Add project-specific architecture, data model, and deployment notes in that project's `AGENTS.md`.
- Keep the workflow, git safety, verification, documentation, and handoff rules unless the project has a better local convention.
- Remove irrelevant sections instead of leaving stale instructions behind.

## Work Modes

Classify the task before changing files.

Small change:
- Examples: copy edits, isolated CSS adjustments, simple UI polish, documentation-only updates.
- Verify with the most relevant targeted check.

Medium change:
- Examples: client behavior, validation, business logic, import/export logic, API response shape without schema changes.
- Verify with relevant tests plus lint.
- Run a production build when the change affects bundling, routing, generated assets, or deploy output.

Large change:
- Examples: server behavior, database schema expectations, deployment config, authentication, persisted data migrations, cross-module refactors.
- Run the full completion gate defined by the project.
- Apply the schema safety process when database shape or persisted data expectations change.

## Agent Workflow

1. Inspect first.
   - Run the project's git status command before edits.
   - Read the relevant files before deciding on an implementation.
   - Prefer fast project search tools such as `rg` and `rg --files`.

2. Make scoped changes.
   - Follow existing project patterns.
   - Avoid unrelated refactors.
   - Do not rewrite working code just to match a personal style preference.

3. Update the contract.
   - If behavior changes, update tests or add focused coverage.
   - If user-facing behavior, setup, deployment, or operations change, update README or relevant docs.
   - If the project keeps a changelog, update it before handoff.

4. Verify.
   - Run the appropriate command set for the task risk level.
   - If a command cannot run, report why and what risk remains.

5. Handoff.
   - Summarize what changed.
   - List verification commands and results.
   - Note any follow-up work, deployment state, or migration state.

## Command Matrix Template

Each project should define a command matrix in `AGENTS.md` using this shape:

Install:

```bash
<install command>
```

Develop:

```bash
<local development command>
```

Targeted checks:

```bash
<test command>
<lint command>
<build command>
```

Full completion gate:

```bash
<test command>
<lint command>
<build command>
<deploy dry-run or packaging check>
```

Migration or schema checks:

```bash
<list pending migrations>
<apply local migrations>
<apply remote migrations when ready>
<verify no pending migrations>
```

## Schema And Migration Safety

Use this section for any project with a database, queue, object storage metadata, search index, or other persisted schema.

Rules:
- Identify schema-sensitive files and data contracts in the project-specific `AGENTS.md`.
- Before deploying code that reads new tables, columns, indexes, settings, or persisted fields, check the remote migration state.
- If any required migration is pending, apply it before or together with the deployment.
- After applying migrations, check the migration state again and confirm there is nothing left to apply.
- Do not deploy schema-dependent application code without the matching persisted schema update.
- Report migration state in the final handoff whenever schema expectations changed.

## Code Style

Universal rules:
- Keep changes small, explicit, and easy to review.
- Prefer project-local helpers and conventions over new abstractions.
- Add abstractions only when they remove real duplication or clarify a repeated concept.
- Validate inputs at the boundary where bad data enters the system.
- Keep comments short and useful; explain why when the code cannot make that obvious.
- Avoid unrelated formatting churn.

## UI Guidance

Universal rules:
- Match the existing design system before inventing new visual patterns.
- Keep common workflows fast, predictable, and accessible.
- Make mobile layouts dense enough to scan without hiding critical controls.
- Use existing design tokens, CSS variables, spacing, and component patterns.
- Prefer established icon libraries already used by the project.
- Avoid oversized decorative sections in operational tools.

## Git Safety

Assume the repository may have user or agent work in progress.

Before editing or committing:

```bash
git status -sb
```

Rules:
- Never revert unrelated changes.
- If committing, stage only files that belong to the current task.
- Do not switch branches with unrelated uncommitted work in the tree.
- Before switching branches, identify whether each modified file belongs to the current task.
- Stash, commit, or ask before moving unrelated work.
- Prefer clear merges or PRs when moving work from a feature branch to the main branch.
- If cherry-picking, inspect the commit graph before and after.
- Do not use destructive commands such as `git reset --hard` or `git checkout --` unless explicitly requested.

## Documentation And Changelog

README maintenance:
- If a project has no `README.md`, create one when making the first meaningful project change.
- If a project already has a `README.md`, keep it updated whenever setup, commands, features, deployment, data contracts, tests, or operational behavior changes.
- Match the repository's existing README style when one exists.
- When creating a new README, prefer a practical project-doc structure: project title, concise overview, feature summary, tech stack, local development, available commands, deployment notes, data or architecture notes, testing coverage, and changelog/release notes when applicable.
- Keep README content user-facing and operationally useful; avoid dumping internal reasoning or implementation trivia.

Update documentation when:
- Setup, commands, environment variables, deployment steps, or migrations change.
- User-facing behavior changes.
- API behavior or data contracts change.
- A new operational risk or recovery step is discovered.

Update the changelog when:
- Features are added.
- Behavior changes.
- Bugs are fixed.
- Tests, migrations, or deployment procedures materially change.

For documentation-only changes, a changelog entry is optional unless the documentation change describes a released behavior or operational process.

## Deployment Handoff

Before merging, pushing, or deploying:
- Fetch the remote state.
- Confirm the relationship between the local main branch, remote main branch, current branch, and commit intended for deployment.
- Do not deploy a local build while leaving the remote main branch behind unless explicitly asked for a deploy-only hotfix.
- If a deploy-only hotfix is unavoidable, state which commit is deployed and which branch still needs pushing.

Before final handoff after deployment or push, report:
- Deployed version.
- Remote branch and commit pushed.
- Whether the local worktree is clean.

## Final Response Checklist

Before handing off, confirm:
- Files changed are limited to the task.
- Relevant docs and changelog are updated or intentionally unnecessary.
- Relevant checks were run.
- Migration state is reported when schema expectations changed.
- Deployment and git state are reported when pushing or deploying occurred.
