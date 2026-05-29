import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithGoogle, signInWithEmail, createAccount } from '../services/auth';
import { APP_ADMIN_EMAIL, APP_YEAR } from '../constants';

type Mode = 'signin' | 'create';

export default function SignIn() {
  const [mode, setMode]       = useState<Mode>('signin');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const switchMode = (m: Mode) => { setMode(m); setError(''); };

  const handleGoogle = async () => {
    setError(''); setLoading(true);
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (e) {
      const msg = errorMessage(e);
      if (msg) setError(msg);
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.'); return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.'); return;
    }
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await createAccount(email, password);
      }
      navigate('/dashboard');
    } catch (e) {
      setError(errorMessage(e) || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-md">

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Job Application Generator</h1>
          <p className="text-gray-500 text-sm mb-8">Sign in to manage your applications</p>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <GoogleIcon />
            Sign in with Google
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-gray-400">or</span>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-lg border border-gray-200 p-1 mb-6">
            <button
              onClick={() => switchMode('signin')}
              className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${
                mode === 'signin' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode('create')}
              className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${
                mode === 'create' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder={mode === 'create' ? 'At least 8 characters' : '••••••••'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>

      <footer className="px-6 py-3 text-center text-sm text-gray-400">
        © {APP_YEAR} divel.me — All rights reserved &nbsp;|&nbsp; Contact:{' '}
        <a href={`mailto:${APP_ADMIN_EMAIL}`} className="hover:text-indigo-600">
          {APP_ADMIN_EMAIL}
        </a>
      </footer>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.48-1.63.76-2.7.76-2.07 0-3.82-1.4-4.45-3.29H1.86v2.07A8 8 0 008.98 17z"/>
      <path fill="#FBBC05" d="M4.53 10.52A4.9 4.9 0 014.27 9c0-.53.09-1.04.26-1.52V5.41H1.86A8 8 0 001 9c0 1.28.31 2.5.86 3.59l2.67-2.07z"/>
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 008.98 1 8 8 0 001.86 5.4l2.67 2.1c.63-1.89 2.38-3.33 4.45-3.33z"/>
    </svg>
  );
}

function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e) {
    switch ((e as { code: string }).code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';
      case 'auth/popup-closed-by-user':
        return '';
    }
  }
  return 'Something went wrong. Please try again.';
}
