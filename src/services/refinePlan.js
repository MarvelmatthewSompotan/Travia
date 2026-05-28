import { llmGenerate } from './llmProvider'

function extractJsonObject(text) {
  const obj = text.match(/\{[\s\S]*\}/)
  return obj ? obj[0] : null
}

function safeNumber(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// Asks the model to either re-pick from existing cached options (repick)
// or signal that dates/destination must change (rerun).
//
// Returns one of:
//   { kind: 'repick', flight, hotel, places, note }
//   { kind: 'rerun', changes: { destination_name?, outbound_date?, trip_duration_days? }, note }
export async function refinePlan({ tripInfo, currentPlan, flights, hotels, places, chatHistory, userMessage }, opts) {
  const flightList = flights.map((f, i) => `[${i}] ${f.airline} — $${f.price ?? '?'}, ${f.stops} stop(s), ${f.duration_min ?? '?'} min`)
  const hotelList = hotels.map((h, i) => `[${i}] ${h.name} — $${h.price_per_night ?? '?'}/night, rating ${h.rating ?? '?'}, ${h.hotel_class ?? 'hotel'}`)
  const placeList = places.map((p, i) => `[${i}] ${p.name} — rating ${p.rating ?? '?'}`)

  const transcript = chatHistory
    .slice(-8)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n')

  const currentSummary = currentPlan
    ? `CURRENT PLAN: "${currentPlan.title}" — flight=${currentPlan.flight?.airline ?? 'none'}, hotel=${currentPlan.hotel?.name ?? 'none'}, places=${(currentPlan.places || []).map((p) => p.name).join('; ')}`
    : 'CURRENT PLAN: none'

  const context = `TRIP CONTEXT: ${tripInfo.departure_city || tripInfo.departure_iata} → ${tripInfo.destination_name}, ${tripInfo.trip_duration_days} days, departing ${tripInfo.outbound_date}.
${currentSummary}

FLIGHT OPTIONS (cached):
${flightList.length ? flightList.join('\n') : 'none'}

HOTEL OPTIONS (cached):
${hotelList.length ? hotelList.join('\n') : 'none'}

PLACE OPTIONS (cached):
${placeList.length ? placeList.join('\n') : 'none'}

RECENT CONVERSATION:
${transcript || '(none)'}

NEW USER MESSAGE: ${userMessage}`

  const today = new Date().toISOString().split('T')[0]

  const system = `You refine an existing travel plan based on the user's message. Today is ${today}.
Return ONLY a valid JSON object — no markdown, no code fences.

You have TWO modes:

1) REPICK MODE: when the user wants a different flight/hotel/places from the cached lists.
   Return: { "kind": "repick", "flight": <int>, "hotel": <int>, "places": [<int>, <int>, ...], "note": "<one short sentence to the user>" }
   Indices must exist in the cached lists above. "places" must contain 3 to 5 unique indices.

2) RERUN MODE: when the user changes destination, dates, or trip length so cached options no longer apply.
   Return: { "kind": "rerun", "changes": { "destination_name"?: "...", "outbound_date"?: "YYYY-MM-DD", "trip_duration_days"?: <int> }, "note": "<one short sentence>" }
   Only include keys in "changes" that actually changed.
   For dates: resolve relative expressions like "november this year", "next month", "in 3 weeks" to a concrete YYYY-MM-DD using today's date above.

If unsure, prefer REPICK. Never invent flights, hotels, or places — only use indices from the cached lists.`

  const text = await llmGenerate(system, context, opts)
  const raw = extractJsonObject(text)
  if (!raw) throw new Error('Could not parse refinement response.')

  const parsed = JSON.parse(raw)
  if (parsed.kind === 'rerun') {
    const changes = parsed.changes && typeof parsed.changes === 'object' ? parsed.changes : {}
    const out = {}
    if (typeof changes.destination_name === 'string' && changes.destination_name.trim()) {
      out.destination_name = changes.destination_name.trim()
    }
    if (typeof changes.outbound_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(changes.outbound_date)) {
      out.outbound_date = changes.outbound_date
    }
    if (changes.trip_duration_days != null) {
      const d = safeNumber(changes.trip_duration_days, null)
      if (d != null && d >= 1) out.trip_duration_days = d
    }
    return { kind: 'rerun', changes: out, note: typeof parsed.note === 'string' ? parsed.note : '' }
  }

  // default to repick (also handles parsed.kind === 'repick')
  const placeIndices = Array.isArray(parsed.places) ? parsed.places.map(Number).filter(Number.isInteger) : []
  return {
    kind: 'repick',
    flight: safeNumber(parsed.flight, 0),
    hotel: safeNumber(parsed.hotel, 0),
    places: placeIndices,
    note: typeof parsed.note === 'string' ? parsed.note : '',
  }
}
