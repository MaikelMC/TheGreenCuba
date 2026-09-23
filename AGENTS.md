# AGENTS.md – Guidelines for Agentic Coding Agents

This file provides instructions for AI coding agents (e.g., OpenCode, Copilot, Cursor) working in the **La Verde** repository. It covers project setup, common commands, code style, testing, linting, and best practices.

---

## 1. Project Overview

La Verde is a Next.js 15 (App Router) platform for discovering places in Cuba with AI‑powered natural‑language search. Stack: Next.js (React 19), Tailwind CSS + design tokens (DESIGN.md), TypeScript strict, Zustand, Drizzle ORM, Vercel AI SDK, Clerk, Radix UI, Lucide, Sonner, Motion.

Source code lives in `/src`:

- `app/` – App Router pages & layouts
- `components/` – Shared UI components
- `hooks/` – Custom React hooks
- `lib/` – Utilities, API clients, DB helpers
- `store/` – Zustand stores
- `types/` – Global TypeScript types
- `providers/` – Context providers (theme, auth, etc.)

---

## 2. Development Commands

Run from repository root.

| Command               | Purpose                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `npm run dev`         | Start Next.js dev server (http://localhost:3000)                         |
| `npm run build`       | Production build                                                         |
| `npm run start`       | Start production server                                                  |
| `npm run lint`        | Run ESLint via Next.js (`next lint`)                                     |
| `npm run typecheck`   | Type‑check only (`tsc --noEmit`)                                         |
| `npm run format`      | Format with Prettier (`prettier --write \"src/**/*.{ts,tsx,css,json}\"`) |
| `npm run db:generate` | Generate Drizzle migrations                                              |
| `npm run db:push`     | Push schema changes                                                      |
| `npm run db:migrate`  | Apply migrations                                                         |
| `npm run db:studio`   | Launch Drizzle Studio                                                    |
| `npm run db:seed`     | Seed database with sample data                                           |

### Running a Single Test

No test framework is configured yet. If you add Vitest (recommended) or Jest:

```bash
# Vitest
npx vitest run src/lib/utils.test.ts -t "should return formatted date"

# Jest
npm test -- src/lib/utils.test.ts -t "should return formatted date"
```

Otherwise rely on manual verification and type‑checking.

---

## 3. Code Style Guidelines

### 3.1 TypeScript Strictness

- `tsconfig.json` has `"strict": true`, `"strictNullChecks": true`, `"noUncheckedIndexedAccess": true`.
- Use explicit types for parameters and returns.
- Prefer `satisfies` to validate props against design tokens.
- Avoid `any`; if unavoidable, add a comment explaining why.

### 3.2 Imports & Module Resolution

- Use absolute `@/` alias: `import { Button } from "@/components/ui/button";`
- Import order:
  1. Framework/library (`next`, `react`, `ai`, …)
  2. Third‑party (`zod`, `lucide-react`, …)
  3. Internal aliases (`@/components`, `@/lib`, `@/hooks`, …)
  4. Local relative (`./utils`) when needed.
- Blank line between groups.

### 3.3 Naming Conventions

- Components & exportable functions: `PascalCase` (e.g., `ProductCard.tsx`)
- Hooks: `use` + `PascalCase` (`useSearch`, `useAuth`)
- Constants & enum values: `UPPER_SNAKE_CASE` (`MAX_RESULTS`, `Status.PENDING`)
- Variables & function args: `camelCase`
- Files:
  - Components: `PascalCase.tsx`
  - Hooks: `camelCase.ts`
  - Utilities: `camelCase.ts`
  - Types: `PascalCase.ts` (exported type) or `camelCase.ts` (utility)

### 3.4 Formatting

- Prettier with `prettier-plugin-tailwindcss` sorts Tailwind classes.
- Run `npm run format` before committing.
- Keep class lists short; extract to `cn()` (`clsx` + `tailwind-merge`) when needed.

### 3.5 Error Handling

- Server actions/API routes: `try/catch`, return `{ error: string }` or throw `Response.error()`.
- Client: use React Error Boundaries where appropriate; otherwise show `sonner` toast.
- Validate request data with `zod` (`schema.safeParse()`).
- Async utilities: return `Promise<Result<T, E>>` where `Result` is `{ success: true; data: T } | { success: false; error: E }`.

### 3.6 Comments & Documentation

- Exported functions/components: JSDoc describing params, return, side effects.
- Internal functions: concise inline comment only when intent unclear.
- TODO/FIXME: `// TODO:` or `// FIXME:` with ticket reference if possible.

### 3.7 Testing Practices (when added)

- Unit tests for pure utilities (`lib/`, `hooks/`).
- Component tests with React Testing Library; avoid testing implementation details.
- Mock external APIs (Clerk, AI SDK, DB) with `jest.mock()` or `vi.mock()`.
- Target 80%+ coverage on critical paths (auth, search, transactions).

### 3.8 Git & Commit Guidelines

- Branch names: `feature/<short>`, `bugfix/<issue>`, `chore/<task>`.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`); subject ≤ 50 chars.
- PRs: brief summary, related issue number, screenshots for UI changes.

---

## 4. Linting & Formatting Tools

- **ESLint**: `next lint`; run `npm run lint`; fix with `npm run lint -- --fix`.
- **Prettier**: `npm run format`. Editor integration (format‑on‑save) recommended.
- **Tailwind CSS Prettier Plugin**: ensures consistent class ordering; no extra config.

---

## 5. Existing Agentic‑Tool Rules

- No `.cursor` directory or `.cursorrules`.
- No `.github/copilot-instructions.md`.
- Opencode skills are present in `.opencode`; respect them.

---

## 6. Design System Reference

All visual standards (colors, typography, spacing, radii, shadows, transitions) are in `DESIGN.md` as CSS custom properties. Use tokens like `var(--lv-green-500)`, `var(--fs-body)`, `var(--gap-md)` instead of hard‑coded values.

---

## 7. Adding a Test Framework (Recommendation)

1. Install Vitest: `npm i -D vitest @vitest/coverage-v8 happy-dom`
2. Add `vitest.config.ts`:
   ```ts
   import { defineConfig } from "vitest/config";
   export default defineConfig({
     test: {
       globals: true,
       environment: "happy-dom",
       setupFiles: "./src/test/setup.ts",
       coverage: { provider: "v8", reporter: ["text", "json", "html"] },
     },
   });
   ```
3. Add npm script: `"test": "vitest run"`.
4. Create test files (`*.test.ts`) alongside source or in `__tests__`.

---

## 8. Reminder for Agents

- Prioritize type safety and design‑token usage over custom CSS.
- Keep components small, reusable; compose from Radix primitives.
- Validate inputs with `zod` in server actions/API routes; handle errors gracefully.
- Run `npm run lint && npm run typecheck && npm run format` before submitting changes.

---

_This document targets ~150 lines. Adjust as the project evolves._

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
