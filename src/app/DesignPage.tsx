import { Plus, Save, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Navigate } from 'react-router'
import logoUrl from '@/assets/logo.svg'
import logoMonoUrl from '@/assets/logo-mono.svg'
import { Button } from '@/components/ui/button'
import { ArchCard, Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { TextField } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { SwitchRow } from '@/components/ui/switch'
import { toast } from '@/components/ui/toast'
import { Elephant, GotaBorder, JharokhaArch, LeheriyaDivider, MarigoldBurst, Paisley, PeacockFeather } from '@/design/motifs'
import { BillPreview, type BillView } from '@/features/bills/BillPreview'
import { formatINR } from '@/lib/format'
import { useIsManager, useSettings } from './useShop'

// /design — admin-only living style guide for review. Labels are English on
// purpose: this page is for the developer, not for daily use.

const SWATCHES = [
  ['ivory', 'Page background'],
  ['surface', 'Cards'],
  ['surface-2', 'Subtle fill'],
  ['ink', 'Text'],
  ['ink-muted', 'Secondary text'],
  ['rani', 'Rani pink · primary'],
  ['marigold', 'Marigold · highlight'],
  ['saffron', 'Saffron · accent'],
  ['indigo', 'Royal indigo · headings'],
  ['emerald', 'Emerald · success/paid'],
  ['gold', 'Gold · decoration only'],
  ['gold-deep', 'Gold text'],
  ['danger', 'Danger'],
] as const

const SAMPLE_BILL: BillView = {
  number: 'GD/26-27/0042',
  orderNumber: 'GD/26-27/0042',
  date: new Date(2026, 10, 12),
  customer: { name: 'रीना शर्मा', phone: '98290 12345' },
  lines: [
    { name: 'डिज़ाइनर ब्लाउज़ / Designer blouse', qty: 1, rate: 850, addOns: [{ name: 'अस्तर / Lining', rate: 120 }, { name: 'लटकन / Latkan', rate: 80 }] },
    { name: 'राजपूती पोशाक / Rajputi poshak', qty: 1, rate: 2400, addOns: [{ name: 'गोटा-पत्ती / Gota-patti', rate: 600 }] },
    { name: 'साड़ी फ़ॉल-पीको / Fall-pico', qty: 2, rate: 120 },
  ],
  discount: { type: 'flat', value: 100 },
  roundOff: true,
  advance: 1500,
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl">{title}</h2>
      {children}
    </section>
  )
}

export function DesignPage() {
  const isManager = useIsManager()
  const { settings } = useSettings()
  const [layout, setLayout] = useState<'mobile' | 'a4'>('mobile')
  const [paid, setPaid] = useState(false)
  const [burst, setBurst] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [switchOn, setSwitchOn] = useState(true)

  if (!isManager) return <Navigate to="/" replace />

  const bill = paid ? { ...SAMPLE_BILL, payments: [2690] } : SAMPLE_BILL

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-4xl">Design system</h1>
        <p className="text-ink-muted">“Rajasthani Royal Boutique” — tokens, type, components, motifs and the bill.</p>
      </div>

      <Section title="Logo">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            [logoUrl, 'Colour'],
            [logoMonoUrl, 'Single colour (stamps/print)'],
            ['/pwa-192x192.png', 'App icon (maskable)'],
            ['/favicon.svg', 'Favicon'],
          ].map(([src, label]) => (
            <Card key={label} className="flex flex-col items-center gap-2">
              <img src={src} alt={label} className="size-28 object-contain" />
              <span className="text-center text-sm text-ink-muted">{label}</span>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Colour tokens (all text pairs pass WCAG AA — see contrast.test.ts)">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {SWATCHES.map(([token, label]) => (
            <div key={token} className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="h-16" style={{ background: `var(--${token})` }} />
              <div className="p-2 text-sm">
                <div className="font-semibold">--{token}</div>
                <div className="text-ink-muted">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <Card className="flex flex-col gap-2">
          <p className="font-display text-5xl text-rani">गोटा & धागा</p>
          <p className="font-display text-3xl text-indigo-royal">Rozha One — क्ष त्र श्र ज्ञ प्र्</p>
          <p className="text-xl">Mukta body text: नमस्ते रीना जी, आपके कपड़े तैयार हैं। Your clothes are ready.</p>
          <p className="text-ink-muted">Secondary: अंतिम नाप 3 महीने पहले लिया गया</p>
          <p className="money text-3xl font-bold">{formatINR(125000)} · {formatINR(850.5)} · {formatINR(99)}</p>
        </Card>
      </Section>

      <Section title="Buttons (≥48px, icon + word)">
        <div className="flex flex-wrap gap-3">
          <Button>
            <Plus /> नया ऑर्डर
          </Button>
          <Button variant="secondary">
            <Save /> सेव करें
          </Button>
          <Button variant="success">पैसे मिले</Button>
          <Button variant="danger">
            <Trash2 /> मिटाएँ
          </Button>
          <Button variant="ghost">वापस</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Inputs & feedback">
        <Card className="grid gap-4 md:grid-cols-2">
          <TextField label="ग्राहक का नाम" placeholder="जैसे: सुनीता" />
          <TextField label="फ़ोन नंबर" defaultValue="98290" error="10 अंक का नंबर डालें" />
          <SwitchRow label="बड़े अक्षर" hint="सिर्फ़ इस फ़ोन पर" checked={switchOn} onCheckedChange={setSwitchOn} />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-12 w-full" />
          </div>
        </Card>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => toast({ message: 'ग्राहक सेव हुआ', undo: () => toast({ message: 'वापस ले लिया' }) })}>
            Toast with undo
          </Button>
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            Confirm dialog
          </Button>
          <Button variant="success" onClick={() => { setBurst(true); setTimeout(() => setBurst(false), 1700) }}>
            Marigold burst 🌼
          </Button>
        </div>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="रीना जी को हटाएँ?"
          body="चिंता न करें — हटाए गए ग्राहक रीसायकल बिन में रहते हैं और वापस लाए जा सकते हैं।"
          confirmLabel="हाँ, हटाएँ"
          danger
          onConfirm={() => toast({ message: 'हटा दिया', undo: () => undefined })}
        />
        <MarigoldBurst show={burst} />
      </Section>

      <Section title="Cards & motifs">
        <div className="grid gap-4 md:grid-cols-2">
          <ArchCard title="Jharokha arch card">
            <p>Section card with arch crest and gota-patti edge.</p>
          </ArchCard>
          <Card className="flex flex-col gap-3">
            <JharokhaArch className="h-16 text-gold" />
            <GotaBorder className="h-3 text-gold" />
            <LeheriyaDivider />
            <div className="flex items-end justify-around">
              <Paisley className="h-20 w-16 text-gold" />
              <PeacockFeather className="h-24 w-12" />
              <Elephant className="h-20 w-28 text-indigo-royal" />
            </div>
          </Card>
        </div>
      </Section>

      <Section title="The bill">
        <div className="flex flex-wrap gap-3">
          <Button variant={layout === 'mobile' ? 'primary' : 'secondary'} size="md" onClick={() => setLayout('mobile')}>
            WhatsApp portrait
          </Button>
          <Button variant={layout === 'a4' ? 'primary' : 'secondary'} size="md" onClick={() => setLayout('a4')}>
            A4
          </Button>
          <Button variant={paid ? 'success' : 'secondary'} size="md" onClick={() => setPaid((p) => !p)}>
            {paid ? 'Showing PAID' : 'Show PAID stamp'}
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl bg-surface-2 p-4">
          <div className="mx-auto w-fit shadow-2xl">
            <BillPreview bill={bill} shop={settings} layout={layout} />
          </div>
        </div>
      </Section>
    </div>
  )
}
