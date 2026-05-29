import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import { getProfile, isProfileComplete } from './services/profile';
import Layout from './components/Layout';
import SignIn from './pages/SignIn';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import NewApplication from './pages/NewApplication';
import ApplicationDetail from './pages/ApplicationDetail';

function ProfileGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady]     = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    getProfile().then(p => {
      setComplete(isProfileComplete(p));
      setReady(true);
    });
  }, []);

  if (!ready) return <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>;
  if (!complete) return <Navigate to="/profile" replace />;
  return <>{children}</>;
}

export default function App() {
  const [user, setUser]     = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signin" element={!user ? <SignIn /> : <Navigate to="/dashboard" />} />
        {user ? (
          <Route element={<Layout />}>
            <Route path="/profile"            element={<Profile />} />
            <Route path="/dashboard"          element={<ProfileGuard><Dashboard /></ProfileGuard>} />
            <Route path="/new-application"    element={<ProfileGuard><NewApplication /></ProfileGuard>} />
            <Route path="/application/:appId" element={<ApplicationDetail />} />
            <Route path="*"                   element={<Navigate to="/dashboard" />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/signin" />} />
        )}
      </Routes>
    </BrowserRouter>
  );
}
