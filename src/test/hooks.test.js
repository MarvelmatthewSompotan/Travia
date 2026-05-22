import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSessionsList, useSavedPlans } from '../hooks/useChat'

// Mock the api module so tests never hit a real server.
vi.mock('../services/api', () => ({
  api: {
    listSessions: vi.fn(),
    listPlans: vi.fn(),
    savePlan: vi.fn(),
    deletePlan: vi.fn(),
  },
}))

import { api } from '../services/api'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── useSessionsList ───────────────────────────────────────────────────────────
describe('useSessionsList', () => {
  it('returns an empty array initially', () => {
    api.listSessions.mockResolvedValue([])
    const { result } = renderHook(() => useSessionsList(0))
    expect(result.current.sessions).toEqual([])
  })

  it('populates sessions after the API resolves', async () => {
    const sessions = [
      { id: 'a1', title: 'Trip to Bali', updated_at: '2025-09-01T00:00:00Z' },
    ]
    api.listSessions.mockResolvedValue(sessions)
    const { result } = renderHook(() => useSessionsList(0))
    await waitFor(() => expect(result.current.sessions).toHaveLength(1))
    expect(result.current.sessions[0].title).toBe('Trip to Bali')
  })

  it('returns an empty array when the API fails', async () => {
    api.listSessions.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useSessionsList(0))
    await waitFor(() => {
      // stays empty and does not throw
      expect(result.current.sessions).toEqual([])
    })
  })

  it('re-fetches when refreshNonce changes', async () => {
    api.listSessions.mockResolvedValue([])
    const { rerender } = renderHook(({ nonce }) => useSessionsList(nonce), {
      initialProps: { nonce: 0 },
    })
    expect(api.listSessions).toHaveBeenCalledTimes(1)
    rerender({ nonce: 1 })
    await waitFor(() => expect(api.listSessions).toHaveBeenCalledTimes(2))
  })
})

// ── useSavedPlans ─────────────────────────────────────────────────────────────
describe('useSavedPlans', () => {
  it('starts with an empty plans array', () => {
    api.listPlans.mockResolvedValue([])
    const { result } = renderHook(() => useSavedPlans(0))
    expect(result.current.plans).toEqual([])
  })

  it('populates plans after the API resolves', async () => {
    const plans = [
      { id: 1, title: 'Bali', brief: 'Beach', plan: {}, plan_key: 'k1' },
    ]
    api.listPlans.mockResolvedValue(plans)
    const { result } = renderHook(() => useSavedPlans(0))
    await waitFor(() => expect(result.current.plans).toHaveLength(1))
    expect(result.current.plans[0].title).toBe('Bali')
  })

  it('reload() re-fetches plans from the API', async () => {
    api.listPlans
      .mockResolvedValueOnce([{ id: 1, title: 'Old' }])
      .mockResolvedValueOnce([{ id: 1, title: 'New' }])
    const { result } = renderHook(() => useSavedPlans(0))
    await waitFor(() => expect(result.current.plans[0]?.title).toBe('Old'))
    await result.current.reload()
    await waitFor(() => expect(result.current.plans[0].title).toBe('New'))
  })

  it('deletePlan() calls api.deletePlan then reloads', async () => {
    api.listPlans.mockResolvedValue([{ id: 5, title: 'Trip' }])
    api.deletePlan.mockResolvedValue(null)
    const { result } = renderHook(() => useSavedPlans(0))
    await waitFor(() => expect(result.current.plans).toHaveLength(1))
    api.listPlans.mockResolvedValue([])
    await result.current.deletePlan(5)
    expect(api.deletePlan).toHaveBeenCalledWith(5)
    await waitFor(() => expect(result.current.plans).toHaveLength(0))
  })

  it('sets error state when listPlans fails', async () => {
    api.listPlans.mockRejectedValue(new Error('Server error'))
    const { result } = renderHook(() => useSavedPlans(0))
    await waitFor(() => expect(result.current.error).toBe('Server error'))
  })
})
