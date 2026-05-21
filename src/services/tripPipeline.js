import {
  MOCK_FLIGHTS,
  MOCK_HOTELS,
  MOCK_NARRATIVE,
  MOCK_PLACES,
  MOCK_TRIP_INFO,
} from './mockData.js'

const MOCK = import.meta.env.VITE_MOCK_MODE === 'true'

const OLLAMA_MODEL = 'llama3.2'
const OLLAMA_URL = 'http://localhost:11434/api/generate'
const SEARCHAPI_BASE = 'https://www.searchapi.io/api/v1/search'

export const REQUIRED_FIELDS = [
  'departure_iata',
  'arrival_iata',
  'destination_name',
  'trip_duration_days',
]

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

export async function ollamaGenerate(system, prompt, { signal } = {}) {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      system,
      prompt,
      stream: false,
      format: 'json',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama error ${res.status}: ${text}`)
  }
  const data = await res.json()
  return data.response
}

// Streams a free-form (non-JSON) response token-by-token.
// Calls onChunk(deltaText) for each piece; resolves with the full text.
export async function ollamaStream(system, prompt, onChunk, { signal } = {}) {
  if (MOCK) {
    for (const word of MOCK_NARRATIVE.split(' ')) {
      await new Promise((r) => setTimeout(r, 40))
      onChunk?.(word + ' ')
    }
    return MOCK_NARRATIVE
  }
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      system,
      prompt,
      stream: true,
    }),
  })
  if (!res.ok || !res.body) {
    const text = res.body ? await res.text() : ''
    throw new Error(`Ollama error ${res.status}: ${text}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      let json
      try { json = JSON.parse(line) } catch { continue }
      if (typeof json.response === 'string' && json.response.length > 0) {
        full += json.response
        onChunk?.(json.response)
      }
      if (json.done) return full
    }
  }
  return full
}

export async function extractTripInfo(userPrompt, opts) {
  if (MOCK) return { ...MOCK_TRIP_INFO }
  const today = new Date().toISOString().split('T')[0]
  const system = `Extract travel details from the user's trip description. Today's date is ${today}.
Return ONLY a valid JSON object with exactly these fields. Use null for anything the user did NOT state — do not guess.
- "departure_iata": The SPECIFIC primary airport IATA code (3 letters) for the departure city. Examples: Manado="MDC", Jakarta="CGK", Surabaya="SUB", Bali="DPS". Never use a city/metro code.
- "departure_city": Departure city name, or null
- "arrival_iata": The SPECIFIC primary airport IATA code (3 letters) for the destination. Examples: Tokyo="HND", Bali="DPS", Bangkok="BKK", Singapore="SIN", Seoul="ICN". NEVER use a metro code like "TYO" — always pick one real airport.
- "destination_name": Full destination name for searching (e.g. "Tokyo, Japan"), or null
- "trip_duration_days": Number of days as an integer, or null
- "outbound_date": Departure date as YYYY-MM-DD. If the user gives only a month or a relative time (e.g. "November", "next month"), resolve it to a concrete FUTURE date — use the 15th of that month. If no date at all is mentioned, null.
- "preferences": Short text describing the kind of trip the user wants (e.g. "Japanese food, sightseeing"), or null`

  const text = await ollamaGenerate(system, userPrompt, opts)
  const raw = extractJsonObject(text)
  if (!raw) throw new Error('Could not understand the trip description. Please rephrase it.')
  return JSON.parse(raw)
}

export function getMissingFields(info) {
  return REQUIRED_FIELDS.filter((f) => {
    const v = info[f]
    if (v === null || v === undefined || v === '') return true
    if (f === 'trip_duration_days' && (!Number.isFinite(Number(v)) || Number(v) < 1)) return true
    return false
  })
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

export async function selectPlans(tripInfo, flights, places, hotels, opts) {
  const flightList = flights.map((f, i) => `[${i}] ${f.airline} — $${f.price ?? '?'}, ${f.stops} stop(s), ${f.duration_min ?? '?'} min`)
  const hotelList = hotels.map((h, i) => `[${i}] ${h.name} — $${h.price_per_night ?? '?'}/night, rating ${h.rating ?? '?'}, ${h.hotel_class ?? 'hotel'}`)
  const placeList = places.map((p, i) => `[${i}] ${p.name} — rating ${p.rating ?? '?'}`)

  const context = `TRIP: ${tripInfo.departure_city || tripInfo.departure_iata} → ${tripInfo.destination_name}, ${tripInfo.trip_duration_days} days
USER PREFERENCES: ${tripInfo.preferences || 'none specified'}

FLIGHT OPTIONS:
${flightList.length ? flightList.join('\n') : 'none'}

HOTEL OPTIONS:
${hotelList.length ? hotelList.join('\n') : 'none'}

PLACE OPTIONS:
${placeList.length ? placeList.join('\n') : 'none'}`

  const system = `You are a travel planning assistant. Choose options for 3 travel plans from the numbered lists provided.
Return ONLY a valid JSON object — no markdown, no code fences.
The object must have exactly three keys: "best", "budget", "balanced".
- "best": highest quality regardless of price
- "budget": cheapest viable option
- "balanced": a sensible mix of quality and price
Each key maps to an object with exactly these fields:
- "title": short plan name, max 6 words
- "brief": 1-2 sentences on why this plan fits, max 40 words
- "flight": integer index of the chosen flight from the FLIGHT OPTIONS list
- "hotel": integer index of the chosen hotel from the HOTEL OPTIONS list
- "places": array of 3 to 5 integer indices from the PLACE OPTIONS list
Only use index numbers that exist in the lists above.`

  const text = await ollamaGenerate(system, context, opts)
  const raw = extractJsonObject(text)
  if (!raw) throw new Error('AI returned an invalid response. Please try again.')

  const parsed = JSON.parse(raw)
  for (const key of ['best', 'budget', 'balanced']) {
    const sel = parsed[key]
    if (!sel || typeof sel.title !== 'string' || typeof sel.brief !== 'string') {
      throw new Error('AI response was missing expected fields. Please try again.')
    }
  }
  return parsed
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
  getApiKey()
  const [flightsResult, placesResult, hotelsResult] = await Promise.allSettled([
    searchFlights(info.departure_iata, info.arrival_iata, info.outbound_date, info.return_date),
    searchPlaces(info.destination_name),
    searchHotels(info.destination_name, info.outbound_date, info.return_date),
  ])

  const flightsData = flightsResult.status === 'fulfilled'
    ? flightsResult.value
    : { items: [], error: 'Flight search failed.' }

  return {
    flights: flightsData.items,
    flightError: flightsData.error,
    places: placesResult.status === 'fulfilled' ? placesResult.value : [],
    hotels: hotelsResult.status === 'fulfilled' ? hotelsResult.value : [],
  }
}
