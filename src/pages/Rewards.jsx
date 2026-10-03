import { useEffect } from 'react';
import { useAuth } from '../auth.jsx';
import { formatPoints, pointsToRupees } from '../api.js';
import { PageHeader } from '../components/ComplaintCard.jsx';

const TIERS = [
  { emoji: '☣️', label: 'Hazardous waste', pts: 250, inr: '5.00', note: 'Chemicals, medical, toxic waste' },
  { emoji: '💻', label: 'E-waste', pts: 200, inr: '4.00', note: 'Electronics, batteries, cables' },
  { emoji: '🧱', label: 'Construction / Bulky', pts: 150, inr: '3.00', note: 'Debris, furniture, appliances' },
  { emoji: '🗑️', label: 'Overflowing bin', pts: 100, inr: '2.00', note: 'Public dustbins, garbage piles' },
  { emoji: '♻️', label: 'Plastic / dry', pts: 75, inr: '1.50', note: 'Bottles, packaging, cartons' },
  { emoji: '🍌', label: 'Wet / organic', pts: 50, inr: '1.00', note: 'Food scraps, compostable waste' },
];

const PERKS = [
  { emoji: '⚡', title: 'Direct UPI cash payout', cost: 500, note: '₹10 transferred directly to UPI' },
  { emoji: '🛍️', title: 'Reusable cloth bag', cost: 500, note: 'Eco-friendly shopping tote' },
  { emoji: '🪴', title: 'Sapling planting kit', cost: 1000, note: 'Pot, seeds & potting soil' },
  { emoji: '🚌', title: '₹100 transit / bus top-up', cost: 5000, note: 'Public transit card recharge' },
  { emoji: '🧴', title: 'Home compost starter kit', cost: 2500, note: 'Aerobic bin + microbe mix' },
];

export default function Rewards() {
  const { user, refresh } = useAuth();
  useEffect(() => { refresh(); }, [refresh]);

  const balancePts = user.points || 0;
  const balanceInr = pointsToRupees(balancePts);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Rewards" subtitle="Earn eco points for every resolved complaint (50 pts = ₹1)." />

      {/* Balance Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-brand to-[#15803D] p-6 text-white shadow-sm">
        <p className="text-sm font-medium text-white/80">Your balance</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <p className="text-4xl font-extrabold tracking-tight">🌿 {formatPoints(balancePts)} <span className="text-lg font-semibold text-white/80">pts</span></p>
          <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold text-white backdrop-blur">
            ≈ ₹{balanceInr}
          </span>
        </div>
        <p className="mt-3 text-sm text-white/90">
          Fixed conversion rate: <b className="text-white">50 points = ₹1.00</b>. Hazardous waste earns higher rewards.
        </p>
      </div>

      {/* Earning Tiers */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-navy">Point rates by waste category</h2>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {TIERS.map((t) => (
            <div key={t.label} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-navy flex items-center gap-1.5">
                  <span>{t.emoji}</span> {t.label}
                </span>
                <span className="rounded-full bg-brand-pale px-2 py-0.5 text-xs font-bold text-[#15803D]">
                  +{t.pts} pts
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{t.note}</p>
              <p className="mt-1.5 font-mono text-[11px] font-semibold text-brand">₹{t.inr} reward</p>
            </div>
          ))}
        </div>
      </div>

      {/* Perks to redeem */}
      <div>
        <h2 className="mb-3 text-sm font-bold text-navy">Redeem points (50 pts = ₹1)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PERKS.map((p) => {
            const affordable = balancePts >= p.cost;
            const inrVal = pointsToRupees(p.cost);
            return (
              <div key={p.title} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.03]">
                <span className="text-2xl">{p.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-navy">{p.title}</p>
                  <p className="text-xs text-slate-500">{formatPoints(p.cost)} pts <span className="text-slate-400">· ₹{inrVal}</span></p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${affordable ? 'bg-brand-pale text-[#15803D]' : 'bg-slate-100 text-slate-400'}`}>
                  {affordable ? 'Available' : `${formatPoints(p.cost - balancePts)} to go`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
