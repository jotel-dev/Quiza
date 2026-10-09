# Getting Support for Quiza

Thank you for using and building on **Quiza**! Whether you are a player experiencing an issue with a staked round, a developer integrating our contract interface, or an open-source contributor setting up your local environment, we are here to help.

---

## Channels for Help

| Inquiry Type | Recommended Channel | Expected Response Time |
| :--- | :--- | :--- |
| **Community Discussion & Chat** | [Telegram Community (t.me/nullifiersystem/1)](https://t.me/nullifiersystem/1) | Community response (hours) |
| **Bug Reports & Glitches** | [GitHub Issues (Bug Report)](https://github.com/jotel-dev/Quiza/issues/new?template=bug_report.yml) | 24–48 business hours |
| **Feature Requests & Ideas** | [GitHub Issues (Feature Request)](https://github.com/jotel-dev/Quiza/issues/new?template=feature_request.yml) | 48–72 business hours |
| **Architecture Questions & RFCs** | [GitHub Discussions](https://github.com/jotel-dev/Quiza/discussions) | Weekly maintainer review |
| **Security Vulnerabilities** | `security@quiza.app` (See [SECURITY.md](SECURITY.md)) | < 24 hours |

---

## Frequently Asked Questions First

Before opening a ticket, please consult:

- **[FAQ.md](FAQ.md)** — Frequently Asked Questions covering wallet setup, staking mechanics, timeout refunds, and developer setup.
- **[docs/troubleshooting.md](docs/troubleshooting.md)** — Diagnostic steps for common local development and transaction simulation errors.
- **[docs/known-limits.md](docs/known-limits.md)** — Documented constraints such as browser-local round indexing and 2-hour timeout rules.

---

## When Submitting a Support Request

To help us resolve your issue quickly, please provide:

1. **Transaction Hash or Round ID**:
   - For on-chain issues, include the Stellar Expert link (e.g., `https://stellar.expert/explorer/testnet/tx/...`) or the numeric `round_id`.
2. **Wallet Address**:
   - Your public Stellar address (`G...`). **Never share your secret key (`S...`) with anyone!** Maintainers will never ask for your private key.
3. **Environment Details**:
   - Browser & OS (e.g., Chrome 128 on macOS).
   - Freighter wallet version.
   - Network (Testnet vs. Mainnet).
4. **Console Logs / Error Messages**:
   - Inspect the browser console (`F12` → Console) and provide full error text or stack traces.

---

## Community Etiquette

- Be courteous, respectful, and constructive as defined in our [Code of Conduct](CODE_OF_CONDUCT.md).
- Avoid tagging maintainers directly in public chat groups unless an urgent production exploit is identified.
- Never share confidential credentials, `.env` files, or private keys in public forums.
