import { useState, useEffect, useMemo } from 'react';
import { Package } from 'lucide-react';
import {
  getCachedResolvedImageUrl,
  isGooglePhotosShareLink,
  normalizeImageSrcSync,
  resolveImageUrlAsync,
} from '../utils/imageUrl';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function SmartImage({ src, alt, className = '', fallbackLabel }: SmartImageProps) {
  const trimmed = (src || '').trim();
  const isAsyncShare = useMemo(() => isGooglePhotosShareLink(trimmed), [trimmed]);
  const syncSrc = useMemo(
    () => (isAsyncShare ? getCachedResolvedImageUrl(trimmed) || '' : normalizeImageSrcSync(trimmed)),
    [trimmed, isAsyncShare]
  );

  const [asyncResolved, setAsyncResolved] = useState<string>(syncSrc);
  const [resolving, setResolving] = useState<boolean>(isAsyncShare && !syncSrc);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!isAsyncShare) {
      setAsyncResolved(syncSrc);
      setResolving(false);
      return;
    }

    const cached = getCachedResolvedImageUrl(trimmed);
    if (cached) {
      setAsyncResolved(cached);
      setResolving(false);
      return;
    }

    let active = true;
    setAsyncResolved('');
    setResolving(true);
    void resolveImageUrlAsync(trimmed).then((url) => {
      if (!active) return;
      setAsyncResolved(url);
      setResolving(false);
      if (!url) setFailed(true);
    });

    return () => {
      active = false;
    };
  }, [trimmed, isAsyncShare, syncSrc]);

  const effectiveSrc = isAsyncShare ? asyncResolved : syncSrc;

  if (resolving) {
    return (
      <div
        aria-label={alt}
        className={`animate-pulse bg-zinc-200/80 dark:bg-zinc-800/80 ${className}`}
      />
    );
  }

  if (!effectiveSrc || failed) {
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
      src={effectiveSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
