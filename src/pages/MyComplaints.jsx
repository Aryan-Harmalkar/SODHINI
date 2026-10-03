import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import ComplaintCard, { EmptyState, ListSkeleton, PageHeader } from '../components/ComplaintCard.jsx';

export default function MyComplaints() {
  const [complaints, setComplaints] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/complaints').then((d) => setComplaints(d.complaints)).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My complaints" subtitle="Track the status of waste you've reported." />
      {error ? <p className="text-sm text-red-600">{error}</p>
        : !complaints ? <ListSkeleton />
        : complaints.length === 0 ? (
          <EmptyState emoji="🗂️" title="No complaints yet">
            <Link to="/" className="font-semibold text-brand hover:text-brand-dark">File your first complaint →</Link>
          </EmptyState>
        ) : (
          <div className="space-y-3">{complaints.map((c) => <ComplaintCard key={c.id} c={c} />)}</div>
        )}
    </div>
  );
}
