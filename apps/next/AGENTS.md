# AI Instructions

This repository uses Kiro Steering Files.

The source of truth for the project architecture is:

../../.kiro/steering/

Before implementing any feature you MUST read:

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

Never ignore the root steering files. Frontend-specific work must also respect
the backend boundary described in `14-monorepo-integration.md`.
