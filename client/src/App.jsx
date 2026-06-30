import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Intake from './pages/Intake';
import SnapshotResult from './pages/SnapshotResult';
import Dashboard from './pages/Dashboard';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import CookieBanner from './components/CookieBanner';
import AdminDashboard from './pages/admin/AdminDashboard';
import AffiliateLogin from './pages/AffiliateLogin';
import AffiliateDashboard from './pages/AffiliateDashboard';
import PublicMarketplace from './pages/PublicMarketplace';
import FAQ from './pages/FAQ';
import CoachingCheckin from './pages/CoachingCheckin';

function RequireAuth({ children }) {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return null; // loading
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const [status, setStatus] = useState('loading'); // loading | ok | denied

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('[RequireAdmin] no session — denying');
        setStatus('denied');
        return;
      }
      const { data: profile, error } = await supabase
        .from('profiles').select('is_admin').eq('id', session.user.id).maybeSingle();
      console.log('[RequireAdmin] user:', session.user.id, '| is_admin raw value:', profile?.is_admin, '| error:', error?.message ?? null);
      setStatus(profile?.is_admin === true ? 'ok' : 'denied');
    }
    check();
  }, []);

  if (status === 'loading') return null;
  if (status === 'denied')  return <Navigate to="/dashboard" replace />;
  return children;
}

function CookieBannerGuard() {
  const { pathname } = useLocation();
  const isDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  return isDashboard ? null : <CookieBanner />;
}

export default function App() {
  return (
    <>
    <CookieBannerGuard />
    <Routes>
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/intake" element={
        <RequireAuth><Intake /></RequireAuth>
      } />
      <Route path="/snapshot" element={
        <RequireAuth><SnapshotResult /></RequireAuth>
      } />
      <Route path="/dashboard" element={
        <RequireAuth><Dashboard /></RequireAuth>
      } />
      <Route path="/dashboard/*" element={
        <RequireAuth><Dashboard /></RequireAuth>
      } />
      <Route path="/admin/*" element={
        <RequireAdmin><AdminDashboard /></RequireAdmin>
      } />
      <Route path="/coaching/checkin" element={
        <RequireAuth><CoachingCheckin /></RequireAuth>
      } />
      <Route path="/affiliate/login"     element={<AffiliateLogin />} />
      <Route path="/affiliate/dashboard" element={<AffiliateDashboard />} />
      <Route path="/marketplace" element={<PublicMarketplace />} />
      <Route path="/faq" element={<FAQ />} />
      {/* Catch-all for the app shell */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
    </>
  );
}
