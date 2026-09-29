/**
 * Bathymetry utility for the North Indian Ocean domain (Lat 4°N to 24°N, Lon 60°E to 94°E).
 * Models realistic seafloor topography:
 * - Continental shelves (0 - 200m) along Indian coasts, Indus delta, Bengal shelf
 * - Continental slopes (200m - 2000m)
 * - Deep basins: Central Arabian Sea (~3600-4200m), Bay of Bengal fan (~3000-3600m), Equatorial Basin (~4200-4800m)
 * - Submarine ridges: Chagos-Laccadive Ridge (~1400-1800m), Carlsberg Ridge (~2000-2400m), Ninety East Ridge (~2200m)
 * - Submarine trenches: Andaman Basin / Trench (~3500-4400m)
 */

export function getSeafloorDepth(lat, lon) {
  // Base abyssal plain depth around 3850m
  let depth = 3850;

  // 1. Distance to Indian subcontinent coast (roughly lat 8-22, lon 68-88)
  // Gujarat / Saurashtra shelf
  if (lat > 20 && lat < 23 && lon > 68 && lon < 72) {
    depth = 80 + (23 - lat) * 150;
  }
  // Mumbai / Konkan shelf
  else if (lat >= 14 && lat <= 20 && lon > 71 && lon < 74) {
    const distToCoast = (74.5 - lon) * 60; // km approx
    depth = Math.max(70, distToCoast * 12);
  }
  // Malabar coast / Kerala shelf
  else if (lat >= 8 && lat < 14 && lon > 74 && lon < 77) {
    const distToCoast = (77.0 - lon) * 60;
    depth = Math.max(90, distToCoast * 18);
  }
  // Coromandel / Tamil Nadu shelf
  else if (lat >= 8 && lat < 16 && lon > 79 && lon < 82) {
    const distToCoast = (lon - 79.5) * 60;
    depth = Math.max(80, distToCoast * 22);
  }
  // Bay of Bengal Northern Shelf / Ganges-Brahmaputra Delta
  else if (lat >= 19.5 && lon >= 86 && lon <= 92) {
    depth = 60 + (24 - lat) * 280;
  }
  // Sri Lanka shelf
  else if (lat >= 5.5 && lat <= 9.8 && lon >= 79.2 && lon <= 82.5) {
    const dLat = lat - 7.8;
    const dLon = lon - 80.7;
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    if (dist < 1.2) {
      depth = 80 + dist * 600;
    } else {
      depth = 1200 + dist * 1000;
    }
  }
  // 2. Chagos - Laccadive Ridge (runs north-south along lon ~72.5°E, lat 4°N to 14°N)
  else if (Math.abs(lon - 72.8) < 1.4 && lat >= 4 && lat <= 14) {
    const ridgeDist = Math.abs(lon - 72.8);
    depth = 1450 + ridgeDist * 1100 + Math.sin(lat * 1.5) * 200;
  }
  // 3. Carlsberg Ridge (mid-ocean spreading ridge in SW Arabian Sea: lat 4-10°N, lon 60-66°E)
  else if (lon < 66 && lat < 10) {
    const ridgeDist = Math.abs(lat - (4 + (lon - 60) * 0.8));
    depth = 2200 + ridgeDist * 750 + Math.sin(lon * 2) * 180;
  }
  // 4. Ninety East Ridge (long linear ridge in eastern BoB, lon ~90°E, lat 4-15°N)
  else if (Math.abs(lon - 90.2) < 0.9 && lat >= 4 && lat <= 16) {
    depth = 2100 + Math.abs(lon - 90.2) * 900;
  }
  // 5. Andaman Basin / Trench (east of 92°E, lat 9-14°N)
  else if (lon > 92.5 && lat >= 9 && lat <= 14) {
    depth = 3400 + Math.sin(lat * 1.2) * 600;
  }
  // 6. Central Arabian Sea Abyssal Plain
  else if (lon >= 62 && lon <= 70 && lat >= 12 && lat <= 19) {
    depth = 3900 + Math.sin(lat * 0.8) * 200 + Math.cos(lon * 0.7) * 200;
  }
  // 7. Central Bay of Bengal Abyssal Plain
  else if (lon >= 83 && lon <= 89 && lat >= 10 && lat <= 18) {
    depth = 3300 + (19 - lat) * 60 + Math.sin(lon * 0.9) * 150;
  }
  // Default regional ocean floor
  else {
    depth = 3700 + Math.sin(lat * 0.5) * 400 + Math.cos(lon * 0.4) * 300;
  }

  // Bound to realistic ocean depths
  return Math.max(50, Math.min(4800, Math.round(depth)));
}

/**
 * Piecewise Oceanographic Vertical Depth Scaling function.
 * Ensures:
 * 1. Visible, distinct vertical physical space between each thermocline depth layer (0 to 2000m)
 * 2. Generous abyssal clearance space (4+ 3D units) between Argo profile limit (2000m) and the ocean bed
 * 3. Deep ocean bed bathymetry sits comfortably at -15.5 to -19.0 units
 */
export function depthTo3DY(depthMeters) {
  if (depthMeters <= 0) return 0.0;
  if (depthMeters <= 100) {
    // 0m to 100m (Surface mixed layer & upper thermocline): 0 to -4.0 units
    return -(depthMeters / 100) * 4.0;
  } else if (depthMeters <= 500) {
    // 100m to 500m (Main thermocline & intermediate): -4.0 to -7.5 units
    return -4.0 - ((depthMeters - 100) / 400) * 3.5;
  } else if (depthMeters <= 2000) {
    // 500m to 2000m (Argo parking 1000m & deep profile limit 2000m): -7.5 to -12.5 units
    return -7.5 - ((depthMeters - 500) / 1500) * 5.0;
  } else {
    // 2000m to 5000m (Abyssal water column clearance & Ocean Bed): -12.5 to -19.0 units
    const abyssalFactor = Math.min(1.0, (depthMeters - 2000) / 2500);
    return -12.5 - abyssalFactor * 6.5;
  }
}

/**
 * Returns color representation for seafloor depth in [0, 5000m].
 * Shallow shelf: Teal/Turquoise (#0891b2)
 * Bathyal: Cobalt/Ocean Blue (#1e40af)
 * Abyssal: Deep Indigo/Midnight (#0f172a / #030712)
 */
export function getBathymetryColor(depth) {
  // Normalize 0 to 4500m
  const t = Math.max(0, Math.min(1, depth / 4200));
  
  if (t < 0.1) {
    // 0 - 420m (Continental Shelf)
    return { r: 14 / 255, g: 140 / 255, b: 170 / 255, hex: '#0e8caa' };
  } else if (t < 0.35) {
    // 420 - 1500m (Slope / Submarine Ridge)
    const factor = (t - 0.1) / 0.25;
    return {
      r: (14 + factor * (20 - 14)) / 255,
      g: (140 - factor * 60) / 255,
      b: (170 + factor * 20) / 255,
      hex: '#1450a8'
    };
  } else if (t < 0.75) {
    // 1500 - 3150m (Bathyal Basin)
    const factor = (t - 0.35) / 0.4;
    return {
      r: (20 - factor * 8) / 255,
      g: (80 - factor * 45) / 255,
      b: (190 - factor * 70) / 255,
      hex: '#0d2260'
    };
  } else {
    // 3150 - 4500m+ (Abyssal Plain & Trenches)
    const factor = (t - 0.75) / 0.25;
    return {
      r: (12 - factor * 8) / 255,
      g: (35 - factor * 22) / 255,
      b: (120 - factor * 85) / 255,
      hex: '#050c20'
    };
  }
}

/**
 * Famous seabed topographic features for annotation
 */
export const SEABED_FEATURES = [
  { name: 'Arabian Abyssal Plain', lat: 15.5, lon: 65.0, depth: 3950, type: 'Basin' },
  { name: 'Chagos-Laccadive Ridge', lat: 10.0, lon: 72.8, depth: 1650, type: 'Submarine Ridge' },
  { name: 'Carlsberg Mid-Ocean Ridge', lat: 6.5, lon: 62.5, depth: 2280, type: 'Spreading Ridge' },
  { name: 'Bay of Bengal Abyssal Fan', lat: 14.0, lon: 86.5, depth: 3380, type: 'Deep Basin' },
  { name: 'Ninety East Ridge', lat: 11.0, lon: 90.2, depth: 2150, type: 'Linear Ridge' },
  { name: 'Ganges Delta Shelf', lat: 21.0, lon: 89.5, depth: 120, type: 'Continental Shelf' },
  { name: 'Andaman Trench', lat: 11.5, lon: 93.0, depth: 3820, type: 'Subduction Trench' }
];
