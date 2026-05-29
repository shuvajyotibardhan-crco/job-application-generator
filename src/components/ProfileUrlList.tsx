import { useState } from 'react';

export interface ProfileUrl {
  id: string;
  label: string;
  url: string;
}

interface Props {
  urls: ProfileUrl[];
  onChange: (urls: ProfileUrl[]) => void;
}

export default function ProfileUrlList({ urls, onChange }: Props) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');

  const add = () => {
    if (!label.trim() || !url.trim()) return;
    onChange([...urls, { id: crypto.randomUUID(), label: label.trim(), url: url.trim() }]);
    setLabel('');
    setUrl('');
  };

  const remove = (id: string) => onChange(urls.filter(u => u.id !== id));

  return (
    <div className="space-y-2">
      {urls.map(u => (
        <div key={u.id} className="flex items-center gap-3 text-sm">
          <span className="font-medium w-28 truncate text-gray-700">{u.label}</span>
          <span className="text-gray-500 flex-1 truncate">{u.url}</span>
          <button onClick={() => remove(u.id)} className="text-red-500 hover:text-red-700 text-xs shrink-0">
            Remove
          </button>
        </div>
      ))}
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Label (e.g. LinkedIn)"
          className="border border-gray-300 rounded px-2 py-1.5 text-sm sm:w-36"
        />
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://..."
          className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1"
        />
        <button
          onClick={add}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  );
}
