# Build Prompt: "Gota & Dhaaga by Sumitra" (गोटा & धागा) — Tailoring Business Manager

> **Brand:** shop name **"Gota & Dhaaga"**, sub-line **"by Sumitra · राजस्थानी सिलाई"**, tagline on bills: **"हर टांके में अपनापन"** (Care in every stitch). The shop name, sub-line, tagline and logo must all be editable in Settings (never hard-coded), because they print on every bill.

> Saved as `SPEC.md` at the repo root so later sessions can refer back to it.

---

## 0. Who this is for (read first, it drives every decision)

You are building a production app for **Sumitra**, who runs a small **Rajasthani tailoring business** from home for neighbourhood customers. Right now she keeps everything in a paper diary: customers, measurements, orders, payments and dues. The diary fills up, and copying records into a new one is painful.

- **Primary user:** a middle-aged woman, not tech-savvy, mainly on an **Android phone**, sometimes on a laptop or tablet. She is comfortable with WhatsApp and the camera, and that's about it.
- **Language:** **Hindi first**, with an English toggle. Every label, button, message, bill and report is in both languages. Numbers use Indian formatting (₹1,25,000), dates use DD/MM/YYYY.
- **Admin/helper:** her son (the developer) is a second user with an admin role, for support and recovery.
- **The three things that matter most, in order:**
  1. **Data is NEVER lost**, under any circumstances (phone lost, offline, bad network, accidental delete, app bug).
  2. **It's dead simple to learn.** If she has to ask how to do something twice, the UI has failed.
  3. **It looks stunning:** festive, proud, Rajasthani. It should feel like *her* shop, not a generic SaaS dashboard.
- **Budget: ₹0.** Every service must be on a **free tier that does NOT require adding a credit card or billing account**. Before choosing a service, verify its current free-tier limits and terms, and tell me if anything has changed. Don't use anything that pauses or deletes data for inactivity without a safe workaround.

---

## 1. Architecture (free, offline-first, multi-device)

This stack was chosen after comparing the free options (verified Nov 2026). Use it unless you find a concrete blocker, in which case explain the blocker and propose an alternative before switching. **Every service below works with no credit card or billing account. Never upgrade any project to a paid plan (e.g. Firebase Blaze).**

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React + Vite + TypeScript + Tailwind CSS + shadcn/ui (Radix primitives)** | Fast, accessible components we fully own and restyle into the Rajasthani theme |
| Animation | **Framer Motion** | Polished micro-interactions |
| Charts | **Apache ECharts** (`echarts-for-react`) | The richest-looking free charts: heatmaps, gauges, gradients, animations |
| App shell | **PWA** (`vite-plugin-pwa`), installable on her Android home screen, works fully offline | Feels like a real app, no Play Store needed |
| Auth | **Firebase Authentication with Google Sign-In** (she already has a Gmail on her phone) + a **4-digit app PIN** lock on top for quick re-entry | Free on the Spark plan. No phone-OTP (avoid anything SMS-billed) |
| Database | **Cloud Firestore, Spark (free) plan**, with **persistent offline cache** (`persistentLocalCache` + `persistentMultipleTabManager`) | Free tier: 1 GiB stored, 50k reads/day, 20k writes/day, no inactivity pausing. Offline-first and multi-device sync are built in, so we don't write our own sync engine |
| Hosting | **Cloudflare Pages** (free, unlimited bandwidth and requests, auto-deploy from GitHub) | Free forever, HTTPS, preview deploys |
| Backups | **GitHub Actions nightly cron** → `firebase-admin` exports every collection to dated JSON in a **private GitHub repo** (plus a weekly Excel snapshot) | **Firestore's managed backups/PITR are NOT free** (they need billing), so this off-platform backup is mandatory, not optional |
| Images (design refs, diary photos) | **Cloudinary free plan** (no card, ~25 monthly credits) via unsigned upload preset; compress client-side to ≤ 300 KB first. Store only the URL + metadata in Firestore. Keep an image-provider interface so it can be swapped | **Firebase Cloud Storage now requires the Blaze plan**, so don't use it |
| Bills (PDF + image) | Render the bill as a real HTML/CSS component in the browser → **PNG** via `html-to-image` (at 2–3× pixel ratio) for WhatsApp, and **PDF** via `jsPDF` embedding that high-res render (A4 + mobile-portrait sizes). Self-host the fonts (no Google Fonts CDN at render time, so it works offline) | The browser shapes Hindi conjuncts (क्ष, त्र, श्र, ्र) correctly. **Don't use `@react-pdf/renderer`/pdfkit for Hindi text**: they don't do proper Devanagari shaping and break the matras |
| Sharing | **Web Share API Level 2** (share the PNG/PDF file straight into WhatsApp), with a fallback to `wa.me/91XXXXXXXXXX?text=` click-to-chat plus a download | Free, no WhatsApp Business API |
| Payments on bill | **UPI deep-link QR** (`upi://pay?pa=&pn=&am=&cu=INR&tn=`) generated client-side with `qrcode` | Free, works with every UPI app |

**Rejected options (don't revisit unless asked):**
- **Supabase free:** projects pause after 7 days of low activity, there are no free backups, and there's no built-in offline sync. That's more moving parts and more risk.
- **Phone-only storage (IndexedDB alone):** data dies with the phone and can't be seen on other devices. It's used **only** as the offline cache.
- **Google Sheets as a database:** weak security rules, no transactions, slow.
- **Self-hosted PocketBase:** needs a server, and free VMs need a card.

**Free-tier headroom check (include it in your Phase 1 reply):** estimate the yearly data size (customers, orders, bills, payments, audit logs) against 1 GiB. Estimate daily reads and writes at peak wedding season (about 50 orders/day) against 50k/20k. Note that a brand-new device downloads the whole dataset once (initial sync), so keep documents lean. Don't add listeners on the full audit-log collection; paginate it. Compute reports from the local cache, not with repeated server queries.

### Data-safety design (non-negotiable — implement all of it and test each item)

1. **Offline-first:** every write goes to the local cache instantly and syncs when online. Show a small, always-visible sync indicator: ✅ "सब सेव है / All saved" · 🔄 "सिंक हो रहा है (3)" · ⚠️ "ऑफ़लाइन — फ़ोन में सुरक्षित / Offline — safe on phone".
2. **No hard deletes, ever.** A delete is a soft delete (`isDeleted`, `deletedAt`, `deletedBy`). There's a **Recycle Bin** with one-tap restore. Firestore Security Rules must **deny `delete`** on all business collections.
3. **Append-only audit log:** every create, update, soft-delete, restore, login, export and backup writes an `auditLogs` entry with: who, when (server timestamp), device/browser, entity type and id, action, and a **before → after diff**. Security rules allow `create` only; `update` and `delete` are denied. She can view the audit trail from **any device**, filtered by date, customer, action and user, in plain Hindi ("सुमित्रा ने 12/11 को रीना जी का बिल ₹1,200 से ₹1,000 किया").
4. **Record versioning:** each business document keeps `version`, `createdAt/By` and `updatedAt/By`. Use transactions for money operations (payments, bill totals) so concurrent edits from two devices can't corrupt balances.
5. **Ledger integrity:** customer balance is **derived** from bills minus payments (not a stored number that can drift). If a cached balance is stored for speed, add a "Recalculate & verify" admin tool and a nightly consistency check.
6. **Backups, three layers:**
   - (a) Nightly GitHub Actions JSON export to a private repo, keeping 90 days.
   - (b) A one-tap **"बैकअप डाउनलोड करें / Download backup"** in the app (JSON + Excel).
   - (c) A **monthly reminder banner** asking her to download a backup to her phone or Google Drive.
   - Build a **Restore from backup** admin screen with a dry-run preview.
7. **Validation:** Zod schemas on every form and on every Firestore write path. Security rules also validate field types and required fields. A user can only read and write data belonging to their own `shopId`.
8. **Unsaved-changes guard:** autosave drafts of in-progress forms (order, bill) to IndexedDB so that a phone call, app switch or crash never loses half-typed data.
9. **Tests:** unit tests for billing math and balance calculation, Firestore rules tests with the emulator, and an offline → online sync test. Document how to run them.
10. **Session security:** the PIN lock re-asks after 5 minutes in the background. "Sign out of all devices" lives in settings. A login history appears in the audit log.

---

## 2. Data model (Firestore)

Everything sits under `shops/{shopId}/...` so a second shop or a helper can be added later.

- **users**: name, email, role (`owner` | `admin` | `helper`), PIN hash, language preference
- **customers**: name, phone (WhatsApp), alternate phone, area/mohalla, address, photo (optional), tags (e.g. regular, VIP, wedding family), referred-by, birthday/anniversary (optional), notes, created/updated metadata
- **measurements** (per customer, **versioned history**, never overwritten): garment category, named measurement fields (see master data), free-text notes, optional reference photo, date taken. Show "last measured X months ago"
- **masterData/garmentTypes**: name (Hindi + English), category, default stitching rate, default delivery days, measurement field template, active flag, icon
- **masterData/addOns**: e.g. lining (अस्तर), piping, latkan, tassels, gota-patti work, aari/zari work, mirror work, padding/cups, extra-fast delivery charge, fall-pico — each with a default rate
- **orders**: order number (auto, per financial year, e.g. `GD/26-27/0042`, prefix configurable), customer, items[] (garment type, qty, rate — **editable**, add-ons with editable rates, fabric given by customer Y/N, fabric notes, design reference photo, measurement snapshot), order date, trial date, promised delivery date, status, urgency flag, assigned karigar (optional), notes
- **Order status pipeline:** मिला/Received → कटिंग/Cutting → सिलाई/Stitching → ट्रायल/Trial → तैयार/Ready → दिया/Delivered (+ Cancelled). Each status change is audited
- **bills/invoices**: generated from an order (or standalone). Line items with **editable amounts**, discount (₹ or %), round-off, advance adjusted, total, paid, balance due, bill number, UPI QR, status (unpaid / partial / paid). Editing an issued bill creates a new revision and keeps the old one viewable
- **payments**: customer, bill(s) applied to, amount, mode (cash / UPI / other), date, note. Supports advance, partial and full payments
- **reminders**: customer, type (payment due / ready for pickup / trial date / greeting), message, channel, sent at, sent by
- **expenses**: category (thread, buttons, lining stock, machine repair, karigar payout, electricity, other), amount, date, note
- **karigars** (optional helpers): name, phone, rate per piece, assigned work, payouts
- **auditLogs** (append-only), **settings** (shop name, logo, address, UPI ID, bill footer, language, theme, reminder templates)

### Seed the master data with Rajasthani tailoring (all editable, rates as placeholders)

Rajputi poshak, lehenga / ghagra, odhni finishing, kurti, salwar suit, anarkali, blouse (simple / designer / padded), sharara, gharara, plazo, saree fall-pico, petticoat, kurta-pajama, Nehru jacket, kids' frocks and lehengas, alteration (fitting / length / hemming). Add-ons: gota-patti, aari work, zari, mirror (shisha) work, latkan, lining, piping, dori, hook/zip change. Measurement templates per garment, e.g. blouse: shoulder, bust, waist, front length, back length, sleeve length, sleeve round, armhole, front neck depth, back neck depth. Lehenga: waist, length, hip, flare/kali count.

---

## 3. Features

Tag every feature as **[MVP]** or **[EXTRA]**. Build all MVP features first, then the extras, each behind a **feature flag in Settings** so we can switch features off after she tries them.

### Core [MVP]
- Google Sign-In + PIN, a "remember this device" option, and an easy first-run setup wizard (shop name, UPI ID, language)
- **Home screen = 4 giant buttons:** ➕ नया ऑर्डर (New order) · 👩 ग्राहक (Customers) · 💰 पैसे मिले (Payment received) · 📊 हिसाब (Summary). Below them: today's deliveries, overdue orders, total dues
- **Customer management:** add, edit, search (Hindi + English, partial phone number, **transliteration-aware**, so "sunita" finds "सुनीता"), customer profile with orders, bills, payments, measurements, balance and a WhatsApp button
- **Measurements:** per garment template, with version history and a "copy last measurements" shortcut
- **Orders:** a create-order flow in **3 steps max** (customer → items → dates & advance), editable rates, live status board (kanban on tablet, list with status chips on phone)
- **Bills:** one tap from an order → beautiful bill → share PDF on WhatsApp / download / print. **All amounts editable** before issuing; revisions are tracked
- **Payments:** record full or partial payments and advances, with automatic balance update
- **Reminders:**
  - Tap → opens WhatsApp with a pre-filled polite Hindi message (editable templates), e.g. "नमस्ते रीना जी, आपका ₹850 बकाया है। कृपया सुविधानुसार भुगतान करें। UPI: … — गोटा & धागा, सुमित्रा"
  - Also "your clothes are ready" and "trial tomorrow" reminders
  - A **bulk reminder** screen for all dues older than X days (opens chats one by one)
  - Every reminder sent is logged
- **Master data screens:** garment types, add-ons, rates, measurement templates (add/edit/deactivate, never hard delete)
- **Audit log viewer**, **Recycle Bin**, **Backup & Restore**, **sync indicator**
- **Hindi/English toggle**, **large-text mode**, fully usable one-handed on a 6" phone

### MIS & Analytics [MVP + EXTRA]
A **"हिसाब / Business Summary"** section with a global filter bar (date range presets: today / this week / this month / this FY / custom; garment type; customer; status; payment mode; area). Every report can be **exported to Excel and PDF**.
- KPI cards (animated count-up): total billed, collected, outstanding dues, orders in progress, delivered this month, average order value, new customers
- Revenue vs collection trend (monthly line/area chart)
- Garment-wise mix (donut) and garment-wise revenue (bar)
- **Dues ageing report** (0–30 / 31–60 / 61–90 / 90+ days) with a one-tap remind
- Top customers by revenue / by orders / by pending dues
- Order pipeline funnel and **on-time delivery %**
- Busy-season heatmap (calendar heatmap of orders by day — shows Teej, Gangaur, Diwali and wedding-season peaks)
- Income vs expenses → **profit estimate** [EXTRA]
- Area/mohalla-wise customers [EXTRA]
- Karigar workload and payouts [EXTRA]
- Customer ledger statement (date-wise, shareable as PDF) [MVP]
- Day-end summary: "आज ₹X आए, Y ऑर्डर दिए, Z बाकी" [MVP]

### Extras [EXTRA] — build all of these behind feature flags
- Delivery/trial **calendar** view
- **Order token slip** for the customer (small printable/shareable receipt with an order number and delivery date)
- **UPI QR code** on every bill (`upi://pay?pa=…&am=…&tn=…`) — amount pre-filled
- **Voice input** (Web Speech API, `hi-IN`) for names and notes
- **Photo of a diary page / design reference** attached to an order or customer
- **Diary migration mode:** a fast bulk-entry screen for transferring old diary records (customer + old balance as an "opening balance" entry), plus CSV/Excel import with a preview and validation
- Festival greeting messages (Diwali, Teej, Rakhi) and birthday wishes via WhatsApp
- Customer loyalty note ("10th order — give a small discount?")
- Expenses tracker
- Karigar management
- Low-stock reminders for materials (thread, lining, buttons)
- Daily automatic summary notification (local PWA notification, if supported)
- Dark mode ("रात मोड")
- Multi-user: add a helper with a limited role (can create orders, cannot edit rates or see reports)
- Optional GST toggle (off by default)
- In-app **"मदद / Help"**: short animated tooltips, plus a "show me how" guided tour for each main screen

---

## 4. Design direction — make it stunning

Theme: **"Rajasthani Royal Boutique."** Festive and warm, but clean and readable. Not cluttered.

- **Palette:** rani pink (#E0115F-ish), marigold/saffron, deep indigo/royal blue, emerald, with **gold accents** on a warm ivory background. Define them as Tailwind design tokens. Check WCAG AA contrast for all text
- **Motifs (subtle, as SVG):** **jharokha arch** frames for cards and headers, **bandhani dot** patterns as faint backgrounds, **gota-patti / leheriya** borders as dividers, small paisley and elephant/peacock accents in empty states. Draw the motifs yourself in SVG; don't copy copyrighted artwork
- **Typography:** an elegant Devanagari display font for headings (e.g. *Rozha One*, *Yatra One* or *Tiro Devanagari Hindi*), a highly readable body font (e.g. *Mukta*, *Hind* or *Noto Sans Devanagari*), and tabular numerals for money
- **Micro-interactions:** soft spring animations, a confetti/marigold-petal burst when a bill is marked paid, gentle haptic feedback (`navigator.vibrate`) on key actions, skeleton loaders, smooth page transitions
- **Accessibility for her:** touch targets ≥ 48px, base font ≥ 17px, icons always paired with text, no hidden gestures for critical actions, confirmation dialogs in plain Hindi, a 5-second **"Undo"** toast after every save or delete
- **The bill** is the showpiece:
  - A4 and a WhatsApp-friendly portrait layout
  - Shop name **"गोटा & धागा"** in decorative Devanagari with "Gota & Dhaaga · by Sumitra" beneath, tagline "हर टांके में अपनापन", a jharokha-arch header, a gold foil-style border
  - Itemised table, add-ons, discount, advance, **big bold balance due**, UPI QR, thank-you line ("आपका धन्यवाद, फिर पधारें 🙏")
  - Optional "PAID" stamp graphic when settled
  - It must look premium as a PDF on a phone screen
- Design a **custom logo/monogram** for "Gota & Dhaaga" (an original SVG, e.g. a needle whose thread curls into a gota-patti leaf, or a jharokha arch framing a "ग"). Provide colour, single-colour (for stamps/print) and favicon/app-icon versions
- Mobile-first, then a responsive tablet/desktop layout with a sidebar

Before coding the screens, produce a short **design system page** in the app (`/design`, admin only) showing colours, type, buttons, cards and the bill preview, so it can be reviewed.

---

## 5. Build plan — work in phases, commit after each

1. **Setup:** repo, Vite/React/TS/Tailwind, Firebase project (walk me step by step through creating it in the console with no billing), env config, Firebase emulators, CI (lint + test).
2. **Security first:** auth, PIN, shop scoping, Firestore rules (no deletes, append-only audit), the audit-log helper wrapping *every* write, rules tests.
3. **Design system + app shell + PWA + offline cache + sync indicator.**
4. **Master data + customers + measurements.**
5. **Orders + status pipeline.**
6. **Bills + PDF + WhatsApp share + UPI QR + payments + ledger.**
7. **Reminders + templates.**
8. **MIS dashboard + reports + filters + exports.**
9. **Backup (GitHub Action + in-app) + restore + Recycle Bin + audit viewer.**
10. **Extras behind feature flags.**
11. **Hardening:** offline/sync tests, two-device conflict test, Lighthouse PWA score ≥ 90, a large-dataset test (seed 2,000 customers and 10,000 orders and check that reports stay fast).
12. **Deploy + handover:**
    - A `README.md` written for me
    - A **1-page Hindi user guide** for my mother (with screenshots) as a PDF
    - A `RECOVERY.md` that explains exactly how to restore data if anything goes wrong

### Working rules
- After each phase, give me a short summary and the exact commands to run or test it.
- Prefer **simple, direct solutions**. Don't add a backend server unless it's truly needed (free tiers and fewer moving parts win).
- When editing later, make **targeted edits** to existing files rather than regenerating whole files.
- Never store secrets in the repo. Use GitHub Secrets for the backup service account.
- If a free-tier limit could realistically be hit (reads/writes per day, storage), calculate it against this usage — about 50 customers a day at peak season — and tell me the headroom.
- Ask me before any decision that is hard to reverse (data model changes after real data exists, switching providers).
