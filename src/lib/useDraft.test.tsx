import 'fake-indexeddb/auto'
import { act, renderHook, waitFor } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useDraft } from './useDraft'

const strict = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('useDraft', () => {
  it('restores what was typed last time', async () => {
    const a = renderHook(() => useDraft('k1', { name: '' }), { wrapper: strict })
    act(() => a.result.current.setValue({ name: 'सुनीता' }))
    await act(() => sleep(500))
    a.unmount()

    const b = renderHook(() => useDraft('k1', { name: '' }), { wrapper: strict })
    await waitFor(() => expect(b.result.current.value.name).toBe('सुनीता'))
    expect(b.result.current.restored).toBe(true)
  })

  it('does not resurrect a draft after clear (even under StrictMode)', async () => {
    const a = renderHook(() => useDraft('k2', { name: '' }), { wrapper: strict })
    act(() => a.result.current.setValue({ name: 'old' }))
    act(() => a.result.current.clear())
    await act(() => sleep(500))
    a.unmount()

    const b = renderHook(() => useDraft('k2', { name: '' }), { wrapper: strict })
    await act(() => sleep(100))
    expect(b.result.current.value.name).toBe('')
    expect(b.result.current.restored).toBe(false)
  })

  it('never overwrites what the user is already typing', async () => {
    const a = renderHook(() => useDraft('k3', { name: '' }))
    act(() => a.result.current.setValue({ name: 'stale draft' }))
    a.unmount() // flushes

    const b = renderHook(() => useDraft('k3', { name: '' }))
    act(() => b.result.current.setValue({ name: 'typed now' })) // before the draft finishes loading
    await act(() => sleep(100))
    expect(b.result.current.value.name).toBe('typed now')
  })

  it('saves immediately on unmount, without waiting for the debounce', async () => {
    const a = renderHook(() => useDraft('k4', { n: 0 }))
    act(() => a.result.current.setValue({ n: 7 }))
    a.unmount()

    const b = renderHook(() => useDraft('k4', { n: 0 }))
    await waitFor(() => expect(b.result.current.value.n).toBe(7))
  })

  it('reset discards the draft', async () => {
    const a = renderHook(() => useDraft('k5', { name: '' }))
    act(() => a.result.current.setValue({ name: 'x' }))
    act(() => a.result.current.reset({ name: '' }))
    a.unmount()
    const b = renderHook(() => useDraft('k5', { name: '' }))
    await act(() => sleep(100))
    expect(b.result.current.value.name).toBe('')
  })
})
