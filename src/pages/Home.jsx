import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import CameraModal from '../components/CameraModal.jsx';
import LocationModal from '../components/LocationModal.jsx';

const fmtCoord = (n) => n.toFixed(6);

function useGeolocation() {
  const [state, setState] = useState({ status: 'requesting' });

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'denied', message: 'Location is not supported by this browser.' });
      return;
    }
    setState({ status: 'requesting' });
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        const accuracy = p.coords.accuracy;
        let locality = '';
        try {
          const rev = await api(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
          locality = rev.locality || '';
        } catch {
          // ignore
        }
        setState({
          status: 'granted',
          coords: { lat, lng, accuracy },
          locality,
          isCoarse: accuracy > 120,
          isManual: false,
        });
      },
      (err) => setState({
        status: 'denied',
        message: err.code === err.PERMISSION_DENIED
          ? 'Location permission denied. Enable precise location for this site, or set your location manually.'
          : err.code === err.TIMEOUT
            ? 'Timed out getting your location. Move to an open area, retry, or set manually.'
            : 'Unable to determine your location.',
      }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => { request(); }, [request]);
  return [state, request, setState];
}

export default function Home() {
  const [stage, setStage] = useState('capture'); // capture | analyzing | result | success
  const [photo, setPhoto] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [geo, retryGeo, setGeo] = useGeolocation();
  const [description, setDescription] = useState('');
  const [result, setResult] = useState(null);
  const [complaint, setComplaint] = useState(null);
  const [error, setError] = useState('');
  const [filing, setFiling] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const closeCamera = useCallback(() => setCameraOpen(false), []);
  const onCapture = useCallback((dataUrl) => { setPhoto(dataUrl); setCameraOpen(false); setError(''); }, []);

  const canAnalyze = !!photo && geo.status === 'granted';

  const analyze = async () => {
    if (!canAnalyze) return;
    setError('');
    setStage('analyzing');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const data = await api('/api/classify', {
        method: 'POST',
        signal: ctrl.signal,
        body: {
          image: photo,
          ...geo.coords,
          locationName: geo.locality,
          description: description.trim(),
        },
      });
      setResult(data);
      setStage('result');
    } catch (e) {
      if (e.name === 'AbortError') return;
      setError(e.message);
      setStage('capture');
    }
  };

  const fileComplaint = async () => {
    setFiling(true);
    setError('');
    try {
      setComplaint(await api('/api/complaints', { method: 'POST', body: { analysisId: result.analysisId } }));
      setStage('success');
    } catch (e) {
      setError(e.message);
    } finally {
      setFiling(false);
    }
  };

  const retake = () => {
    setResult(null);
    setPhoto(null);
    setError('');
    setStage('capture');
    setCameraOpen(true);
  };

  const startOver = () => {
    setResult(null);
    setComplaint(null);
    setPhoto(null);
    setDescription('');
    setError('');
    setStage('capture');
  };

  const onLocationConfirm = (manual) => {
    setGeo({
      status: 'granted',
      coords: { lat: manual.lat, lng: manual.lng, accuracy: manual.accuracy || 5 },
      locality: manual.locality,
      isCoarse: false,
      isManual: true,
    });
  };

  const onSwitchToAssagao = () => {
    setGeo({
      status: 'granted',
      coords: { lat: 15.5981, lng: 73.7721, accuracy: 5 },
      locality: 'Assagao, Goa',
      isCoarse: false,
      isManual: true,
    });
  };

  return (
    <>
      <section className={`mx-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03] ${stage === 'success' ? 'max-w-xl' : 'max-w-xl lg:max-w-5xl'}`}>
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5 sm:px-6 sm:py-4">
          <h1 className="text-[17px] font-bold tracking-tight whitespace-nowrap text-navy sm:text-xl">📣 File a complaint</h1>
          <span className="rounded-full bg-[#FEF9C3] px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-[#854D0E] ring-1 ring-[#FDE68A] sm:px-3 sm:text-xs">
            🏆 Up to +250 pts (₹5) on resolution · 50 pts = ₹1
          </span>
        </header>

        <div className="p-4 sm:p-6 lg:p-8">
          {stage === 'capture' && (
            <CaptureStep
              photo={photo}
              onOpenCamera={() => setCameraOpen(true)}
              geo={geo}
              retryGeo={retryGeo}
              onOpenLocationPicker={() => setLocationModalOpen(true)}
              onSwitchToAssagao={onSwitchToAssagao}
              description={description}
              setDescription={setDescription}
              canAnalyze={canAnalyze}
              onAnalyze={analyze}
              error={error}
            />
          )}
          {stage === 'analyzing' && <AnalyzingStep photo={photo} />}
          {stage === 'result' && result && (
            <ResultStep
              photo={photo}
              result={result}
              onFile={fileComplaint}
              filing={filing}
              onRetake={retake}
              error={error}
            />
          )}
          {stage === 'success' && complaint && <SuccessStep complaint={complaint} onAnother={startOver} />}
        </div>
      </section>

      <CameraModal open={cameraOpen} onClose={closeCamera} onCapture={onCapture} />
      <LocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        currentCoords={geo.coords}
        currentLocality={geo.locality}
        onConfirm={onLocationConfirm}
      />
    </>
  );
}

/* ------------------------------------------------------------------------ */

function StepLabel({ n, children }) {
  return (
    <p className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-navy">
      <span className="grid size-5 place-items-center rounded-full bg-brand-pale text-[11px] font-bold text-brand ring-1 ring-brand/20">{n}</span>
      {children}
    </p>
  );
}

function CaptureStep({
  photo,
  onOpenCamera,
  geo,
  retryGeo,
  onOpenLocationPicker,
  onSwitchToAssagao,
  description,
  setDescription,
  canAnalyze,
  onAnalyze,
  error,
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-8">
      {/* Photo */}
      <div className="flex flex-col">
        <StepLabel n={1}>Photo of the waste</StepLabel>
        {photo ? (
          <div className="animate-fade-up relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 lg:flex-1">
            <img src={photo} alt="Captured waste" className="aspect-[4/3] w-full object-cover lg:aspect-auto lg:h-full lg:min-h-[340px]" />
            <button
              type="button"
              onClick={onOpenCamera}
              className="absolute right-3 bottom-3 rounded-full bg-white/95 px-4 py-2.5 text-sm font-semibold text-navy shadow-md ring-1 ring-slate-900/5 transition-colors duration-150 hover:bg-white active:scale-95"
            >
              🔄 Retake
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenCamera}
            className="group flex w-full flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-9 text-slate-500 transition-colors duration-150 hover:border-brand/50 hover:bg-brand-pale/60 active:bg-brand-pale sm:py-12 lg:min-h-[340px] lg:flex-1"
          >
            <span className="hidden size-16 place-items-center rounded-full bg-white text-3xl shadow-sm ring-1 ring-slate-200 lg:grid">📷</span>
            <span className="flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-[15px] font-bold text-white shadow-sm shadow-brand/20 transition-colors duration-150 group-hover:bg-brand-dark">📷 Open camera</span>
            <span className="text-xs">Take a clear, well-lit photo of the waste</span>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6">
        {/* Location */}
        <div>
          <StepLabel n={2}>Precise location</StepLabel>
          <LocationStatus
            geo={geo}
            retry={retryGeo}
            onOpenPicker={onOpenLocationPicker}
            onSwitchToAssagao={onSwitchToAssagao}
          />
        </div>

        {/* Description */}
        <div className="flex flex-1 flex-col">
          <StepLabel n={3}>Description <span className="font-normal text-slate-400">(optional)</span></StepLabel>
          <textarea
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the waste (e.g. bin overflowing for 3 days, bad smell)…"
            className="min-h-24 w-full flex-1 resize-y rounded-xl border border-slate-200 px-4 py-3 text-base text-navy placeholder:text-slate-400 outline-none transition-all duration-150 hover:border-slate-300 focus:border-brand focus:ring-4 focus:ring-brand/15 sm:text-[15px] lg:min-h-32 lg:resize-none"
          />
          <p className="mt-1.5 text-right text-[11px] text-slate-400">{description.length}/500</p>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="pt-1">
          <button
            type="button"
            onClick={onAnalyze}
            disabled={!canAnalyze}
            className="h-[52px] w-full rounded-xl bg-brand text-[15px] font-bold text-white shadow-sm shadow-brand/20 transition-all duration-150 hover:bg-brand-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            Analyze
          </button>
          {!canAnalyze && (
            <p className="mt-2 text-center text-xs text-slate-400">
              {!photo && geo.status !== 'granted' ? 'Add a photo and allow location to continue'
                : !photo ? 'Add a photo to continue' : 'Allow location to continue'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function LocationStatus({ geo, retry, onOpenPicker, onSwitchToAssagao }) {
  if (geo.status === 'requesting') {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
          <span>Requesting location… <span className="text-slate-400">Please allow browser prompt.</span></span>
        </div>
        <button
          type="button"
          onClick={onOpenPicker}
          className="shrink-0 text-xs font-semibold text-brand hover:text-brand-dark sm:self-center"
        >
          📍 Set manually
        </button>
      </div>
    );
  }

  if (geo.status === 'granted') {
    const { lat, lng, accuracy } = geo.coords;
    const isChapora = (geo.locality || '').toLowerCase().includes('chapora');

    return (
      <div className="space-y-2">
        {isChapora && (
          <div className="animate-fade-up rounded-xl border border-amber-300 bg-amber-50/95 p-3.5 text-xs text-amber-950 shadow-xs">
            <div className="flex items-start gap-2">
              <span className="text-base leading-none">⚠️</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-amber-950">Showing Chapora instead of Assagao?</p>
                <p className="mt-1 text-amber-900/90 leading-relaxed">
                  In North Goa, ISP networks frequently map IP and towers to Chapora. If you are reporting from Assagao, tap below to fix it immediately:
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onSwitchToAssagao}
                    className="flex items-center gap-1.5 rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-transform hover:bg-[#15803D] active:scale-95"
                  >
                    <span>🌴</span> Switch to Assagao
                  </button>
                  <button
                    type="button"
                    onClick={onOpenPicker}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-xs hover:bg-amber-100/60 active:scale-95"
                  >
                    ✏️ Pick on map
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="animate-fade-up flex items-center justify-between gap-3 rounded-xl border border-brand/25 bg-brand-pale px-4 py-3 text-sm">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-semibold text-[#15803D]">
              <span>📍</span>
              <span className="truncate">{geo.locality || 'Location captured'}</span>
              {geo.isManual && (
                <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand">Manual</span>
              )}
            </div>
            <p className="mt-0.5 truncate font-mono text-xs text-slate-600">
              {fmtCoord(lat)}, {fmtCoord(lng)}{accuracy ? ` · ±${Math.round(accuracy)} m` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenPicker}
              className="rounded-lg border border-brand/30 bg-white px-3 py-1.5 text-xs font-semibold text-brand shadow-xs transition-colors hover:bg-brand-pale"
            >
              ✏️ Change
            </button>
            <button
              type="button"
              onClick={retry}
              className="rounded-lg p-1.5 text-xs font-semibold text-slate-500 hover:bg-white hover:text-navy"
              title="Refresh device GPS"
            >
              🔄
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up space-y-2">
      <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-red-700">Location unavailable</p>
          <p className="mt-0.5 text-xs text-red-600/90">{geo.message}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={retry}
            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onOpenPicker}
            className="rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-brand-dark"
          >
            📍 Set manually
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 px-1 text-xs text-slate-500">
        <span>Quick set:</span>
        <button
          type="button"
          onClick={onSwitchToAssagao}
          className="rounded-md bg-slate-100 px-2.5 py-1 font-semibold text-brand hover:bg-brand-pale active:scale-95"
        >
          🌴 Use Assagao, Goa
        </button>
      </div>
    </div>
  );
}

function AnalyzingStep({ photo }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="mb-5 flex items-center justify-center gap-3 rounded-xl bg-brand-pale py-3 text-sm font-semibold text-[#15803D]">
        <span className="size-5 animate-spin rounded-full border-[2.5px] border-brand/25 border-t-brand" />
        Analyzing your photo…
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-xl bg-slate-900">
          <img src={photo} alt="" className="max-h-56 sm:max-h-80 md:max-h-none md:aspect-[4/3] w-full object-cover opacity-60 blur-[1px]" />
          <div className="shimmer absolute inset-0 opacity-50 mix-blend-overlay" />
        </div>
        <div className="space-y-4">
          <div className="shimmer h-4 w-32 rounded" />
          <div className="flex flex-wrap gap-2">
            <div className="shimmer h-8 w-40 rounded-full" />
            <div className="shimmer h-8 w-28 rounded-full" />
            <div className="shimmer h-8 w-32 rounded-full" />
          </div>
          <div className="shimmer h-4 w-24 rounded" />
          <div className="shimmer h-14 w-full rounded-xl" />
          <div className="shimmer h-4 w-36 rounded" />
          <div className="shimmer h-16 w-full rounded-xl" />
          <div className="shimmer h-[52px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function ResultStep({ photo, result, onFile, filing, onRetake, error }) {
  const { isWaste, tags, location, summary, pointsMeta } = result;
  const isHazardous = pointsMeta?.isHazardous || tags?.some((t) => t.key === 'hazardous' || t.key === 'e_waste');
  const points = pointsMeta?.points || (tags?.some((t) => t.key === 'hazardous') ? 250 : tags?.some((t) => t.key === 'e_waste') ? 200 : 50);
  const inr = pointsMeta?.inr || (points / 50).toFixed(2);

  return (
    <div className="animate-fade-up grid gap-6 md:grid-cols-2">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900 md:self-start">
        <img src={photo} alt="Submitted waste" className="max-h-56 sm:max-h-80 md:max-h-none md:aspect-[4/3] w-full object-cover" />
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Classification</p>
          <div className="flex flex-wrap gap-2">
            {isWaste ? tags.map((t, i) => (
              <span
                key={t.key}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${i === 0
                  ? t.isHazardous ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-brand-pale text-[#15803D] ring-brand/30'
                  : 'bg-slate-50 text-slate-700 ring-slate-200'}`}
              >
                <span>{t.emoji}</span>{t.label}
                <span className={`rounded-full px-1.5 py-px text-xs ${i === 0 ? 'bg-brand text-white' : 'bg-slate-200 text-slate-600'}`}>{t.confidence}%</span>
              </span>
            )) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
                🚫 Not waste
              </span>
            )}
          </div>
        </div>

        {isWaste && (
          <div className={`rounded-xl border p-3.5 ${isHazardous ? 'border-amber-300 bg-amber-50/90 text-amber-950' : 'border-brand/25 bg-brand-pale text-slate-800'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-bold text-sm">
                <span>{isHazardous ? '☣️ Hazardous waste detected' : '🌿 Eco points reward'}</span>
                {isHazardous && (
                  <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    High priority
                  </span>
                )}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-brand shadow-xs">
                +{points} pts (₹{inr})
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              {isHazardous
                ? `Hazardous/e-waste earns top-tier reward of +${points} pts (₹${inr}) on resolution (50 pts = ₹1).`
                : `Earn +${points} pts (₹${inr}) upon complaint resolution (50 pts = ₹1).`}
            </p>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Location</p>
          <a
            href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm transition-colors duration-150 hover:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="font-semibold text-navy truncate">
                📍 {location.name || `${fmtCoord(location.lat)}, ${fmtCoord(location.lng)}`}
              </p>
              <p className="mt-0.5 font-mono text-xs text-slate-500">
                {fmtCoord(location.lat)}, {fmtCoord(location.lng)}
                {location.accuracy != null && ` · ±${Math.round(location.accuracy)} m`}
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-brand">Map ↗</span>
          </a>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Description summary</p>
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{summary}</p>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        {isWaste ? (
          <div className="mt-auto pt-2">
            <button
              type="button"
              onClick={onFile}
              disabled={filing}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-bold text-white shadow-sm shadow-brand/20 transition-all duration-150 hover:bg-brand-dark active:scale-[0.99] disabled:opacity-70"
            >
              {filing && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              File complaint
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">+{points} pts (₹{inr})</span>
            </button>
            <button
              type="button"
              onClick={onRetake}
              className="mt-2.5 w-full py-2 text-sm font-medium text-slate-500 transition-colors duration-150 hover:text-navy active:text-navy"
            >
              Wrong result? Retake photo
            </button>
          </div>
        ) : (
          <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
            <p className="text-sm font-semibold text-navy">This doesn't look like waste</p>
            <p className="mt-1 text-xs text-slate-500">Try a closer, well-lit photo of the waste.</p>
            <button
              type="button"
              onClick={onRetake}
              className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border-[1.5px] border-slate-200 bg-white text-sm font-semibold text-navy transition-colors duration-150 hover:bg-slate-100 active:scale-[0.99]"
            >
              📷 Retake photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SuccessStep({ complaint, onAnother }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(complaint.id); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  const pts = complaint.pointsOnResolution || 50;
  const inr = complaint.pointsInr || (pts / 50).toFixed(2);

  return (
    <div className="animate-fade-up py-6 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-brand-pale ring-8 ring-brand-pale/50">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="size-8 text-brand"><path d="M20 6 9 17l-5-5" /></svg>
      </div>
      <h2 className="mt-5 text-xl font-bold text-navy">Complaint filed!</h2>
      <p className="mt-1.5 text-sm text-slate-500">
        A garbage collector will pick it up soon. You'll earn{' '}
        <b className="text-navy">+{pts} pts (₹{inr})</b>{' '}
        once it's resolved (50 pts = ₹1).
      </p>

      <button type="button" onClick={copy} className="mx-auto mt-5 flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 transition-colors duration-150 hover:bg-slate-100">
        <span className="text-xs text-slate-500">Complaint ID</span>
        <span className="font-mono text-sm font-bold tracking-wide text-navy">{complaint.id}</span>
        <span className="text-xs font-semibold text-brand">{copied ? 'Copied' : 'Copy'}</span>
      </button>

      <div className="mx-auto mt-6 grid max-w-sm gap-2 sm:grid-cols-2">
        <Link to="/complaints" className="grid h-11 place-items-center rounded-xl border-[1.5px] border-slate-200 text-sm font-semibold text-navy transition-colors duration-150 hover:bg-slate-50">
          View my complaints
        </Link>
        <button type="button" onClick={onAnother} className="h-11 rounded-xl bg-brand text-sm font-bold text-white transition-colors duration-150 hover:bg-brand-dark">
          File another
        </button>
      </div>
    </div>
  );
}

function ErrorNote({ children }) {
  return <p role="alert" className="animate-fade-up rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{children}</p>;
}
