import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listApplications, Application, ApplicationStatus } from '../services/applications';
import {
  DashboardFilters, DEFAULT_FILTERS,
  getDashboardFilters, saveDashboardFilters,
} from '../services/preferences';
import StatusBadge from '../components/StatusBadge';

const ALL_STATUSES: ApplicationStatus[] = ['Submitted', 'In Progress', 'Completed'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [apps, setApps]         = useState<Application[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [filters, setFilters]   = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([listApplications(), getDashboardFilters()])
      .then(([list, saved]) => {
        setApps(list);
        setFilters(saved);
        const active = saved.company || saved.role || saved.dateFrom || saved.dateTo || saved.statuses.length > 0;
        if (active) setShowFilters(true);
      })
      .catch(() => setError('Failed to load applications.'))
      .finally(() => setLoading(false));
  }, []);

  const updateFilters = (patch: Partial<DashboardFilters>) => {
    setFilters(prev => {
      const next = { ...prev, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveDashboardFilters(next), 800);
      return next;
    });
  };

  const clearFilters = () => {
    const cleared = { ...DEFAULT_FILTERS };
    setFilters(cleared);
    saveDashboardFilters(cleared);
  };

  const toggleStatus = (s: ApplicationStatus) => {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter(x => x !== s)
      : [...filters.statuses, s];
    updateFilters({ statuses: next });
  };

  const filtered = apps.filter(app => {
    if (filters.company && !app.companyName.toLowerCase().includes(filters.company.toLowerCase())) return false;
    if (filters.role && !app.roleTitle.toLowerCase().includes(filters.role.toLowerCase())) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(app.status)) return false;
    if (filters.dateFrom || filters.dateTo) {
      const ms = toMillis(app.generatedAt);
      if (ms !== null) {
        if (filters.dateFrom && ms < new Date(filters.dateFrom).getTime()) return false;
        if (filters.dateTo) {
          const end = new Date(filters.dateTo);
          end.setHours(23, 59, 59, 999);
          if (ms > end.getTime()) return false;
        }
      }
    }
    return true;
  });

  const hasActiveFilters = filters.company || filters.role || filters.dateFrom || filters.dateTo || filters.statuses.length > 0;

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {hasActiveFilters
              ? `${filtered.length} of ${apps.length} application${apps.length !== 1 ? 's' : ''}`
              : `${apps.length} application${apps.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${
              hasActiveFilters
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 10h10M11 16h2" />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="bg-indigo-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {[filters.company, filters.role, filters.dateFrom || filters.dateTo, filters.statuses.length > 0].filter(Boolean).length}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate('/new-application')}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            + New Application
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Company</label>
              <input
                type="text"
                placeholder="Filter by company…"
                value={filters.company}
                onChange={e => updateFilters({ company: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
              <input
                type="text"
                placeholder="Filter by role…"
                value={filters.role}
                onChange={e => updateFilters({ role: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date from</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e => updateFilters({ dateFrom: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date to</label>
              <input
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={e => updateFilters({ dateTo: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Status</label>
            <div className="flex flex-wrap gap-2">
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filters.statuses.includes(s)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end pt-1">
              <button
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-red-600 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-6">{error}</p>}

      {apps.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-500 text-sm mb-4">No applications yet.</p>
          <button
            onClick={() => navigate('/new-application')}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Create your first application
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
          <p className="text-gray-500 text-sm">No applications match the current filters.</p>
          <button onClick={clearFilters} className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(app => (
                  <tr key={app.appId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{app.companyName}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{app.roleTitle}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap hidden sm:table-cell">{formatDate(app.generatedAt)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/application/${app.appId}`)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium whitespace-nowrap"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function toMillis(ts: unknown): number | null {
  if (!ts) return null;
  try {
    return (ts as { toMillis(): number }).toMillis?.() ?? (ts as { seconds: number }).seconds * 1000;
  } catch {
    return null;
  }
}

function formatDate(ts: unknown): string {
  const ms = toMillis(ts);
  if (ms === null) return '—';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
