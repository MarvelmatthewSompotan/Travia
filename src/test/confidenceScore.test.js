import { describe, it, expect } from 'vitest'
import { computeConfidence, CONFIDENCE_THRESHOLD } from '../services/confidenceScore'

describe('computeConfidence', () => {
  it('returns 0 for an empty context', () => {
    expect(computeConfidence({})).toBe(0)
  })

  it('returns 1.0 when every weighted field is present', () => {
    const score = computeConfidence({
      departure_iata: 'MDC',
      arrival_iata: 'DPS',
      destination_name: 'Bali, Indonesia',
      trip_duration_days: 5,
      outbound_date: '2025-12-01',
    })
    expect(score).toBe(1)
  })

  it('returns 0.6 with only origin + destination IATAs', () => {
    const score = computeConfidence({ departure_iata: 'MDC', arrival_iata: 'DPS' })
    expect(score).toBe(0.6)
  })

  it('returns 0.8 with origin + destination + name', () => {
    const score = computeConfidence({
      departure_iata: 'MDC', arrival_iata: 'DPS', destination_name: 'Bali',
    })
    expect(score).toBe(0.8)
  })

  it('ignores null/empty/zero values', () => {
    const score = computeConfidence({
      departure_iata: null, arrival_iata: '', destination_name: 'Bali', trip_duration_days: 0,
    })
    expect(score).toBe(0.2)
  })

  it('treats invalid trip_duration_days as missing', () => {
    const score = computeConfidence({
      departure_iata: 'MDC', arrival_iata: 'DPS', destination_name: 'Bali',
      trip_duration_days: 'soon',
    })
    expect(score).toBe(0.8)
  })

  it('CONFIDENCE_THRESHOLD is 0.7', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.7)
  })

  it('origin + destination alone clears the threshold (0.6 does NOT)', () => {
    const score = computeConfidence({ departure_iata: 'MDC', arrival_iata: 'DPS' })
    expect(score).toBeLessThan(CONFIDENCE_THRESHOLD)
  })

  it('origin + destination + name clears the threshold', () => {
    const score = computeConfidence({
      departure_iata: 'MDC', arrival_iata: 'DPS', destination_name: 'Bali',
    })
    expect(score).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD)
  })
})
