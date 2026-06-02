import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

type MediaUploadProps = {
  label: string;
  description: string;
  accept: Record<string, string[]>;
  value?: string;
  onChange: (dataUrl: string, fileName: string) => void;
  preview?: 'image' | 'audio';
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function MediaUpload({ label, description, accept, value, onChange, preview = 'image' }: MediaUploadProps) {
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
      <div className="mb-2">
        <div className="text-sm font-bold text-slate-800">{label}</div>
        <div className="text-xs text-slate-500 mt-1">{description}</div>
      </div>
      <div {...getRootProps()} className={`rounded-2xl border-2 border-dashed p-5 cursor-pointer transition ${isDragActive ? 'border-brand-500 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-brand-400'}`}>
        <input {...getInputProps()} />
        <div className="text-center">
          <div className="text-3xl mb-2">{preview === 'audio' ? '🎧' : '🖼️'}</div>
          <p className="text-sm font-semibold text-slate-700">{busy ? '读取中...' : isDragActive ? '松开上传' : '点击或拖拽上传'}</p>
          <p className="text-xs text-slate-400 mt-1">{name || '上传后会作为当前功能的参考素材'}</p>
        </div>
      </div>
      {value && preview === 'image' && <img src={value} alt="reference" className="mt-3 max-h-56 rounded-2xl border border-slate-200 object-contain bg-white" />}
      {value && preview === 'audio' && <audio src={value} controls className="mt-3 w-full" />}
    </div>
  );
}
