import { useMemo } from 'react'
import { useSession } from '@/auth/AuthGate'
import { useCollection } from '@/data/hooks'
import type { Stored } from '@/data/types'
import type { Payment } from '@/features/payments/schema'
import { allBalances, totalDues } from './ledger'
import type { Bill } from './schema'

/** Bills, payments and derived balances for the whole shop, from the local cache. */
export function useLedger() {
  const { shopId } = useSession()
  const bills = useCollection<Bill>(shopId, 'bills')
  const payments = useCollection<Payment>(shopId, 'payments')
  const balances = useMemo(() => allBalances(bills ?? [], payments ?? []), [bills, payments])
  const dues = useMemo(() => totalDues(balances), [balances])
  const debtors = useMemo(() => [...balances.values()].filter((v) => v > 0).length, [balances])
  return {
    bills: bills as Stored<Bill>[] | undefined,
    payments: payments as Stored<Payment>[] | undefined,
    balances,
    dues,
    debtors,
    loading: bills === undefined || payments === undefined,
  }
}
