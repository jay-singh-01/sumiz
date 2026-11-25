import { StrictMode, useEffect, useState, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts: bundled and precached, so Hindi renders offline and on bills.
import '@fontsource/mukta/400.css'
import '@fontsource/mukta/600.css'
import '@fontsource/mukta/700.css'
import '@fontsource/rozha-one/400.css'
import './index.css'
import { Splash } from './app/Splash'

function StartupError({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-4 px-4 py-8">
      <h1 className="text-3xl">ऐप शुरू नहीं हो पाया · The app couldn’t start</h1>
      <p className="text-lg">
        कृपया दोबारा खोलें। समस्या बनी रहे तो एडमिन को बताएँ। · Please reopen the app. If this keeps happening, tell the admin.
      </p>
      <pre className="overflow-x-auto rounded-xl border border-line bg-surface p-4 text-sm whitespace-pre-wrap">{message}</pre>
    </main>
  )
}

/**
 * The splash plays while the app (and Firebase) load underneath. App is
 * imported dynamically so a startup failure (e.g. missing Firebase config)
 * shows a readable message instead of a blank white screen.
 */
function Root() {
  const [App, setApp] = useState<ComponentType | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    import('./App.tsx')
      .then((m) => setApp(() => m.default))
      .catch((err: unknown) => {
        console.error(err)
        setError(err instanceof Error ? err.message : String(err))
      })
  }, [])
  return (
    <>
      {error ? <StartupError message={error} /> : App ? <App /> : null}
      <Splash />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
