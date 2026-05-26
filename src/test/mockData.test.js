import { describe, it, expect } from 'vitest'
import {
  MOCK_USER_PROMPT,
  MOCK_TRIP_INFO,
  MOCK_FLIGHTS,
  MOCK_HOTELS,
  MOCK_PLACES,
  MOCK_TRIPADVISOR_PLACES,
  MOCK_NARRATIVE,
  MOCK_READY_CONFIRMATION,
} from '../services/mockData'

describe('MOCK_USER_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof MOCK_USER_PROMPT).toBe('string')
    expect(MOCK_USER_PROMPT.length).toBeGreaterThan(0)
  })
})

describe('MOCK_TRIP_INFO', () => {
  it('has all intake-required fields filled', () => {
    for (const field of ['departure_iata', 'arrival_iata', 'destination_name', 'trip_duration_days']) {
      expect(MOCK_TRIP_INFO[field]).toBeTruthy()
    }
  })

  it('has a valid IATA departure code (3 uppercase letters)', () => {
    expect(MOCK_TRIP_INFO.departure_iata).toMatch(/^[A-Z]{3}$/)
  })

  it('has a valid IATA arrival code (3 uppercase letters)', () => {
    expect(MOCK_TRIP_INFO.arrival_iata).toMatch(/^[A-Z]{3}$/)
  })

  it('has a valid outbound_date in YYYY-MM-DD format', () => {
    expect(MOCK_TRIP_INFO.outbound_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('has a positive integer trip_duration_days', () => {
    expect(Number.isInteger(MOCK_TRIP_INFO.trip_duration_days)).toBe(true)
    expect(MOCK_TRIP_INFO.trip_duration_days).toBeGreaterThan(0)
  })
})

describe('MOCK_FLIGHTS', () => {
  it('has an items array', () => {
    expect(Array.isArray(MOCK_FLIGHTS.items)).toBe(true)
    expect(MOCK_FLIGHTS.items.length).toBeGreaterThan(0)
  })

  it('each item has required flight fields', () => {
    for (const f of MOCK_FLIGHTS.items) {
      expect(typeof f.airline).toBe('string')
      expect(typeof f.price).toBe('number')
      expect(typeof f.stops).toBe('number')
      expect(typeof f.duration_min).toBe('number')
    }
  })

  it('has error=null', () => {
    expect(MOCK_FLIGHTS.error).toBeNull()
  })
})

describe('MOCK_HOTELS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(MOCK_HOTELS)).toBe(true)
    expect(MOCK_HOTELS.length).toBeGreaterThan(0)
  })

  it('each hotel has name, price_per_night and rating', () => {
    for (const h of MOCK_HOTELS) {
      expect(typeof h.name).toBe('string')
      expect(typeof h.price_per_night).toBe('number')
      expect(typeof h.rating).toBe('number')
    }
  })
})

describe('MOCK_PLACES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(MOCK_PLACES)).toBe(true)
    expect(MOCK_PLACES.length).toBeGreaterThan(0)
  })

  it('each place has a name and rating', () => {
    for (const p of MOCK_PLACES) {
      expect(typeof p.name).toBe('string')
      expect(typeof p.rating).toBe('number')
    }
  })

  it('provides at least 3 places (minimum for a plan)', () => {
    expect(MOCK_PLACES.length).toBeGreaterThanOrEqual(3)
  })
})

describe('MOCK_TRIPADVISOR_PLACES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(MOCK_TRIPADVISOR_PLACES)).toBe(true)
    expect(MOCK_TRIPADVISOR_PLACES.length).toBeGreaterThan(0)
  })

  it('each entry has required enrichment fields', () => {
    for (const p of MOCK_TRIPADVISOR_PLACES) {
      expect(typeof p.name).toBe('string')
      expect(typeof p.tripadvisor_rating).toBe('number')
      expect(typeof p.tripadvisor_review_count).toBe('number')
      expect(Array.isArray(p.review_snippets)).toBe(true)
      expect(p.review_snippets.every((s) => typeof s === 'string')).toBe(true)
    }
  })
})

describe('MOCK_NARRATIVE', () => {
  it('is a non-empty string', () => {
    expect(typeof MOCK_NARRATIVE).toBe('string')
    expect(MOCK_NARRATIVE.length).toBeGreaterThan(0)
  })

  it('does not reference old three-plan language', () => {
    expect(MOCK_NARRATIVE.toLowerCase()).not.toContain('three')
    expect(MOCK_NARRATIVE.toLowerCase()).not.toContain('three travel plans')
  })
})

describe('MOCK_READY_CONFIRMATION', () => {
  it('is a non-empty string', () => {
    expect(typeof MOCK_READY_CONFIRMATION).toBe('string')
    expect(MOCK_READY_CONFIRMATION.length).toBeGreaterThan(0)
  })
})
