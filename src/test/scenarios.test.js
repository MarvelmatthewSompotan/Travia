/**
 * Scenario-level tests: simulate different user prompts and verify that the
 * pipeline produces the expected output at each stage.
 *
 * All Ollama calls are intercepted via a fetch spy so these tests run
 * offline without a running Ollama daemon.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  extractAndMergeTripInfo,
  parseExperienceType,
  generatePlan,
  assemblePlan,
  normalizeTripInfo,
  enrichPlacesWithReviews,
} from '../services/tripPipeline'
import { refinePlan } from '../services/refinePlan'

// ── fetch mock helpers ────────────────────────────────────────────────────────

function mockFetch(responseText) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ response: responseText }),
  })
}

function mockFetchJson(obj) {
  return mockFetch(JSON.stringify(obj))
}

// ── Shared fixtures ───────────────────────────────────────────────────────────

const FLIGHTS = [
  { airline: 'Garuda Indonesia', price: 180, stops: 0, duration_min: 130 },
  { airline: 'Lion Air',         price:  95, stops: 1, duration_min: 150 },
  { airline: 'Batik Air',        price: 130, stops: 0, duration_min: 140 },
]

const HOTELS = [
  { name: 'Seminyak Boutique Villas', price_per_night: 210, total_rate: 630, rating: 4.9, hotel_class: '5-star' },
  { name: 'Kuta Reef Beach Resort',   price_per_night:  95, total_rate: 285, rating: 4.6, hotel_class: '4-star' },
  { name: 'Ubud Budget Inn',          price_per_night:  30, total_rate:  90, rating: 3.8, hotel_class: '2-star' },
]

const PLACES = [
  { name: 'Tanah Lot Temple',         rating: 4.7, type: 'Temple' },
  { name: 'Seminyak Beach',           rating: 4.5, type: 'Beach' },
  { name: 'Ubud Monkey Forest',       rating: 4.4, type: 'Nature' },
  { name: 'Tegallalang Rice Terraces',rating: 4.6, type: 'Landscape' },
  { name: 'Jimbaran Seafood Market',  rating: 4.3, type: 'Restaurant' },
]

const TRIP_INFO = {
  departure_iata: 'MDC', departure_city: 'Manado',
  arrival_iata: 'DPS', destination_name: 'Bali, Indonesia',
  trip_duration_days: 3,
  outbound_date: '2025-09-15',
  return_date: '2025-09-18',
  preferences: 'beaches, good food',
}

// ── 1. Intake scenarios ───────────────────────────────────────────────────────

describe('Intake scenario: complete prompt in one message', () => {
  let fetchSpy
  afterEach(() => fetchSpy?.mockRestore())

  it('extracts all required fields and returns ready_to_plan=true', async () => {
    fetchSpy = mockFetchJson({
      departure_iata: 'MDC', departure_city: 'Manado',
      arrival_iata: 'DPS', destination_name: 'Bali, Indonesia',
      trip_duration_days: 3, outbound_date: '2025-09-15', preferences: 'beaches, good food',
    })
    const history = [{ role: 'user', content: '3-day trip from Manado to Bali, I love beaches and good food' }]
    const result = await extractAndMergeTripInfo(history)

    expect(result.ready_to_plan).toBe(true)
    expect(result.missing_required).toEqual([])
    expect(result.trip_context.departure_iata).toBe('MDC')
    expect(result.trip_context.arrival_iata).toBe('DPS')
    expect(result.trip_context.trip_duration_days).toBe(3)
    expect(result.trip_context.preferences).toBe('beaches, good food')
  })
})

describe('Intake scenario: missing departure city', () => {
  let fetchSpy
  afterEach(() => fetchSpy?.mockRestore())

  it('identifies departure_iata as missing and marks ready_to_plan=false', async () => {
    fetchSpy = mockFetchJson({
      departure_iata: null, departure_city: null,
      arrival_iata: 'DPS', destination_name: 'Bali, Indonesia',
      trip_duration_days: 5, outbound_date: null, preferences: null,
    })
    const history = [{ role: 'user', content: 'I want to go to Bali for 5 days' }]
    const result = await extractAndMergeTripInfo(history)

    expect(result.ready_to_plan).toBe(false)
    expect(result.missing_required).toContain('departure_iata')
    expect(result.missing_required).not.toContain('arrival_iata')
    expect(result.missing_required).not.toContain('trip_duration_days')
  })
})

describe('Intake scenario: missing destination', () => {
  let fetchSpy
  afterEach(() => fetchSpy?.mockRestore())

  it('identifies arrival_iata and destination_name as missing', async () => {
    fetchSpy = mockFetchJson({
      departure_iata: 'MDC', departure_city: 'Manado',
      arrival_iata: null, destination_name: null,
      trip_duration_days: 3, outbound_date: null, preferences: null,
    })
    const history = [{ role: 'user', content: '3-day trip from Manado, I want a beach trip' }]
    const result = await extractAndMergeTripInfo(history)

    expect(result.ready_to_plan).toBe(false)
    expect(result.missing_required).toContain('arrival_iata')
    expect(result.missing_required).toContain('destination_name')
  })
})

describe('Intake scenario: completely vague prompt', () => {
  let fetchSpy
  afterEach(() => fetchSpy?.mockRestore())

  it('returns ready_to_plan=false with all required fields missing', async () => {
    fetchSpy = mockFetchJson({
      departure_iata: null, departure_city: null,
      arrival_iata: null, destination_name: null,
      trip_duration_days: null, outbound_date: null, preferences: null,
    })
    const history = [{ role: 'user', content: 'hi' }]
    const result = await extractAndMergeTripInfo(history)

    expect(result.ready_to_plan).toBe(false)
    expect(result.missing_required).toHaveLength(4)
  })
})

// ── 2. Multi-turn intake scenarios ────────────────────────────────────────────

describe('Multi-turn intake: incomplete → follow-up fills the gap', () => {
  let fetchSpy
  afterEach(() => fetchSpy?.mockRestore())

  it('merges turn 2 departure into context that had everything else', async () => {
    // Turn 1: user says destination + duration, LLM extracts those but not departure
    fetchSpy = mockFetchJson({
      departure_iata: null, departure_city: null,
      arrival_iata: 'DPS', destination_name: 'Bali, Indonesia',
      trip_duration_days: 5, outbound_date: null, preferences: 'adventure',
    })
    const history1 = [{ role: 'user', content: 'Bali for 5 days, adventure vibe' }]
    const turn1 = await extractAndMergeTripInfo(history1)
    fetchSpy.mockRestore()

    expect(turn1.ready_to_plan).toBe(false)
    expect(turn1.missing_required).toContain('departure_iata')

    // Turn 2: user provides departure, LLM now returns full context
    fetchSpy = mockFetchJson({
      departure_iata: 'MDC', departure_city: 'Manado',
      arrival_iata: 'DPS', destination_name: 'Bali, Indonesia',
      trip_duration_days: 5, outbound_date: null, preferences: 'adventure',
    })
    const history2 = [
      ...history1,
      { role: 'assistant', content: 'Where are you flying from?' },
      { role: 'user', content: "I'm from Manado" },
    ]
    const turn2 = await extractAndMergeTripInfo(history2, turn1.trip_context)

    expect(turn2.ready_to_plan).toBe(true)
    expect(turn2.trip_context.departure_iata).toBe('MDC')
    expect(turn2.trip_context.arrival_iata).toBe('DPS')
    expect(turn2.trip_context.trip_duration_days).toBe(5)
  })
})

describe('Multi-turn intake: user corrects destination mid-conversation', () => {
  let fetchSpy
  afterEach(() => fetchSpy?.mockRestore())

  it('overrides the earlier destination with the corrected one', async () => {
    // Existing context had Singapore
    const existingContext = {
      departure_iata: 'MDC', departure_city: 'Manado',
      arrival_iata: 'SIN', destination_name: 'Singapore',
      trip_duration_days: 3, outbound_date: null, preferences: null,
    }
    // User says "actually Tokyo" — LLM overrides the destination
    fetchSpy = mockFetchJson({
      departure_iata: 'MDC', departure_city: 'Manado',
      arrival_iata: 'HND', destination_name: 'Tokyo, Japan',
      trip_duration_days: 3, outbound_date: null, preferences: null,
    })
    const history = [
      { role: 'user', content: 'Manado to Singapore 3 days' },
      { role: 'assistant', content: 'Got it! Searching for Singapore trips.' },
      { role: 'user', content: 'Actually I want to go to Tokyo instead' },
    ]
    const result = await extractAndMergeTripInfo(history, existingContext)

    expect(result.trip_context.arrival_iata).toBe('HND')
    expect(result.trip_context.destination_name).toBe('Tokyo, Japan')
    expect(result.trip_context.departure_iata).toBe('MDC') // unchanged
    expect(result.ready_to_plan).toBe(true)
  })
})

// ── 3. Experience type classification scenarios ───────────────────────────────

describe.each([
  ['budget',     'I want to spend as little as possible',         'budget'],
  ['luxury',     'Give me the most luxurious option available',   'luxury'],
  ['adventure',  'I want to hike, surf and go off the beaten path', 'adventure'],
  ['food',       'I live for local food and street markets',      'food'],
  ['relaxation', 'Just want to relax at a beach resort and do nothing', 'relaxation'],
  ['cultural',   'Museums, temples and local neighborhoods',      'cultural'],
  ['romantic',   'Planning a romantic getaway with my partner',   'romantic'],
  ['family',     'Travelling with kids, need family-friendly spots', 'family'],
  ['balanced',   'Something good overall, not too expensive',     'balanced'],
])('parseExperienceType: %s', (experienceType, userMessage, expected) => {
  let fetchSpy
  afterEach(() => fetchSpy?.mockRestore())

  it(`classifies "${userMessage.slice(0, 40)}…" as ${expected}`, async () => {
    fetchSpy = mockFetchJson({ experience_type: expected, confidence: 'high', raw_preference: userMessage })
    const result = await parseExperienceType(userMessage)
    expect(result.experience_type).toBe(expected)
  })
})

describe('parseExperienceType: ambiguous or mixed signals', () => {
  let fetchSpy
  afterEach(() => fetchSpy?.mockRestore())

  it('falls back to balanced when the preference is unclear', async () => {
    fetchSpy = mockFetchJson({ experience_type: 'balanced', confidence: 'low', raw_preference: 'I dunno' })
    const result = await parseExperienceType("I dunno, anything is fine")
    expect(result.experience_type).toBe('balanced')
  })

  it('returns balanced with low confidence when Ollama response is not JSON', async () => {
    fetchSpy = mockFetch('I cannot determine this.')
    const result = await parseExperienceType('something unclear')
    expect(result.experience_type).toBe('balanced')
    expect(result.confidence).toBe('low')
  })
})

// ── 4. generatePlan scenarios ─────────────────────────────────────────────────

describe('generatePlan: returns a valid plan selection for each experience type', () => {
  let fetchSpy
  afterEach(() => fetchSpy?.mockRestore())

  const cachedOptions = { flights: FLIGHTS, hotels: HOTELS, places: PLACES }

  it.each([
    ['budget',     { title: 'Budget Bali',   brief: 'Cheapest combo', flight: 1, hotel: 2, places: [0,1,2,3] }],
    ['luxury',     { title: 'Luxury Escape', brief: 'Top-rated everything', flight: 0, hotel: 0, places: [0,1,3,4] }],
    ['adventure',  { title: 'Adventure Run', brief: 'Active outdoors', flight: 2, hotel: 1, places: [2,3,0,1] }],
    ['food',       { title: 'Food Lover',    brief: 'Eat your way through Bali', flight: 1, hotel: 2, places: [4,1,0,2] }],
    ['relaxation', { title: 'Chill Bali',    brief: 'Beaches and resorts only', flight: 0, hotel: 0, places: [1,0,3,2] }],
  ])('experience_type=%s produces a plan with correct structure', async (experienceType, llmSelection) => {
    fetchSpy = mockFetchJson(llmSelection)
    const plan = await generatePlan(TRIP_INFO, cachedOptions, experienceType)

    expect(plan.experience_type).toBe(experienceType)
    expect(typeof plan.title).toBe('string')
    expect(typeof plan.brief).toBe('string')
    expect(typeof plan.flight).toBe('number')
    expect(typeof plan.hotel).toBe('number')
    expect(Array.isArray(plan.places)).toBe(true)
  })

  it('throws a user-friendly error when Ollama returns no JSON', async () => {
    fetchSpy = mockFetch('Sorry, I cannot help with that.')
    await expect(generatePlan(TRIP_INFO, cachedOptions, 'balanced'))
      .rejects.toThrow('AI returned an invalid response')
  })

  it('throws a user-friendly error when returned JSON is missing title/brief', async () => {
    fetchSpy = mockFetchJson({ flight: 0, hotel: 0, places: [0,1,2] })
    await expect(generatePlan(TRIP_INFO, cachedOptions, 'balanced'))
      .rejects.toThrow('AI response was missing expected fields')
  })
})

// ── 5. generatePlan → assemblePlan end-to-end ─────────────────────────────────

describe('generatePlan → assemblePlan: full plan assembly per experience type', () => {
  let fetchSpy
  afterEach(() => fetchSpy?.mockRestore())

  const cachedOptions = { flights: FLIGHTS, hotels: HOTELS, places: PLACES }

  it('budget selection picks cheapest flight and hotel, computes correct total', async () => {
    fetchSpy = mockFetchJson({
      title: 'Budget Bali', brief: 'Most affordable combo',
      flight: 1, hotel: 2, places: [0,1,2,3],
    })
    const selection = await generatePlan(TRIP_INFO, cachedOptions, 'budget')
    const plan = await assemblePlan(selection, TRIP_INFO, FLIGHTS, PLACES, HOTELS, null)

    expect(plan.flight.airline).toBe('Lion Air')
    expect(plan.flight.price).toBe(95)
    expect(plan.hotel.name).toBe('Ubud Budget Inn')
    expect(plan.hotel.total_price).toBe(90)
    expect(plan.total_price).toBe(95 + 90)
    expect(plan.places).toHaveLength(4)
  })

  it('luxury selection picks premium flight and hotel', async () => {
    fetchSpy = mockFetchJson({
      title: 'Luxury Escape', brief: 'Premium everything',
      flight: 0, hotel: 0, places: [0,1,2,3],
    })
    const selection = await generatePlan(TRIP_INFO, cachedOptions, 'luxury')
    const plan = await assemblePlan(selection, TRIP_INFO, FLIGHTS, PLACES, HOTELS, null)

    expect(plan.flight.airline).toBe('Garuda Indonesia')
    expect(plan.hotel.name).toBe('Seminyak Boutique Villas')
    expect(plan.hotel.total_price).toBe(630)
    expect(plan.total_price).toBe(180 + 630)
  })

  it('plan includes a booking link when departure/arrival IATAs are present', async () => {
    fetchSpy = mockFetchJson({ title: 'T', brief: 'B', flight: 0, hotel: 0, places: [0,1,2] })
    const selection = await generatePlan(TRIP_INFO, cachedOptions, 'balanced')
    const plan = await assemblePlan(selection, TRIP_INFO, FLIGHTS, PLACES, HOTELS, null)

    expect(plan.flight.link).toContain('google.com/travel/flights')
    expect(plan.flight.link).toContain('MDC')
    expect(plan.flight.link).toContain('DPS')
  })
})

// ── 6. Refine scenarios ───────────────────────────────────────────────────────

describe('refinePlan: hotel swap scenarios', () => {
  let fetchSpy
  afterEach(() => fetchSpy?.mockRestore())

  const base = {
    tripInfo: TRIP_INFO,
    currentPlan: { title: 'Luxury Escape', flight: { airline: 'Garuda' }, hotel: { name: 'Seminyak Boutique Villas' }, places: [] },
    flights: FLIGHTS, hotels: HOTELS, places: PLACES, chatHistory: [],
  }

  it('"find me a cheaper hotel" → repick with budget hotel index', async () => {
    fetchSpy = mockFetchJson({ kind: 'repick', flight: 0, hotel: 2, places: [0,1,2,3], note: 'Switched to Ubud Budget Inn' })
    const result = await refinePlan({ ...base, userMessage: 'find me a cheaper hotel' })

    expect(result.kind).toBe('repick')
    expect(result.hotel).toBe(2)
    expect(result.note).toBe('Switched to Ubud Budget Inn')
  })

  it('"upgrade the hotel to something 5 star" → repick with luxury hotel index', async () => {
    fetchSpy = mockFetchJson({ kind: 'repick', flight: 0, hotel: 0, places: [0,1,2,3], note: 'Upgraded to Seminyak Boutique Villas' })
    const result = await refinePlan({ ...base, userMessage: 'upgrade the hotel to something 5 star' })

    expect(result.kind).toBe('repick')
    expect(result.hotel).toBe(0)
  })
})

describe('refinePlan: flight swap scenarios', () => {
  let fetchSpy
  afterEach(() => fetchSpy?.mockRestore())

  const base = {
    tripInfo: TRIP_INFO,
    currentPlan: { title: 'Budget Pick', flight: { airline: 'Lion Air' }, hotel: { name: 'Ubud Budget Inn' }, places: [] },
    flights: FLIGHTS, hotels: HOTELS, places: PLACES, chatHistory: [],
  }

  it('"I prefer direct flights" → repick with 0-stop flight', async () => {
    fetchSpy = mockFetchJson({ kind: 'repick', flight: 0, hotel: 2, places: [0,1,2,3], note: 'Switched to Garuda direct flight' })
    const result = await refinePlan({ ...base, userMessage: 'I prefer direct flights' })

    expect(result.kind).toBe('repick')
    expect(result.flight).toBe(0)
    const chosen = FLIGHTS[result.flight]
    expect(chosen.stops).toBe(0)
  })

  it('"cheapest flight regardless of stops" → repick with cheapest index', async () => {
    fetchSpy = mockFetchJson({ kind: 'repick', flight: 1, hotel: 2, places: [0,1,2,3], note: 'Cheapest available' })
    const result = await refinePlan({ ...base, userMessage: 'cheapest flight regardless of stops' })

    const chosen = FLIGHTS[result.flight]
    expect(chosen.price).toBe(95)
  })
})

describe('refinePlan: place swap scenarios', () => {
  let fetchSpy
  afterEach(() => fetchSpy?.mockRestore())

  const base = {
    tripInfo: TRIP_INFO,
    currentPlan: { title: 'Current', flight: { airline: 'Garuda' }, hotel: { name: 'Resort' }, places: PLACES.slice(0,3) },
    flights: FLIGHTS, hotels: HOTELS, places: PLACES, chatHistory: [],
  }

  it('"add more food experiences" → repick with restaurant index in places', async () => {
    fetchSpy = mockFetchJson({ kind: 'repick', flight: 0, hotel: 1, places: [0,1,4,3], note: 'Added Jimbaran Seafood Market' })
    const result = await refinePlan({ ...base, userMessage: 'add more food experiences' })

    expect(result.places).toContain(4) // Jimbaran Seafood Market is index 4
  })

  it('"remove temples, only nature and beaches" → repick excludes temple index', async () => {
    fetchSpy = mockFetchJson({ kind: 'repick', flight: 0, hotel: 1, places: [1,2,3,4], note: 'Removed Tanah Lot Temple' })
    const result = await refinePlan({ ...base, userMessage: 'remove temples, only nature and beaches' })

    expect(result.places).not.toContain(0) // Tanah Lot Temple is index 0
  })
})

describe('refinePlan: destination and date change scenarios (rerun)', () => {
  let fetchSpy
  afterEach(() => fetchSpy?.mockRestore())

  const base = {
    tripInfo: TRIP_INFO,
    currentPlan: { title: 'Bali Plan', flight: { airline: 'Garuda' }, hotel: { name: 'Beach Resort' }, places: [] },
    flights: FLIGHTS, hotels: HOTELS, places: PLACES, chatHistory: [],
  }

  it('"change destination to Tokyo" → rerun with new destination', async () => {
    fetchSpy = mockFetchJson({ kind: 'rerun', changes: { destination_name: 'Tokyo, Japan', arrival_iata: 'HND' }, note: 'Changing destination to Tokyo' })
    const result = await refinePlan({ ...base, userMessage: 'change destination to Tokyo instead' })

    expect(result.kind).toBe('rerun')
    expect(result.changes.destination_name).toBe('Tokyo, Japan')
  })

  it('"make it 7 days" → rerun with extended duration', async () => {
    fetchSpy = mockFetchJson({ kind: 'rerun', changes: { trip_duration_days: 7 }, note: 'Extended to 7 days' })
    const result = await refinePlan({ ...base, userMessage: 'make it 7 days instead' })

    expect(result.kind).toBe('rerun')
    expect(result.changes.trip_duration_days).toBe(7)
  })

  it('"leave in October instead" → rerun with new outbound date', async () => {
    fetchSpy = mockFetchJson({ kind: 'rerun', changes: { outbound_date: '2025-10-15' }, note: 'Changed departure to October' })
    const result = await refinePlan({ ...base, userMessage: 'leave in October instead' })

    expect(result.kind).toBe('rerun')
    expect(result.changes.outbound_date).toBe('2025-10-15')
  })

  it('"keep everything but fly from Jakarta" → rerun preserves destination', async () => {
    fetchSpy = mockFetchJson({ kind: 'rerun', changes: { departure_iata: 'CGK', departure_city: 'Jakarta' }, note: 'Changed origin to Jakarta' })
    const result = await refinePlan({ ...base, userMessage: 'fly from Jakarta instead' })

    expect(result.kind).toBe('rerun')
    // destination unchanged — only departure changed
    expect(result.changes).not.toHaveProperty('destination_name')
  })
})

// ── 7. assemblePlan edge cases ────────────────────────────────────────────────

describe('assemblePlan: handles out-of-range indices gracefully', () => {
  it('falls back to index 0 when flight index is beyond list length', async () => {
    const selection = { title: 'T', brief: 'B', flight: 99, hotel: 0, places: [0] }
    const plan = await assemblePlan(selection, TRIP_INFO, FLIGHTS, PLACES, HOTELS, null)
    expect(plan.flight.airline).toBe(FLIGHTS[0].airline)
  })

  it('falls back to index 0 when hotel index is beyond list length', async () => {
    const selection = { title: 'T', brief: 'B', flight: 0, hotel: 99, places: [0] }
    const plan = await assemblePlan(selection, TRIP_INFO, FLIGHTS, PLACES, HOTELS, null)
    expect(plan.hotel.name).toBe(HOTELS[0].name)
  })

  it('skips out-of-range place indices silently', async () => {
    const selection = { title: 'T', brief: 'B', flight: 0, hotel: 0, places: [0, 99, 2] }
    const plan = await assemblePlan(selection, TRIP_INFO, FLIGHTS, PLACES, HOTELS, null)
    expect(plan.places).toHaveLength(2) // index 99 is dropped
    expect(plan.places[0].name).toBe('Tanah Lot Temple')
    expect(plan.places[1].name).toBe('Ubud Monkey Forest')
  })
})

// ── 8. Tripadvisor enrichment scenarios ──────────────────────────────────────
// searchTripadvisor calls the SearchAPI directly (not Ollama), so mock fetch
// must return SearchAPI format: { results: [{ name, rating, num_reviews, reviews }] }

function mockTripadvisorFetch(items) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ results: items }),
  })
}

describe('enrichPlacesWithReviews: review matching scenarios', () => {
  let fetchSpy
  afterEach(() => fetchSpy?.mockRestore())

  it('attaches tripadvisor data when name matches exactly', async () => {
    fetchSpy = mockTripadvisorFetch([
      { name: 'Tanah Lot Temple', rating: 4.8, num_reviews: 12400, reviews: ['Stunning at sunset.'] },
    ])
    const result = await enrichPlacesWithReviews(
      [{ name: 'Tanah Lot Temple', rating: 4.7 }],
      'Bali, Indonesia',
    )
    expect(result[0].tripadvisor_rating).toBe(4.8)
    expect(result[0].review_snippets[0]).toBe('Stunning at sunset.')
  })

  it('leaves place unchanged when no tripadvisor match is found', async () => {
    fetchSpy = mockTripadvisorFetch([
      { name: 'Some Completely Different Place', rating: 4.0, num_reviews: 100, reviews: [] },
    ])
    const original = { name: 'Tanah Lot Temple', rating: 4.7 }
    const result = await enrichPlacesWithReviews([original], 'Bali, Indonesia')

    expect(result[0]).toEqual(original)
    expect(result[0]).not.toHaveProperty('tripadvisor_rating')
  })

  it('returns original places when tripadvisor search fails', async () => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))
    const places = [{ name: 'Tanah Lot Temple', rating: 4.7 }]
    const result = await enrichPlacesWithReviews(places, 'Bali')

    expect(result).toEqual(places)
  })

  it('enriches only matching places, leaving others untouched', async () => {
    fetchSpy = mockTripadvisorFetch([
      { name: 'Seminyak Beach', rating: 4.5, num_reviews: 6800, reviews: ['Great sunset.'] },
    ])
    const places = [
      { name: 'Tanah Lot Temple', rating: 4.7 },
      { name: 'Seminyak Beach', rating: 4.4 },
    ]
    const result = await enrichPlacesWithReviews(places, 'Bali, Indonesia')

    expect(result[0]).not.toHaveProperty('tripadvisor_rating') // no match
    expect(result[1].tripadvisor_rating).toBe(4.5)             // matched
  })
})

// ── 9. normalizeTripInfo scenarios ────────────────────────────────────────────

describe('normalizeTripInfo: date and duration handling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-09-01T00:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('a complete context produces the correct return_date', () => {
    const result = normalizeTripInfo({ outbound_date: '2025-09-15', trip_duration_days: 3 })
    expect(result.return_date).toBe('2025-09-18')
  })

  it('missing outbound_date defaults to tomorrow', () => {
    const result = normalizeTripInfo({ trip_duration_days: 7 })
    expect(result.outbound_date).toBe('2025-09-02')
    expect(result.return_date).toBe('2025-09-09')
  })

  it('missing duration defaults to 5 days', () => {
    const result = normalizeTripInfo({ outbound_date: '2025-10-01' })
    expect(result.trip_duration_days).toBe(5)
    expect(result.return_date).toBe('2025-10-06')
  })

  it('a 1-night trip has return = outbound + 1', () => {
    const result = normalizeTripInfo({ outbound_date: '2025-12-24', trip_duration_days: 1 })
    expect(result.return_date).toBe('2025-12-25')
  })

  it('month-boundary trip computes return correctly', () => {
    const result = normalizeTripInfo({ outbound_date: '2025-01-29', trip_duration_days: 5 })
    expect(result.return_date).toBe('2025-02-03')
  })
})
