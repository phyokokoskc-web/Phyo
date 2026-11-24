import { useState, useEffect, useMemo } from 'react';
import { Package } from 'lucide-react';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

function normalizeImageSrc(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('/')) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    // Auto-convert standard Dropbox share links (dl=0 / dl=1 -> raw=1) while keeping rlkey intact
    if (host === 'dropbox.com' || host.endsWith('.dropbox.com')) {
      url.searchParams.delete('dl');
      url.searchParams.set('raw', '1');
      return url.toString();
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

export function SmartImage({ src, alt, className = '', fallbackLabel }: SmartImageProps) {
  const resolvedSrc = useMemo(() => normalizeImageSrc(src), [src]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 text-zinc-500 dark:text-zinc-400 p-4 text-center ${className}`}
      >
        <Package className="w-7 h-7 mb-2 opacity-70" />
        <span className="text-xs font-medium line-clamp-2 max-w-[160px]">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
