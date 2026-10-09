# Project Governance

This document describes the governance structure, decision-making process, and contributor roles for the **Quiza** open-source project.

Our governance model is designed to promote transparent, community-driven development while preserving the technical integrity, financial safety, and security required for non-custodial Web3 gaming infrastructure.

---

## 1. Governance Principles

1. **Safety First**: Any smart contract modification that impacts player funds, pool solvency, or accounting invariants requires rigorous formal verification and multi-maintainer approval.
2. **Open & Transparent**: Technical proposals, roadmaps, and architectural decisions are discussed openly in GitHub Issues and pull requests.
3. **Meritocratic Progression**: Contributors who demonstrate sustained technical capability, attention to detail, and constructive community participation are granted review and maintainer responsibilities.
4. **Decentralized Vision**: While currently maintained by the core engineering team (`jotel-dev`), the project is structured to transition toward decentralized protocol governance.

---

## 2. Contributor Roles & Permissions

| Role | Responsibilities | Requirements | Access Level |
| :--- | :--- | :--- | :--- |
| **Community Member** | Plays games, reports bugs, participates in discussions | Follows Code of Conduct | Read & Issue Creation |
| **Contributor** | Submits bug fixes, documentation, feature PRs | One or more merged PRs | Fork & Pull Request |
| **Reviewer** | Reviews PRs, triages issues, validates test coverage | Sustained contributions & domain competence | Triage / Review |
| **Maintainer** | Approves PRs, manages releases, guides roadmap | Core architectural mastery & proven trust | Write / Merge |
| **Security Council** | Audits contracts, handles CVE reports, controls multisig | Nominated core maintainers | Admin / Multisig Keys |

---

## 3. Decision-Making Process

### Lazy Consensus

For everyday bug fixes, non-breaking performance improvements, documentation updates, and UI enhancements, we operate under **Lazy Consensus**:

- A pull request is submitted with passing CI tests.
- If at least one maintainer approves and no objections are raised within **48 hours**, the change is merged.

### RFC (Request for Comments) Process

For significant changes—such as smart contract upgrades, token economics adjustments, storage layout alterations, or major API breaking changes—the author must submit an RFC:

1. **Draft Proposal**: Open an issue titled `RFC: <Proposed Change>` or submit a draft Markdown document to `docs/rfcs/`.
2. **Required Sections**:
   - Summary & Problem Statement
   - Architectural Design & Contract Invariants
   - Security & Threat Analysis
   - Backward Compatibility & Migration Plan
3. **Review Window**: The RFC remains open for community review for at least **7 calendar days**.
4. **Consensus**: Consensus is reached when at least two maintainers approve and no unresolved security concerns remain.

---

## 4. Smart Contract Upgrades & Admin Keys

The Soroban smart contract enforces strict admin authorization:

- **Admin Key**: Can pause/unpause staking, adjust stake limits (`min_stake`, `max_stake`), and fund or withdraw house liquidity.
- **Verifier Key**: Solely authorized to resolve quiz rounds via `resolve(round_id, won, score)`. Cannot withdraw pool funds or modify limits.
- **Production Key Management**: For testnet, throwaway identities generated via `stellar keys` are utilized. For mainnet production, the admin key will be transitioned to a multi-signature Stellar account requiring $M$-of-$N$ threshold signatures from the Security Council.

---

## 5. Amendments to this Document

Modifications to `GOVERNANCE.md` require unanimous approval from all active Maintainers and a minimum 7-day public comment period.
