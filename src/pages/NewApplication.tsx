import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveCompany, generateApplication } from '../services/applications';

type Step = 'form' | 'disambiguate' | 'generating';

interface CompanyOption {
  name: string;
  slug: string;
  summary: string;
}

export default function NewApplication() {
  const navigate = useNavigate();

  const [step, setStep]               = useState<Step>('form');
  const [companyName, setCompanyName] = useState('');
  const [roleTitle, setRoleTitle]     = useState('');
  const [jd, setJd]                   = useState('');
  const [error, setError]             = useState('');
  const [resolving, setResolving]     = useState(false);
  const [extracting, setExtracting]   = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  // Disambiguation
  const [options, setOptions]         = useState<CompanyOption[]>([]);
  const [selectedSlug, setSelectedSlug] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    setExtracting(true);
    setError('');
    try {
      let text = '';
      if (ext === 'txt') {
        text = await file.text();
      } else if (ext === 'pdf') {
        const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
        GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await getDocument({ data: arrayBuffer }).promise;
        const pages = await Promise.all(
          Array.from({ length: pdf.numPages }, (_, i) =>
            pdf.getPage(i + 1).then(p => p.getTextContent()).then(c => c.items.map((item) => 'str' in item ? item.str : '').join(' '))
          )
        );
        text = pages.join('\n\n');
      } else if (ext === 'docx') {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        setError('Only .txt, .pdf, and .docx files are supported.');
        return;
      }
      setJd(text.trim());
    } catch {
      setError('Failed to read file. Please paste the text manually.');
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!companyName.trim()) { setError('Company name is required.'); return; }
    if (!roleTitle.trim())   { setError('Role title is required.'); return; }
    if (!jd.trim())          { setError('Job description is required.'); return; }

    setResolving(true);
    try {
      const result = await resolveCompany(companyName.trim());
      const data = result.data as
        | { resolved: true;  company: CompanyOption }
        | { resolved: false; options: CompanyOption[] };

      if (data.resolved) {
        await startGeneration(data.company.name, data.company.slug);
      } else {
        setOptions(data.options);
        setSelectedSlug(data.options[0]?.slug ?? '');
        setStep('disambiguate');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResolving(false);
    }
  };

  const handleDisambiguate = async () => {
    const chosen = options.find(o => o.slug === selectedSlug);
    if (!chosen) return;
    await startGeneration(chosen.name, chosen.slug);
  };

  const startGeneration = async (name: string, slug: string) => {
    setStep('generating');
    setError('');
    try {
      const result = await generateApplication({ companySlug: slug, companyName: name, roleTitle: roleTitle.trim(), jobDescription: jd.trim() });
      const { appId } = result.data as { appId: string };
      navigate(`/application/${appId}`);
    } catch (err) {
      setError(errorMessage(err));
      setStep('form');
    }
  };

  if (step === 'generating') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-3 text-gray-600">
          <Spinner />
          <span className="text-sm">Generating your tailored resume and cover letter…</span>
        </div>
        <p className="text-xs text-gray-400 mt-4">This takes about 30–60 seconds. Please don't close this tab.</p>
      </div>
    );
  }

  if (step === 'disambiguate') {
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <button onClick={() => setStep('form')} className="text-sm text-indigo-600 hover:underline mb-6 flex items-center gap-1">
          ← Back
        </button>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Which company did you mean?</h1>
        <p className="text-sm text-gray-500 mb-6">Multiple matches were found for "{companyName}". Select the one you're applying to.</p>

        <div className="space-y-3 mb-6">
          {options.map(opt => (
            <label key={opt.slug} className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${selectedSlug === opt.slug ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <input
                type="radio"
                name="company"
                value={opt.slug}
                checked={selectedSlug === opt.slug}
                onChange={() => setSelectedSlug(opt.slug)}
                className="mt-0.5 accent-indigo-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{opt.name}</p>
                {opt.summary && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{opt.summary}</p>}
              </div>
            </label>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>}

        <button
          onClick={handleDisambiguate}
          disabled={!selectedSlug}
          className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          Generate Application
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">New Application</h1>
      <p className="text-sm text-gray-500 mb-8">Paste the job description and we'll generate a tailored resume and cover letter.</p>

      <form onSubmit={handleFormSubmit} className="space-y-6">

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Role Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input
                value={companyName} onChange={e => setCompanyName(e.target.value)}
                placeholder="e.g. Google"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role Title</label>
              <input
                value={roleTitle} onChange={e => setRoleTitle(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Job Description</h2>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting}
                className="flex items-center gap-1.5 text-xs text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 disabled:opacity-50 transition-colors"
              >
                {extracting ? <><Spinner /><span>Reading…</span></> : <><UploadIcon />Upload file</>}
              </button>
            </div>
          </div>
          <textarea
            value={jd} onChange={e => setJd(e.target.value)}
            rows={14}
            placeholder="Paste the full job description here, or upload a .txt / .pdf / .docx file…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y font-mono"
          />
          <p className="text-xs text-gray-400">Include the full JD for the best results — requirements, responsibilities, and any skills listed.</p>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <button
          type="submit"
          disabled={resolving}
          className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {resolving ? <><Spinner /><span>Resolving company…</span></> : 'Generate Resume & Cover Letter'}
        </button>
      </form>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return (e as { message: string }).message;
  return 'Something went wrong. Please try again.';
}
