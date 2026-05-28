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
    flight: { airline: 'Garuda' },
    hotel: { name: 'Beach Resort' },
    places: [{ name: 'Tanah Lot' }],
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
  chatHistory: [
    { role: 'user', content: 'Original prompt' },
  ],
  userMessage: 'Swap the hotel for something cheaper',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('refinePlan — repick mode', () => {
  it('returns repick with parsed indices', async () => {
    llmGenerate.mockResolvedValue(
      '{"kind":"repick","flight":0,"hotel":1,"places":[0,1,2],"note":"Switched to Budget Inn"}'
    )
    const result = await refinePlan(baseArgs)
    expect(result.kind).toBe('repick')
    expect(result.flight).toBe(0)
    expect(result.hotel).toBe(1)
    expect(result.places).toEqual([0, 1, 2])
    expect(result.note).toBe('Switched to Budget Inn')
  })

  it('defaults to repick when kind is missing', async () => {
    llmGenerate.mockResolvedValue(
      '{"flight":1,"hotel":0,"places":[0,2],"note":"Changed flight"}'
    )
    const result = await refinePlan(baseArgs)
    expect(result.kind).toBe('repick')
    expect(result.flight).toBe(1)
  })

  it('handles non-integer place indices by filtering them out', async () => {
    llmGenerate.mockResolvedValue(
      '{"kind":"repick","flight":0,"hotel":0,"places":[0,"x",2],"note":""}'
    )
    const result = await refinePlan(baseArgs)
    // "x" → Number("x") = NaN → Number.isInteger(NaN) = false → filtered
    expect(result.places).toEqual([0, 2])
  })

  it('falls back to 0 for flight/hotel when value is non-numeric', async () => {
    llmGenerate.mockResolvedValue(
      '{"kind":"repick","flight":"bad","hotel":null,"places":[],"note":""}'
    )
    const result = await refinePlan(baseArgs)
    expect(result.flight).toBe(0)
    expect(result.hotel).toBe(0)
  })
})

describe('refinePlan — rerun mode', () => {
  it('returns rerun with valid changes', async () => {
    llmGenerate.mockResolvedValue(
      '{"kind":"rerun","changes":{"destination_name":"Tokyo, Japan","trip_duration_days":5},"note":"Changing destination"}'
    )
    const result = await refinePlan(baseArgs)
    expect(result.kind).toBe('rerun')
    expect(result.changes.destination_name).toBe('Tokyo, Japan')
    expect(result.changes.trip_duration_days).toBe(5)
    expect(result.note).toBe('Changing destination')
  })

  it('keeps only valid outbound_date format', async () => {
    llmGenerate.mockResolvedValue(
      '{"kind":"rerun","changes":{"outbound_date":"2025-11-15"},"note":""}'
    )
    const result = await refinePlan(baseArgs)
    expect(result.changes.outbound_date).toBe('2025-11-15')
  })

  it('rejects malformed outbound_date', async () => {
    llmGenerate.mockResolvedValue(
      '{"kind":"rerun","changes":{"outbound_date":"Nov 15"},"note":""}'
    )
    const result = await refinePlan(baseArgs)
    expect(result.changes).not.toHaveProperty('outbound_date')
  })

  it('rejects trip_duration_days < 1', async () => {
    llmGenerate.mockResolvedValue(
      '{"kind":"rerun","changes":{"trip_duration_days":0},"note":""}'
    )
    const result = await refinePlan(baseArgs)
    expect(result.changes).not.toHaveProperty('trip_duration_days')
  })

  it('returns empty changes object when changes field is missing', async () => {
    llmGenerate.mockResolvedValue('{"kind":"rerun","note":"ok"}')
    const result = await refinePlan(baseArgs)
    expect(result.kind).toBe('rerun')
    expect(result.changes).toEqual({})
  })
})

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
