import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, saveProfile, UserProfile, ProfileUrl } from '../services/profile';
import { uploadBaseResume } from '../services/storage';
import ProfileUrlList from '../components/ProfileUrlList';

type ResumeInputMode = 'file' | 'gdocs';

export default function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState('');

  // Form fields
  const [fullName, setFullName]         = useState('');
  const [email, setEmail]               = useState('');
  const [phone, setPhone]               = useState('');
  const [city, setCity]                 = useState('');
  const [state, setState]               = useState('');
  const [profileUrls, setProfileUrls]   = useState<ProfileUrl[]>([]);

  // Resume state
  const [resumeMode, setResumeMode]     = useState<ResumeInputMode>('file');
  const [gdocsUrl, setGdocsUrl]         = useState('');
  const [currentResumeRef, setCurrentResumeRef] = useState<string | null>(null);
  const [currentResumeType, setCurrentResumeType] = useState<UserProfile['baseResumeType']>(null);

  useEffect(() => {
    getProfile().then(p => {
      if (p) {
        setFullName(p.fullName || '');
        setEmail(p.email || '');
        setPhone(p.phone || '');
        setCity(p.city || '');
        setState(p.state || '');
        setProfileUrls(p.profileUrls || []);
        setCurrentResumeRef(p.baseResumeRef);
        setCurrentResumeType(p.baseResumeType);
        if (p.baseResumeType === 'gdocs' && p.baseResumeRef) {
          setResumeMode('gdocs');
          setGdocsUrl(p.baseResumeRef);
        }
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['pdf', 'docx', 'png', 'jpg', 'jpeg'];
    if (!ext || !allowed.includes(ext)) {
      setError('Only PDF, DOCX, PNG, or JPG files are accepted.'); return;
    }
    const normalised = ext === 'jpeg' ? 'jpg' : ext as 'pdf' | 'docx' | 'png' | 'jpg';
    setUploading(true); setError('');
    try {
      const path = await uploadBaseResume(file);
      setCurrentResumeRef(path);
      setCurrentResumeType(normalised);
      await saveProfile({ baseResumeRef: path, baseResumeType: normalised });
      setSuccess('Resume uploaded successfully.');
    } catch {
      setError('Upload failed. Please try again.');
    } finally { setUploading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (!fullName.trim()) { setError('Full name is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address.'); return; }
    if (!phone.trim()) { setError('Phone number is required.'); return; }
    if (!city.trim()) { setError('City is required.'); return; }
    if (!state.trim()) { setError('State is required.'); return; }

    let resumeRef = currentResumeRef;
    let resumeType = currentResumeType;

    if (resumeMode === 'gdocs') {
      if (!gdocsUrl.trim() || !gdocsUrl.includes('docs.google.com')) {
        setError('Please enter a valid Google Docs URL.'); return;
      }
      resumeRef = gdocsUrl.trim();
      resumeType = 'gdocs';
    }

    setSaving(true);
    try {
      await saveProfile({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim(),
        state: state.trim(),
        profileUrls,
        baseResumeRef: resumeRef,
        baseResumeType: resumeType,
      });
      setCurrentResumeRef(resumeRef);
      setCurrentResumeType(resumeType);
      setSuccess('Profile saved.');
      setTimeout(() => navigate('/dashboard'), 800);
    } catch {
      setError('Failed to save profile. Please try again.');
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading profile…</div>;
  }

  const resumeLabel = currentResumeRef
    ? currentResumeType === 'gdocs'
      ? 'Google Docs resume linked'
      : `Resume on file (${currentResumeType?.toUpperCase() ?? 'file'})`
    : 'No resume uploaded yet';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Your Profile</h1>
      <p className="text-sm text-gray-500 mb-8">Personal details used in your resumes and cover letters.</p>

      <form onSubmit={handleSave} className="space-y-6">

        {/* Personal Details */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Personal Details</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  value={city} onChange={e => setCity(e.target.value)}
                  placeholder="San Francisco"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  value={state} onChange={e => setState(e.target.value)}
                  placeholder="CA"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Base Resume */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Base Resume</h2>
            {currentResumeRef && (
              <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                {resumeLabel}
              </span>
            )}
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-lg border border-gray-200 p-1 w-fit">
            <button type="button" onClick={() => setResumeMode('file')}
              className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${resumeMode === 'file' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              Upload File
            </button>
            <button type="button" onClick={() => setResumeMode('gdocs')}
              className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${resumeMode === 'gdocs' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              Google Docs URL
            </button>
          </div>

          {resumeMode === 'file' ? (
            <div>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {uploading ? 'Uploading…' : (currentResumeRef && currentResumeType !== 'gdocs') ? 'Replace Resume (PDF / DOCX / Image)' : 'Upload Resume (PDF / DOCX / Image)'}
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Docs Share URL</label>
              <input
                value={gdocsUrl} onChange={e => setGdocsUrl(e.target.value)}
                placeholder="https://docs.google.com/document/d/..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">Document must be set to "Anyone with the link can view".</p>
            </div>
          )}
        </section>

        {/* Profile URLs */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Links</h2>
          <p className="text-xs text-gray-400">LinkedIn and GitHub will be prioritised for document headers.</p>
          <ProfileUrlList urls={profileUrls} onChange={setProfileUrls} />
        </section>

        {/* Feedback */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
