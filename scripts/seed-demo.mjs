// Seeds realistic demo data into the LOCAL EMULATOR (never a real project):
// customers, orders across the last 12 months (busier around Teej, Gangaur,
// Diwali and the wedding season), bills, advances and payments.
//
//   npm run emulators            # terminal 1
//   (sign in once in the app and finish shop setup)
//   node scripts/seed-demo.mjs --customers 40 --orders 220
//
// Writes into the most recently created shop. Also used for the large-dataset
// performance test: --customers 2000 --orders 10000
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDocs, Timestamp, writeBatch } from 'firebase/firestore'

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? Number(process.argv[i + 1]) : def
}
const N_CUSTOMERS = arg('customers', 40)
const N_ORDERS = arg('orders', 220)

let seed = 42
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
const pick = (xs) => xs[Math.floor(rnd() * xs.length)]
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const FIRST = ['सुनीता', 'रीना', 'पूजा', 'कमला', 'गीता', 'सरला', 'लक्ष्मी', 'प्रिया', 'मीना', 'शांति', 'अनीता', 'नेहा', 'ममता', 'सीमा', 'उषा', 'किरण', 'रेखा', 'ज्योति', 'मंजू', 'सुमन']
const LAST = ['शर्मा', 'अग्रवाल', 'जैन', 'राठौड़', 'शेखावत', 'माहेश्वरी', 'गुप्ता', 'चौधरी', 'सोनी', 'खंडेलवाल']
const AREAS = ['शास्त्री नगर', 'मालवीय नगर', 'राजा पार्क', 'वैशाली नगर', 'मानसरोवर', 'सी-स्कीम', 'झोटवाड़ा']

// Relative busyness per month (Jan..Dec): wedding season, Gangaur, Teej, Diwali.
const MONTH_WEIGHT = [1.6, 1.4, 1.5, 1.3, 0.8, 0.6, 0.8, 1.4, 0.9, 1.6, 2.2, 1.7]

const env = await initializeTestEnvironment({ projectId: 'demo-gota-dhaaga', firestore: { host: '127.0.0.1', port: 8080 } })

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()
  const shops = (await getDocs(collection(db, 'shops'))).docs.sort((a, b) => (b.get('createdAt')?.toMillis() ?? 0) - (a.get('createdAt')?.toMillis() ?? 0))
  if (!shops.length) throw new Error('No shop yet: sign in to the app on the emulator and finish setup first.')
  const shopId = shops[0].id
  const owner = shops[0].get('ownerUid')
  const garments = (await getDocs(collection(db, `shops/${shopId}/garmentTypes`))).docs.map((d) => ({ id: d.id, ...d.data() }))
  if (!garments.length) throw new Error('Shop has no garment types yet.')
  console.log(`Seeding shop ${shopId}: ${N_CUSTOMERS} customers, ${N_ORDERS} orders`)

  const now = new Date()
  const ts = Timestamp.now()
  const meta = (createdMs) => ({
    version: 1,
    createdBy: owner,
    updatedBy: owner,
    createdAt: Timestamp.fromMillis(createdMs),
    updatedAt: ts, // "now" so the app's delta sync picks everything up
    isDeleted: false,
  })

  let batch = writeBatch(db)
  let ops = 0
  const put = async (path, data) => {
    batch.set(doc(db, path), data)
    if (++ops % 450 === 0) {
      await batch.commit()
      batch = writeBatch(db)
    }
  }

  const customers = []
  for (let i = 0; i < N_CUSTOMERS; i++) {
    const id = `seed-c${i}`
    const created = new Date(now.getFullYear(), now.getMonth() - Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27))
    const c = {
      name: `${pick(FIRST)} ${pick(LAST)}`,
      phone: `9${String(Math.floor(rnd() * 1e9)).padStart(9, '0')}`,
      altPhone: '',
      area: pick(AREAS),
      address: '',
      tags: rnd() < 0.2 ? ['regular'] : [],
      referredBy: '',
      birthday: '',
      anniversary: '',
      notes: '',
      photoUrl: null,
    }
    customers.push({ id, ...c, created })
    await put(`shops/${shopId}/customers/${id}`, { ...c, ...meta(created.getTime()) })
  }

  // Order dates weighted by month busyness.
  const days = []
  for (let back = 365; back >= 0; back--) {
    const d = new Date(now)
    d.setDate(d.getDate() - back)
    days.push({ d, w: MONTH_WEIGHT[d.getMonth()] * (d.getDay() === 0 ? 0.4 : 1) })
  }
  const totalW = days.reduce((s, x) => s + x.w, 0)
  const pickDay = () => {
    let r = rnd() * totalW
    for (const x of days) if ((r -= x.w) <= 0) return x.d
    return days[days.length - 1].d
  }

  const seqByFy = new Map()
  for (let i = 0; i < N_ORDERS; i++) {
    const c = pick(customers)
    const od = pickDay()
    const fy = od.getMonth() >= 3 ? od.getFullYear() : od.getFullYear() - 1
    const fyLabel = `${String(fy % 100).padStart(2, '0')}-${String((fy + 1) % 100).padStart(2, '0')}`
    const seq = (seqByFy.get(fyLabel) ?? 0) + 1
    seqByFy.set(fyLabel, seq)
    const orderNumber = `GD/${fyLabel}/Z${String(seq).padStart(3, '0')}`
    const items = Array.from({ length: 1 + Math.floor(rnd() * 2.2) }, () => {
      const g = pick(garments)
      return {
        garmentTypeId: g.id, garmentName: g.nameHi, qty: rnd() < 0.15 ? 2 : 1, rate: g.defaultRate, addOns: [],
        fabricByCustomer: true, fabricNotes: '', notes: '', measurementId: null, measurementTakenOn: null, measurements: {}, designPhotoUrl: null,
      }
    })
    const total = items.reduce((s, it) => s + it.qty * it.rate, 0)
    const due = new Date(od)
    due.setDate(due.getDate() + 5 + Math.floor(rnd() * 8))
    const ageDays = (now - od) / 86_400_000
    const status = ageDays > 25 ? (rnd() < 0.96 ? 'delivered' : 'cancelled') : pick(['received', 'cutting', 'stitching', 'trial', 'ready', 'delivered'])
    const history = [{ status: 'received', at: od.toISOString(), by: 'seed' }]
    if (status === 'delivered') {
      const dd = new Date(due)
      dd.setDate(dd.getDate() + Math.floor(rnd() * 5) - 2) // mostly around the promise
      history.push({ status: 'delivered', at: (dd > now ? now : dd).toISOString(), by: 'seed' })
    } else if (status !== 'received') history.push({ status, at: od.toISOString(), by: 'seed' })
    const id = `seed-o${i}`
    await put(`shops/${shopId}/orders/${id}`, {
      orderNumber, customerId: c.id, customerName: c.name, customerPhone: c.phone, items,
      orderDate: iso(od), trialDate: '', deliveryDate: iso(due), status, statusHistory: history,
      urgent: rnd() < 0.08, karigarId: null, notes: '', ...meta(od.getTime()),
    })
    if (status === 'cancelled') continue

    const advance = rnd() < 0.7 ? Math.round((total * (0.2 + rnd() * 0.3)) / 50) * 50 : 0
    if (advance > 0)
      await put(`shops/${shopId}/payments/${id}-adv`, {
        customerId: c.id, customerName: c.name, orderId: id, billId: null, amount: advance, mode: rnd() < 0.6 ? 'upi' : 'cash',
        date: iso(od), kind: 'advance', note: orderNumber, ...meta(od.getTime()),
      })
    if (status === 'delivered' || status === 'ready') {
      const bd = new Date(history[history.length - 1].at)
      await put(`shops/${shopId}/bills/${id}-bill`, {
        billNumber: orderNumber, customerId: c.id, customerName: c.name, customerPhone: c.phone, orderId: id, billDate: iso(bd),
        lines: items.map((it) => ({ name: it.garmentName, qty: it.qty, rate: it.rate, addOns: [] })),
        discount: { type: 'flat', value: 0 }, roundOff: true, total, revision: 1, revisions: [], notes: '', ...meta(bd.getTime()),
      })
      // Most pay in full; some leave dues of various ages.
      const r = rnd()
      const rest = total - advance
      const paid = r < 0.75 ? rest : r < 0.9 ? Math.round(rest / 2 / 50) * 50 : 0
      if (paid > 0 && status === 'delivered')
        await put(`shops/${shopId}/payments/${id}-pay`, {
          customerId: c.id, customerName: c.name, orderId: null, billId: `${id}-bill`, amount: paid, mode: rnd() < 0.6 ? 'upi' : 'cash',
          date: iso(bd), kind: 'payment', note: '', ...meta(bd.getTime()),
        })
    }
  }
  await batch.commit()
  console.log(`Done: ${ops} documents written.`)
})
await env.cleanup()
