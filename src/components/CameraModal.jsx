import { useEffect, useRef, useState } from 'react';

const MAX_DIM = 1280;

function toJpeg(source, width, height) {
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function fileToJpeg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve(toJpeg(img, img.naturalWidth, img.naturalHeight)); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error('Could not read that image.')); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/**
 * Full-screen camera using getUserMedia (rear camera preferred).
 * Falls back to the native file picker with `capture="environment"`, which
 * opens the camera app directly on most phones.
 */
export default function CameraModal({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const fileRef = useRef(null);
  const [facing, setFacing] = useState('environment');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let stream;
    let cancelled = false;
    setReady(false);
    setError('');

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error(), { name: 'Unsupported' });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (!cancelled) setReady(true);
      } catch (e) {
        if (cancelled) return;
        setError(e.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in your browser settings, or use your phone camera instead.'
          : !window.isSecureContext
            ? 'The live camera needs HTTPS (or localhost). You can still take a photo with your device camera.'
            : 'No camera available here. You can take or choose a photo instead.');
      }
    })();

    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, facing, onClose]);

  if (!open) return null;

  const snap = () => {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    onCapture(toJpeg(v, v.videoWidth, v.videoHeight));
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { onCapture(await fileToJpeg(file)); } catch (err) { setError(err.message); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Camera" className="fixed inset-0 z-50 flex flex-col bg-black sm:items-center sm:justify-center sm:bg-slate-900/80 sm:p-6 sm:backdrop-blur-sm">
      <div className="relative flex size-full flex-col overflow-hidden bg-black sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-3xl sm:border sm:border-slate-800 sm:shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white sm:px-5">
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-sm font-medium hover:bg-white/10">✕ Close</button>
          <span className="text-sm font-semibold">Take a photo of the waste</span>
          <button
            type="button"
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            disabled={!ready}
            className="rounded-full px-3 py-1.5 text-sm font-medium hover:bg-white/10 disabled:opacity-40"
            aria-label="Switch camera"
          >
            🔄 Flip
          </button>
        </div>

        <div className="relative flex-1 overflow-hidden bg-slate-950 min-h-[320px] sm:min-h-[420px]">
          <video ref={videoRef} playsInline muted className={`absolute inset-0 size-full object-contain ${facing === 'user' ? '-scale-x-100' : ''}`} />
          {!ready && !error && (
            <div className="absolute inset-0 grid place-items-center text-sm text-white/70">
              <span className="flex items-center gap-2"><span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Starting camera…</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center p-6">
              <div className="max-w-sm rounded-2xl bg-white p-5 text-center">
                <p className="text-3xl">📷</p>
                <p className="mt-2 text-sm text-slate-600">{error}</p>
                <button type="button" onClick={() => fileRef.current?.click()} className="mt-4 h-11 w-full rounded-xl bg-brand text-sm font-bold text-white hover:bg-brand-dark">
                  Use device camera / gallery
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-8 border-t border-white/10 px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-4">
          <button type="button" onClick={() => fileRef.current?.click()} className="w-16 text-xs font-medium text-white/80 hover:text-white">Gallery</button>
          <button
            type="button"
            onClick={snap}
            disabled={!ready}
            aria-label="Capture photo"
            className="grid size-[72px] place-items-center rounded-full border-4 border-white/90 transition-transform duration-150 active:scale-95 disabled:opacity-40"
          >
            <span className="size-14 rounded-full bg-white" />
          </button>
          <span className="w-16" />
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
    </div>
  );
}
