import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import type { BannerSlide, Language } from '../types';
import { SmartImage } from './SmartImage';

interface BannerSliderProps {
  banners: BannerSlide[];
  lang: Language;
  onSelectCategory: (category: string) => void;
}

export function BannerSlider({ banners, lang, onSelectCategory }: BannerSliderProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || banners.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % banners.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [paused, banners.length]);

  if (banners.length === 0) return null;

  const current = banners[activeIdx];

  const handlePrev = () => {
    setActiveIdx((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const handleNext = () => {
    setActiveIdx((prev) => (prev + 1) % banners.length);
  };

  return (
    <section
      aria-label="Featured Collections"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-900"
    >
      <div className="relative aspect-[16/9] md:aspect-[21/9] w-full overflow-hidden">
        {banners.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-500 ease-out ${
              idx === activeIdx ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            <SmartImage
              src={slide.image}
              alt={lang === 'mm' ? slide.titleMm : slide.title}
              className="h-full w-full object-cover"
              fallbackLabel={slide.title}
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/15"
              aria-hidden="true"
            />
          </div>
        ))}

        <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-10 md:p-14 max-w-2xl">
          <p className="text-xs font-medium tracking-wide text-zinc-200 mb-2">
            {lang === 'mm' ? current.kickerMm : current.kicker}
          </p>
          <h1
            className="font-display text-2xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-white leading-[1.15] mb-3"
            style={{ textWrap: 'balance' }}
          >
            {lang === 'mm' ? current.titleMm : current.title}
          </h1>
          <p className="text-sm sm:text-base text-zinc-200/90 max-w-lg mb-6 leading-relaxed line-clamp-2">
            {lang === 'mm' ? current.subtitleMm : current.subtitle}
          </p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onSelectCategory(current.targetCategory)}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{lang === 'mm' ? current.ctaLabelMm : current.ctaLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Prev / Next Controls */}
        <div className="absolute bottom-5 right-5 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous slide"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur-sm border border-white/15 hover:bg-black/75 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next slide"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur-sm border border-white/15 hover:bg-black/75 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Slide Index Bars */}
        <div className="absolute bottom-6 left-6 sm:left-10 md:left-14 z-10 hidden sm:flex items-center gap-2">
          {banners.map((slide, idx) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveIdx(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 rounded-sm transition-all cursor-pointer ${
                idx === activeIdx ? 'w-8 bg-white' : 'w-3 bg-white/40 hover:bg-white/65'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
