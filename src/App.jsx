import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import MyComplaints from './pages/MyComplaints.jsx';
import Pickups from './pages/Pickups.jsx';
import Rewards from './pages/Rewards.jsx';
import Leaderboard from './pages/Leaderboard.jsx';

function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#F8FAFC]">
      <span className="size-8 animate-spin rounded-full border-[3px] border-brand/20 border-t-brand" />
    </div>
  );
}

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return (
    <div className="min-h-dvh bg-[#F8FAFC]">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-3 pt-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8 md:pb-12 lg:pt-10">
        <Outlet />
      </main>
    </div>
  );
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  return user ? <Navigate to="/" replace /> : children;
}

function CollectorOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'collector') return <Navigate to="/complaints" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route element={<RequireAuth />}>
        <Route index element={<Home />} />
        <Route path="complaints" element={<MyComplaints />} />
        <Route path="pickups" element={<CollectorOnly><Pickups /></CollectorOnly>} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="leaderboard" element={<Leaderboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
