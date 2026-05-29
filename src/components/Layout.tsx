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
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link to="/dashboard" className="text-base sm:text-xl font-semibold text-indigo-600 shrink-0">
          <span className="hidden sm:inline">Job Application Generator</span>
          <span className="sm:hidden">JAG</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          <Link to="/dashboard" className="text-sm text-gray-600 hover:text-indigo-600 shrink-0">
            Dashboard
          </Link>
          <Link to="/profile" className="text-sm text-gray-600 hover:text-indigo-600 shrink-0">
            Profile
          </Link>
          <Link to="/new-application" className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 shrink-0 whitespace-nowrap">
            <span className="hidden sm:inline">New Application</span>
            <span className="sm:hidden">+ New</span>
          </Link>
          <button onClick={handleSignOut} className="text-sm text-gray-600 hover:text-red-600 shrink-0">
            <span className="hidden sm:inline">Sign Out</span>
            <span className="sm:hidden">Out</span>
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
