// ── Canonical test input ─────────────────────────────────────────────────────
// Paste one of these into the composer when VITE_MOCK_MODE=true.
// SearchAPI calls are bypassed; Ollama still runs on your actual prompt.
export const MOCK_USER_PROMPT =
  '3-day trip from Manado to Bali, I love beaches and good food'

export const MOCK_USER_PROMPT_BUDGET =
  '5-day budget trip from Jakarta to Yogyakarta, interested in culture and temples'

export const MOCK_USER_PROMPT_LUXURY =
  '4-day luxury escape from Surabaya to Raja Ampat, diving and relaxation'

// ── Fixed trip info ──────────────────────────────────────────────────────────
// Shape must match what extractAndMergeTripInfo returns.
export const MOCK_TRIP_INFO = {
  departure_iata: 'MDC',
  departure_city: 'Manado',
  arrival_iata: 'DPS',
  destination_name: 'Bali, Indonesia',
  trip_duration_days: 3,
  outbound_date: '2025-09-15',
  preferences: 'beaches, good food',
}

export const MOCK_TRIP_INFO_YOGYAKARTA = {
  departure_iata: 'CGK',
  departure_city: 'Jakarta',
  arrival_iata: 'JOG',
  destination_name: 'Yogyakarta, Indonesia',
  trip_duration_days: 5,
  outbound_date: '2025-10-10',
  preferences: 'culture, temples, batik',
}

export const MOCK_TRIP_INFO_RAJA_AMPAT = {
  departure_iata: 'SUB',
  departure_city: 'Surabaya',
  arrival_iata: 'RJM',
  destination_name: 'Raja Ampat, Indonesia',
  trip_duration_days: 4,
  outbound_date: '2025-11-05',
  preferences: 'diving, relaxation, luxury',
}

// ── Search fixtures — Bali ────────────────────────────────────────────────────

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

// ── Search fixtures — Yogyakarta ──────────────────────────────────────────────

export const MOCK_FLIGHTS_YOGYAKARTA = {
  items: [
    {
      airline: 'Garuda Indonesia',
      airline_logo: null,
      departure_time: '2025-10-10 06:30',
      arrival_time: '2025-10-10 07:40',
      duration_min: 70,
      stops: 0,
      price: 60,
    },
    {
      airline: 'Citilink',
      airline_logo: null,
      departure_time: '2025-10-10 10:00',
      arrival_time: '2025-10-10 11:10',
      duration_min: 70,
      stops: 0,
      price: 38,
    },
    {
      airline: 'Lion Air',
      airline_logo: null,
      departure_time: '2025-10-10 13:00',
      arrival_time: '2025-10-10 15:20',
      duration_min: 140,
      stops: 1,
      price: 27,
    },
  ],
  error: null,
}

export const MOCK_HOTELS_YOGYAKARTA = [
  {
    name: 'Hyatt Regency Yogyakarta',
    description: 'Luxury hotel with views of Merapi volcano and a large pool.',
    rating: 4.7,
    price_per_night: 120,
    total_rate: 600,
    hotel_class: '5-star',
    link: null,
  },
  {
    name: 'Gaia Cosmo Hotel',
    description: 'Stylish mid-range hotel near Malioboro Street.',
    rating: 4.3,
    price_per_night: 45,
    total_rate: 225,
    hotel_class: '4-star',
    link: null,
  },
  {
    name: 'Lotus Guesthouse',
    description: 'Friendly budget guesthouse near Prambanan, with breakfast included.',
    rating: 4.0,
    price_per_night: 15,
    total_rate: 75,
    hotel_class: '2-star',
    link: null,
  },
]

export const MOCK_PLACES_YOGYAKARTA = [
  {
    name: 'Borobudur Temple',
    description: "The world's largest Buddhist temple, a UNESCO World Heritage site.",
    rating: 4.8,
    reviews: 24000,
    price: '$25',
    type: 'Temple',
    website: null,
  },
  {
    name: 'Prambanan Temple Complex',
    description: 'Stunning 9th-century Hindu temples dedicated to the Trimurti.',
    rating: 4.7,
    reviews: 18000,
    price: '$20',
    type: 'Temple',
    website: null,
  },
  {
    name: 'Malioboro Street',
    description: 'The famous shopping street lined with batik, wayang, and street food.',
    rating: 4.4,
    reviews: 15000,
    price: null,
    type: 'Shopping',
    website: null,
  },
  {
    name: 'Kraton (Sultan Palace)',
    description: "The Yogyakarta sultanate's royal palace and cultural museum.",
    rating: 4.3,
    reviews: 9200,
    price: '$2',
    type: 'Historical',
    website: null,
  },
  {
    name: 'Gudeg Yu Djum',
    description: 'Legendary gudeg restaurant serving the iconic Yogyakarta jackfruit stew since 1950.',
    rating: 4.5,
    reviews: 5400,
    price: '$',
    type: 'Restaurant',
    website: null,
  },
  {
    name: 'Mount Merapi Viewpoint',
    description: 'Dramatic views of the active Merapi volcano; jeep tours available.',
    rating: 4.6,
    reviews: 7800,
    price: '$$',
    type: 'Nature',
    website: null,
  },
]

// ── Search fixtures — Raja Ampat ──────────────────────────────────────────────

export const MOCK_FLIGHTS_RAJA_AMPAT = {
  items: [
    {
      airline: 'Garuda Indonesia',
      airline_logo: null,
      departure_time: '2025-11-05 07:00',
      arrival_time: '2025-11-05 14:30',
      duration_min: 270,
      stops: 1,
      price: 420,
    },
    {
      airline: 'Batik Air',
      airline_logo: null,
      departure_time: '2025-11-05 11:00',
      arrival_time: '2025-11-05 19:20',
      duration_min: 320,
      stops: 2,
      price: 260,
    },
  ],
  error: null,
}

export const MOCK_HOTELS_RAJA_AMPAT = [
  {
    name: 'Papua Paradise Eco Resort',
    description: 'Over-water bungalows on a private island with house reef snorkeling.',
    rating: 4.9,
    price_per_night: 350,
    total_rate: 1400,
    hotel_class: '5-star',
    link: null,
  },
  {
    name: 'Coralia Raja Ampat',
    description: 'Mid-range dive resort with direct beach access and PADI dive centre.',
    rating: 4.5,
    price_per_night: 140,
    total_rate: 560,
    hotel_class: '4-star',
    link: null,
  },
  {
    name: 'Waisai Torang Cinta Beach Camp',
    description: 'Budget beach camp with basic huts and stunning snorkeling right outside.',
    rating: 4.1,
    price_per_night: 40,
    total_rate: 160,
    hotel_class: '2-star',
    link: null,
  },
]

export const MOCK_PLACES_RAJA_AMPAT = [
  {
    name: 'Wayag Islands',
    description: 'Iconic karst mushroom islands surrounded by crystal-clear turquoise water.',
    rating: 4.9,
    reviews: 6200,
    price: '$$',
    type: 'Nature',
    website: null,
  },
  {
    name: 'Piaynemo Viewpoint',
    description: 'Panoramic hilltop view over dozens of jungle-topped islets.',
    rating: 4.8,
    reviews: 4800,
    price: '$',
    type: 'Viewpoint',
    website: null,
  },
  {
    name: 'Pianemo Snorkeling Spot',
    description: 'Incredibly rich coral gardens with manta rays and pygmy seahorses.',
    rating: 4.9,
    reviews: 3900,
    price: '$$',
    type: 'Diving / Snorkeling',
    website: null,
  },
  {
    name: 'Arborek Village',
    description: "Traditional Papuan fishing village; great spot for manta ray sightings.",
    rating: 4.6,
    reviews: 2700,
    price: null,
    type: 'Cultural',
    website: null,
  },
  {
    name: 'Misool Eco Resort House Reef',
    description: 'World-class dive site with sharks, turtles, and rare nudibranchs.',
    rating: 4.8,
    reviews: 1900,
    price: '$$$',
    type: 'Diving / Snorkeling',
    website: null,
  },
]

// ── Tripadvisor enrichment fixtures — Bali ────────────────────────────────────

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

// ── Tripadvisor enrichment fixtures — Yogyakarta ──────────────────────────────

export const MOCK_TRIPADVISOR_PLACES_YOGYAKARTA = [
  {
    name: 'Borobudur Temple',
    tripadvisor_rating: 4.9,
    tripadvisor_review_count: 31000,
    review_snippets: [
      'One of the most impressive historical sites I have ever visited.',
      'Go at sunrise — the mist over the stupas is absolutely magical.',
      'Allow at least 3 hours to fully explore all levels.',
    ],
  },
  {
    name: 'Prambanan Temple Complex',
    tripadvisor_rating: 4.7,
    tripadvisor_review_count: 22000,
    review_snippets: [
      'Stunning Hindu architecture, very different vibe to Borobudur.',
      'The evening Ramayana ballet performance here is unmissable.',
    ],
  },
  {
    name: 'Malioboro Street',
    tripadvisor_rating: 4.3,
    tripadvisor_review_count: 19000,
    review_snippets: [
      'Great for batik shopping — bargain hard and you will get good prices.',
      'Lively at night with street musicians and food stalls.',
    ],
  },
  {
    name: 'Kraton (Sultan Palace)',
    tripadvisor_rating: 4.2,
    tripadvisor_review_count: 11000,
    review_snippets: [
      'Fascinating cultural history; the gamelan performances are a highlight.',
      'The guided tour is worth it for the context about Javanese royalty.',
    ],
  },
  {
    name: 'Gudeg Yu Djum',
    tripadvisor_rating: 4.6,
    tripadvisor_review_count: 6800,
    review_snippets: [
      'Best gudeg in Yogyakarta — rich, sweet jackfruit stew done perfectly.',
      'Arrive early as they often sell out by mid-morning.',
    ],
  },
  {
    name: 'Mount Merapi Viewpoint',
    tripadvisor_rating: 4.5,
    tripadvisor_review_count: 9400,
    review_snippets: [
      'The jeep tour is thrilling and the volcanic landscape is surreal.',
      'Book a sunrise slot for the clearest views of the summit.',
    ],
  },
]

// ── Tripadvisor enrichment fixtures — Raja Ampat ─────────────────────────────

export const MOCK_TRIPADVISOR_PLACES_RAJA_AMPAT = [
  {
    name: 'Wayag Islands',
    tripadvisor_rating: 4.9,
    tripadvisor_review_count: 7800,
    review_snippets: [
      'The most beautiful place I have ever seen — bar none.',
      'The boat ride is long but the view from the top is worth every minute.',
      'Bring snorkeling gear — the water around the islands is spectacular.',
    ],
  },
  {
    name: 'Piaynemo Viewpoint',
    tripadvisor_rating: 4.8,
    tripadvisor_review_count: 5600,
    review_snippets: [
      'Fewer crowds than Wayag and just as breathtaking.',
      'Climb early morning before other tour boats arrive.',
    ],
  },
  {
    name: 'Pianemo Snorkeling Spot',
    tripadvisor_rating: 4.9,
    tripadvisor_review_count: 4200,
    review_snippets: [
      'The coral density here is unlike anything I have seen in 20 years of diving.',
      'Manta rays glide right past you — absolutely surreal.',
    ],
  },
  {
    name: 'Arborek Village',
    tripadvisor_rating: 4.5,
    tripadvisor_review_count: 3100,
    review_snippets: [
      'Warm welcome from the locals; the handicraft market is charming.',
      'Manta rays feed in the shallows right off the jetty — unbelievable.',
    ],
  },
  {
    name: 'Misool Eco Resort House Reef',
    tripadvisor_rating: 4.8,
    tripadvisor_review_count: 2200,
    review_snippets: [
      'Best dive I have done in 15 years of liveaboards — period.',
      'The conservation work here is inspiring; stay as long as you can.',
    ],
  },
]

// ── Ready confirmation ────────────────────────────────────────────────────────
export const MOCK_READY_CONFIRMATION =
  "Perfect, I have everything I need — searching for flights, hotels, and places now!"

// ── Streaming narrative ───────────────────────────────────────────────────────
// Emitted token-by-token by ollamaStream() in mock mode so the streaming UI runs.
export const MOCK_NARRATIVE =
  "Here's your trip plan! I've put together a balanced mix of flights, hotel, and places based on your preferences. " +
  "What kind of experience are you going for — relaxed beach vibes, a food adventure, luxury, or something else?"
