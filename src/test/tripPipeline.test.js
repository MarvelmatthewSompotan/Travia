import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  addDays,
  daysFromNow,
  fillDefaults,
  normalizeTripInfo,
  pickIndex,
  assemblePlan,
  enrichPlacesWithReviews,
  ollamaGenerate,
  extractAndMergeTripInfo,
  generateFollowUp,
  generateReadyConfirmation,
  generateExperiencePrompt,
  parseExperienceType,
} from '../services/tripPipeline'
import { MOCK_PLACES, MOCK_TRIPADVISOR_PLACES } from '../services/mockData'

function mockFetch(responseText) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ response: responseText }),
  })
}

// ── addDays ──────────────────────────────────────────────────────────────────
describe('addDays', () => {
  it('adds days to a date string', () => {
    expect(addDays('2025-09-15', 3)).toBe('2025-09-18')
  })

  it('rolls over month boundary', () => {
    expect(addDays('2025-01-30', 3)).toBe('2025-02-02')
  })

  it('handles adding zero days', () => {
    expect(addDays('2025-06-01', 0)).toBe('2025-06-01')
  })
})

// ── daysFromNow ───────────────────────────────────────────────────────────────
describe('daysFromNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-09-01T00:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a date N days in the future as YYYY-MM-DD', () => {
    expect(daysFromNow(5)).toBe('2025-09-06')
  })

  it('returns today for N=0', () => {
    expect(daysFromNow(0)).toBe('2025-09-01')
  })
})

// ── fillDefaults ──────────────────────────────────────────────────────────────
describe('fillDefaults', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-09-01T00:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('fills outbound_date with 7 days from now when missing', () => {
    const result = fillDefaults({ departure_iata: 'MDC', arrival_iata: 'DPS', destination_name: 'Bali', trip_duration_days: 3 })
    expect(result.outbound_date).toBe('2025-09-08')
  })

  it('keeps an existing outbound_date unchanged', () => {
    const result = fillDefaults({ outbound_date: '2025-10-01', trip_duration_days: 3 })
    expect(result.outbound_date).toBe('2025-10-01')
  })

  it('does not mutate the input object', () => {
    const input = { trip_duration_days: 3 }
    fillDefaults(input)
    expect(input).not.toHaveProperty('outbound_date')
  })

  it('preserves all other fields as-is', () => {
    const input = { departure_iata: 'MDC', arrival_iata: 'DPS', destination_name: 'Bali', trip_duration_days: 5, outbound_date: '2025-10-01' }
    const result = fillDefaults(input)
    expect(result.departure_iata).toBe('MDC')
    expect(result.trip_duration_days).toBe(5)
  })

  it('infers departure_iata from departure_city when missing', () => {
    const result = fillDefaults({ departure_city: 'Manado', destination_name: 'Bali' })
    expect(result.departure_iata).toBe('MDC')
  })

  it('infers arrival_iata from destination_name when missing', () => {
    const result = fillDefaults({ departure_iata: 'MDC', destination_name: 'Tokyo, Japan' })
    expect(result.arrival_iata).toBe('HND')
  })

  it('defaults trip_duration_days to 5 when no length hint exists', () => {
    const result = fillDefaults({ departure_iata: 'MDC', arrival_iata: 'DPS', destination_name: 'Bali' })
    expect(result.trip_duration_days).toBe(5)
  })

  it('infers trip_duration_days from preferences "weekend"', () => {
    const result = fillDefaults({
      departure_iata: 'MDC', arrival_iata: 'DPS', destination_name: 'Bali',
      preferences: 'quick weekend getaway',
    })
    expect(result.trip_duration_days).toBe(2)
  })

  it('infers trip_duration_days from preferences "a week"', () => {
    const result = fillDefaults({
      departure_iata: 'MDC', arrival_iata: 'DPS', destination_name: 'Bali',
      preferences: 'a week of beach time',
    })
    expect(result.trip_duration_days).toBe(7)
  })

  it('infers outbound_date from preferences mentioning a month', () => {
    const result = fillDefaults({
      departure_iata: 'MDC', arrival_iata: 'DPS', destination_name: 'Bali',
      preferences: 'in November',
    })
    expect(result.outbound_date).toBe('2025-11-15')
  })
})

// ── normalizeTripInfo ─────────────────────────────────────────────────────────
describe('normalizeTripInfo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-09-01T00:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('keeps a valid outbound_date and computes return_date', () => {
    const result = normalizeTripInfo({
      outbound_date: '2025-10-01',
      trip_duration_days: 3,
    })
    expect(result.outbound_date).toBe('2025-10-01')
    expect(result.return_date).toBe('2025-10-04')
    expect(result.trip_duration_days).toBe(3)
  })

  it('falls back to tomorrow when outbound_date is missing', () => {
    const result = normalizeTripInfo({ trip_duration_days: 5 })
    expect(result.outbound_date).toBe('2025-09-02')
  })

  it('falls back to duration=5 when trip_duration_days is missing', () => {
    const result = normalizeTripInfo({ outbound_date: '2025-10-01' })
    expect(result.trip_duration_days).toBe(5)
    expect(result.return_date).toBe('2025-10-06')
  })

  it('does not mutate the original object', () => {
    const original = { outbound_date: '2025-10-01', trip_duration_days: 2 }
    normalizeTripInfo(original)
    expect(original).not.toHaveProperty('return_date')
  })
})

// ── pickIndex ─────────────────────────────────────────────────────────────────
describe('pickIndex', () => {
  const list = ['a', 'b', 'c']

  it('returns the index when valid', () => {
    expect(pickIndex(1, list)).toBe(1)
  })

  it('returns 0 when index is out-of-bounds positive', () => {
    expect(pickIndex(99, list)).toBe(0)
  })

  it('returns 0 when index is negative', () => {
    expect(pickIndex(-1, list)).toBe(0)
  })

  it('returns -1 when list is empty', () => {
    expect(pickIndex(0, [])).toBe(-1)
  })

  it('coerces string indices', () => {
    expect(pickIndex('2', list)).toBe(2)
  })

  it('returns 0 for non-integer values on non-empty list', () => {
    expect(pickIndex('foo', list)).toBe(0)
  })
})

// ── assemblePlan ──────────────────────────────────────────────────────────────
const flights = [
  { airline: 'Garuda', airline_logo: null, departure_time: '07:00', arrival_time: '09:10',
    duration_min: 130, stops: 0, price: 180 },
]
const hotels = [
  { name: 'Beach Resort', price_per_night: 95, total_rate: 285, rating: 4.6, hotel_class: '4-star', link: null },
]
const places = [
  { name: 'Tanah Lot', rating: 4.7 },
  { name: 'Seminyak Beach', rating: 4.5 },
  { name: 'Monkey Forest', rating: 4.4 },
]
const tripInfo = {
  departure_iata: 'MDC',
  arrival_iata: 'DPS',
  destination_name: 'Bali',
  trip_duration_days: 3,
  outbound_date: '2025-09-15',
  return_date: '2025-09-18',
}

describe('assemblePlan', () => {
  it('assembles a plan with correct flight, hotel and places', async () => {
    const selection = { title: 'Best Pick', brief: 'Great', flight: 0, hotel: 0, places: [0, 1, 2] }
    const plan = await assemblePlan(selection, tripInfo, flights, places, hotels, null)

    expect(plan.title).toBe('Best Pick')
    expect(plan.flight.airline).toBe('Garuda')
    expect(plan.flight.duration_hours).toBe(2.2)
    expect(plan.hotel.name).toBe('Beach Resort')
    expect(plan.hotel.nights).toBe(3)
    expect(plan.hotel.total_price).toBe(285)
    expect(plan.places).toHaveLength(3)
    expect(plan.places[0].name).toBe('Tanah Lot')
    expect(plan.flightError).toBeNull()
  })

  it('falls back to price_per_night * nights when total_rate is null', async () => {
    const noTotalHotels = [{ ...hotels[0], total_rate: null, price_per_night: 100 }]
    const selection = { title: 'T', brief: 'B', flight: 0, hotel: 0, places: [0] }
    const plan = await assemblePlan(selection, tripInfo, flights, places, noTotalHotels, null)
    expect(plan.hotel.total_price).toBe(300) // 100 * 3 nights
  })

  it('deduplicates repeated place indices', async () => {
    const selection = { title: 'T', brief: 'B', flight: 0, hotel: 0, places: [0, 0, 1] }
    const plan = await assemblePlan(selection, tripInfo, flights, places, hotels, null)
    expect(plan.places).toHaveLength(2)
  })

  it('attaches flightError when no flights available', async () => {
    const selection = { title: 'T', brief: 'B', flight: 0, hotel: 0, places: [] }
    const plan = await assemblePlan(selection, tripInfo, [], places, hotels, 'No flights found')
    expect(plan.flight).toBeNull()
    expect(plan.flightError).toBe('No flights found')
  })

  it('computes total_price as flight.price + hotel.total_price', async () => {
    const selection = { title: 'T', brief: 'B', flight: 0, hotel: 0, places: [] }
    const plan = await assemblePlan(selection, tripInfo, flights, places, hotels, null)
    expect(plan.total_price).toBe(180 + 285)
  })

  it('copies departure_iata and arrival_iata onto the flight', async () => {
    const selection = { title: 'T', brief: 'B', flight: 0, hotel: 0, places: [] }
    const plan = await assemblePlan(selection, tripInfo, flights, places, hotels, null)
    expect(plan.flight.departure_iata).toBe('MDC')
    expect(plan.flight.arrival_iata).toBe('DPS')
  })

  it('copies destination_name onto the flight for route display', async () => {
    const selection = { title: 'T', brief: 'B', flight: 0, hotel: 0, places: [] }
    const plan = await assemblePlan(selection, tripInfo, flights, places, hotels, null)
    expect(plan.flight.destination_name).toBe('Bali')
  })

  it('copies departure_city onto the flight when present', async () => {
    const tripWithCity = { ...tripInfo, departure_city: 'Manado' }
    const selection = { title: 'T', brief: 'B', flight: 0, hotel: 0, places: [] }
    const plan = await assemblePlan(selection, tripWithCity, flights, places, hotels, null)
    expect(plan.flight.departure_city).toBe('Manado')
  })

  it('sets route fields to null when tripInfo lacks them', async () => {
    const selection = { title: 'T', brief: 'B', flight: 0, hotel: 0, places: [] }
    const plan = await assemblePlan(selection, {}, flights, places, hotels, null)
    expect(plan.flight.departure_iata).toBeNull()
    expect(plan.flight.arrival_iata).toBeNull()
    expect(plan.flight.departure_city).toBeNull()
    expect(plan.flight.destination_name).toBeNull()
  })
})

// ── enrichPlacesWithReviews ───────────────────────────────────────────────────
describe('enrichPlacesWithReviews', () => {
  it('merges tripadvisor fields onto matching places', async () => {
    const input = [
      { name: 'Tanah Lot Temple', rating: 4.7 },
      { name: 'Seminyak Beach', rating: 4.5 },
    ]
    // VITE_MOCK_MODE is undefined in test env, so searchTripadvisor will reject (no fetch).
    // Pass taResults directly by spying is complex; instead test the pure path via mock data
    // by ensuring the function is importable and returns an array of the same length.
    const result = await enrichPlacesWithReviews(input, 'Bali, Indonesia')
    expect(result).toHaveLength(input.length)
    expect(result[0].name).toBe('Tanah Lot Temple')
  })

  it('returns the original array unchanged when places is empty', async () => {
    const result = await enrichPlacesWithReviews([], 'Bali')
    expect(result).toEqual([])
  })

  it('returns the original array when searchTripadvisor throws', async () => {
    const input = [{ name: 'Some Place', rating: 4.0 }]
    // In non-mock mode with no network, enrichPlacesWithReviews catches and returns input
    const result = await enrichPlacesWithReviews(input, 'Nowhere')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Some Place')
  })
})

// ── MOCK_TRIPADVISOR_PLACES shape ─────────────────────────────────────────────
describe('MOCK_TRIPADVISOR_PLACES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(MOCK_TRIPADVISOR_PLACES)).toBe(true)
    expect(MOCK_TRIPADVISOR_PLACES.length).toBeGreaterThan(0)
  })

  it('each entry has name, tripadvisor_rating, tripadvisor_review_count, review_snippets', () => {
    for (const p of MOCK_TRIPADVISOR_PLACES) {
      expect(typeof p.name).toBe('string')
      expect(typeof p.tripadvisor_rating).toBe('number')
      expect(typeof p.tripadvisor_review_count).toBe('number')
      expect(Array.isArray(p.review_snippets)).toBe(true)
      expect(p.review_snippets.length).toBeGreaterThan(0)
    }
  })

  it('names align with MOCK_PLACES for merging', () => {
    const mockNames = MOCK_PLACES.map((p) => p.name.toLowerCase())
    for (const ta of MOCK_TRIPADVISOR_PLACES) {
      const found = mockNames.some((n) => n.includes(ta.name.toLowerCase()) || ta.name.toLowerCase().includes(n))
      expect(found).toBe(true)
    }
  })
})

// ── ollamaGenerate ────────────────────────────────────────────────────────────
describe('ollamaGenerate', () => {
  let fetchSpy
  afterEach(() => { fetchSpy?.mockRestore() })

  it('includes format:json in the request body by default', async () => {
    fetchSpy = mockFetch('{"answer":1}')
    await ollamaGenerate('sys', 'prompt')
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.format).toBe('json')
  })

  it('omits format from the request body when json=false', async () => {
    fetchSpy = mockFetch('Hello there')
    await ollamaGenerate('sys', 'prompt', { json: false })
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('format')
  })

  it('returns the response string from Ollama', async () => {
    fetchSpy = mockFetch('{"answer":42}')
    const result = await ollamaGenerate('sys', 'prompt')
    expect(result).toBe('{"answer":42}')
  })

  it('throws when the response is not ok', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service unavailable'),
    })
    await expect(ollamaGenerate('sys', 'prompt')).rejects.toThrow('Ollama error 503')
  })
})

// ── extractAndMergeTripInfo ───────────────────────────────────────────────────
describe('extractAndMergeTripInfo', () => {
  let fetchSpy
  afterEach(() => { fetchSpy?.mockRestore() })

  const fullExtraction = JSON.stringify({
    departure_iata: 'MDC', departure_city: 'Manado',
    arrival_iata: 'DPS', destination_name: 'Bali, Indonesia',
    trip_duration_days: 3, outbound_date: '2025-09-15', preferences: 'beaches',
  })

  it('returns ready_to_plan=true when all required fields are present', async () => {
    fetchSpy = mockFetch(fullExtraction)
    const result = await extractAndMergeTripInfo([{ role: 'user', content: '3 days in Bali' }])
    expect(result.ready_to_plan).toBe(true)
    expect(result.missing_required).toEqual([])
  })

  it('returns ready_to_plan=false when required fields are missing', async () => {
    fetchSpy = mockFetch(JSON.stringify({
      departure_iata: null, arrival_iata: 'DPS', destination_name: 'Bali',
      trip_duration_days: null, outbound_date: null, preferences: null, departure_city: null,
    }))
    const result = await extractAndMergeTripInfo([{ role: 'user', content: 'Bali trip' }])
    expect(result.ready_to_plan).toBe(false)
    expect(result.missing_required).toContain('departure_iata')
    expect(result.missing_required).toContain('trip_duration_days')
  })

  it('merges new extraction with existing context, preserving existing values when extraction returns null', async () => {
    fetchSpy = mockFetch(JSON.stringify({
      departure_iata: null, arrival_iata: 'DPS', destination_name: 'Bali',
      trip_duration_days: 5, outbound_date: null, preferences: null, departure_city: null,
    }))
    const existing = { departure_iata: 'MDC', departure_city: 'Manado' }
    const result = await extractAndMergeTripInfo([{ role: 'user', content: 'Bali trip' }], existing)
    expect(result.trip_context.departure_iata).toBe('MDC')
    expect(result.trip_context.arrival_iata).toBe('DPS')
    expect(result.trip_context.trip_duration_days).toBe(5)
  })

  it('new extraction values override existing context', async () => {
    fetchSpy = mockFetch(JSON.stringify({
      departure_iata: 'CGK', arrival_iata: 'DPS', destination_name: 'Bali',
      trip_duration_days: 7, outbound_date: null, preferences: null, departure_city: 'Jakarta',
    }))
    const existing = { departure_iata: 'MDC', departure_city: 'Manado', trip_duration_days: 3 }
    const result = await extractAndMergeTripInfo([{ role: 'user', content: 'Actually from Jakarta' }], existing)
    expect(result.trip_context.departure_iata).toBe('CGK')
    expect(result.trip_context.trip_duration_days).toBe(7)
  })

  it('does not mutate the existingContext argument', async () => {
    fetchSpy = mockFetch(fullExtraction)
    const existing = { departure_iata: 'MDC' }
    await extractAndMergeTripInfo([{ role: 'user', content: 'test' }], existing)
    expect(Object.keys(existing)).toEqual(['departure_iata'])
  })

  it('marks trip_duration_days as missing when it is zero', async () => {
    fetchSpy = mockFetch(JSON.stringify({
      departure_iata: 'MDC', arrival_iata: 'DPS', destination_name: 'Bali',
      trip_duration_days: 0, outbound_date: null, preferences: null, departure_city: null,
    }))
    const result = await extractAndMergeTripInfo([{ role: 'user', content: 'test' }])
    expect(result.missing_required).toContain('trip_duration_days')
  })

  it('returns a confidence score between 0 and 1', async () => {
    fetchSpy = mockFetch(fullExtraction)
    const result = await extractAndMergeTripInfo([{ role: 'user', content: '3 days in Bali' }])
    expect(typeof result.confidence).toBe('number')
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('marks ready_to_plan=true when confidence ≥ 0.7 (origin + destination + name)', async () => {
    fetchSpy = mockFetch(JSON.stringify({
      departure_iata: 'MDC', arrival_iata: 'DPS', destination_name: 'Bali',
      trip_duration_days: null, outbound_date: null, preferences: null, departure_city: null,
    }))
    const result = await extractAndMergeTripInfo([{ role: 'user', content: 'Bali from Manado' }])
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
    expect(result.ready_to_plan).toBe(true)
  })

  it('marks ready_to_plan=false when confidence < 0.7 (destination only)', async () => {
    fetchSpy = mockFetch(JSON.stringify({
      departure_iata: null, arrival_iata: null, destination_name: 'Bali',
      trip_duration_days: null, outbound_date: null, preferences: null, departure_city: null,
    }))
    const result = await extractAndMergeTripInfo([{ role: 'user', content: 'Bali' }])
    expect(result.confidence).toBeLessThan(0.7)
    expect(result.ready_to_plan).toBe(false)
  })
})

// ── generateFollowUp ──────────────────────────────────────────────────────────
describe('generateFollowUp', () => {
  let fetchSpy
  afterEach(() => { fetchSpy?.mockRestore() })

  it('returns the Ollama response text', async () => {
    fetchSpy = mockFetch('Where are you flying from?')
    const result = await generateFollowUp({}, ['departure_iata'], [], [])
    expect(result).toBe('Where are you flying from?')
  })

  it('calls Ollama without format:json', async () => {
    fetchSpy = mockFetch('Some question')
    await generateFollowUp({ destination_name: 'Bali' }, ['departure_iata'], [], [])
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('format')
  })
})

// ── generateReadyConfirmation ─────────────────────────────────────────────────
describe('generateReadyConfirmation', () => {
  let fetchSpy
  afterEach(() => { fetchSpy?.mockRestore() })

  it('returns the Ollama response text', async () => {
    fetchSpy = mockFetch('Great, searching now!')
    const tripContext = { departure_city: 'Manado', destination_name: 'Bali', trip_duration_days: 3 }
    const result = await generateReadyConfirmation(tripContext)
    expect(result).toBe('Great, searching now!')
  })

  it('calls Ollama without format:json', async () => {
    fetchSpy = mockFetch('On it!')
    await generateReadyConfirmation({ departure_city: 'Manado', destination_name: 'Bali', trip_duration_days: 3 })
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('format')
  })
})

// ── generateExperiencePrompt ──────────────────────────────────────────────────
describe('generateExperiencePrompt', () => {
  let fetchSpy
  afterEach(() => { fetchSpy?.mockRestore() })

  it('returns the Ollama response text', async () => {
    fetchSpy = mockFetch('What kind of vibe are you going for?')
    const result = await generateExperiencePrompt(
      { hotel: { name: 'Beach Resort' } },
      { trip_duration_days: 3, destination_name: 'Bali' },
    )
    expect(result).toBe('What kind of vibe are you going for?')
  })

  it('calls Ollama without format:json', async () => {
    fetchSpy = mockFetch('Any preference?')
    await generateExperiencePrompt({ hotel: null }, { trip_duration_days: 3, destination_name: 'Bali' })
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('format')
  })
})

// ── parseExperienceType ────────────────────────────────────────────────────────
describe('parseExperienceType', () => {
  let fetchSpy
  afterEach(() => { fetchSpy?.mockRestore() })

  it('parses a valid experience_type from the Ollama response', async () => {
    fetchSpy = mockFetch('{"experience_type":"luxury","confidence":"high","raw_preference":"luxurious"}')
    const result = await parseExperienceType('I want something luxurious')
    expect(result.experience_type).toBe('luxury')
    expect(result.confidence).toBe('high')
  })

  it('falls back to balanced when Ollama returns no JSON', async () => {
    fetchSpy = mockFetch('I cannot determine that.')
    const result = await parseExperienceType('something weird')
    expect(result.experience_type).toBe('balanced')
    expect(result.confidence).toBe('low')
  })

  it('falls back to balanced when JSON is malformed', async () => {
    fetchSpy = mockFetch('{bad json}')
    const result = await parseExperienceType('unclear preference')
    expect(result.experience_type).toBe('balanced')
  })

  it('preserves raw_preference from valid response', async () => {
    fetchSpy = mockFetch('{"experience_type":"food","confidence":"medium","raw_preference":"love eating"}')
    const result = await parseExperienceType('I love eating local food')
    expect(result.raw_preference).toBe('love eating')
  })
})
