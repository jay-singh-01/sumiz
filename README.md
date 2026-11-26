# गोटा & धागा · Gota & Dhaaga by Sumitra

An offline-first business manager for Sumitra's Rajasthani tailoring shop. It runs as an installable Android app (PWA), Hindi-first with an English toggle, and costs ₹0 to run.

- **Product spec:** [SPEC.md](SPEC.md)
- **Hindi user guide (1 page, printable):** [docs/user-guide-hindi.pdf](docs/user-guide-hindi.pdf)
- **If something goes wrong:** [RECOVERY.md](RECOVERY.md)

## What it does

| Area | Highlights |
|---|---|
| Customers | Hindi/English transliteration search ("sunita" finds सुनीता), phone, area, notes, profile with ledger |
| Measurements | Per-garment forms, history with dates, copied onto each order |
| Orders | 3-step wizard, status pipeline (मिला → कटिंग → सिलाई → ट्रायल → तैयार → दिया), urgent flag, board/list, design photos, token slip |
| Bills | GD/FY/A001 numbering per device, discount, optional GST (CGST/SGST), round-off, UPI QR, share as image/PDF on WhatsApp |
| Payments | Advance, part payments, opening balance from the old diary, customer ledger with running balance, dues ageing |
| Reminders | One-tap WhatsApp: ready for pickup, payment due, trial, festival greetings; editable templates; send log |
| Reports | Earnings, dues, trends, garment mix, areas, karigar work, profit (after expenses); Excel/PDF export; table view for every chart |
| Extras | Calendar, expenses, karigars (piece-rate), material stock with low-stock alert, diary migration (CSV/Excel), voice typing, guided help tours, daily reminder notification; each can be switched off in Settings |
| Safety | Works offline, audited writes, no hard deletes (Recycle Bin), change history, PIN lock, sign out of all devices, nightly + in-app backups with dry-run restore |

## Stack

React 19 + Vite + TypeScript, Tailwind v4, Radix primitives, Motion, ECharts. Firebase Auth (Google) and Firestore (Spark, free) with a persistent offline cache. Cloudflare Pages hosting. GitHub Actions nightly backups. Cloudinary (free) for photos. html-to-image + jsPDF for bills.

## Setting it up (handover checklist)

1. **Firebase project:** [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md). Create the project on the free plan, enable Google sign-in and Firestore, and publish `firestore.rules`.
2. **Put it online:** [docs/DEPLOY.md](docs/DEPLOY.md). Cloudflare Pages, environment variables, the authorized domain, and installing on the phone.
3. **Nightly backups:** [docs/BACKUP.md](docs/BACKUP.md). A private GitHub repo plus the `FIREBASE_SERVICE_ACCOUNT` secret.
4. **Photos (optional):** [docs/PHOTOS.md](docs/PHOTOS.md). A Cloudinary unsigned upload preset.

Rules for keeping it free: never upgrade Firebase to Blaze, and never commit `.env.local` or service-account keys. The backup key lives only in GitHub Secrets.

## Development

Prerequisites: Node 24+, and **Java 21+** for the Firebase emulators and rules tests only (e.g. [Temurin 21](https://adoptium.net/)).

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run emulators` | Local Auth + Firestore emulators (UI on <http://127.0.0.1:4000>); data persists in `emulator-data/` |
| `npm run dev:emu` | Run the app against the emulators, with no real Firebase needed |
| `npm run seed:demo` | Fill the emulator shop with demo data (`-- --customers 200 --orders 1000` for more) |
| `npm run dev` | Run against the real Firebase project (needs `.env.local`, see `.env.example`) |
| `npm test` | Unit tests |
| `npm run test:rules` | Firestore security-rules tests (starts the emulator automatically) |
| `npm run ci` | Lint + typecheck + unit tests |
| `npm run build` | Production build into `dist/` |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, rules tests and the build on every push and PR.

### Code map

```
src/
  app/          shell, home, settings, feature flags, sync indicator
  auth/         Google sign-in, PIN lock, shop setup, invites
  data/         write helpers, outbox, delta sync, hooks, schemas, backup format
  features/     customers, measurements, orders, bills, payments, reminders,
                reports, backup, audit, master (garments/add-ons), extras
  i18n/         Hindi + English strings (parity enforced by a test)
  lib/          formatting (₹1,25,000, DD/MM/YYYY), dates, drafts, firebase
firestore.rules  security rules (the real protection for the data)
scripts/backup/  nightly backup job (copied into the private backups repo)
scripts/seed-demo.mjs  emulator demo data
```

## How data is kept safe

- **All writes go through [src/data/write.ts](src/data/write.ts).** Each write is validated with Zod and committed atomically with an audit-log entry whose id is `<collection>_<docId>_v<version>`. [firestore.rules](firestore.rules) rejects any business write that lacks that entry, so nothing can bypass the audit trail. Per-collection validators in the rules re-check the important fields.
- **No hard deletes.** Rules deny `delete` everywhere. Records are soft-deleted (`isDeleted`) and restored from the Recycle Bin.
- **Versioning instead of client transactions.** Firestore transactions don't work offline. Instead, every write must set `version` to exactly the previous value + 1, and the rules enforce it. If two devices edit the same record, the second write is rejected rather than silently overwriting the first.
- **The outbox stops rejected writes from vanishing** ([src/data/outbox.ts](src/data/outbox.ts)). Each write is also recorded in IndexedDB until the server accepts it. Rejected writes go to a "conflicts" store for review. Writes left over after the app was killed offline are reconciled against their audit entries on the next start.
- **Delta sync** ([src/data/sync.ts](src/data/sync.ts)). Devices listen only for documents changed since the last sync, and screens read from the local cache. This keeps reads far inside the free 50k/day.
- **Money is handled in integer paise**, and balances are always derived (bills − payments), never stored, so they can't drift.
- **Sign out of all devices** sets `users/{uid}.revokedBefore`. The rules then refuse any session signed in before that.
- **Backups:** a nightly incremental JSON backup goes to a private GitHub repo, plus a one-tap in-app download. Restore always shows a dry run and never overwrites newer records.

## Tests

- `npm test`: 216 unit tests. They cover formatting, bill maths (discount, GST split, round-off), the ledger and dues ageing, order numbering, transliteration search, report metrics, the Excel export, the backup format and restore planning, diary-migration parsing, drafts, PIN hashing and i18n parity. They also include a **scale test**: the full summary on 2,000 customers and 10,000 orders must build in under 1.5 s.
- `npm run test:rules`: 71 emulator tests. They cover the security rules (shop scoping, no deletes, append-only audit, version checks, roles, invites, revocation, field validators) **and** the app's real write helpers against those rules, including a two-device conflict landing in the outbox.
