import { describe, it, expect, vi, beforeEach } from 'vitest'
import { refinePlan } from '../services/refinePlan'

vi.mock('../services/llmProvider', () => ({
  llmGenerate: vi.fn(),
  llmStream: vi.fn(),
  getProvider: vi.fn(() => 'ollama'),
  setProvider: vi.fn(),
}))

import { llmGenerate } from '../services/llmProvider'

const baseArgs = {
  tripInfo: {
    departure_city: 'Manado',
    departure_iata: 'MDC',
    arrival_iata: 'DPS',
    destination_name: 'Bali, Indonesia',
    trip_duration_days: 3,
    outbound_date: '2025-09-15',
  },
  currentPlan: {
    title: 'Best Pick',
    flight: { airline: 'Garuda', price: 180 },
    hotel: { name: 'Beach Resort' },
    places: [{ name: 'Tanah Lot' }, { name: 'Seminyak Beach' }],
  },
  flights: [
    { airline: 'Garuda', price: 180, stops: 0, duration_min: 130 },
    { airline: 'Lion Air', price: 95, stops: 1, duration_min: 150 },
  ],
  hotels: [
    { name: 'Beach Resort', price_per_night: 95, rating: 4.6, hotel_class: '4-star' },
    { name: 'Budget Inn', price_per_night: 30, rating: 3.8, hotel_class: '2-star' },
  ],
  places: [
    { name: 'Tanah Lot', rating: 4.7 },
    { name: 'Seminyak Beach', rating: 4.5 },
    { name: 'Monkey Forest', rating: 4.4 },
  ],
  chatHistory: [{ role: 'user', content: 'Original prompt' }],
  userMessage: 'Swap the hotel for something cheaper',
  pendingRefinement: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── chat mode ──────────────────────────────────────────────────────────────────

describe('refinePlan — chat mode', () => {
  it('returns chat with reply text', async () => {
    llmGenerate.mockResolvedValue('{"kind":"chat","reply":"Tokyo is a vibrant city with amazing food!"}')
    const result = await refinePlan({ ...baseArgs, userMessage: 'what do you think of tokyo?' })
    expect(result.kind).toBe('chat')
    expect(result.reply).toBe('Tokyo is a vibrant city with amazing food!')
  })

  it('returns empty reply string when reply is missing', async () => {
    llmGenerate.mockResolvedValue('{"kind":"chat"}')
    const result = await refinePlan({ ...baseArgs, userMessage: 'thanks!' })
    expect(result.kind).toBe('chat')
    expect(result.reply).toBe('')
  })
})

// ── ask mode ───────────────────────────────────────────────────────────────────

describe('refinePlan — ask mode', () => {
  it('returns ask with question and proposed_changes', async () => {
    llmGenerate.mockResolvedValue(
      '{"kind":"ask","question":"Should I update just the flights or regenerate everything?","proposed_changes":{"outbound_date":"2025-11-15"}}',
    )
    const result = await refinePlan({ ...baseArgs, userMessage: 'go on november' })
    expect(result.kind).toBe('ask')
    expect(result.question).toContain('Should I update')
    expect(result.proposed_changes.outbound_date).toBe('2025-11-15')
  })

  it('returns empty proposed_changes when missing', async () => {
    llmGenerate.mockResolvedValue('{"kind":"ask","question":"What scope?"}')
    const result = await refinePlan({ ...baseArgs, userMessage: 'change dates' })
    expect(result.kind).toBe('ask')
    expect(result.proposed_changes).toEqual({})
  })
})

// ── repick mode ────────────────────────────────────────────────────────────────

describe('refinePlan — repick mode', () => {
  it('returns repick with parsed indices', async () => {
    llmGenerate.mockResolvedValue(
      '{"kind":"repick","flight":0,"hotel":1,"places":[0,1,2],"note":"Switched to Budget Inn"}',
    )
    const result = await refinePlan(baseArgs)
    expect(result.kind).toBe('repick')
    expect(result.flight).toBe(0)
    expect(result.hotel).toBe(1)
    expect(result.places).toEqual([0, 1, 2])
    expect(result.note).toBe('Switched to Budget Inn')
  })

  it('defaults to repick when kind is missing', async () => {
    llmGenerate.mockResolvedValue('{"flight":1,"hotel":0,"places":[0,2],"note":"Changed flight"}')
    const result = await refinePlan(baseArgs)
    expect(result.kind).toBe('repick')
    expect(result.flight).toBe(1)
  })

  it('handles non-integer place indices by filtering them out', async () => {
    llmGenerate.mockResolvedValue('{"kind":"repick","flight":0,"hotel":0,"places":[0,"x",2],"note":""}')
    const result = await refinePlan(baseArgs)
    expect(result.places).toEqual([0, 2])
  })

  it('falls back to current plan indices when flight/hotel are non-numeric', async () => {
    llmGenerate.mockResolvedValue('{"kind":"repick","flight":"bad","hotel":null,"places":[],"note":""}')
    const result = await refinePlan(baseArgs)
    // current plan: Garuda (idx 0), Beach Resort (idx 0)
    expect(result.flight).toBe(0)
    expect(result.hotel).toBe(0)
  })
})

// ── rerun mode ─────────────────────────────────────────────────────────────────

describe('refinePlan — rerun mode', () => {
  it('returns rerun with valid changes and scope=full', async () => {
    llmGenerate.mockResolvedValue(
      '{"kind":"rerun","changes":{"destination_name":"Tokyo, Japan","trip_duration_days":5},"scope":"full","note":"Changing destination"}',
    )
    const result = await refinePlan(baseArgs)
    expect(result.kind).toBe('rerun')
    expect(result.changes.destination_name).toBe('Tokyo, Japan')
    expect(result.changes.trip_duration_days).toBe(5)
    expect(result.scope).toBe('full')
  })

  it('returns scope=flights when only flight dates change', async () => {
    llmGenerate.mockResolvedValue(
      '{"kind":"rerun","changes":{"outbound_date":"2025-11-15"},"scope":"flights","note":"Updated dates"}',
    )
    const result = await refinePlan(baseArgs)
    expect(result.scope).toBe('flights')
    expect(result.changes.outbound_date).toBe('2025-11-15')
  })

  it('defaults scope to full when scope is missing', async () => {
    llmGenerate.mockResolvedValue(
      '{"kind":"rerun","changes":{"outbound_date":"2025-11-15"},"note":""}',
    )
    const result = await refinePlan(baseArgs)
    expect(result.scope).toBe('full')
  })

  it('keeps only valid outbound_date format', async () => {
    llmGenerate.mockResolvedValue('{"kind":"rerun","changes":{"outbound_date":"2025-11-15"},"scope":"flights","note":""}')
    const result = await refinePlan(baseArgs)
    expect(result.changes.outbound_date).toBe('2025-11-15')
  })

  it('rejects malformed outbound_date', async () => {
    llmGenerate.mockResolvedValue('{"kind":"rerun","changes":{"outbound_date":"Nov 15"},"scope":"flights","note":""}')
    const result = await refinePlan(baseArgs)
    expect(result.changes).not.toHaveProperty('outbound_date')
  })

  it('rejects trip_duration_days < 1', async () => {
    llmGenerate.mockResolvedValue('{"kind":"rerun","changes":{"trip_duration_days":0},"scope":"full","note":""}')
    const result = await refinePlan(baseArgs)
    expect(result.changes).not.toHaveProperty('trip_duration_days')
  })

  it('returns empty changes when changes field is missing', async () => {
    llmGenerate.mockResolvedValue('{"kind":"rerun","scope":"full","note":"ok"}')
    const result = await refinePlan(baseArgs)
    expect(result.kind).toBe('rerun')
    expect(result.changes).toEqual({})
  })
})

// ── pending refinement ─────────────────────────────────────────────────────────

describe('refinePlan — pending refinement', () => {
  it('passes pending_refinement context to the LLM call', async () => {
    llmGenerate.mockResolvedValue('{"kind":"rerun","changes":{"outbound_date":"2025-11-15"},"scope":"flights","note":""}')
    await refinePlan({
      ...baseArgs,
      pendingRefinement: { outbound_date: '2025-11-15' },
      userMessage: 'just update the flight',
    })
    const callArg = llmGenerate.mock.calls[0][1]
    expect(callArg).toContain('PENDING CHANGE')
    expect(callArg).toContain('2025-11-15')
  })
})

// ── error cases ────────────────────────────────────────────────────────────────

describe('refinePlan — error cases', () => {
  it('throws when LLM returns no JSON object', async () => {
    llmGenerate.mockResolvedValue('Sorry, I cannot help with that.')
    await expect(refinePlan(baseArgs)).rejects.toThrow('Could not parse')
  })

  it('propagates LLM network errors', async () => {
    llmGenerate.mockRejectedValue(new Error('LLM error 503'))
    await expect(refinePlan(baseArgs)).rejects.toThrow('LLM error 503')
  })
})
