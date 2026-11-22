import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { AuthGate } from '@/auth/AuthGate'
import { AppShell } from '@/app/AppShell'
import { ComingSoon } from '@/app/ComingSoon'
import { HomePage } from '@/app/HomePage'
import { LanguageProvider } from '@/i18n'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'customers/*', element: <ComingSoon title="nav_customers" phase={4} /> },
      { path: 'orders/*', element: <ComingSoon title="nav_orders" phase={5} /> },
      { path: 'payments/*', element: <ComingSoon title="home_payment" phase={6} /> },
      { path: 'summary/*', element: <ComingSoon title="nav_summary" phase={8} /> },
      { path: 'settings', lazy: async () => ({ Component: (await import('@/app/SettingsPage')).SettingsPage }) },
      { path: 'design', lazy: async () => ({ Component: (await import('@/app/DesignPage')).DesignPage }) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return (
    <LanguageProvider>
      <AuthGate>
        <RouterProvider router={router} />
      </AuthGate>
    </LanguageProvider>
  )
}
