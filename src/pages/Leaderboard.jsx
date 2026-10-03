import { useEffect, useState } from 'react';
import { api, formatPoints, pointsToRupees } from '../api.js';
import { ListSkeleton, PageHeader } from '../components/ComplaintCard.jsx';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/leaderboard').then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Leaderboard" subtitle="Top citizens keeping the city clean (50 pts = ₹1)." />
      {error ? <p className="text-sm text-red-600">{error}</p> : !data ? <ListSkeleton /> : (
        <ol className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/[0.03]">
          {data.leaders.map((u, i) => {
            const me = u.id === data.me;
            return (
              <li key={u.id} className={`flex items-center gap-4 border-b border-slate-100 px-4 py-3.5 last:border-0 ${me ? 'bg-brand-pale' : ''}`}>
                <span className="w-7 text-center text-lg font-bold text-slate-400">{MEDALS[i] || i + 1}</span>
                <span className="grid size-9 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">{u.name.charAt(0)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">{u.name}{me && <span className="ml-1.5 text-xs font-medium text-brand">(you)</span>}</p>
                  <p className="text-xs text-slate-500">{u.resolved} resolved</p>
                </div>
                <div className="text-right">
                  <span className="block text-sm font-bold text-navy">🌿 {formatPoints(u.points)} pts</span>
                  <span className="block text-[11px] font-medium text-slate-500">₹{pointsToRupees(u.points)}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
