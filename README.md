# गोटा & धागा · Gota & Dhaaga

Offline-first tailoring business manager for Sumitra's Rajasthani tailoring shop.
Full product spec: [SPEC.md](SPEC.md). Firebase project setup: [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).

> This README gets a full handover rewrite in Phase 12.

## Prerequisites

- Node 24+
- **Java 21+** (only for the Firebase emulators / rules tests), e.g. [Temurin 21](https://adoptium.net/)

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run emulators` | Start local Auth + Firestore emulators (UI on <http://127.0.0.1:4000>); data persists in `emulator-data/` |
| `npm run dev:emu` | Run the app against the emulators (no real Firebase needed) |
| `npm run dev` | Run the app against the real Firebase project (needs `.env.local`) |
| `npm test` | Unit tests |
| `npm run test:rules` | Firestore security-rules tests (starts the emulator automatically) |
| `npm run ci` | Lint + typecheck + unit tests |
| `npm run build` | Production build into `dist/` |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, rules tests and the build on every push and PR.
