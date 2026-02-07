import { useEffect } from 'react';

interface Props {
  src: string;
  filename: string;
  onClose: () => void;
  onAssign?: () => void;
  canAssign: boolean;
}

export function Lightbox({ src, filename, onClose, onAssign, canAssign }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={filename}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 truncate max-w-[300px]">{filename}</span>

          {canAssign && onAssign && (
            <button className="btn btn-primary text-xs" onClick={onAssign}>
              Assign to Shot
            </button>
          )}

          <button className="btn btn-secondary text-xs" onClick={onClose}>
            Close (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
