# Full-Platform Product Source of Truth

This folder supersedes the earlier replenishment-only blueprint and is the approved product source of truth for the commercial Shopify inventory platform.

## Read in this order

1. `01_EXECUTIVE_PRODUCT_DIRECTION.md`
2. `02_FULL_STOCKY_PARITY_PRD.md`
3. `03_COMMUNITY_PAIN_POINTS_AND_OPPORTUNITIES.md`
4. `04_ARCHITECTURE_AND_BFS_PLAN.md`
5. `05_CURRENT_REPOSITORY_GAP_AUDIT.md`
6. `06_ROADMAP_AND_RELEASE_GATES.md`
7. `09_FEATURE_MATRIX.md`
8. `10_RESEARCH_SOURCES.md`

## Feature matrices

- `feature_matrix.csv` is the machine-readable backlog for coding agents and project tooling.
- `Stocky_Full_Platform_Feature_Matrix.xlsx` is the formatted project-management view.
- `09_FEATURE_MATRIX.md` is the human-readable repository reference.

## Agent prompts

Cursor and Claude Code prompt files are supplied separately. They are not product requirements and should not be treated as source-of-truth documents.

## Important

- The repository was inspected through the connected GitHub app.
- Code commands were not run in the ChatGPT environment; Cursor and Claude Code must execute and record lint, type-check, test, build, Prisma, Shopify configuration, and GraphQL validation results.
- Cursor should execute Phase 0 only before opening its alignment PR.
- Claude Code should independently review Cursor's Phase-0 PR.
- Do not use the public name `Stocky`, `Stocky++`, or branding that could imply a first-party Shopify product.
- No business rule may change without an approved decision record.

Mapped feature count: **132**
