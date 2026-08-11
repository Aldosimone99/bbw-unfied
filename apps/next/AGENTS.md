# AI Instructions

This repository uses Kiro Steering Files.

The source of truth for the project architecture is:

../../.kiro/steering/

Before implementing any feature you MUST read the root `AGENTS.md` and:

- 00-product.md
- 01-architecture.md
- 02-domain-model.md
- 03-database.md
- 04-auth-and-permissions.md
- 05-security.md
- 06-coding-standards.md
- 07-testing.md
- 08-ui.md
- 09-definition-of-done.md
- 10-api.md
- 11-folder-structure.md
- 12-ai-rules.md
- 13-app-design-system.md
- 14-monorepo-integration.md

If a request conflicts with these files,
stop and explain the conflict before writing code.

Never ignore the root steering files, and never create a second steering tree.
Frontend-specific work must also respect the backend boundary described in
`14-monorepo-integration.md`: the browser uses `/api/backend/*`, while
authorization and operational rules remain server-side.

Registration stays account-first: do not add account type, clinic or role
selection to the initial form. Collect that context after login in onboarding.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
