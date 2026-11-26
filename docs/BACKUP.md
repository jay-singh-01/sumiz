# Backups: setup and recovery

There are three layers. Each one alone is enough to recover the shop.

| Layer | Where | How often | Who does it |
|---|---|---|---|
| 1. Nightly backup | Private GitHub repo `gota-dhaaga-backups` | Every night, 02:00 IST | Automatic (GitHub Actions) |
| 2. Download from the app | Phone / Google Drive | Monthly (the app shows a banner) | Sumitra, in **सेटिंग → बैकअप और सुरक्षा** |
| 3. Firestore itself | Google's servers + every phone's offline copy | Live | Automatic |

Firestore's own scheduled backups and point-in-time recovery need the paid Blaze plan, so layer 1 replaces them.

---

## One-time setup of the nightly backup (about 15 minutes)

Customer data never goes into the app repo. It goes into a **separate private repo**.

### 1. Create the private repo
1. On GitHub: **New repository** → name `gota-dhaaga-backups` → **Private** → create.
2. Copy these four files from this repo's `scripts/backup/` folder into the new repo:
   - `backup.mjs` → repo root
   - `package.json` → repo root
   - `.gitignore` → repo root
   - `nightly.yml` → `.github/workflows/nightly.yml`

   Commit and push. (You can do it in the GitHub web UI: **Add file → Upload files**, then create `.github/workflows/nightly.yml` with **Add file → Create new file**.)

### 2. Create a Firebase service account key
1. Firebase console → ⚙️ **Project settings** → **Service accounts** → **Generate new private key** → confirm. A `.json` file downloads.
2. That file is a password to all the shop's data. **Never commit it, email it or share it.**

### 3. Store it as a GitHub Secret
1. In `gota-dhaaga-backups`: **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `FIREBASE_SERVICE_ACCOUNT`. Value: open the downloaded `.json` in Notepad, select all, paste.
3. Save, then **delete the downloaded `.json` file** from your computer (and empty the Recycle Bin).

### 4. Run it once
**Actions** tab → **Nightly backup** → **Run workflow**. After a minute or two you should see a green ✅ and a new commit "Backup YYYY-MM-DD" containing:

```
latest/<shopId>.json            full current snapshot (one record per line)
daily/<date>/<shopId>.json.gz   dated copy, kept 90 days, restorable in the app
audit/<shopId>/<YYYY-MM>.jsonl  the complete append-only change history
excel/<shopId>/<date>.xlsx      weekly spreadsheet (Sundays)
reports/<shopId>.txt            counts, total dues, consistency problems
meta.json                       bookkeeping for the incremental export
```

From then on it runs every night. **If a night fails, GitHub emails you** and the Actions tab shows a red ❌.

### Cost and limits
- GitHub Actions: about 1 minute per night, inside the free 2,000 minutes/month for private repos.
- Firestore reads: the first run reads everything once. After that each night reads **only what changed** (typically a few hundred reads, well inside the free 50,000/day). Once a month a cheap count check (1 read per 1,000 records) catches anything missed.
- The repo grows by roughly 0.5 MB a day of compressed snapshots. If it ever approaches 1 GB (years away), make a fresh repo and carry over just `latest/`, `audit/` and `meta.json`.

> Why a separate repo? GitHub turns off scheduled workflows in public repos after 60 days without activity, and customer phone numbers must never be public. In the private backup repo, the nightly commit itself keeps the schedule alive.

---

## Recovery: what to do when something goes wrong

### "I deleted something by mistake"
**सेटिंग → बैकअप और सुरक्षा → रीसायकल बिन** → **वापस लाएँ**. Nothing is ever really deleted.

### "Some records changed or disappeared and I don't know how"
1. **बदलावों का इतिहास** (change history) shows who changed what, when and from which device. Most mistakes can be fixed by hand from there.
2. To roll back in bulk: owner/admin → **बैकअप से वापस लाएँ** → choose a backup file:
   - a file downloaded from the app (`.json`), or
   - a nightly file from GitHub: `daily/<date>/<shopId>.json.gz` (open it on GitHub → **Download raw file**).
3. The app shows a **preview** (how many records would be recreated, undeleted or reverted) before anything changes.
   - **Safe mode (default):** only brings back records that are missing or deleted.
   - **Overwrite mode:** also puts changed records back to their backup state.
   - Records created after the backup are never touched. User accounts, the audit log and order-number counters are never overwritten.
4. Tap **हाँ**. Every restored record gets a new version and an entry in the change history ("बैकअप से … वापस लाए").

### "The phone is lost or broken"
Nothing is lost: the data lives in Firestore. On the new phone, open the app and sign in with the same Google account. Everything downloads again. Then use **सेटिंग → सभी फ़ोन/डिवाइस से लॉग आउट** to lock out the lost phone.

### "The whole Firebase project is gone" (worst case)
1. Create a new Firebase project (docs/FIREBASE_SETUP.md), publish `firestore.rules`, and point the app at it (`.env.local` / Cloudflare env vars).
2. Sign in as the owner and finish first-run setup. This creates a new shop with a new shop ID.
3. The restore screen refuses a backup from a different shop ID, which is a safety check against mixing shops. For this one-off migration, ask the developer to run the restore with the old shop ID mapped to the new one. The backup files contain every field needed.

### Checking the backups are healthy
Open `reports/<shopId>.txt` in the backup repo. It should end with `consistency: OK`, and its total dues should match the app's **कुल बकाया**.
