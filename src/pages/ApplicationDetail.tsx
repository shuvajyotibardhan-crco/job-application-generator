import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApplication, updateStatus, deleteApplicationCall, Application, nextStatus } from '../services/applications';
import { getDownloadUrl } from '../services/storage';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';

export default function ApplicationDetail() {
  const { appId }       = useParams<{ appId: string }>();
  const navigate        = useNavigate();

  const [app, setApp]             = useState<Application | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [advancing, setAdvancing] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!appId) return;
    getApplication(appId)
      .then(setApp)
      .catch(() => setError('Failed to load application.'))
      .finally(() => setLoading(false));
  }, [appId]);

  const handleAdvanceStatus = async () => {
    if (!app) return;
    const next = nextStatus(app.status);
    if (!next) return;
    setAdvancing(true);
    try {
      await updateStatus(app.appId, next);
      setApp({ ...app, status: next });
    } catch {
      setError('Failed to update status.');
    } finally { setAdvancing(false); }
  };

  const handleDelete = async () => {
    if (!app) return;
    setDeleting(true);
    try {
      await deleteApplicationCall(app.appId);
      navigate('/dashboard');
    } catch {
      setError('Failed to delete application.');
      setDeleting(false);
    }
  };

  const handleDownload = async (storagePath: string, filename: string) => {
    try {
      const url = await getDownloadUrl(storagePath);
      const ext = filename.split('.').pop()!.toLowerCase();
      const mimeMap: Record<string, string> = {
        pdf:  'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
      const mime = mimeMap[ext] ?? 'application/octet-stream';

      if ('showSaveFilePicker' in window) {
        const fileHandle = await (window as Window & typeof globalThis & {
          showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle>
        }).showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: ext.toUpperCase() + ' file', accept: { [mime]: ['.' + ext] } }],
        });
        const response = await fetch(url);
        const blob = await response.blob();
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        // Fallback: anchor click (Firefox / Safari)
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return; // user cancelled picker
      setError('Download failed. Please try again.');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>;
  if (!app)    return <div className="flex items-center justify-center h-64 text-gray-500">Application not found.</div>;

  const next = nextStatus(app.status);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {showConfirm && (
        <ConfirmDialog
          title="Delete Application"
          message={`Permanently delete your application to ${app.companyName} for ${app.roleTitle}? This cannot be undone.`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete'}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <button onClick={() => navigate('/dashboard')} className="text-sm text-indigo-600 hover:underline mb-6 flex items-center gap-1">
        ← Back to Dashboard
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{app.companyName}</h1>
            <p className="text-gray-600 mt-0.5">{app.roleTitle}</p>
            <p className="text-xs text-gray-400 mt-1">{formatDate(app.generatedAt)}</p>
          </div>
          <StatusBadge status={app.status} />
        </div>

        {app.aiDetectionWarning && (
          <div className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Note: Some sections may still contain patterns detected by AI tools after 3 rewrite passes.
          </div>
        )}
      </div>

      {/* Status */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Status</h2>
        <div className="flex items-center gap-6">
          {(['Submitted', 'In Progress', 'Completed'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-300 text-xs">→</span>}
              <span className={`text-sm font-medium ${app.status === s ? 'text-indigo-600' : 'text-gray-400'}`}>{s}</span>
            </div>
          ))}
        </div>
        {next && (
          <button
            onClick={handleAdvanceStatus}
            disabled={advancing}
            className="mt-4 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {advancing ? 'Updating…' : `Mark as ${next}`}
          </button>
        )}
      </div>

      {/* Downloads */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Documents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DownloadGroup
            label="Resume"
            docxPath={app.resumeStoragePath}
            pdfPath={app.resumePdfPath}
            company={app.companyName}
            role={app.roleTitle}
            onDownload={handleDownload}
          />
          <DownloadGroup
            label="Cover Letter"
            docxPath={app.coverLetterStoragePath}
            pdfPath={app.coverLetterPdfPath}
            company={app.companyName}
            role={app.roleTitle}
            onDownload={handleDownload}
          />
        </div>
      </div>

      {/* Job Description */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Job Description</h2>
        <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">{app.jobDescription}</pre>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {/* Delete */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowConfirm(true)}
          className="text-sm text-red-600 hover:text-red-800 border border-red-200 rounded-lg px-4 py-2 hover:bg-red-50 transition-colors"
        >
          Delete Application
        </button>
      </div>
    </div>
  );
}

function DownloadGroup({ label, docxPath, pdfPath, company, role, onDownload }: {
  label: string;
  docxPath: string;
  pdfPath: string;
  company: string;
  role: string;
  onDownload: (path: string, filename: string) => void;
}) {
  const slug = `${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const type = label === 'Resume' ? 'resume' : 'cover-letter';
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <p className="text-sm font-medium text-gray-800 mb-3">{label}</p>
      <div className="space-y-2">
        <button
          onClick={() => onDownload(pdfPath, `${slug}-${type}.pdf`)}
          className="w-full text-left text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-2"
        >
          <DownloadIcon /> PDF
        </button>
        <button
          onClick={() => onDownload(docxPath, `${slug}-${type}.docx`)}
          className="w-full text-left text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-2"
        >
          <DownloadIcon /> DOCX
        </button>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function formatDate(ts: unknown): string {
  if (!ts) return '';
  try {
    const millis = (ts as { toMillis(): number }).toMillis?.() ?? (ts as { seconds: number }).seconds * 1000;
    return new Date(millis).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}
