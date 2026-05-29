import { Outlet, Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { APP_ADMIN_EMAIL, APP_YEAR } from '../constants';

export default function Layout() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut(auth);
    navigate('/signin');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <Link to="/dashboard" className="text-xl font-semibold text-indigo-600">
          Job Application Generator
        </Link>
        <div className="flex items-center gap-6">
          <Link to="/profile" className="text-sm text-gray-600 hover:text-indigo-600">
            Profile
          </Link>
          <Link to="/new-application" className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700">
            New Application
          </Link>
          <button onClick={handleSignOut} className="text-sm text-gray-600 hover:text-red-600">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-gray-200 px-6 py-3 text-center text-sm text-gray-500">
        © {APP_YEAR} divel.me — All rights reserved &nbsp;|&nbsp; Contact:{' '}
        <a href={`mailto:${APP_ADMIN_EMAIL}`} className="hover:text-indigo-600">
          {APP_ADMIN_EMAIL}
        </a>
      </footer>
    </div>
  );
}
