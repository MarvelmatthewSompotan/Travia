const AIRPORT_MAP = {
  // Indonesia
  jakarta: 'CGK', bandung: 'BDO', surabaya: 'SUB',
  bali: 'DPS', denpasar: 'DPS',
  yogyakarta: 'JOG', yogya: 'JOG', jogja: 'JOG', semarang: 'SRG',
  manado: 'MDC', makassar: 'UPG', balikpapan: 'BPN', pontianak: 'PNK',
  palembang: 'PLM', medan: 'KNO', pekanbaru: 'PKU', padang: 'PDG',
  lombok: 'LOP', 'raja ampat': 'RJM', sorong: 'SOQ',
  // Southeast Asia
  singapore: 'SIN', 'kuala lumpur': 'KUL', kl: 'KUL',
  bangkok: 'BKK', phuket: 'HKT', 'chiang mai': 'CNX',
  'ho chi minh': 'SGN', saigon: 'SGN', hanoi: 'HAN',
  manila: 'MNL', cebu: 'CEB', boracay: 'MPH',
  'phnom penh': 'PNH', 'siem reap': 'REP', yangon: 'RGN',
  // East Asia
  tokyo: 'HND', osaka: 'KIX', seoul: 'ICN', busan: 'PUS',
  beijing: 'PEK', shanghai: 'PVG', 'hong kong': 'HKG', taipei: 'TPE',
  // South Asia / Middle East
  dubai: 'DXB', 'abu dhabi': 'AUH', doha: 'DOH',
  mumbai: 'BOM', delhi: 'DEL', bangalore: 'BLR',
  // Europe
  london: 'LHR', paris: 'CDG', amsterdam: 'AMS',
  frankfurt: 'FRA', rome: 'FCO', barcelona: 'BCN',
  // Australia / Pacific
  sydney: 'SYD', melbourne: 'MEL', brisbane: 'BNE', auckland: 'AKL',
  // Americas
  'new york': 'JFK', 'los angeles': 'LAX', 'san francisco': 'SFO',
  miami: 'MIA', toronto: 'YYZ', 'mexico city': 'MEX',
}

const MONTH_MAP = {
  january: '01', jan: '01',
  february: '02', feb: '02',
  march: '03', mar: '03',
  april: '04', apr: '04',
  may: '05',
  june: '06', jun: '06',
  july: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sep: '09', sept: '09',
  october: '10', oct: '10',
  november: '11', nov: '11',
  december: '12', dec: '12',
}

export function inferAirport(text) {
  if (!text) return null
  const lower = text.toLowerCase().trim()
  for (const [key, iata] of Object.entries(AIRPORT_MAP)) {
    if (lower.includes(key)) return iata
  }
  return null
}

export function inferDatesFromSeason(text) {
  if (!text) return null
  const lower = text.toLowerCase()
  const today = new Date()

  if (lower.includes('next month')) {
    const d = new Date(today.getFullYear(), today.getMonth() + 1, 15)
    return d.toISOString().split('T')[0]
  }
  if (lower.includes('this month')) {
    const d = new Date(today.getFullYear(), today.getMonth(), 15)
    return d.toISOString().split('T')[0]
  }

  for (const [keyword, month] of Object.entries(MONTH_MAP)) {
    if (!lower.includes(keyword)) continue
    const targetYear =
      parseInt(month) <= today.getMonth() + 1 ? today.getFullYear() + 1 : today.getFullYear()
    return `${targetYear}-${month}-15`
  }
  return null
}

export function inferTripLength(text) {
  if (!text) return null
  const lower = text.toLowerCase()
  if (lower.includes('weekend') || /\b2[\s-]day/.test(lower) || lower.includes('two day')) return 2
  if (/\b3[\s-]day/.test(lower) || lower.includes('three day') || lower.includes('long weekend')) return 3
  if (/\b5[\s-]day/.test(lower) || lower.includes('five day')) return 5
  if (/\b10[\s-]day/.test(lower) || lower.includes('ten day')) return 10
  if (lower.includes('two week') || /\b2[\s-]week/.test(lower)) return 14
  if (lower.includes('week') && !lower.includes('next week')) return 7
  return null
}
