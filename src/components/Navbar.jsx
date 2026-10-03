import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { formatPoints, pointsToRupees } from '../api.js';
import Logo from './Logo.jsx';

const icon = (d) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-[22px]" aria-hidden>
    {d}
  </svg>
);

const LINKS = [
  {
    to: '/complaints', label: 'My complaints', short: 'Complaints',
    icon: icon(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h6M9 11h6M9 15h4" /></>),
  },
  {
    to: '/pickups', label: 'Pickups', short: 'Pickups',
    icon: icon(<><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>),
  },
  {
    to: '/rewards', label: 'Rewards', short: 'Rewards',
    icon: icon(<><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12M12 8S10.5 3 8 4.5 9.5 8 12 8Zm0 0s1.5-5 4-3.5S14.5 8 12 8Z" /></>),
  },
  {
    to: '/leaderboard', label: 'Leaderboard', short: 'Leaders',
    icon: icon(<><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3" /></>),
  },
];

function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const initial = (user?.name || 'A').trim().charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="grid size-9 place-items-center rounded-full bg-brand text-sm font-bold text-white ring-2 ring-white transition-shadow duration-150 hover:ring-brand/25 focus-visible:ring-brand/40"
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="animate-fade-up absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-navy">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">
              {user?.role === 'collector' ? '🚛 Garbage Collector' : '🏠 Citizen'} · {user?.identifier}
            </p>
          </div>
          <button
            role="menuitem"
            type="button"
            onClick={async () => { setOpen(false); await logout(); navigate('/login', { replace: true }); }}
            className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 transition-colors duration-150 hover:bg-red-50"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user } = useAuth();
  const links = LINKS.filter((l) => (l.to === '/pickups' ? user?.role === 'collector' : true));

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6 md:h-16">
          <Link to="/" className="flex shrink-0 items-center gap-2 rounded-lg" aria-label="EcoClean home">
            <Logo className="size-8 md:size-9" />
            <span className="text-[17px] font-bold tracking-tight text-navy md:text-lg">EcoClean</span>
          </Link>

          {/* Desktop / tablet: centered pills */}
          <nav aria-label="Primary" className="mx-auto hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) => `rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 lg:px-4 ${isActive
                  ? 'bg-[#DCFCE7] text-[#15803D]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-navy'}`}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0 md:gap-2.5">
            <Link
              to="/rewards"
              title={`${formatPoints(user?.points)} points (50 pts = ₹1)`}
              className="flex items-center gap-1.5 rounded-full bg-[#FEF9C3] px-2.5 py-1.5 text-[13px] font-semibold whitespace-nowrap text-[#854D0E] ring-1 ring-[#FDE68A] transition-colors duration-150 hover:bg-[#FEF08A] md:px-3 md:text-sm"
            >
              <span>🌿</span>
              <span>{formatPoints(user?.points)} pts</span>
              <span className="text-xs font-medium text-[#854D0E]/80">≈ ₹{pointsToRupees(user?.points)}</span>
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>

      {/* Mobile: bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <div className={`mx-auto grid max-w-md ${links.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className="group flex flex-col items-center gap-1 pt-2 pb-2.5">
              {({ isActive }) => (
                <>
                  <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors duration-150 ${isActive ? 'bg-[#DCFCE7] text-[#15803D]' : 'text-slate-500 group-active:bg-slate-100'}`}>
                    {l.icon}
                  </span>
                  <span className={`text-[11px] leading-none font-medium ${isActive ? 'text-[#15803D]' : 'text-slate-500'}`}>{l.short}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
