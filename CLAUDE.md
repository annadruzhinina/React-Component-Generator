# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # First-time setup: install deps, generate Prisma client, run migrations
npm run dev          # Start dev server at http://localhost:3000 (Node compat mode)
npm run dev:daemon   # Background dev server with Turbopack (logs to logs.txt)
npm run build        # Production build
npm run lint         # Run ESLint
npm run test         # Run all tests with Vitest
npm run db:reset     # Force-reset the SQLite database
```

All Next.js commands require `node-compat.cjs` (a Node.js polyfill injected via `NODE_OPTIONS`).

Run a single test file:
```bash
npx vitest run src/lib/__tests__/file-system.test.ts
```

## Architecture

**UIGen** is a Next.js 15 app that generates React components from natural language prompts using Claude AI, with live preview in an iframe.

### Request Flow

1. User types prompt → `MessageInput` → POST `/api/chat`
2. `/api/chat/route.ts` calls Claude (model: `claude-haiku-4-5`) with streaming + tools (maxSteps: 40 real, 4 mock)
3. Claude uses `str_replace_editor` (create/edit files) and `file_manager` (rename/delete) tools
4. Tool calls update `FileSystemContext` (in-memory virtual FS, no disk writes)
5. `PreviewFrame` picks up FS changes → Babel transforms JSX → renders in sandboxed iframe

### Key Abstractions

**Virtual File System** (`src/lib/file-system.ts`): In-memory tree with Map-based node storage. Serializes to JSON for database persistence. All file operations go through this — nothing writes to disk during generation.

**JSX Transformer** (`src/lib/transform/jsx-transformer.ts`): Babel standalone transforms JSX to ES5, then an import map resolves `react`, `react-dom`, and `@/` aliases to esm.sh CDN URLs for iframe rendering. CSS imports are stripped and collected separately. Missing local imports get placeholder stub modules. Syntax errors are caught per-file and displayed inline in the preview iframe with a styled error UI showing file path and line numbers.

**Language Model Provider** (`src/lib/provider.ts`): Returns real Claude model if `ANTHROPIC_API_KEY` is set, otherwise falls back to `MockLanguageModel` that generates a static component — so the app works without an API key.

**Server Actions** (`src/actions/index.ts`): `signUp`, `signIn`, `signOut`, `getUser`, `createProject`, `getProject`, `getProjects`.

### State Management

- `ChatProvider` (`src/lib/contexts/chat-context.tsx`): Chat messages, input state, streaming
- `FileSystemProvider` (`src/lib/contexts/file-system-context.tsx`): Virtual FS state, file CRUD

Both contexts live in `main-content.tsx` wrapping the three-panel layout: chat | preview | code editor.

### Auth

JWT (HS256, 7-day expiry) via `jose`, stored as `auth-token` httpOnly cookie. Anonymous users get sessionStorage-tracked sessions via `anon-work-tracker.ts` — work is preserved for redirect to sign-in. Middleware in `src/middleware.ts` protects `/api/projects` and `/api/filesystem`.

Project data is only persisted to the database for authenticated users with a `projectId`. Anonymous sessions are ephemeral. The home page redirects authenticated users to their first project.

### Database

Prisma + SQLite (`prisma/dev.db`). Two models: `User` (email/password) and `Project` (stores `messages` and `data` as JSON strings). Generated client lives in `src/generated/prisma/`. Run `npx prisma studio` to inspect.

### Generated components

Claude always produces a root `/App.jsx` entry point using `@/` import aliases for cross-file references. The preview auto-detects the entry point in order: `App.jsx` → `App.tsx` → `index.jsx` → `index.tsx`. Tailwind CSS v4 is available in preview via CDN (`cdn.tailwindcss.com`).

## Code Style

Use comments sparingly. Only comment complex or non-obvious logic.

## Environment

`ANTHROPIC_API_KEY` in `.env` enables real AI generation. Without it, the mock provider runs automatically.
