import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

type MediaUploadText = {
  reading: string;
  releaseToUpload: string;
  clickOrDrag: string;
  defaultHint: string;
};

type MediaUploadProps = {
  label: string;
  description: string;
  accept: Record<string, string[]>;
  value?: string;
  onChange: (dataUrl: string, fileName: string) => void;
  preview?: 'image' | 'audio';
  text?: MediaUploadText;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function MediaUpload({ label, description, accept, value, onChange, preview = 'image', text }: MediaUploadProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const onDrop = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(files[0]);
      setName(files[0].name);
      onChange(dataUrl, files[0].name);
    } finally {
      setBusy(false);
    }
  }, [onChange]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept, maxFiles: 1 });

  return (
    <div>
      <div className="mb-3">
        <div className="text-sm font-bold text-slate-800">{label}</div>
        <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
      </div>
      <div {...getRootProps()} className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 transition ${isDragActive ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-slate-50 hover:border-brand-400'}`}>
        <input {...getInputProps({ className: 'hidden' })} aria-label={label} />
        <div className="flex min-h-[104px] items-center justify-center text-center">
          <div>
            <div className="mb-2 text-3xl">{preview === 'audio' ? '🎧' : '🖼️'}</div>
            <p className="text-sm font-semibold text-slate-700">{busy ? text?.reading : isDragActive ? text?.releaseToUpload : text?.clickOrDrag}</p>
            <p className="mt-1 text-xs text-slate-400">{name || text?.defaultHint}</p>
          </div>
        </div>
      </div>
      {value && preview === 'image' && <img src={value} alt="reference" className="mt-3 max-h-64 w-full rounded-2xl border border-slate-200 bg-white object-contain p-2" />}
      {value && preview === 'audio' && <audio src={value} controls className="mt-3 w-full" />}
    </div>
  );
}
