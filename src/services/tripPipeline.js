import {
  MOCK_FLIGHTS,
  MOCK_HOTELS,
  MOCK_NARRATIVE,
  MOCK_PLACES,
  MOCK_TRIPADVISOR_PLACES,
} from './mockData.js'
import { computeConfidence, CONFIDENCE_THRESHOLD } from './confidenceScore.js'
import { inferAirport, inferDatesFromSeason, inferTripLength } from './inferDefaults.js'
import { llmGenerate, llmStream } from './llmProvider.js'
export { ollamaGenerate } from './ollamaClient.js'

const MOCK = import.meta.env.VITE_MOCK_MODE === 'true'

const SEARCHAPI_BASE = 'https://www.searchapi.io/api/v1/search'

const INTAKE_REQUIRED = ['departure_iata', 'arrival_iata', 'destination_name', 'trip_duration_days']
const INTAKE_OPTIONAL = ['outbound_date', 'preferences']

function getApiKey() {
  const key = import.meta.env.VITE_SEARCHAPI_KEY
  if (!key) {
    throw new Error('Missing VITE_SEARCHAPI_KEY. Set it in .env and restart the dev server.')
  }
  return key
}

export function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function extractJsonObject(text) {
  const obj = text.match(/\{[\s\S]*\}/)
  return obj ? obj[0] : null
}

function buildFlightLink(depIata, arrIata, outboundDate, returnDate) {
  const q = `Flights from ${depIata} to ${arrIata} on ${outboundDate} returning ${returnDate}`
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`
}

// Mock stream — emits MOCK_NARRATIVE word-by-word so the streaming UI path runs.
export async function ollamaStream(system, prompt, onChunk, { signal } = {}) {
  if (MOCK) {
    for (const word of MOCK_NARRATIVE.split(' ')) {
      if (signal?.aborted) break
      await new Promise((r) => setTimeout(r, 40))
      onChunk?.(word + ' ')
    }
    return MOCK_NARRATIVE
  }
  return llmStream(system, prompt, onChunk, { signal })
}

export async function extractAndMergeTripInfo(conversationHistory, existingContext = {}, opts) {
  const today = new Date().toISOString().split('T')[0]
  const convoText = conversationHistory
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  const system = `You extract travel details from a conversation and infer as much as possible. Today is ${today}.
Be AGGRESSIVE about inference — if someone says "Bali" infer DPS airport. "Jakarta" → CGK. "Manado" → MDC. "a week" → 7 days.
Return ONLY valid JSON with these exact fields:
- "departure_iata": 3-letter IATA for origin airport. Infer from any city/region mention.
- "departure_city": origin city name, or null
- "arrival_iata": 3-letter IATA for destination airport. Infer from any destination mention.
- "destination_name": full destination name e.g. "Bali, Indonesia", or null
- "trip_duration_days": integer days. Infer: "a week"=7, "weekend"=2, "long weekend"=3, "10 days"=10, "a few days"=3. Default 5 if genuinely unknown.
- "outbound_date": YYYY-MM-DD. Resolve relative references to a concrete FUTURE date. "Next month" → 15th of next month. "In July" → July 15 of nearest future year. Null only if absolutely no hint.
- "preferences": trip style and interests, or null
Return null only when there is truly zero basis for inference.`

  const existingText = Object.entries(existingContext)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')

  const prompt = `${existingText ? `Previously known: ${existingText}\n\n` : ''}Conversation:\n${convoText}\n\nExtract or update trip details. Infer aggressively. Preserve previously known values unless the conversation explicitly changes them.`

  const text = await llmGenerate(system, prompt, opts)
  const raw = extractJsonObject(text)

  let extracted
  try { extracted = raw ? JSON.parse(raw) : {} } catch { extracted = {} }

  const trip_context = {
    departure_iata:     extracted.departure_iata     ?? existingContext.departure_iata     ?? null,
    departure_city:     extracted.departure_city     ?? existingContext.departure_city     ?? null,
    arrival_iata:       extracted.arrival_iata       ?? existingContext.arrival_iata       ?? null,
    destination_name:   extracted.destination_name   ?? existingContext.destination_name   ?? null,
    trip_duration_days: extracted.trip_duration_days ?? existingContext.trip_duration_days ?? null,
    outbound_date:      extracted.outbound_date      ?? existingContext.outbound_date      ?? null,
    preferences:        extracted.preferences        ?? existingContext.preferences        ?? null,
  }

  const confidence = computeConfidence(trip_context)
  const ready_to_plan = confidence >= CONFIDENCE_THRESHOLD

  const missing_required = INTAKE_REQUIRED.filter((f) => {
    const v = trip_context[f]
    if (!v && v !== 0) return true
    if (f === 'trip_duration_days' && (!Number.isFinite(Number(v)) || Number(v) < 1)) return true
    return false
  })

  const missing_optional = INTAKE_OPTIONAL.filter((f) => !trip_context[f])

  return {
    trip_context,
    confidence,
    ready_to_plan,
    missing_required,
    missing_optional,
  }
}

export async function generateFollowUp(tripContext, missingRequired, missingOptional, history, opts) {
  const known = Object.entries(tripContext)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ')

  const recentUser = history
    .filter((m) => m.role === 'user')
    .slice(-2)
    .map((m) => m.content)
    .join(' / ')

  const critical = missingRequired.slice(0, 2)

  const system =
    'You are a friendly travel assistant. Ask ONLY for the most critical missing trip details. Never ask about optional things like preferences. Max 1-2 short sentences. No bullet lists, no greeting, no filler.'

  const prompt = `Known: ${known || 'nothing yet'}
Critical gaps (ask about at most 2): ${critical.join(', ')}
${recentUser ? `User just said: "${recentUser}"` : ''}
Write a single natural follow-up question. Ask ONLY about the critical gaps above.`

  return await llmGenerate(system, prompt, { ...opts, json: false })
}

export async function generateReadyConfirmation(tripContext, opts) {
  const system =
    'You are a friendly travel assistant. In one short sentence, say you have all the details and are searching right now. Do NOT ask for confirmation — just announce and go. Be warm and direct.'
  const prompt = `Trip: ${tripContext.departure_city || tripContext.departure_iata} → ${tripContext.destination_name}, ${tripContext.trip_duration_days} day(s) from ${tripContext.outbound_date || 'soon'}.`
  return await llmGenerate(system, prompt, { ...opts, json: false })
}

export function fillDefaults(tripContext) {
  const info = { ...tripContext }
  if (!info.departure_iata && info.departure_city) {
    info.departure_iata = inferAirport(info.departure_city)
  }
  if (!info.arrival_iata && info.destination_name) {
    info.arrival_iata = inferAirport(info.destination_name)
  }
  if (!info.trip_duration_days) {
    info.trip_duration_days = inferTripLength(info.preferences) ?? 5
  }
  if (!info.outbound_date && info.preferences) {
    info.outbound_date = inferDatesFromSeason(info.preferences)
  }
  if (!info.outbound_date) info.outbound_date = daysFromNow(7)
  return info
}

export async function searchFlights(departureIata, arrivalIata, outboundDate, returnDate) {
  if (MOCK) return MOCK_FLIGHTS
  const params = new URLSearchParams({
    engine: 'google_flights',
    departure_id: String(departureIata || '').toUpperCase(),
    arrival_id: String(arrivalIata || '').toUpperCase(),
    outbound_date: outboundDate,
    return_date: returnDate,
    flight_type: 'round_trip',
    currency: 'USD',
    api_key: getApiKey(),
  })

  const res = await fetch(`${SEARCHAPI_BASE}?${params}`)
  if (!res.ok) {
    return { items: [], error: `Flight search failed (HTTP ${res.status}).` }
  }

  const data = await res.json()
  const all = [...(data.best_flights || []), ...(data.other_flights || [])]
  const items = all.slice(0, 6).map((f) => {
    const legs = f.flights || []
    const first = legs[0] || {}
    const last = legs[legs.length - 1] || {}
    return {
      airline: first.airline ?? 'Unknown airline',
      airline_logo: first.airline_logo ?? f.airline_logo ?? null,
      departure_time: first.departure_airport?.time
        ? `${first.departure_airport.date ?? ''} ${first.departure_airport.time}`.trim()
        : null,
      arrival_time: last.arrival_airport?.time
        ? `${last.arrival_airport.date ?? ''} ${last.arrival_airport.time}`.trim()
        : null,
      duration_min: f.total_duration ?? null,
      stops: Math.max(legs.length - 1, 0),
      price: f.price ?? null,
    }
  })

  if (items.length === 0) {
    return {
      items: [],
      error: data.error
        || `No flights found for ${departureIata} → ${arrivalIata} on ${outboundDate}. The airport code may be incorrect.`,
    }
  }
  return { items, error: null }
}

export async function searchPlaces(destinationName) {
  if (MOCK) return MOCK_PLACES
  const params = new URLSearchParams({
    engine: 'google_maps',
    q: `top tourist attractions in ${destinationName}`,
    api_key: getApiKey(),
  })

  const res = await fetch(`${SEARCHAPI_BASE}?${params}`)
  if (!res.ok) return []

  const data = await res.json()
  const results = data.local_results || []
  return results.slice(0, 10).map((p) => ({
    name: p.title ?? 'Unknown place',
    description: p.description ?? null,
    rating: p.rating ?? null,
    reviews: p.reviews ?? null,
    price: p.price ?? null,
    type: p.type ?? null,
    website: p.website ?? null,
  }))
}

export async function searchHotels(destinationName, checkIn, checkOut) {
  if (MOCK) return MOCK_HOTELS
  const params = new URLSearchParams({
    engine: 'google_hotels',
    q: `hotels in ${destinationName}`,
    check_in_date: checkIn,
    check_out_date: checkOut,
    api_key: getApiKey(),
  })

  const res = await fetch(`${SEARCHAPI_BASE}?${params}`)
  if (!res.ok) return []

  const data = await res.json()
  const results = data.properties || []
  return results.slice(0, 8).map((h) => ({
    name: h.name ?? 'Unknown hotel',
    price_per_night: h.price_per_night?.extracted_price ?? null,
    total_rate: h.total_price?.extracted_price ?? null,
    rating: h.rating ?? null,
    hotel_class: h.hotel_class ?? null,
    description: h.description ?? null,
    link: h.link ?? null,
  }))
}

export async function searchTripadvisor(destinationName) {
  if (MOCK) return MOCK_TRIPADVISOR_PLACES

  const params = new URLSearchParams({
    engine: 'tripadvisor',
    q: `things to do in ${destinationName}`,
    api_key: getApiKey(),
  })

  const res = await fetch(`${SEARCHAPI_BASE}?${params}`)
  if (!res.ok) return []

  const data = await res.json()
  const results = data.results || data.attractions || data.properties || []
  return results.slice(0, 15).map((r) => ({
    name: r.name || r.title || '',
    tripadvisor_rating: r.rating ?? null,
    tripadvisor_review_count: r.num_reviews ?? r.review_count ?? null,
    review_snippets: (r.reviews || [])
      .slice(0, 3)
      .map((rv) => (typeof rv === 'string' ? rv : rv.text || rv.snippet || '').trim())
      .filter(Boolean),
  }))
}

function matchTripadvisorPlace(place, taResults) {
  const a = place.name.toLowerCase()
  return taResults.find((r) => {
    const b = r.name.toLowerCase()
    if (b === a || b.includes(a) || a.includes(b)) return true
    return b.split(/\s+/).some((w) => w.length > 4 && a.includes(w))
  }) || null
}

export async function enrichPlacesWithReviews(places, destinationName) {
  if (!places?.length) return places
  const taResults = await searchTripadvisor(destinationName).catch(() => [])
  if (!taResults.length) return places
  return places.map((place) => {
    const match = matchTripadvisorPlace(place, taResults)
    if (!match) return place
    return {
      ...place,
      tripadvisor_rating: match.tripadvisor_rating,
      tripadvisor_review_count: match.tripadvisor_review_count,
      review_snippets: match.review_snippets,
    }
  })
}

const EXPERIENCE_BIAS = {
  balanced:   'Pick the best overall combination of quality, price, and variety.',
  budget:     'Minimize total cost. Maximize review quality per dollar. Avoid premium options.',
  luxury:     'Pick the highest-reviewed premium options regardless of price. Hotels 4+ stars.',
  adventure:  'Prioritize outdoor, active, and adventurous places. Avoid tourist traps.',
  food:       'Prioritize restaurants and food experiences. Include at least 3 restaurants in places.',
  relaxation: 'Prioritize resorts, beaches, spas, and low-intensity activities.',
  cultural:   'Prioritize museums, historical sites, local markets, and authentic neighborhoods.',
  romantic:   'Prefer couple-friendly venues and boutique hotels.',
  family:     'Prefer family-friendly places and kid-safe hotels.',
}

export async function generatePlan(tripInfo, cachedOptions, experienceType = 'balanced', opts) {
  const { flights = [], places = [], hotels = [] } = cachedOptions
  const bias = EXPERIENCE_BIAS[experienceType] || EXPERIENCE_BIAS.balanced

  const flightList = flights.map((f, i) => `[${i}] ${f.airline} — $${f.price ?? '?'}, ${f.stops} stop(s), ${f.duration_min ?? '?'} min`)
  const hotelList  = hotels.map((h, i) => `[${i}] ${h.name} — $${h.price_per_night ?? '?'}/night, rating ${h.rating ?? '?'}`)
  const placeList  = places.map((p, i) => {
    const rating = p.tripadvisor_rating ?? p.rating ?? '?'
    const reviewNote = p.review_snippets?.[0] ? ` · "${p.review_snippets[0].slice(0, 80)}"` : ''
    return `[${i}] ${p.name} — rating ${rating}${reviewNote}`
  })

  const context = `TRIP: ${tripInfo.departure_city || tripInfo.departure_iata} → ${tripInfo.destination_name}, ${tripInfo.trip_duration_days} days
PREFERENCES: ${tripInfo.preferences || 'none specified'}
EXPERIENCE TYPE: ${experienceType}
PLANNING BIAS: ${bias}

FLIGHT OPTIONS:
${flightList.length ? flightList.join('\n') : 'none'}

HOTEL OPTIONS:
${hotelList.length ? hotelList.join('\n') : 'none'}

PLACE OPTIONS:
${placeList.length ? placeList.join('\n') : 'none'}`

  const system = `You are a travel planning assistant. Choose ONE travel plan from the numbered lists, applying the PLANNING BIAS strictly.
Return ONLY a valid JSON object — no markdown, no code fences.
Fields:
- "experience_type": the experience type string
- "title": short plan name, max 8 words
- "brief": 2-3 sentences explaining why this combination fits the experience type, max 60 words
- "flight": integer index from FLIGHT OPTIONS
- "hotel": integer index from HOTEL OPTIONS
- "places": array of 4-6 integer indices from PLACE OPTIONS
Only use index numbers that exist in the lists above.`

  const text = await llmGenerate(system, context, opts)
  const raw = extractJsonObject(text)
  if (!raw) throw new Error('AI returned an invalid response. Please try again.')

  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed.title !== 'string' || typeof parsed.brief !== 'string') {
    throw new Error('AI response was missing expected fields. Please try again.')
  }
  return { ...parsed, experience_type: experienceType }
}

export async function generateExperiencePrompt(plan, tripInfo, opts) {
  const system = 'You are a friendly travel assistant. Keep replies to 2-3 sentences, conversational tone, no bullet lists.'
  const prompt = `You just generated a ${tripInfo.trip_duration_days}-day trip to ${tripInfo.destination_name} with hotel: ${plan.hotel?.name ?? 'selected hotel'}.

Ask the user what kind of vibe or experience type they want so you can tailor a new version. Naturally mention a few options like budget-friendly, luxury, food trip, adventure, relaxation, romantic, or cultural — but don't make it feel like a menu.`

  return await llmGenerate(system, prompt, { ...opts, json: false })
}

export async function parseExperienceType(userMessage, opts) {
  const system = 'You classify travel experience preferences. Respond ONLY with valid JSON — no markdown.'
  const prompt = `The user was asked what kind of travel experience they want.
USER SAID: "${userMessage}"

Map to the closest type. Valid types: balanced, budget, luxury, adventure, food, relaxation, cultural, romantic, family.
If unclear, use "balanced".

Respond ONLY with valid JSON:
{"experience_type": "balanced", "confidence": "high", "raw_preference": "user words"}`

  const text = await llmGenerate(system, prompt, opts)
  const raw = extractJsonObject(text)
  try {
    return raw ? JSON.parse(raw) : { experience_type: 'balanced', confidence: 'low', raw_preference: userMessage }
  } catch {
    return { experience_type: 'balanced', confidence: 'low', raw_preference: userMessage }
  }
}

export function pickIndex(value, list) {
  const i = Number(value)
  if (!Number.isInteger(i) || i < 0 || i >= list.length) return list.length ? 0 : -1
  return i
}

export function assemblePlan(selection, tripInfo, flights, places, hotels, flightError) {
  const fi = pickIndex(selection.flight, flights)
  const hi = pickIndex(selection.hotel, hotels)

  let flight = null
  if (fi >= 0) {
    const f = flights[fi]
    flight = {
      ...f,
      duration_hours: f.duration_min ? Math.round((f.duration_min / 60) * 10) / 10 : null,
      link: buildFlightLink(tripInfo.departure_iata, tripInfo.arrival_iata, tripInfo.outbound_date, tripInfo.return_date),
    }
  }

  let hotel = null
  if (hi >= 0) {
    const h = hotels[hi]
    const nights = tripInfo.trip_duration_days
    const total = h.total_rate ?? (h.price_per_night != null ? h.price_per_night * nights : null)
    hotel = { ...h, nights, total_price: total }
  }

  const placeIndices = Array.isArray(selection.places) ? selection.places : []
  const seen = new Set()
  const chosenPlaces = []
  for (const raw of placeIndices) {
    const i = Number(raw)
    if (Number.isInteger(i) && i >= 0 && i < places.length && !seen.has(i)) {
      seen.add(i)
      chosenPlaces.push(places[i])
    }
  }

  const totalPrice = (flight?.price || 0) + (hotel?.total_price || 0)

  return {
    title: selection.title,
    brief: selection.brief,
    flight,
    flightError: flight ? null : flightError,
    hotel,
    places: chosenPlaces,
    total_price: totalPrice,
  }
}

// Normalizes a trip-info object: fills missing dates/duration and computes return_date.
export function normalizeTripInfo(rawInfo) {
  const info = { ...rawInfo }
  const outbound = info.outbound_date && /^\d{4}-\d{2}-\d{2}$/.test(info.outbound_date)
    ? info.outbound_date
    : daysFromNow(1)
  const duration = Number(info.trip_duration_days) || 5
  info.outbound_date = outbound
  info.trip_duration_days = duration
  info.return_date = addDays(outbound, duration)
  return info
}

// Fetches flights/places/hotels in parallel for a normalized tripInfo.
export async function fetchTripOptions(info) {
  if (!MOCK) getApiKey()
  const [flightsResult, placesResult, hotelsResult] = await Promise.allSettled([
    searchFlights(info.departure_iata, info.arrival_iata, info.outbound_date, info.return_date),
    searchPlaces(info.destination_name),
    searchHotels(info.destination_name, info.outbound_date, info.return_date),
  ])

  const flightsData = flightsResult.status === 'fulfilled'
    ? flightsResult.value
    : { items: [], error: 'Flight search failed.' }

  const rawPlaces = placesResult.status === 'fulfilled' ? placesResult.value : []
  const places = rawPlaces.length
    ? await enrichPlacesWithReviews(rawPlaces, info.destination_name).catch(() => rawPlaces)
    : []

  return {
    flights: flightsData.items,
    flightError: flightsData.error,
    places,
    hotels: hotelsResult.status === 'fulfilled' ? hotelsResult.value : [],
  }
}
