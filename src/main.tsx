import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts: bundled and precached, so Hindi renders offline and on bills.
import '@fontsource/mukta/400.css'
import '@fontsource/mukta/600.css'
import '@fontsource/mukta/700.css'
import '@fontsource/rozha-one/400.css'
import './index.css'

const root = createRoot(document.getElementById('root')!)

// App is loaded dynamically so a startup failure (e.g. missing Firebase
// config) shows a readable message instead of a blank white screen.
import('./App.tsx')
  .then(({ default: App }) =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  .catch((err: unknown) => {
    console.error(err)
    const message = err instanceof Error ? err.message : String(err)
    root.render(
      <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 px-4 py-8">
        <h1 className="text-3xl">ऐप शुरू नहीं हो पाया · The app couldn’t start</h1>
        <p className="text-lg">
          कृपया दोबारा खोलें। समस्या बनी रहे तो एडमिन को बताएँ। · Please reopen the app. If this keeps happening, tell the admin.
        </p>
        <pre className="overflow-x-auto rounded-xl border border-line bg-surface p-4 text-sm whitespace-pre-wrap">{message}</pre>
      </main>,
    )
  })
