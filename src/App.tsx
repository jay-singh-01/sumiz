import { useState } from 'react'
import { formatDate, formatINR } from '@/lib/format'

// Phase 1 placeholder: proves Tailwind, the path alias and Indian formatting
// are wired up. Replaced by the real app shell in Phase 3.
export default function App() {
  const [today] = useState(() => new Date())
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl font-bold text-rani">गोटा & धागा</h1>
      <p className="text-lg text-indigo-royal">Gota &amp; Dhaaga · by Sumitra · राजस्थानी सिलाई</p>
      <p className="italic text-gold">हर टांके में अपनापन</p>
      <p className="rounded-xl border-2 border-gold bg-white px-4 py-3 tabular-nums">
        {formatINR(125000)} · {formatDate(today)}
      </p>
      <p className="text-sm text-ink/70">Setup complete — Phase 1</p>
    </main>
  )
}
