import { useState, useEffect, useMemo } from 'react';
import { Edit3, EyeOff, Store } from 'lucide-react';
import type { Language, StoreBrandConfig } from '../types';
import { t } from '../i18n';
import {
  getCachedResolvedImageUrl,
  isGooglePhotosShareLink,
  normalizeImageSrcSync,
  resolveImageUrlAsync,
} from '../utils/imageUrl';

interface StoreLogoBannerProps {
  brand: StoreBrandConfig;
  lang: Language;
  isAdmin?: boolean;
  onEdit?: () => void;
}

function getMonogram(name: string): string {
  const clean = name.trim();
  if (!clean) return 'SK';
  const parts = clean.split(/[\s&]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export function StoreLogoBanner({
  brand,
  lang,
  isAdmin = false,
  onEdit,
}: StoreLogoBannerProps) {
  const dict = t(lang);
  const rawLogo = (brand.logoImage || '').trim();
  const isAsyncShare = useMemo(() => isGooglePhotosShareLink(rawLogo), [rawLogo]);
  const initialSrc = useMemo(
    () => (isAsyncShare ? getCachedResolvedImageUrl(rawLogo) || '' : normalizeImageSrcSync(rawLogo)),
    [rawLogo, isAsyncShare]
  );

  const [logoSrc, setLogoSrc] = useState(initialSrc);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
    if (!isAsyncShare) {
      setLogoSrc(initialSrc);
      return;
    }
    const cached = getCachedResolvedImageUrl(rawLogo);
    if (cached) {
      setLogoSrc(cached);
      return;
    }
    let active = true;
    setLogoSrc('');
    void resolveImageUrlAsync(rawLogo).then((resolved) => {
      if (!active) return;
      if (resolved) setLogoSrc(resolved);
      else setImgFailed(true);
    });
    return () => {
      active = false;
    };
  }, [rawLogo, isAsyncShare, initialSrc]);

  if (!brand.showLogoBanner && !isAdmin) {
    return null;
  }

  const headline =
    (lang === 'mm' ? brand.bannerTitleMm : brand.bannerTitle) ||
    (lang === 'mm' ? brand.bannerTitle : brand.bannerTitleMm);
  const subtitle =
    (lang === 'mm' ? brand.bannerSubtitleMm : brand.bannerSubtitle) ||
    (lang === 'mm' ? brand.bannerSubtitle : brand.bannerSubtitleMm);
  const hasImage = Boolean(logoSrc) && !imgFailed;

  return (
    <section
      aria-label={`${brand.storeName} Logo Banner`}
      className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-white via-zinc-50/90 to-zinc-100/70 dark:from-[#16191F] dark:via-[#171B22] dark:to-zinc-900/80 px-3.5 py-2.5 sm:px-5 sm:py-3 shadow-xs ${
        !brand.showLogoBanner && isAdmin ? 'opacity-75' : ''
      }`}
    >
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          {hasImage ? (
            <div className="h-11 sm:h-12 w-auto min-w-[2.75rem] sm:min-w-[3rem] max-w-[140px] sm:max-w-[180px] shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden flex items-center justify-center px-1">
              <img
                src={logoSrc}
                alt={brand.storeName}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="h-full w-auto max-w-full object-contain"
              />
            </div>
          ) : (
            <div
              className="h-11 w-11 sm:h-12 sm:w-12 shrink-0 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-display text-sm sm:text-base font-bold tracking-tight"
              aria-hidden="true"
            >
              {getMonogram(brand.storeName)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-display text-sm sm:text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                {brand.storeName}
              </span>
              {headline && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-600 hidden sm:inline">·</span>
                  <span className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">
                    {headline}
                  </span>
                </>
              )}
              {!brand.showLogoBanner && isAdmin && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                  <EyeOff className="w-3 h-3" />
                  <span>{dict.admin.logoBannerHiddenNote}</span>
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {isAdmin && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{dict.admin.editBrandBannerBtn}</span>
          </button>
        ) : (
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 shrink-0">
            <Store className="w-3.5 h-3.5" />
            <span>Yangon & Mandalay</span>
          </div>
        )}
      </div>
    </section>
  );
}
