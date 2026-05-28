const FIELD_WEIGHTS = {
  departure_iata:     0.30,
  arrival_iata:       0.30,
  destination_name:   0.20,
  trip_duration_days: 0.10,
  outbound_date:      0.10,
}

export const CONFIDENCE_THRESHOLD = 0.7

export function computeConfidence(tripContext) {
  let score = 0
  for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
    const v = tripContext[field]
    const valid =
      v != null &&
      v !== '' &&
      (field !== 'trip_duration_days' || (Number.isFinite(Number(v)) && Number(v) >= 1))
    if (valid) score += weight
  }
  return Math.round(score * 100) / 100
}
