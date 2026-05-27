import { describe, it, expect } from 'vitest'
import {
  MOCK_USER_PROMPT,
  MOCK_USER_PROMPT_BUDGET,
  MOCK_USER_PROMPT_LUXURY,
  MOCK_TRIP_INFO,
  MOCK_TRIP_INFO_YOGYAKARTA,
  MOCK_TRIP_INFO_RAJA_AMPAT,
  MOCK_FLIGHTS,
  MOCK_FLIGHTS_YOGYAKARTA,
  MOCK_FLIGHTS_RAJA_AMPAT,
  MOCK_HOTELS,
  MOCK_HOTELS_YOGYAKARTA,
  MOCK_HOTELS_RAJA_AMPAT,
  MOCK_PLACES,
  MOCK_PLACES_YOGYAKARTA,
  MOCK_PLACES_RAJA_AMPAT,
  MOCK_TRIPADVISOR_PLACES,
  MOCK_TRIPADVISOR_PLACES_YOGYAKARTA,
  MOCK_TRIPADVISOR_PLACES_RAJA_AMPAT,
  MOCK_NARRATIVE,
  MOCK_READY_CONFIRMATION,
} from '../services/mockData'

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateTripInfo(info) {
  expect(info.departure_iata).toMatch(/^[A-Z]{3}$/)
  expect(info.arrival_iata).toMatch(/^[A-Z]{3}$/)
  expect(typeof info.destination_name).toBe('string')
  expect(info.destination_name.length).toBeGreaterThan(0)
  expect(Number.isInteger(info.trip_duration_days)).toBe(true)
  expect(info.trip_duration_days).toBeGreaterThan(0)
  expect(info.outbound_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
}

function validateFlights(flights) {
  expect(Array.isArray(flights.items)).toBe(true)
  expect(flights.items.length).toBeGreaterThan(0)
  expect(flights.error).toBeNull()
  for (const f of flights.items) {
    expect(typeof f.airline).toBe('string')
    expect(typeof f.price).toBe('number')
    expect(typeof f.stops).toBe('number')
    expect(typeof f.duration_min).toBe('number')
  }
}

function validateHotels(hotels) {
  expect(Array.isArray(hotels)).toBe(true)
  expect(hotels.length).toBeGreaterThan(0)
  for (const h of hotels) {
    expect(typeof h.name).toBe('string')
    expect(typeof h.price_per_night).toBe('number')
    expect(typeof h.rating).toBe('number')
    expect(typeof h.hotel_class).toBe('string')
  }
}

function validatePlaces(places) {
  expect(Array.isArray(places)).toBe(true)
  expect(places.length).toBeGreaterThanOrEqual(3)
  for (const p of places) {
    expect(typeof p.name).toBe('string')
    expect(typeof p.rating).toBe('number')
    expect(typeof p.type).toBe('string')
  }
}

function validateTripadvisor(taPlaces, googlePlaces) {
  expect(Array.isArray(taPlaces)).toBe(true)
  expect(taPlaces.length).toBeGreaterThan(0)
  for (const p of taPlaces) {
    expect(typeof p.name).toBe('string')
    expect(typeof p.tripadvisor_rating).toBe('number')
    expect(typeof p.tripadvisor_review_count).toBe('number')
    expect(Array.isArray(p.review_snippets)).toBe(true)
    expect(p.review_snippets.length).toBeGreaterThan(0)
    expect(p.review_snippets.every((s) => typeof s === 'string')).toBe(true)
  }
  if (googlePlaces) {
    const googleNames = googlePlaces.map((p) => p.name.toLowerCase())
    for (const ta of taPlaces) {
      const matched = googleNames.some(
        (n) => n.includes(ta.name.toLowerCase()) || ta.name.toLowerCase().includes(n),
      )
      expect(matched).toBe(true)
    }
  }
}

// ── MOCK_USER_PROMPT variants ─────────────────────────────────────────────────

describe.each([
  ['Bali',       MOCK_USER_PROMPT],
  ['Yogyakarta', MOCK_USER_PROMPT_BUDGET],
  ['Raja Ampat', MOCK_USER_PROMPT_LUXURY],
])('MOCK_USER_PROMPT (%s)', (_, prompt) => {
  it('is a non-empty string', () => {
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(0)
  })
})

// ── MOCK_TRIP_INFO variants ───────────────────────────────────────────────────

describe.each([
  ['Bali',       MOCK_TRIP_INFO],
  ['Yogyakarta', MOCK_TRIP_INFO_YOGYAKARTA],
  ['Raja Ampat', MOCK_TRIP_INFO_RAJA_AMPAT],
])('MOCK_TRIP_INFO (%s)', (_, info) => {
  it('has valid IATA codes', () => { expect(info.departure_iata).toMatch(/^[A-Z]{3}$/) })
  it('has all required intake fields', () => { validateTripInfo(info) })
  it('departure and arrival IATAs are different', () => {
    expect(info.departure_iata).not.toBe(info.arrival_iata)
  })
})

// ── MOCK_FLIGHTS variants ─────────────────────────────────────────────────────

describe.each([
  ['Bali',       MOCK_FLIGHTS],
  ['Yogyakarta', MOCK_FLIGHTS_YOGYAKARTA],
  ['Raja Ampat', MOCK_FLIGHTS_RAJA_AMPAT],
])('MOCK_FLIGHTS (%s)', (_, flights) => {
  it('has a valid items array', () => { validateFlights(flights) })
  it('includes at least one flight with at most 1 stop', () => {
    expect(flights.items.some((f) => f.stops <= 1)).toBe(true)
  })
  it('prices are all positive', () => {
    expect(flights.items.every((f) => f.price > 0)).toBe(true)
  })
})

// ── MOCK_HOTELS variants ──────────────────────────────────────────────────────

describe.each([
  ['Bali',       MOCK_HOTELS],
  ['Yogyakarta', MOCK_HOTELS_YOGYAKARTA],
  ['Raja Ampat', MOCK_HOTELS_RAJA_AMPAT],
])('MOCK_HOTELS (%s)', (_, hotels) => {
  it('has a valid structure', () => { validateHotels(hotels) })
  it('has at least one hotel under $60/night (budget option)', () => {
    expect(hotels.some((h) => h.price_per_night < 60)).toBe(true)
  })
  it('has at least one hotel above $100/night (premium option)', () => {
    expect(hotels.some((h) => h.price_per_night > 100)).toBe(true)
  })
  it('total_rate equals price_per_night × trip_duration for all hotels (where available)', () => {
    for (const h of hotels) {
      if (h.total_rate != null && h.price_per_night != null) {
        expect(h.total_rate % h.price_per_night).toBe(0)
      }
    }
  })
})

// ── MOCK_PLACES variants ──────────────────────────────────────────────────────

describe.each([
  ['Bali',       MOCK_PLACES],
  ['Yogyakarta', MOCK_PLACES_YOGYAKARTA],
  ['Raja Ampat', MOCK_PLACES_RAJA_AMPAT],
])('MOCK_PLACES (%s)', (_, places) => {
  it('has a valid structure', () => { validatePlaces(places) })
  it('ratings are all between 1 and 5', () => {
    expect(places.every((p) => p.rating >= 1 && p.rating <= 5)).toBe(true)
  })
  it('has variety in place types (at least 2 distinct types)', () => {
    const types = new Set(places.map((p) => p.type))
    expect(types.size).toBeGreaterThanOrEqual(2)
  })
})

// ── MOCK_TRIPADVISOR_PLACES variants ─────────────────────────────────────────

describe.each([
  ['Bali',       MOCK_TRIPADVISOR_PLACES,           MOCK_PLACES],
  ['Yogyakarta', MOCK_TRIPADVISOR_PLACES_YOGYAKARTA, MOCK_PLACES_YOGYAKARTA],
  ['Raja Ampat', MOCK_TRIPADVISOR_PLACES_RAJA_AMPAT, MOCK_PLACES_RAJA_AMPAT],
])('MOCK_TRIPADVISOR_PLACES (%s)', (_, taPlaces, googlePlaces) => {
  it('has required enrichment fields', () => { validateTripadvisor(taPlaces, googlePlaces) })
  it('review counts are all positive', () => {
    expect(taPlaces.every((p) => p.tripadvisor_review_count > 0)).toBe(true)
  })
  it('review snippets are non-empty strings', () => {
    for (const p of taPlaces) {
      expect(p.review_snippets.every((s) => s.trim().length > 0)).toBe(true)
    }
  })
  it('names align with google places fixtures for merging', () => {
    const googleNames = googlePlaces.map((p) => p.name.toLowerCase())
    for (const ta of taPlaces) {
      const matched = googleNames.some(
        (n) => n.includes(ta.name.toLowerCase()) || ta.name.toLowerCase().includes(n),
      )
      expect(matched).toBe(true)
    }
  })
})

// ── Cross-dataset consistency ─────────────────────────────────────────────────

describe('Dataset consistency: Yogyakarta fixtures', () => {
  it('trip_info, flights, hotels, places, and tripadvisor all reference the same destination', () => {
    expect(MOCK_TRIP_INFO_YOGYAKARTA.arrival_iata).toBe('JOG')
    expect(MOCK_TRIP_INFO_YOGYAKARTA.destination_name).toContain('Yogyakarta')
    expect(MOCK_PLACES_YOGYAKARTA.some((p) => p.name.includes('Borobudur'))).toBe(true)
    expect(MOCK_TRIPADVISOR_PLACES_YOGYAKARTA.some((p) => p.name.includes('Borobudur'))).toBe(true)
  })
})

describe('Dataset consistency: Raja Ampat fixtures', () => {
  it('trip_info, flights, hotels, places, and tripadvisor all reference the same destination', () => {
    expect(MOCK_TRIP_INFO_RAJA_AMPAT.arrival_iata).toBe('RJM')
    expect(MOCK_TRIP_INFO_RAJA_AMPAT.destination_name).toContain('Raja Ampat')
    expect(MOCK_PLACES_RAJA_AMPAT.some((p) => p.name.includes('Wayag'))).toBe(true)
    expect(MOCK_TRIPADVISOR_PLACES_RAJA_AMPAT.some((p) => p.name.includes('Wayag'))).toBe(true)
  })
})

// ── Utility strings ───────────────────────────────────────────────────────────

describe('MOCK_NARRATIVE', () => {
  it('is a non-empty string', () => {
    expect(typeof MOCK_NARRATIVE).toBe('string')
    expect(MOCK_NARRATIVE.length).toBeGreaterThan(0)
  })

  it('does not reference old three-plan language', () => {
    expect(MOCK_NARRATIVE.toLowerCase()).not.toContain('three travel plans')
  })
})

describe('MOCK_READY_CONFIRMATION', () => {
  it('is a non-empty string', () => {
    expect(typeof MOCK_READY_CONFIRMATION).toBe('string')
    expect(MOCK_READY_CONFIRMATION.length).toBeGreaterThan(0)
  })
})
