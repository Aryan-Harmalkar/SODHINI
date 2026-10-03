import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { api } from '../api.js';

const GOA_PRESETS = [
  { label: 'Assagao', lat: 15.5981, lng: 73.7721 },
  { label: 'Chapora', lat: 15.6031, lng: 73.7419 },
  { label: 'Anjuna', lat: 15.5841, lng: 73.7439 },
  { label: 'Vagator', lat: 15.5992, lng: 73.7438 },
  { label: 'Siolim', lat: 15.6267, lng: 73.7663 },
  { label: 'Mapusa', lat: 15.5926, lng: 73.8142 },
];

function createPinIcon() {
  return L.divIcon({
    className: 'leaflet-custom-marker',
    html: `
      <div style="position: relative; width: 34px; height: 42px; transform: translate(-50%, -100%);">
        <svg viewBox="0 0 24 30" width="34" height="42" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 18 12 18s12-9 12-18c0-6.63-5.37-12-12-12z" fill="#16A34A" stroke="#FFFFFF" stroke-width="2"/>
          <circle cx="12" cy="11" r="5" fill="#FFFFFF"/>
          <circle cx="12" cy="11" r="2.5" fill="#15803D"/>
        </svg>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export default function LocationModal({ open, onClose, currentCoords, currentLocality, onConfirm }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const initialLat = currentCoords?.lat ?? 15.5981;
  const initialLng = currentCoords?.lng ?? 73.7721;

  const [selectedCoords, setSelectedCoords] = useState({ lat: initialLat, lng: initialLng });
  const [locality, setLocality] = useState(currentLocality || 'Assagao, Goa');
  const [displayName, setDisplayName] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [revLoading, setRevLoading] = useState(false);

  // Initialize and update map
  useEffect(() => {
    if (!open) return;

    const lat = currentCoords?.lat ?? 15.5981;
    const lng = currentCoords?.lng ?? 73.7721;
    setSelectedCoords({ lat, lng });
    setLocality(currentLocality || '');
    setQuery('');
    setSearchResults([]);

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: 15,
          zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([lat, lng], {
          draggable: true,
          icon: createPinIcon(),
        }).addTo(map);

        marker.on('dragend', async (e) => {
          const pos = e.target.getLatLng();
          handlePositionChange(pos.lat, pos.lng);
        });

        map.on('click', (e) => {
          marker.setLatLng(e.latlng);
          handlePositionChange(e.latlng.lat, e.latlng.lng);
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
      } else {
        const map = mapInstanceRef.current;
        map.invalidateSize();
        map.setView([lat, lng], 15);
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        }
      }

      // Initial reverse geocode if no locality
      if (!currentLocality) {
        handlePositionChange(lat, lng);
      }
    }, 150);

    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, currentCoords, currentLocality, onClose]);

  // Clean up map when modal unmounts
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  const handlePositionChange = async (lat, lng) => {
    setSelectedCoords({ lat, lng });
    setRevLoading(true);
    try {
      const geo = await api(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
      setLocality(geo.locality || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      setDisplayName(geo.displayName || '');
    } catch {
      setLocality(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } finally {
      setRevLoading(false);
    }
  };

  const moveTo = (lat, lng, locName) => {
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    if (mapInstanceRef.current) mapInstanceRef.current.setView([lat, lng], 15);
    setSelectedCoords({ lat, lng });
    if (locName) {
      setLocality(locName);
    } else {
      handlePositionChange(lat, lng);
    }
    setSearchResults([]);
    setQuery('');
  };

  const useGps = () => {
    if (!('geolocation' in navigator)) return;
    setRevLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        moveTo(p.coords.latitude, p.coords.longitude);
      },
      () => {
        setRevLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api(`/api/geo/search?q=${encodeURIComponent(q)}`);
        setSearchResults(data.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [query]);

  if (!open) return null;

  const handleSave = () => {
    onConfirm({
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
      locality: locality || 'Assagao, Goa',
      displayName: displayName || locality,
      accuracy: 5, // manual pinpoint has high human confidence
      isManual: true,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Adjust location"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-3 backdrop-blur-sm sm:p-5"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-navy">📍 Set precise location</h2>
            <p className="text-xs text-slate-500">Search for your area or click on the map to place the pin.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-navy"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Body content */}
        <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-5">
          {/* Why was location Chapora notice */}
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs text-amber-900">
            <span className="font-semibold">Seeing Chapora instead of Assagao?</span> Wi-Fi and mobile networks in North Goa often map IP/towers to Chapora. Use the search or chips below to set <b>Assagao</b>.
          </div>

          {/* Search box */}
          <div className="relative mb-3">
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400">🔍</span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search area (e.g. Assagao, Badem, Siolim)..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-navy placeholder:text-slate-400 outline-none transition-all duration-150 hover:border-slate-300 focus:border-brand focus:ring-4 focus:ring-brand/15"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Search dropdown */}
            {(searching || searchResults.length > 0) && (
              <div className="absolute top-12 z-20 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {searching && (
                  <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500">
                    <span className="size-3 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                    Searching places…
                  </div>
                )}
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => moveTo(r.lat, r.lng, r.locality)}
                    className="flex w-full items-start gap-2.5 border-b border-slate-100 px-4 py-2.5 text-left text-xs text-navy transition-colors hover:bg-slate-50 last:border-0"
                  >
                    <span className="text-sm">📍</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800">{r.locality}</p>
                      <p className="truncate text-slate-500">{r.displayName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick presets */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Quick select:</span>
            {GOA_PRESETS.map((p) => {
              const active = locality.toLowerCase().includes(p.label.toLowerCase());
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => moveTo(p.lat, p.lng, `${p.label}, Goa`)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-150 active:scale-95 ${
                    active
                      ? 'bg-brand text-white shadow-sm shadow-brand/20'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {p.label === 'Assagao' ? '🌴 Assagao' : p.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={useGps}
              className="ml-auto flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
              title="Detect device GPS"
            >
              <span>🎯</span> Device GPS
            </button>
          </div>

          {/* Interactive Map */}
          <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:h-72">
            <div ref={mapContainerRef} className="size-full" />
            <div className="pointer-events-none absolute top-2 right-2 z-[400] rounded-lg bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur">
              Click or drag pin
            </div>
          </div>

          {/* Selected location feedback card */}
          <div className="mt-3 flex items-center justify-between rounded-xl border border-brand/20 bg-brand-pale p-3 text-xs">
            <div className="min-w-0">
              <p className="font-semibold text-[#15803D]">
                {revLoading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="size-3 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                    Detecting address…
                  </span>
                ) : (
                  locality || 'Selected location'
                )}
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-slate-600">
                {selectedCoords.lat.toFixed(6)}, {selectedCoords.lng.toFixed(6)}
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/80 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-brand/20 transition-all duration-150 hover:bg-brand-dark active:scale-[0.98]"
          >
            Confirm location
          </button>
        </div>
      </div>
    </div>
  );
}
