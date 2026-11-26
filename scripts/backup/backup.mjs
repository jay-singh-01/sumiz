// Nightly off-platform backup for Gota & Dhaaga (runs in GitHub Actions in a
// PRIVATE backup repo; see docs/BACKUP.md). Firestore's own backups need a paid
// plan, so this is the safety net.
//
// Incremental, to stay far inside the free 50k reads/day:
//  - each run reads only records changed since the last run (every write,
//    including soft deletes, bumps `updatedAt`) and merges them into
//    latest/<shopId>.json (a full snapshot, one record per line so git diffs
//    stay tiny);
//  - audit-log entries are appended to audit/<shopId>/<YYYY-MM>.jsonl;
//  - once a month (or when counts disagree) a cheap count() check triggers a
//    full re-read of any collection that drifted;
//  - a compressed dated copy goes to daily/<date>/<shopId>.json.gz (kept 90
//    days) — that file can be uploaded straight into the app's restore screen;
//  - on Sundays an Excel snapshot goes to excel/<shopId>/<date>.xlsx;
//  - a consistency report (balances, dangling references) goes to
//    reports/<shopId>.txt.
//
// Env: FIREBASE_SERVICE_ACCOUNT (JSON, from a GitHub Secret), or
// FIRESTORE_EMULATOR_HOST + GCLOUD_PROJECT for local testing.
// BACKUP_DIR: where to write (default: current directory).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const OUT = process.env.BACKUP_DIR || process.cwd()
const RETAIN_DAYS = 90
// Re-read a little before the last run so a write landing mid-run is never missed. (Override only for tests.)
const OVERLAP_MS = Number(process.env.BACKUP_OVERLAP_MS ?? 10 * 60 * 1000)
const FULL_CHECK_EVERY_MS = 30 * 86_400_000
const COLLECTIONS = ['customers', 'measurements', 'orders', 'bills', 'payments', 'reminders', 'expenses', 'karigars', 'garmentTypes', 'addOns', 'settings', 'counters', 'materials', 'users']
const SECRET = new Set(['pinHash', 'pinSalt'])

if (process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-gota-dhaaga' })
else {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set')
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) })
}
const db = getFirestore()

const toJson = (v) => {
  if (v === undefined || v === null) return null
  if (v instanceof Timestamp) return { __ts: v.toMillis() }
  if (Array.isArray(v)) return v.map(toJson)
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => !SECRET.has(k)).map(([k, x]) => [k, toJson(x)]))
  return v
}
const docJson = (d) => ({ id: d.id, ...toJson(d.data()) })
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback)
const ensure = (p) => mkdirSync(p, { recursive: true })
const today = new Date().toISOString().slice(0, 10)
const metaPath = join(OUT, 'meta.json')
const meta = readJson(metaPath, { shops: {} })
let reads = 0
const summary = []

for (const shopDoc of (await db.collection('shops').get()).docs) {
  reads++
  const shopId = shopDoc.id
  const m = meta.shops[shopId] ?? { lastRun: 0, lastFullCheck: 0 }
  const since = Timestamp.fromMillis(Math.max(0, m.lastRun - OVERLAP_MS))
  const runStart = Date.now()
  const latestPath = join(OUT, 'latest', `${shopId}.json`)
  const prev = readJson(latestPath, null)
  const state = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map((prev?.collections?.[c] ?? []).map((d) => [d.id, d]))]))
  const changed = {}
  const countCheck = m.lastRun === 0 || Date.now() - m.lastFullCheck > FULL_CHECK_EVERY_MS

  for (const coll of COLLECTIONS) {
    const ref = db.collection('shops').doc(shopId).collection(coll)
    let full = m.lastRun === 0
    if (!full && countCheck) {
      const n = (await ref.count().get()).data().count
      reads += Math.max(1, Math.ceil(n / 1000))
      if (n !== state[coll].size) full = true
    }
    const snap = full ? await ref.get() : await ref.where('updatedAt', '>=', since).get()
    reads += Math.max(1, snap.size)
    if (full) state[coll] = new Map()
    for (const d of snap.docs) state[coll].set(d.id, docJson(d))
    changed[coll] = snap.size
  }

  // Audit log: append-only, so just append new entries to the month file.
  const audit = await db.collection('shops').doc(shopId).collection('auditLogs').where('at', '>=', since).orderBy('at').get()
  reads += Math.max(1, audit.size)
  let appended = 0
  const seenByMonth = new Map()
  for (const d of audit.docs) {
    const e = docJson(d)
    const month = new Date(e.at?.__ts ?? Date.now()).toISOString().slice(0, 7)
    const file = join(OUT, 'audit', shopId, `${month}.jsonl`)
    if (!seenByMonth.has(file)) {
      ensure(join(OUT, 'audit', shopId))
      seenByMonth.set(file, new Set(existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id) : []))
    }
    const seen = seenByMonth.get(file)
    if (seen.has(e.id)) continue
    appendFileSync(file, JSON.stringify(e) + '\n')
    seen.add(e.id)
    appended++
  }

  // Full snapshot: stable order, one record per line.
  const backup = {
    format: 'gota-dhaaga-backup',
    version: 1,
    shopId,
    exportedAt: new Date().toISOString(),
    source: 'nightly',
    collections: Object.fromEntries(COLLECTIONS.map((c) => [c, [...state[c].values()].sort((a, b) => a.id.localeCompare(b.id))])),
  }
  const lines = ['{', `"format":"gota-dhaaga-backup","version":1,"shopId":${JSON.stringify(shopId)},"exportedAt":${JSON.stringify(backup.exportedAt)},"source":"nightly","collections":{`]
  COLLECTIONS.forEach((c, i) => {
    lines.push(`${JSON.stringify(c)}:[`)
    backup.collections[c].forEach((d, j) => lines.push(JSON.stringify(d) + (j < backup.collections[c].length - 1 ? ',' : '')))
    lines.push(']' + (i < COLLECTIONS.length - 1 ? ',' : ''))
  })
  lines.push('}}')
  const text = lines.join('\n') + '\n'
  JSON.parse(text) // never write a corrupt snapshot
  ensure(join(OUT, 'latest'))
  writeFileSync(latestPath, text)
  ensure(join(OUT, 'daily', today))
  writeFileSync(join(OUT, 'daily', today, `${shopId}.json.gz`), gzipSync(text))

  // Consistency report.
  const live = (c) => [...state[c].values()].filter((d) => !d.isDeleted)
  const p = (r) => Math.round(r * 100)
  const bal = new Map()
  for (const b of live('bills')) bal.set(b.customerId, (bal.get(b.customerId) ?? 0) + p(b.total))
  for (const x of live('payments')) bal.set(x.customerId, (bal.get(x.customerId) ?? 0) + (x.kind === 'opening' ? p(x.amount) : -p(x.amount)))
  const dues = [...bal.values()].filter((v) => v > 0).reduce((a, b) => a + b, 0) / 100
  const ids = (c) => new Set([...state[c].keys()])
  const customers = ids('customers')
  const bills = ids('bills')
  const orders = ids('orders')
  const problems = [
    ...live('orders').filter((o) => !customers.has(o.customerId)).map((o) => `order ${o.orderNumber}: customer ${o.customerId} missing`),
    ...live('bills').filter((b) => b.orderId && !orders.has(b.orderId)).map((b) => `bill ${b.billNumber}: order ${b.orderId} missing`),
    ...live('payments').filter((x) => x.billId && !bills.has(x.billId)).map((x) => `payment ${x.id}: bill ${x.billId} missing`),
  ]
  ensure(join(OUT, 'reports'))
  writeFileSync(
    join(OUT, 'reports', `${shopId}.txt`),
    [
      `Gota & Dhaaga backup report — ${shopId} — ${new Date().toISOString()}`,
      ...COLLECTIONS.map((c) => `${c}: ${live(c).length} live, ${state[c].size} total (${changed[c]} changed since last run)`),
      `audit entries appended: ${appended}`,
      `total dues (bills − payments): ₹${dues.toFixed(2)}`,
      problems.length ? `PROBLEMS (${problems.length}):\n  ${problems.join('\n  ')}` : 'consistency: OK',
    ].join('\n') + '\n',
  )

  // Weekly Excel snapshot (Sundays, or the first run).
  if (new Date().getUTCDay() === 0 || m.lastRun === 0) {
    const { default: writeExcelFile } = await import('write-excel-file/node')
    const s = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))
    const sheet = (name, header, rows) => ({ sheet: name, stickyRowsCount: 1, data: [header.map((h) => ({ value: h, fontWeight: 'bold' })), ...rows.map((r) => r.map((v) => ({ value: v })))] })
    ensure(join(OUT, 'excel', shopId))
    await writeExcelFile([
      sheet('Customers', ['Name', 'Phone', 'Area', 'Balance'], live('customers').map((c) => [s(c.name), s(c.phone), s(c.area), (bal.get(c.id) ?? 0) / 100])),
      sheet('Orders', ['Order', 'Date', 'Customer', 'Status', 'Delivery'], live('orders').map((o) => [s(o.orderNumber), s(o.orderDate), s(o.customerName), s(o.status), s(o.deliveryDate)])),
      sheet('Bills', ['Bill', 'Date', 'Customer', 'Total'], live('bills').map((b) => [s(b.billNumber), s(b.billDate), s(b.customerName), Number(b.total) || 0])),
      sheet('Payments', ['Date', 'Customer', 'Amount', 'Mode', 'Kind'], live('payments').map((x) => [s(x.date), s(x.customerName), Number(x.amount) || 0, s(x.mode), s(x.kind)])),
    ]).toFile(join(OUT, 'excel', shopId, `${today}.xlsx`))
  }

  meta.shops[shopId] = { lastRun: runStart, lastFullCheck: countCheck ? runStart : m.lastFullCheck }
  summary.push(`${shopId}: ${Object.entries(changed).map(([c, n]) => `${c} ${n}`).join(', ')}, audit +${appended}, dues ₹${dues.toFixed(0)}${problems.length ? `, ${problems.length} PROBLEMS` : ''}`)
}

// Keep 90 days of dated snapshots.
if (existsSync(join(OUT, 'daily'))) {
  const cutoff = new Date(Date.now() - RETAIN_DAYS * 86_400_000).toISOString().slice(0, 10)
  for (const day of readdirSync(join(OUT, 'daily'))) if (day < cutoff) rmSync(join(OUT, 'daily', day), { recursive: true, force: true })
}
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n')
console.log(`Backup ${today}: ~${reads} reads`)
for (const line of summary) console.log(line)
