// ── Canonical test input ─────────────────────────────────────────────────────
// Paste this into the composer when VITE_MOCK_MODE=true to exercise the full pipeline.
export const MOCK_USER_PROMPT =
  '3-day trip from Manado to Bali, I love beaches and good food'

// ── Fixed trip info ──────────────────────────────────────────────────────────
// Returned directly by extractTripInfo() in mock mode — skips the LLM call.
export const MOCK_TRIP_INFO = {
  departure_iata: 'MDC',
  departure_city: 'Manado',
  arrival_iata: 'DPS',
  destination_name: 'Bali, Indonesia',
  trip_duration_days: 3,
  outbound_date: '2025-09-15',
  preferences: 'beaches, good food',
}

// ── Search fixtures ──────────────────────────────────────────────────────────
// Shapes must match exactly what searchFlights / searchHotels / searchPlaces return.

export const MOCK_FLIGHTS = {
  items: [
    {
      airline: 'Garuda Indonesia',
      airline_logo: null,
      departure_time: '2025-09-15 07:00',
      arrival_time: '2025-09-15 09:10',
      duration_min: 130,
      stops: 0,
      price: 180,
    },
    {
      airline: 'Lion Air',
      airline_logo: null,
      departure_time: '2025-09-15 11:30',
      arrival_time: '2025-09-15 14:00',
      duration_min: 150,
      stops: 1,
      price: 95,
    },
    {
      airline: 'Batik Air',
      airline_logo: null,
      departure_time: '2025-09-15 15:00',
      arrival_time: '2025-09-15 17:20',
      duration_min: 140,
      stops: 0,
      price: 130,
    },
  ],
  error: null,
}

export const MOCK_HOTELS = [
  {
    name: 'Kuta Reef Beach Resort',
    description: 'Beachfront resort with infinity pool and spa.',
    rating: 4.6,
    price_per_night: 95,
    total_rate: 285,
    hotel_class: '4-star',
    link: null,
  },
  {
    name: 'Ubud Budget Inn',
    description: 'Simple, clean rooms near the rice terraces.',
    rating: 3.8,
    price_per_night: 30,
    total_rate: 90,
    hotel_class: '2-star',
    link: null,
  },
  {
    name: 'Seminyak Boutique Villas',
    description: 'Private villas with rooftop pool, close to nightlife.',
    rating: 4.9,
    price_per_night: 210,
    total_rate: 630,
    hotel_class: '5-star',
    link: null,
  },
]

export const MOCK_PLACES = [
  {
    name: 'Tanah Lot Temple',
    description: 'Iconic sea temple perched on a rock, stunning at sunset.',
    rating: 4.7,
    reviews: 8400,
    price: null,
    type: 'Temple',
    website: null,
  },
  {
    name: 'Seminyak Beach',
    description: 'Wide sandy beach lined with beach clubs and restaurants.',
    rating: 4.5,
    reviews: 5100,
    price: null,
    type: 'Beach',
    website: null,
  },
  {
    name: 'Ubud Monkey Forest',
    description: 'Sacred ancient forest home to hundreds of monkeys.',
    rating: 4.4,
    reviews: 12000,
    price: '$5',
    type: 'Nature',
    website: null,
  },
  {
    name: 'Tegallalang Rice Terraces',
    description: 'Stepped emerald rice fields with stunning valley views.',
    rating: 4.6,
    reviews: 9200,
    price: null,
    type: 'Landscape',
    website: null,
  },
  {
    name: 'Jimbaran Seafood Market',
    description: 'Fresh seafood grilled tableside on the beach at sunset.',
    rating: 4.3,
    reviews: 3800,
    price: '$$',
    type: 'Restaurant',
    website: null,
  },
]

// ── Tripadvisor enrichment fixtures ─────────────────────────────────────────
// Shapes must match what searchTripadvisor returns.
// Names must align with MOCK_PLACES so matchTripadvisorPlace() can merge them.
export const MOCK_TRIPADVISOR_PLACES = [
  {
    name: 'Tanah Lot Temple',
    tripadvisor_rating: 4.8,
    tripadvisor_review_count: 12400,
    review_snippets: [
      'One of the most iconic spots in Bali — stunning at sunset.',
      'Crowds can be heavy but absolutely worth it for the views.',
    ],
  },
  {
    name: 'Seminyak Beach',
    tripadvisor_rating: 4.5,
    tripadvisor_review_count: 6800,
    review_snippets: [
      'Great beach clubs and the sunset here is magical.',
      'Cleaner and more upscale than Kuta Beach.',
    ],
  },
  {
    name: 'Ubud Monkey Forest',
    tripadvisor_rating: 4.4,
    tripadvisor_review_count: 18200,
    review_snippets: [
      "Don't bring food in — the monkeys are quick!",
      'Magical place, especially early in the morning.',
    ],
  },
  {
    name: 'Tegallalang Rice Terraces',
    tripadvisor_rating: 4.5,
    tripadvisor_review_count: 10900,
    review_snippets: [
      'Breathtaking views of the layered terraces.',
      'Go early to beat the tour groups.',
    ],
  },
  {
    name: 'Jimbaran Seafood Market',
    tripadvisor_rating: 4.3,
    tripadvisor_review_count: 4200,
    review_snippets: [
      'Fresh seafood grilled right on the beach — unforgettable.',
      'The grilled fish and prawns are excellent value.',
    ],
  },
]

// ── Streaming narrative ──────────────────────────────────────────────────────
// Emitted token-by-token by ollamaStream() in mock mode so the streaming UI runs.
export const MOCK_NARRATIVE =
  "Here are three travel plans I put together for your 3-day Bali trip! " +
  "Pick the one that suits you best, or let me know if you'd like to adjust anything."
