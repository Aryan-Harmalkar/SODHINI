const fmtDate = (s) => new Date(`${s.replace(' ', 'T')}Z`).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function ComplaintCard({ c, action }) {
  const top = c.tags[0] || { emoji: '🗑️', label: c.category || 'Waste', confidence: 90 };
  const pts = c.pointsOnResolution || 50;
  const inr = c.pointsInr || (pts / 50).toFixed(pts % 50 === 0 ? 0 : 2);
  const isResolved = c.status === 'resolved';

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm shadow-slate-900/[0.03] transition-all duration-150 hover:border-slate-300 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
        <img src={c.image} alt="" className="size-20 shrink-0 rounded-xl object-cover sm:size-24" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold text-navy">{c.id}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
              isResolved
                ? 'bg-brand-pale text-[#15803D] ring-brand/30'
                : 'bg-amber-50 text-amber-800 ring-amber-200'
            }`}>
              {isResolved ? `Resolved · +${pts} pts (₹${inr})` : `Pending · +${pts} pts (₹${inr})`}
            </span>
            {c.isHazardous && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 ring-1 ring-red-200">
                ☣️ Hazardous
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-slate-700">{top.emoji} {top.label} <span className="text-slate-400">· {top.confidence}%</span></p>
          {c.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 sm:line-clamp-1">{c.description}</p>}
          <p className="mt-1 text-xs text-slate-400">
            {fmtDate(c.createdAt)} ·{' '}
            <a href={`https://www.google.com/maps?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer" className="hover:text-brand">
              📍 {c.locationName ? `${c.locationName} (${c.lat.toFixed(4)}, ${c.lng.toFixed(4)})` : `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`}
            </a>
            {c.reporter && action ? ` · by ${c.reporter}` : ''}
          </p>
        </div>
      </div>
      {action && <div className="w-full shrink-0 sm:w-auto sm:self-center">{action}</div>}
    </article>
  );
}

export function PageHeader({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-navy">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function EmptyState({ emoji, title, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <p className="text-4xl">{emoji}</p>
      <p className="mt-3 font-semibold text-navy">{title}</p>
      <div className="mt-1 text-sm text-slate-500">{children}</div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => <div key={i} className="shimmer h-28 rounded-2xl" />)}
    </div>
  );
}
