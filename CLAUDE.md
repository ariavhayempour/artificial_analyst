# Artificial Analyst (Next.js + Vercel Web App)

<!-- Keep this file concise. Details in docs/claude/ -->

## Tech Stack

- Language: TypeScript (strict mode) in `web/`; Python 3 in `quant-ai/` (legacy)
- Framework: Next.js 16 (App Router, React 19) with the Vercel AI SDK
- Runtime: Node 20+
- Package manager: npm (lockfile: `web/package-lock.json`)
- Test runner: Vitest (`web/`), pytest (`quant-ai/`)
- Data / auth: Supabase (SSR client, RLS-backed); market data via Polygon
- Model provider: Anthropic Claude via `@ai-sdk/anthropic`
- Hosting / CI: Vercel (GitHub → Vercel auto-deploy on `main`)
- Key dirs: `web/app/`, `web/app/api/`, `web/lib/`, `web/components/`, `web/test/`

## Purpose

- Artificial Analyst — AI financial analysis and stock prediction
- Multi-user, portfolio-aware quant analyst: positions with live P&L, realized
  gains and trade history, and a portfolio-aware Claude agent
- `web/` is the live app; `quant-ai/` is the original Streamlit implementation,
  retained for reference and retired after production parity

## Development Workflow

All commands run from `web/`. First time: `npm install`.

```bash
# Build/Run
npm run dev           # Dev server (http://localhost:3000)
npm run build         # next build (the gate: must exit 0, zero TS errors)
npm start             # Serve the production build locally

# Test (run before PR)
npm test              # Vitest

# Quality
npm run lint          # ESLint (eslint-config-next)
```

Legacy Streamlit app (`quant-ai/`): `pytest` for tests, `streamlit run app.py`
to serve. Do not add features here — it is being retired.

## Code Style

- TypeScript strict mode, no `any` in committed code; explicit types on public boundaries
- 2-space indent, single quotes, trailing commas
- kebab-case filenames, one component/route per file
- Route handlers return `Response`/`NextResponse` with explicit status +
  content-type; mark server-only modules with `server-only`
- Never trust client input on a route boundary — validate with `zod` and let RLS
  be the second line of defense, not the only one
- Secrets (Supabase service keys, Polygon, Anthropic) stay in environment
  variables and never reach a client component
- Comments: default to one concise line for a non-obvious why; push anything longer
  into `docs/claude/` (see rule 2). No multi-paragraph doc-comment essays, no
  restating what the code does, no comment rot
- Ask before adding any dependency, changing the package manager, adding a UI
  framework or component library beyond the existing shadcn/Base UI setup,
  adding `vercel.json` overrides, or introducing environment variables or secrets

## Documentation

<!-- Claude reads these when relevant -->

- `docs/claude/` - all project documentation (architecture, decisions, structure)

## Working Rules

Read and follow all of them.

### 1. Read this file first

Always read this `CLAUDE.md` at the start of every session, and again whenever
context is cleared. Understand the guidelines below and follow them throughout
the session.

### 2. Documentation lives in `docs/claude/`

All project documentation belongs in Markdown files under `docs/claude/`. Keep
code comments to a single concise line — enough to clarify intent, never more.
Push anything longer into the docs.

### 3. Review the docs before acting

Before planning or building anything, review the relevant files in
`docs/claude/` to understand existing dependencies, decisions, and structure.
Let the docs inform the plan.

### 4. Never commit, stage, or push

Do not run `git add`, `git commit`, or `git push` — ever, unless I give explicit
one-time permission for a specific action. When a task is complete, tell me so
and stop; I will commit manually.

### 5. Planning artifacts stay untracked

All planning artifacts — the `tasks/` folder, `SPEC.md`, `plan.md`, `todo.md` —
always remain untracked. Never stage or commit them. They are enforced by
`.gitignore`; never remove those entries or stage past them with `git add -f`.

### 6. No co-author tags in commits

When you are granted one-time permission to commit under rule 4, never include
co-author trailers (e.g. `Co-Authored-By:`) in the commit message.

### 7. Code comments describe the code, not the plan

Code-file comments must never reference planning-artifact identifiers — story
numbers, task numbers (`T5`), or similar. Those are mutable and get reorganized;
a comment pinned to one reads as stale the moment it changes. Explain the
technical reason instead: functionality, behavior, constraints, or dependencies.
(Cross-references between user-story docs may cite other story numbers freely —
this rule is about code comments only.)

## Common Mistakes

<!-- Add entries when Claude does something wrong -->

- Run `npm run build` and `npm test` from `web/` before declaring a task done
- Add code-file comments longer than one line into a respective `docs/claude` file
- Commit messages must not cite task numbers — rule 7 applies to commit subjects too
