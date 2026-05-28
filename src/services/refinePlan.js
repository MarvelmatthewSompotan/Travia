import { llmGenerate } from './llmProvider'

function extractJsonObject(text) {
  const obj = text.match(/\{[\s\S]*\}/)
  return obj ? obj[0] : null
}

function safeNumber(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// Reverse-map assembled plan items back to their cached list indices.
function findCurrentIndices(currentPlan, flights, hotels, places) {
  const flightIdx = currentPlan?.flight
    ? flights.findIndex((f) => f.airline === currentPlan.flight.airline && f.price === currentPlan.flight.price)
    : -1
  const hotelIdx = currentPlan?.hotel
    ? hotels.findIndex((h) => h.name === currentPlan.hotel.name)
    : -1
  const placeIdxs = (currentPlan?.places || [])
    .map((p) => places.findIndex((cp) => cp.name === p.name))
    .filter((i) => i >= 0)
  return {
    flight: flightIdx >= 0 ? flightIdx : 0,
    hotel: hotelIdx >= 0 ? hotelIdx : 0,
    places: placeIdxs,
  }
}

export async function refinePlan(
  { tripInfo, currentPlan, flights, hotels, places, chatHistory, userMessage, pendingRefinement },
  opts,
) {
  const today = new Date().toISOString().split('T')[0]

  const flightList = flights.map((f, i) => `[${i}] ${f.airline} — $${f.price ?? '?'}, ${f.stops} stop(s), ${f.duration_min ?? '?'} min`)
  const hotelList  = hotels.map((h, i) => `[${i}] ${h.name} — $${h.price_per_night ?? '?'}/night, rating ${h.rating ?? '?'}, ${h.hotel_class ?? 'hotel'}`)
  const placeList  = places.map((p, i) => `[${i}] ${p.name} — rating ${p.rating ?? '?'}`)

  const currentIdx = findCurrentIndices(currentPlan, flights, hotels, places)

  const transcript = chatHistory
    .slice(-8)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n')

  const currentSummary = currentPlan
    ? `CURRENT PLAN: "${currentPlan.title}" — flight=[${currentIdx.flight}] ${currentPlan.flight?.airline ?? 'none'}, hotel=[${currentIdx.hotel}] ${currentPlan.hotel?.name ?? 'none'}, places=[${currentIdx.places.join(',')}] ${(currentPlan.places || []).map((p) => p.name).join('; ')}`
    : 'CURRENT PLAN: none'

  const pendingText = pendingRefinement
    ? `\nPENDING CHANGE (proposed last turn, awaiting scope confirmation): ${JSON.stringify(pendingRefinement)}`
    : ''

  const context = `TRIP: ${tripInfo.departure_city || tripInfo.departure_iata} → ${tripInfo.destination_name}, ${tripInfo.trip_duration_days} days, departing ${tripInfo.outbound_date}.
${currentSummary}${pendingText}

FLIGHT OPTIONS (cached):
${flightList.length ? flightList.join('\n') : 'none'}

HOTEL OPTIONS (cached):
${hotelList.length ? hotelList.join('\n') : 'none'}

PLACE OPTIONS (cached):
${placeList.length ? placeList.join('\n') : 'none'}

RECENT CONVERSATION:
${transcript || '(none)'}

NEW USER MESSAGE: ${userMessage}`

  const system = `You are a travel assistant managing an active trip plan. Today is ${today}.
Analyze the user's message and choose the correct mode. Return ONLY valid JSON — no markdown, no code fences.

MODE 0 — CHAT: user is making conversation, asking a general question, or saying something unrelated to changing the plan (e.g. "what do you think of X?", "tell me about Y", "thanks").
{"kind":"chat","reply":"<1-3 sentence natural conversational answer>"}

MODE 1 — REPICK: user wants to swap a specific item (different hotel, different airline, a specific place).
Keep the current plan's indices for things the user did NOT mention changing.
If the user only wants to change one place, keep the other place indices from the CURRENT PLAN and change only that one.
{"kind":"repick","flight":<int>,"hotel":<int>,"places":[<int>,...],"note":"<one sentence>"}

MODE 2 — ASK: user wants to change dates, destination, or duration but has not said whether hotel/places should also change.
Ask one focused question: should I only re-search flights, or regenerate the whole trip (hotels + places too)?
{"kind":"ask","question":"<one natural focused question>","proposed_changes":{"outbound_date"?:"YYYY-MM-DD","destination_name"?:"...","trip_duration_days"?:<int>}}

MODE 3 — RERUN: user has clearly specified what to regenerate (destination change, dates + explicitly wants new options, or is confirming a pending change).
scope "flights": only search for new flights and keep existing cached hotel and places.
scope "full": search everything fresh (new destination or user asked for new hotel/places too).
{"kind":"rerun","changes":{"destination_name"?:"...","outbound_date"?:"YYYY-MM-DD","trip_duration_days"?:<int>},"scope":"flights"|"full","note":"<one sentence>"}

Only include keys in "changes" / "proposed_changes" that actually changed.
For dates, resolve relative expressions (e.g. "november", "next month") to a concrete YYYY-MM-DD using today's date.
Never invent flights, hotels, or places — only use indices that exist in the cached lists.`

  const text = await llmGenerate(system, context, opts)
  const raw = extractJsonObject(text)
  if (!raw) throw new Error('Could not parse refinement response.')

  const parsed = JSON.parse(raw)

  if (parsed.kind === 'chat') {
    return {
      kind: 'chat',
      reply: typeof parsed.reply === 'string' ? parsed.reply : '',
    }
  }

  if (parsed.kind === 'ask') {
    return {
      kind: 'ask',
      question: typeof parsed.question === 'string' ? parsed.question : '',
      proposed_changes: parsed.proposed_changes && typeof parsed.proposed_changes === 'object'
        ? parsed.proposed_changes
        : {},
    }
  }

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
    const scope = parsed.scope === 'flights' ? 'flights' : 'full'
    return { kind: 'rerun', changes: out, scope, note: typeof parsed.note === 'string' ? parsed.note : '' }
  }

  // default to repick (also handles parsed.kind === 'repick')
  const placeIndices = Array.isArray(parsed.places) ? parsed.places.map(Number).filter(Number.isInteger) : []
  return {
    kind: 'repick',
    flight: safeNumber(parsed.flight, currentIdx.flight),
    hotel: safeNumber(parsed.hotel, currentIdx.hotel),
    places: placeIndices.length ? placeIndices : currentIdx.places,
    note: typeof parsed.note === 'string' ? parsed.note : '',
  }
}
