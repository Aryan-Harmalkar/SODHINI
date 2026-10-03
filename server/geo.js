const cache = new Map();
const MAX_CACHE = 500;

function setCache(key, val) {
  if (cache.size >= MAX_CACHE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, val);
}

function formatLocality(addr) {
  if (!addr) return '';
  const villageOrCity = addr.village || addr.town || addr.city || addr.municipality || '';
  const neighborhood = addr.suburb || addr.neighbourhood || addr.residential || '';
  const road = addr.road || addr.pedestrian || '';
  const state = addr.state || '';

  const parts = [];
  if (road) parts.push(road);
  if (neighborhood && neighborhood.toLowerCase() !== villageOrCity.toLowerCase()) {
    parts.push(neighborhood);
  }
  if (villageOrCity) parts.push(villageOrCity);
  if (state && !parts.includes(state)) parts.push(state);

  return parts.length ? parts.join(', ') : (addr.county || addr.state || 'Unknown location');
}

export async function reverseGeocode(lat, lng) {
  const roundedLat = Number(lat).toFixed(4);
  const roundedLng = Number(lng).toFixed(4);
  const cacheKey = `rev:${roundedLat},${roundedLng}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'EcoCleanApp/1.0 (waste-mgmt@ecoclean.in)',
        'Accept-Language': 'en',
      },
    });

    if (!res.ok) throw new Error(`Geocoding HTTP error ${res.status}`);
    const data = await res.json();
    const locality = formatLocality(data.address);
    const result = {
      lat: Number(lat),
      lng: Number(lng),
      locality,
      displayName: data.display_name || locality,
      details: data.address || {},
    };

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.error('Reverse geocode error:', err.message);
    return {
      lat: Number(lat),
      lng: Number(lng),
      locality: `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`,
      displayName: `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`,
      details: {},
    };
  }
}

export async function searchGeocode(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const cacheKey = `search:${q.toLowerCase()}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=5`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'EcoCleanApp/1.0 (waste-mgmt@ecoclean.in)',
        'Accept-Language': 'en',
      },
    });

    if (!res.ok) throw new Error(`Search geocoding HTTP error ${res.status}`);
    const list = await res.json();
    const results = (list || []).map((item) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      locality: formatLocality(item.address) || item.display_name.split(',')[0],
      displayName: item.display_name,
    }));

    setCache(cacheKey, results);
    return results;
  } catch (err) {
    console.error('Search geocode error:', err.message);
    return [];
  }
}
