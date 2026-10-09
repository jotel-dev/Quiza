# Contributing to Quiza

Thank you for your interest in contributing to **Quiza**! We are building open-source, non-custodial gaming infrastructure on Stellar and Soroban, and we welcome contributions from developers, technical writers, security researchers, and Web3 enthusiasts of all backgrounds.

To maintain the high engineering standards expected of infrastructure-grade software (in the tradition of projects like Kubernetes, Rust, and Stellar), please take a few moments to review these guidelines before submitting code or documentation.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Improving Documentation](#improving-documentation)
  - [Submitting Pull Requests](#submitting-pull-requests)
- [Development Environment Setup](#development-environment-setup)
  - [Prerequisites](#prerequisites)
  - [Repository Setup](#repository-setup)
  - [Running the Local Stack](#running-the-local-stack)
- [Git & Branching Workflow](#git--branching-workflow)
  - [Branch Naming](#branch-naming)
  - [Conventional Commits](#conventional-commits)
- [Coding Standards & Tooling](#coding-standards--tooling)
  - [TypeScript & Frontend](#typescript--frontend)
  - [Backend & Fastify API](#backend--fastify-api)
  - [Rust & Soroban Smart Contracts](#rust--soroban-smart-contracts)
- [Testing Requirements](#testing-requirements)
- [Pull Request Checklist](#pull-request-checklist)
- [Review Process & SLA](#review-process--sla)
- [Security Vulnerabilities](#security-vulnerabilities)

---

## Code of Conduct

All contributors and participants in the Quiza community are required to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). By contributing, you agree to foster a welcoming, inclusive, and harassment-free environment for everyone.

---

## How to Contribute

### Reporting Bugs

1. Search existing [GitHub Issues](https://github.com/jotel-dev/Quiza/issues) to ensure the bug has not already been reported.
2. If unresolved, create a new issue using the **[Bug Report Form](.github/ISSUE_TEMPLATE/bug_report.yml)**.
3. Include:
   - Clear description and minimal reproducible example.
   - Operating system, browser, and Freighter wallet version.
   - Relevant console logs or transaction hashes on Stellar Expert.
   - Expected vs. actual behavior.

### Suggesting Features

We welcome ideas for improving gameplay, developer tooling, or smart contract features!
1. Check existing issues and discussion threads.
2. Open a feature request using the **[Feature Request Form](.github/ISSUE_TEMPLATE/feature_request.yml)**.
3. Explain the problem statement, proposed solution, and architectural impact.

### Improving Documentation

Documentation improvements are always welcome! Whether correcting a typo, adding architectural diagrams, or expanding API tutorials, check the [`docs/`](docs/) directory and submit a PR directly.

---

## Development Environment Setup

### Prerequisites

| Component | Minimum Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.0.0` (LTS recommended) | Frontend & Backend runtime |
| **npm** | `>= 10.0.0` | Package management |
| **Rust & Cargo** | Stable (1.80+) | Soroban smart contract development |
| **Stellar CLI** | `>= 22.0.0` | Soroban contract build, simulate, & deployment |
| **Docker & Docker Compose** | Latest | PostgreSQL database for session & question state |
| **Freighter Wallet** | Latest browser extension | Non-custodial wallet testing on Stellar Testnet |

### Repository Setup

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/<your-username>/Quiza.git
   cd Quiza
   ```

2. **Install Root Dependencies**:
   ```bash
   npm install
   ```

3. **Install Backend Dependencies**:
   ```bash
   npm --prefix apps/api install
   ```

4. **Initialize Environment Variables**:
   ```bash
   cp .env.example .env
   ```

5. **Start PostgreSQL via Docker**:
   ```bash
   docker compose up -d
   ```

---

## Running the Local Stack

The repository includes a unified development orchestrator that runs the Fastify backend and Vite frontend concurrently with log prefixing:

```bash
# Starts API on http://localhost:3001 and Vite frontend on http://localhost:5173
npm run dev
```

Alternatively, run each service independently in separate terminals:

```bash
# Terminal 1: Backend Fastify API (port 3001)
npm --prefix apps/api run dev

# Terminal 2: Frontend Vite UI (port 5173)
npm run dev:vite
```

---

## Git & Branching Workflow

We follow a GitHub Flow branch strategy with `main` representing production-ready code.

### Branch Naming

All branches should use standard lowercase prefixes followed by a short descriptive slug:

- `feat/stellar-session-tokens` — New feature implementations
- `fix/freighter-disconnect-leak` — Bug fixes
- `docs/soroban-ttl-architecture` — Documentation updates
- `test/verifier-retry-sweeper` — Test additions and mocks
- `refactor/balance-helper-signatures` — Non-functional code cleanup
- `perf/question-bank-caching` — Performance optimizations

### Conventional Commits

We enforce the [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/) for all commit messages. This ensures clean changelogs and automated release tracking:

```text
<type>(<optional scope>): <description in imperative mood>

[optional body explaining context and rationale]

[optional footer(s) referencing issue numbers]
```

**Allowed Types**:
- `feat`: A new user-facing or API feature.
- `fix`: A bug fix.
- `docs`: Documentation changes only.
- `style`: Formatting changes that do not affect code logic.
- `refactor`: Code refactoring without changing behavior.
- `perf`: Performance improvements.
- `test`: Adding or updating test suites.
- `chore`: Build tooling, dependency bumps, or CI updates.

**Example**:
```text
feat(refund): implement two-step claim and retry-withdraw refund flow

- Execute claim_timeout on-chain to credit internal balance
- Invoke withdraw to transfer tokens from contract to player wallet
- Add reload detection for uncompleted withdrawals via get_balance > 0

Fixes #42
```

---

## Coding Standards & Tooling

### TypeScript & Frontend

- **Vanilla CSS / Predefined Tailwind**: Reuse existing design tokens in `tailwind.config.js` and existing component classes. Never introduce ad-hoc styles, foreign color schemes, or unvetted UI libraries.
- **Strict Typing**: No unconstrained `any`. Provide explicit types for API contracts, component props, and contract invocation results.
- **Fast Linting**: Run `npm run lint` (`oxlint`) before committing. Fix all warnings and errors.

### Backend & Fastify API

- **Schema Validation**: Every endpoint must define a strict [Zod](https://zod.dev/) schema for request body, query parameters, and responses.
- **Authentication**: Off-chain interactions requiring player authorization must use the Freighter challenge nonce + HMAC session token pattern. Never trust unverified client-provided addresses.
- **Database Access**: Use parameterized SQL queries. Do not concatenate user input into SQL strings.

### Rust & Soroban Smart Contracts

- **Invariant Preservation**: Any modification to contract methods must strictly maintain the core accounting invariant:
  $$\text{Real Token Balance} == \text{pool} + \text{locked} + \text{owed}$$
- **Checked Arithmetic**: Use checked operations (`checked_add`, `checked_sub`, `checked_mul`, `checked_div`) for all financial calculations. Never use raw arithmetic that could overflow or panic in production Wasm.
- **Authorization**: Explicitly enforce `.require_auth()` for any action accessing player balances, admin functions, or verifier signatures.
- **TTL Extension**: Ensure persistent storage entries call `extend_persistent_ttl` and instance storage calls `extend_instance_ttl`.

---

## Testing Requirements

Every pull request must maintain or increase test coverage. Submissions without corresponding tests will not be merged.

### Run All Test Suites Locally

```bash
# 1. API Integration & Security Tests (Vitest)
npm --prefix apps/api test

# 2. Soroban Smart Contract Tests (Cargo)
cd contracts/quiza && cargo test && cd ../..

# 3. Contract Linter (Clippy)
cd contracts/quiza && cargo clippy -- -D warnings && cd ../..

# 4. Frontend Lint & Production Build
npm run lint
npm run build
```

---

## Pull Request Checklist

Before submitting your PR, verify:

- [ ] Branch is rebased onto the latest `origin/main`.
- [ ] Commit messages follow the Conventional Commits specification.
- [ ] No secrets, private keys, or `.env` files are included or exposed.
- [ ] All Vitest API tests pass (`npm --prefix apps/api test`).
- [ ] All Soroban contract tests pass (`cd contracts/quiza && cargo test`).
- [ ] Frontend builds cleanly (`npm run build`).
- [ ] Linter reports zero errors (`npm run lint`).
- [ ] Relevant documentation in `docs/` is updated.
- [ ] The PR references the issue it addresses (e.g., `Closes #123`).

---

## Review Process & SLA

- **Initial Triage**: Maintainers review new PRs within 48 business hours.
- **Automated Checks**: GitHub Actions CI must pass completely before human review begins.
- **Approval**: At least one maintainer approval is required.
- **Merge Strategy**: PRs are squash-merged into `main` with a conventional commit message.

---

## Security Vulnerabilities

Please **do not** open public GitHub issues for security vulnerabilities. Instead, refer to our [Security Policy](SECURITY.md) for encrypted reporting instructions and disclosure procedures.
