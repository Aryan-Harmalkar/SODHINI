import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Logo from '../components/Logo.jsx';

const ROLES = [
  { id: 'citizen', emoji: '🏠', title: 'Citizen', subtitle: 'Report waste & earn points' },
  { id: 'collector', emoji: '🚛', title: 'Garbage Collector', subtitle: 'Pick up & resolve complaints' },
];

const EMPTY = { name: '', identifier: '', password: '', otp: '' };

function validate(mode, otpStep, f) {
  const e = {};
  if (mode === 'signup' && !f.name.trim()) e.name = 'Please enter your full name';
  if (!f.identifier.trim()) e.identifier = 'Please enter your mobile number or email';
  if (mode === 'otp') {
    if (otpStep === 'verify' && !f.otp.trim()) e.otp = 'Please enter the 6-digit OTP';
    else if (otpStep === 'verify' && !/^\d{6}$/.test(f.otp.trim())) e.otp = 'OTP must be 6 digits';
    return e;
  }
  if (!f.password) e.password = 'Please enter your password';
  else if (mode === 'signup' && f.password.length < 6) e.password = 'Use at least 6 characters';
  return e;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'otp'
  const [otpStep, setOtpStep] = useState('request'); // 'request' | 'verify'
  const [devCode, setDevCode] = useState('');
  const [role, setRole] = useState('citizen');
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  const update = (key) => (e) => {
    const value = key === 'otp' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
    if (formError) setFormError('');
  };

  const switchMode = (next) => {
    setMode(next);
    setOtpStep('request');
    setDevCode('');
    setErrors({});
    setFormError('');
    setForm((f) => ({ ...f, password: '', otp: '' }));
  };

  const finish = ({ token, user }) => {
    login(token, user);
    navigate(location.state?.from?.pathname || '/', { replace: true });
  };

  const handleError = (err) => {
    if (err.field && err.field !== 'role') setErrors((er) => ({ ...er, [err.field]: err.message }));
    else setFormError(err.message);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const v = validate(mode, otpStep, form);
    setErrors(v);
    setFormError('');
    if (Object.keys(v).length) return;

    setSubmitting(true);
    try {
      if (mode === 'login') {
        finish(await api('/api/auth/login', { method: 'POST', body: { identifier: form.identifier, password: form.password, role } }));
      } else if (mode === 'signup') {
        finish(await api('/api/auth/signup', {
          method: 'POST',
          body: { name: form.name, identifier: form.identifier, password: form.password, role },
        }));
      } else if (otpStep === 'request') {
        const d = await api('/api/auth/otp/request', { method: 'POST', body: { identifier: form.identifier } });
        setDevCode(d.devCode);
        setOtpStep('verify');
      } else {
        finish(await api('/api/auth/otp/verify', { method: 'POST', body: { identifier: form.identifier, code: form.otp, role } }));
      }
    } catch (err) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const primaryLabel = mode === 'login' ? 'Log in'
    : mode === 'signup' ? 'Sign up'
    : otpStep === 'request' ? 'Send OTP' : 'Verify & log in';

  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <BrandPanel />
      <div className="flex min-h-dvh items-start justify-center lg:items-center">
      <div className="mx-auto flex w-full max-w-[440px] flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:pt-14 lg:py-12">
        <div className="mb-7 flex items-center gap-2 lg:hidden">
          <Logo />
          <span className="text-lg font-bold tracking-tight text-navy">EcoClean</span>
        </div>

        {/* Header */}
        <h1 className="text-[26px] leading-tight font-bold tracking-tight text-navy sm:text-[28px]">
          {isSignup ? 'Create your account 🌱' : 'Welcome back 👋'}
        </h1>
        <p className="mt-2 text-[15px] text-slate-500">
          {isSignup ? 'Sign up to report waste and start earning eco points.' : 'Log in to report waste and track your eco points.'}
        </p>

        {/* Segmented toggle */}
        <div role="tablist" aria-label="Authentication mode" className="relative mt-7 grid grid-cols-2 rounded-xl bg-track p-1">
          <span
            aria-hidden
            className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-[10px] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.10),0_1px_2px_rgba(15,23,42,0.06)] transition-transform duration-150 ease-out ${isSignup ? 'translate-x-full' : ''}`}
          />
          {[['login', 'Log in'], ['signup', 'Sign up']].map(([id, label]) => {
            const active = id === 'signup' ? isSignup : !isSignup;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchMode(id)}
                className={`relative z-10 h-10 rounded-[10px] text-sm font-semibold transition-colors duration-150 ${active ? 'text-navy' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-7">
          {/* Role cards */}
          <p id="role-label" className="mb-2.5 text-sm font-semibold text-navy">I am a</p>
          <div role="radiogroup" aria-labelledby="role-label" className="grid grid-cols-2 gap-3">
            {ROLES.map((r) => {
              const selected = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => { setRole(r.id); setFormError(''); }}
                  className={`relative flex flex-col items-start justify-start rounded-xl border-[1.5px] p-3.5 text-left transition-all duration-150 active:scale-[0.98] sm:p-4 ${selected
                    ? 'border-brand bg-brand-pale'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <span
                    aria-hidden
                    className={`absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-brand text-white transition-all duration-150 ${selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" /></svg>
                  </span>
                  <span className="text-2xl leading-none">{r.emoji}</span>
                  <span className="mt-2.5 block pr-5 text-sm leading-snug font-semibold text-navy">{r.title}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-500">{r.subtitle}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-4">
            {isSignup && (
              <Field label="Full name" error={errors.name} id="name">
                <Input id="name" autoComplete="name" placeholder="e.g. Aryan Sharma" value={form.name} onChange={update('name')} error={errors.name} />
              </Field>
            )}

            <Field label="Mobile number or email" error={errors.identifier} id="identifier">
              <Input
                id="identifier"
                autoComplete="username"
                inputMode="email"
                placeholder="e.g. 98765 43210"
                value={form.identifier}
                onChange={update('identifier')}
                error={errors.identifier}
                disabled={mode === 'otp' && otpStep === 'verify'}
              />
            </Field>

            {mode !== 'otp' && (
              <Field
                label="Password"
                id="password"
                error={errors.password}
                right={!isSignup && (
                  <button type="button" onClick={() => switchMode('otp')} className="text-sm font-semibold text-brand transition-colors duration-150 hover:text-brand-dark">
                    Forgot?
                  </button>
                )}
              >
                <PasswordInput
                  id="password"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder={isSignup ? 'Create a password (min 6 characters)' : 'Enter your password'}
                  value={form.password}
                  onChange={update('password')}
                  error={errors.password}
                />
              </Field>
            )}

            {mode === 'otp' && otpStep === 'verify' && (
              <Field
                label="Enter OTP"
                id="otp"
                error={errors.otp}
                right={<button type="button" onClick={() => { setOtpStep('request'); setDevCode(''); }} className="text-sm font-semibold text-brand hover:text-brand-dark">Change</button>}
                hint={devCode && <>Demo mode — your OTP is <b className="font-semibold text-navy tracking-wider">{devCode}</b></>}
              >
                <Input id="otp" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={form.otp} onChange={update('otp')} error={errors.otp} autoFocus className="tracking-[0.3em]" />
              </Field>
            )}
          </div>

          {formError && (
            <p role="alert" className="animate-fade-up mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-bold text-white shadow-sm shadow-brand/20 transition-all duration-150 hover:bg-brand-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {primaryLabel}
          </button>

          {!isSignup && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs font-medium text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" />
              </div>
              <button
                type="button"
                onClick={() => switchMode(mode === 'otp' ? 'login' : 'otp')}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-slate-200 bg-white text-[15px] font-semibold text-navy transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99]"
              >
                {mode === 'otp' ? '🔑 Log in with password' : '📱 Log in with OTP'}
              </button>
            </>
          )}
        </form>

        {/* Banner */}
        <div className="mt-6 flex items-start gap-3 rounded-xl bg-[#FEF9C3] px-4 py-3.5 text-sm text-[#713F12]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-px size-5 shrink-0 text-[#A16207]" aria-hidden>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" />
          </svg>
          {isSignup ? (
            <p><span className="font-semibold">Join EcoClean.</span> Report waste, earn eco points (50 pts = ₹1), and keep your community clean!</p>
          ) : (
            <p>
              <span className="font-semibold">New here?</span>{' '}
              <button type="button" onClick={() => switchMode('signup')} className="font-semibold underline decoration-[#A16207]/40 underline-offset-2 hover:decoration-[#A16207]">Sign up first</button>
              {' '}to start reporting waste and earning points.
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Demo: <span className="font-medium text-slate-500">demo@ecoclean.in</span> (Citizen) or{' '}
          <span className="font-medium text-slate-500">collector@ecoclean.in</span> · password <span className="font-medium text-slate-500">demo1234</span>
        </p>
      </div>
      </div>
    </div>
  );
}

function BrandPanel() {
  const features = [
    ['📷', 'Snap & report', 'Photograph waste and pin its exact location in seconds.'],
    ['🤖', 'Smart classification', 'We identify the type of waste and route it to the right crew.'],
    ['🌿', 'Earn eco points', 'Earn points (50 pts = ₹1) on resolution, with high rewards for hazardous waste!'],
  ];
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#16A34A] via-[#15803D] to-[#14532D] text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <div aria-hidden className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-white/10 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-[#4ADE80]/20 blur-3xl" />

      <div className="relative flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></svg>
        </span>
        <span className="text-xl font-bold tracking-tight">EcoClean</span>
      </div>

      <div className="relative max-w-md">
        <h2 className="text-4xl leading-[1.15] font-extrabold tracking-tight xl:text-[44px]">Cleaner streets,<br />one report at a time.</h2>
        <p className="mt-4 text-base text-white/80">Join citizens and collectors working together to keep your neighbourhood waste-free.</p>
        <ul className="mt-10 space-y-5">
          {features.map(([emoji, title, text]) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/12 text-xl ring-1 ring-white/20">{emoji}</span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-white/75">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative grid max-w-md grid-cols-3 gap-4 border-t border-white/15 pt-6">
        {[['12k+', 'Reports filed'], ['9.4k', 'Resolved'], ['48 hrs', 'Avg. pickup']].map(([n, l]) => (
          <div key={l}>
            <p className="text-2xl font-bold">{n}</p>
            <p className="text-xs text-white/70">{l}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}

function Field({ label, id, error, right, hint, children }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-semibold text-navy">{label}</label>
        {right}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="animate-fade-up mt-1.5 flex items-center gap-1 text-[13px] font-medium text-red-600">
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0" aria-hidden><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" /></svg>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

function Input({ error, className = '', id, ...props }) {
  return (
    <input
      id={id}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      className={`h-[52px] w-full rounded-xl border bg-white px-4 text-base text-navy sm:text-[15px] placeholder:text-slate-400 outline-none transition-all duration-150 disabled:bg-slate-50 disabled:text-slate-500 ${error
        ? 'border-red-400 focus:ring-4 focus:ring-red-500/15'
        : 'border-slate-200 hover:border-slate-300 focus:border-brand focus:ring-4 focus:ring-brand/15'} ${className}`}
      {...props}
    />
  );
}

function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className="pr-16" {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 px-4 text-xs font-semibold text-slate-500 transition-colors duration-150 hover:text-navy"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
