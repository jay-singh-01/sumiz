import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { AuthGate } from '@/auth/AuthGate'
import { AppShell } from '@/app/AppShell'
import { ComingSoon } from '@/app/ComingSoon'
import { HomePage } from '@/app/HomePage'
import { CustomerFormPage } from '@/features/customers/CustomerForm'
import { CustomerProfilePage } from '@/features/customers/CustomerProfile'
import { CustomersPage } from '@/features/customers/CustomersPage'
import { MeasurementPage } from '@/features/measurements/MeasurementForm'
import { OrderDetailPage } from '@/features/orders/OrderDetail'
import { OrdersPage } from '@/features/orders/OrdersPage'
import { OrderWizardPage } from '@/features/orders/OrderWizard'
import { LanguageProvider } from '@/i18n'

const master = () => import('@/features/master/MasterDataPage')

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'customers/new', element: <CustomerFormPage /> },
      { path: 'customers/:id', element: <CustomerProfilePage /> },
      { path: 'customers/:id/edit', element: <CustomerFormPage /> },
      { path: 'customers/:id/measure', element: <MeasurementPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'orders/new', element: <OrderWizardPage /> },
      { path: 'orders/:id', element: <OrderDetailPage /> },
      { path: 'orders/:id/edit', element: <OrderWizardPage /> },
      { path: 'payments/*', element: <ComingSoon title="home_payment" phase={6} /> },
      { path: 'summary/*', element: <ComingSoon title="nav_summary" phase={8} /> },
      { path: 'master', lazy: async () => ({ Component: (await master()).MasterDataPage }) },
      { path: 'master/garments/:id', lazy: async () => ({ Component: (await master()).GarmentEditorPage }) },
      { path: 'master/addons/:id', lazy: async () => ({ Component: (await master()).AddOnEditorPage }) },
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
