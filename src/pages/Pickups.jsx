import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import ComplaintCard, { EmptyState, ListSkeleton, PageHeader } from '../components/ComplaintCard.jsx';

export default function Pickups() {
  const { user } = useAuth();
  const isCollector = user.role === 'collector';
  const [complaints, setComplaints] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/api/pickups').then((d) => setComplaints(d.complaints)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => { if (isCollector) load(); }, [isCollector, load]);

  const resolve = async (id) => {
    setBusy(id);
    setError('');
    try {
      await api(`/api/complaints/${id}/resolve`, { method: 'POST' });
      setComplaints((list) => list.filter((c) => c.id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!isCollector) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Pickups" subtitle="Collection requests handled by garbage collectors near you." />
        <EmptyState emoji="🚛" title="Pickups are handled by collectors">
          When a collector resolves one of your complaints, you'll earn +50 pts automatically.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Pickups" subtitle="Open complaints waiting for collection, oldest first." />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {!complaints ? <ListSkeleton />
        : complaints.length === 0 ? <EmptyState emoji="✨" title="All clear">No open complaints right now.</EmptyState>
        : (
          <div className="space-y-3">
            {complaints.map((c) => (
              <ComplaintCard
                key={c.id}
                c={c}
                action={(
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => resolve(c.id)}
                    className="flex h-11 w-full items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold whitespace-nowrap text-white transition-all duration-150 hover:bg-brand-dark active:scale-[0.98] disabled:opacity-60 sm:h-9 sm:w-auto"
                  >
                    {busy === c.id ? 'Saving…' : 'Mark resolved'}
                  </button>
                )}
              />
            ))}
          </div>
        )}
    </div>
  );
}
