/**
 * Geographic boundaries and coastlines for North Indian Ocean countries:
 * Domain: Lat 4°N to 24°N, Lon 60°E to 94°E
 * Includes: India, Sri Lanka, Bangladesh, Myanmar, Pakistan, Oman, Maldives, Andaman & Nicobar, Lakshadweep.
 */

// 1. India Main Coastline & Border Points [lat, lon]
export const INDIA_COASTLINE = [
  // Northwest Gujarat & Kutch
  [23.8, 68.2],
  [23.3, 68.5],
  [22.8, 69.1],
  [22.4, 70.0],
  [22.6, 70.8],
  [21.8, 72.2], // Gulf of Khambhat
  [21.1, 72.8], // Surat
  // Konkan / Maharashtra
  [19.8, 72.8],
  [18.9, 72.8], // Mumbai
  [18.0, 73.0],
  [17.0, 73.3], // Ratnagiri
  [15.8, 73.7], // Goa
  // Karnataka
  [14.8, 74.1], // Karwar
  [13.3, 74.7], // Mangalore
  // Kerala (Malabar Coast)
  [12.0, 75.3], // Kannur
  [11.2, 75.8], // Kozhikode
  [10.0, 76.2], // Kochi
  [8.5, 76.9],  // Thiruvananthapuram
  [8.08, 77.55], // Kanyakumari (Southern Tip)
  // Tamil Nadu (Coromandel Coast & Palk Strait)
  [8.8, 78.1],  // Tuticorin
  [9.3, 79.1],  // Rameswaram
  [10.3, 79.8], // Point Calimere
  [11.8, 79.8], // Puducherry
  [13.1, 80.3], // Chennai
  // Andhra Pradesh
  [14.4, 80.1], // Nellore
  [15.8, 80.3], // Ongole
  [16.2, 81.2], // Krishna Delta
  [16.8, 82.2], // Godavari Delta (Kakinada)
  [17.7, 83.3], // Visakhapatnam
  [18.3, 84.0],
  // Odisha
  [19.3, 85.0], // Gopalpur
  [19.8, 85.8], // Puri / Chilika
  [20.3, 86.7], // Paradip
  [21.4, 87.0], // Chandipur
  // West Bengal
  [21.6, 87.5], // Digha
  [21.8, 88.1], // Sagar Island / Sundarbans
  [22.0, 88.8],
  [22.5, 89.0]  // Indo-Bangladesh border
];

// India Northern inland boundary loop to form solid peninsula mesh
export const INDIA_LAND_BOUNDARY = [
  [22.5, 89.0],
  [24.0, 88.5],
  [24.0, 84.0],
  [24.0, 78.0],
  [24.0, 72.0],
  [23.8, 68.2]
];

// 2. Sri Lanka Island
export const SRI_LANKA_COAST = [
  [9.8, 80.2],  // Jaffna
  [9.2, 80.8],
  [8.6, 81.2],  // Trincomalee
  [7.7, 81.7],  // Batticaloa
  [6.8, 81.8],
  [6.0, 81.0],  // Hambantota
  [5.9, 80.5],  // Dondra Head (Southern Tip)
  [6.1, 80.2],  // Galle
  [6.9, 79.8],  // Colombo
  [7.9, 79.8],  // Puttalam
  [8.6, 79.8],  // Mannar
  [9.8, 80.2]
];

// 3. Bangladesh Coastline
export const BANGLADESH_COAST = [
  [22.5, 89.0],
  [21.8, 89.4],
  [22.0, 90.2],
  [22.3, 90.7],
  [22.8, 91.4], // Meghna Estuary
  [22.3, 91.8], // Chittagong
  [21.4, 92.0], // Cox's Bazar
  [20.9, 92.3]  // Border with Myanmar
];

// 4. Myanmar (Burma) Coastline
export const MYANMAR_COAST = [
  [20.9, 92.3],
  [20.1, 92.9], // Sittwe
  [19.4, 93.5], // Kyaukpyu
  [18.4, 94.3],
  [16.0, 94.2], // Ayeyarwady Delta entrance
  [15.8, 94.8]
];

// 5. Pakistan Coastline
export const PAKISTAN_COAST = [
  [23.8, 68.2], // Sir Creek border with India
  [24.2, 67.8], // Indus Delta
  [24.8, 67.0], // Karachi
  [25.0, 66.3], // Sonmiani
  [25.3, 64.6], // Ormara
  [25.2, 62.3], // Gwadar
  [25.1, 61.5]  // Border with Iran
];

// 6. Oman Coastline (Western Edge of domain)
export const OMAN_COAST = [
  [24.0, 60.0],
  [23.6, 58.6], // Muscat
  [22.5, 59.8], // Ras al Hadd
  [20.6, 58.9], // Masirah
  [19.0, 57.8],
  [17.0, 54.5]  // Salalah
];

// 7. Maldives Coral Atolls (Chains of islets southwest of India)
export const MALDIVES_ATOLLS = [
  { name: 'Ihavandhippolhu Atoll', lat: 7.0, lon: 72.9, r: 0.35 },
  { name: 'Haa Alif / Thiladhunmathi', lat: 6.7, lon: 73.1, r: 0.45 },
  { name: 'North Malé Atoll (Capital)', lat: 4.2, lon: 73.5, r: 0.38 },
  { name: 'Ari Atoll', lat: 3.9, lon: 72.8, r: 0.42 },
  { name: 'Faadhippolhu Atoll', lat: 5.4, lon: 73.6, r: 0.32 }
];

// 8. Lakshadweep Islands (Union Territory of India)
export const LAKSHADWEEP_ISLANDS = [
  { name: 'Kavaratti', lat: 10.56, lon: 72.64, r: 0.22 },
  { name: 'Agatti', lat: 10.85, lon: 72.19, r: 0.20 },
  { name: 'Amini', lat: 11.12, lon: 72.73, r: 0.20 },
  { name: 'Kalpeni', lat: 10.07, lon: 73.65, r: 0.22 },
  { name: 'Minicoy (Maliku)', lat: 8.28, lon: 73.05, r: 0.25 }
];

// 9. Andaman & Nicobar Islands (Union Territory of India)
export const ANDAMAN_ISLANDS = [
  { name: 'North Andaman', lat: 13.5, lon: 92.9, r: 0.35 },
  { name: 'Middle Andaman', lat: 12.5, lon: 92.8, r: 0.35 },
  { name: 'South Andaman (Port Blair)', lat: 11.6, lon: 92.7, r: 0.35 },
  { name: 'Little Andaman', lat: 10.7, lon: 92.5, r: 0.28 },
  { name: 'Car Nicobar', lat: 9.2, lon: 92.8, r: 0.25 },
  { name: 'Great Nicobar', lat: 7.0, lon: 93.8, r: 0.35 }
];

// Country Metadata & Maritime EEZ details
export const REGIONAL_COUNTRIES = [
  {
    id: 'IND',
    name: 'India',
    flag: '🇮🇳',
    coastlineKm: 7516,
    capitalLat: 20.0,
    capitalLon: 78.5,
    tag: 'Host Nation / INCOIS HQ',
    description: 'Peninsular subcontinent dividing the Arabian Sea and Bay of Bengal.'
  },
  {
    id: 'LKA',
    name: 'Sri Lanka',
    flag: '🇱🇰',
    coastlineKm: 1340,
    capitalLat: 7.5,
    capitalLon: 80.7,
    tag: 'Island Nation',
    description: 'Strategic maritime hub between western and eastern Indian Ocean shipping lanes.'
  },
  {
    id: 'BGD',
    name: 'Bangladesh',
    flag: '🇧🇩',
    coastlineKm: 580,
    capitalLat: 23.0,
    capitalLon: 90.0,
    tag: 'Delta Shelf',
    description: 'Northern head of Bay of Bengal; vulnerable to cyclonic surge inundation.'
  },
  {
    id: 'MDV',
    name: 'Maldives',
    flag: '🇲🇻',
    coastlineKm: 644,
    capitalLat: 4.5,
    capitalLon: 73.5,
    tag: 'Atoll Archipelago',
    description: '26 coral atolls rising from the Chagos-Laccadive submarine ridge.'
  },
  {
    id: 'MMR',
    name: 'Myanmar',
    flag: '🇲🇲',
    coastlineKm: 1930,
    capitalLat: 18.0,
    capitalLon: 94.0,
    tag: 'Andaman Littoral',
    description: 'Eastern boundary of the Bay of Bengal and Andaman Sea.'
  },
  {
    id: 'PAK',
    name: 'Pakistan',
    flag: '🇵🇰',
    coastlineKm: 1046,
    capitalLat: 24.5,
    capitalLon: 66.0,
    tag: 'Northern Arabian Sea',
    description: 'Bordering the Makran subduction trench and Indus submarine canyon.'
  },
  {
    id: 'OMN',
    name: 'Oman',
    flag: '🇴🇲',
    coastlineKm: 2092,
    capitalLat: 21.0,
    capitalLon: 59.0,
    tag: 'Western Flank',
    description: 'Arabian Peninsula gateway to the Gulf of Oman and Somali Current upwelling.'
  }
];

// Major Sea Bodies Labels
export const SEA_BODIES = [
  { name: 'ARABIAN SEA', lat: 16.0, lon: 66.0, desc: 'High salinity (36.5 PSU), upwelling system' },
  { name: 'BAY OF BENGAL', lat: 15.0, lon: 88.0, desc: 'Low salinity barrier layer (32.0 PSU), cyclone cradle' },
  { name: 'EQUATORIAL INDIAN OCEAN', lat: 5.5, lon: 77.0, desc: 'Wyrtki jet, monsoon current confluence' },
  { name: 'ANDAMAN SEA', lat: 12.0, lon: 93.5, desc: 'Internal solitary waves, subduction zone' },
  { name: 'LAKSHADWEEP SEA', lat: 10.5, lon: 74.0, desc: 'Mini-cold pool, Lakshadweep high/low eddy' }
];
