import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Intake from './pages/Intake';
import Dashboard from './pages/Dashboard';

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

export default function App() {
  return (
    <Routes>
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/intake" element={
        <RequireAuth><Intake /></RequireAuth>
      } />
      <Route path="/dashboard" element={
        <RequireAuth><Dashboard /></RequireAuth>
      } />
      <Route path="/dashboard/*" element={
        <RequireAuth><Dashboard /></RequireAuth>
      } />
      {/* Catch-all for the app shell */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
