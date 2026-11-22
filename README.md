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

## How data is kept safe (Phase 2)

- **All writes go through [src/data/write.ts](src/data/write.ts).** Each write is validated with Zod and committed atomically with an audit-log entry whose id is `<collection>_<docId>_v<version>`. [firestore.rules](firestore.rules) rejects any business write that doesn't have that entry, so nothing can bypass the audit trail.
- **No hard deletes.** Rules deny `delete` everywhere. Records are soft-deleted (`isDeleted`) and can be restored.
- **Versioning instead of client transactions.** Firestore transactions don't work offline. Instead, every write must set `version` to exactly the previous value + 1, and the rules enforce it. If two devices edit the same record, the second write is rejected rather than silently overwriting the first.
- **The outbox stops rejected writes from vanishing** ([src/data/outbox.ts](src/data/outbox.ts)). Each write is also recorded in IndexedDB until the server accepts it. Rejected writes go to a "conflicts" store for review. Writes left over after the app was killed offline are checked against their audit entries on the next start.
- **Delta sync** ([src/data/sync.ts](src/data/sync.ts)). Devices listen only for documents changed since the last sync, and screens read the full data from the local cache. This keeps reads far inside the free 50k/day.
- **Sign out of all devices** sets `users/{uid}.revokedBefore` to the server time. The rules then refuse any session whose Google sign-in is older than that.

## Tests

- `npm test`: unit tests for formatting, diffs, PIN hashing, i18n parity and the sync marker.
- `npm run test:rules`: 50 emulator tests. They cover the security rules (shop scoping, no deletes, append-only audit, version checks, roles, invites, revocation) **and** the app's real write helpers against those rules, including a two-device conflict landing in the outbox.
