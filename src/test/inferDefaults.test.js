import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { inferAirport, inferDatesFromSeason, inferTripLength } from '../services/inferDefaults'

describe('inferAirport', () => {
  it('maps well-known Indonesian cities to IATA', () => {
    expect(inferAirport('Manado')).toBe('MDC')
    expect(inferAirport('Jakarta')).toBe('CGK')
    expect(inferAirport('Bali')).toBe('DPS')
    expect(inferAirport('Denpasar')).toBe('DPS')
    expect(inferAirport('Yogyakarta')).toBe('JOG')
    expect(inferAirport('Jogja')).toBe('JOG')
  })

  it('maps Southeast Asian cities', () => {
    expect(inferAirport('Singapore')).toBe('SIN')
    expect(inferAirport('Bangkok')).toBe('BKK')
    expect(inferAirport('Kuala Lumpur')).toBe('KUL')
    expect(inferAirport('Ho Chi Minh City')).toBe('SGN')
  })

  it('maps international cities', () => {
    expect(inferAirport('Tokyo')).toBe('HND')
    expect(inferAirport('Paris')).toBe('CDG')
    expect(inferAirport('New York')).toBe('JFK')
  })

  it('is case-insensitive', () => {
    expect(inferAirport('BALI')).toBe('DPS')
    expect(inferAirport('bali')).toBe('DPS')
    expect(inferAirport('BaLi')).toBe('DPS')
  })

  it('matches city name within a longer string', () => {
    expect(inferAirport('Bali, Indonesia')).toBe('DPS')
    expect(inferAirport('I want to go to Tokyo next week')).toBe('HND')
  })

  it('returns null for unknown locations', () => {
    expect(inferAirport('Atlantis')).toBeNull()
    expect(inferAirport('Mordor')).toBeNull()
  })

  it('returns null for empty/null input', () => {
    expect(inferAirport('')).toBeNull()
    expect(inferAirport(null)).toBeNull()
    expect(inferAirport(undefined)).toBeNull()
  })
})

describe('inferDatesFromSeason', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-09-01T00:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('resolves "next month" to the 15th of the next month', () => {
    expect(inferDatesFromSeason('Going next month')).toBe('2025-10-15')
  })

  it('resolves "this month" to the 15th of the current month', () => {
    expect(inferDatesFromSeason('Going this month')).toBe('2025-09-15')
  })

  it('resolves a future month name in the same year', () => {
    expect(inferDatesFromSeason('I want to go in November')).toBe('2025-11-15')
    expect(inferDatesFromSeason('Trip in December')).toBe('2025-12-15')
  })

  it('rolls past months to the next year', () => {
    expect(inferDatesFromSeason('Going in March')).toBe('2026-03-15')
    expect(inferDatesFromSeason('Trip in June')).toBe('2026-06-15')
  })

  it('rolls the current month (September) to next year', () => {
    expect(inferDatesFromSeason('Going in September')).toBe('2026-09-15')
  })

  it('accepts short month abbreviations', () => {
    expect(inferDatesFromSeason('In Nov')).toBe('2025-11-15')
    expect(inferDatesFromSeason('In Dec')).toBe('2025-12-15')
  })

  it('returns null when no date hint is present', () => {
    expect(inferDatesFromSeason('I love beaches')).toBeNull()
  })

  it('returns null for empty/null input', () => {
    expect(inferDatesFromSeason('')).toBeNull()
    expect(inferDatesFromSeason(null)).toBeNull()
  })
})

describe('inferTripLength', () => {
  it('detects "weekend" as 2 days', () => {
    expect(inferTripLength('quick weekend trip')).toBe(2)
  })

  it('detects "long weekend" as 3 days', () => {
    expect(inferTripLength('a long weekend')).toBe(3)
  })

  it('detects N-day patterns', () => {
    expect(inferTripLength('a 3-day trip')).toBe(3)
    expect(inferTripLength('5 day vacation')).toBe(5)
    expect(inferTripLength('10-day adventure')).toBe(10)
  })

  it('detects "two week" as 14 days', () => {
    expect(inferTripLength('two week stay')).toBe(14)
    expect(inferTripLength('2 week trip')).toBe(14)
  })

  it('detects "week" as 7 days', () => {
    expect(inferTripLength('a week in Bali')).toBe(7)
  })

  it('does not match "next week" as a length', () => {
    expect(inferTripLength('going next week')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(inferTripLength('A WEEKEND TRIP')).toBe(2)
    expect(inferTripLength('Weekend')).toBe(2)
  })

  it('returns null when no length hint is present', () => {
    expect(inferTripLength('I love beaches')).toBeNull()
  })

  it('returns null for empty/null input', () => {
    expect(inferTripLength('')).toBeNull()
    expect(inferTripLength(null)).toBeNull()
  })
})
