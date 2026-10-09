## Summary of Changes

A clear, concise summary of what this pull request changes and why.

---

## Related Issue(s)

Closes #
Fixes #

---

## Type of Change

- [ ] `feat`: A new feature or enhancement
- [ ] `fix`: A bug fix
- [ ] `docs`: Documentation updates or additions
- [ ] `refactor`: Code refactoring without changing functionality
- [ ] `test`: New or modified tests
- [ ] `perf`: Performance improvements
- [ ] `chore`: Build tooling, dependency updates, or CI maintenance

---

## Component(s) Affected

- [ ] Smart Contract (`contracts/quiza`)
- [ ] Backend Fastify API (`apps/api`)
- [ ] Frontend Web UI (`src/`)
- [ ] Documentation (`docs/`, `*.md`)
- [ ] CI/CD & Tooling (`.github/`, `scripts/`)

---

## Verification & Testing Performed

Describe the testing performed to ensure these changes function as intended:

- [ ] **Contract Tests**: `cd contracts/quiza && cargo test` passes.
- [ ] **Contract Linter**: `cd contracts/quiza && cargo clippy -- -D warnings` passes.
- [ ] **API Tests**: `npm --prefix apps/api test` passes.
- [ ] **Production Build**: `npm run build` succeeds without errors.
- [ ] **Frontend Linter**: `npm run lint` reports zero errors.
- [ ] **Manual Testing**: Describe testnet or browser steps executed.

---

## Security & Invariant Checklist

- [ ] **Accounting Invariant**: Does this change preserve `contract_balance == pool + locked + owed`?
- [ ] **No Secrets Exposed**: Confirmed no `.env`, private keys (`S...`), or secrets are committed.
- [ ] **Authorization Checked**: Are all mutating contract/API endpoints protected by `.require_auth()` or session tokens?
- [ ] **Checked Math**: All arithmetic operations use checked methods (`checked_add`, `checked_mul`, etc.).

---

## Contributor Checklist

- [ ] My code adheres to the project's [Coding Standards](docs/coding-standards.md).
- [ ] I have read and agreed to the [Code of Conduct](CODE_OF_CONDUCT.md).
- [ ] I have added appropriate tests covering new functionality or bug fixes.
- [ ] I have updated relevant documentation in `docs/` and `README.md`.
- [ ] My commit messages follow the [Conventional Commits](CONTRIBUTING.md#conventional-commits) format.
