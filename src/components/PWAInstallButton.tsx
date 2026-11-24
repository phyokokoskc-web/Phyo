import { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import type { Language } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  lang: Language;
  compact?: boolean;
}

export function PWAInstallButton({ lang, compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors cursor-pointer ${
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{lang === 'mm' ? 'App ထည့်သွင်းရန်' : 'Install App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${
            compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span>{lang === 'mm' ? 'iPhone မှာ App ထည့်ရန်' : 'Install on iPhone'}</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-5 shadow-2xl space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {lang === 'mm'
                    ? 'iPhone / iPad တွင် App & Noti Bar ထည့်သွင်းနည်း'
                    : 'Install App on iPhone / iPad'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="text-xs text-zinc-600 dark:text-zinc-300 space-y-2 list-decimal pl-4 leading-relaxed">
                <li>
                  {lang === 'mm'
                    ? 'Safari အောက်ခြေ (သို့) အပေါ်ရှိ Share (အပေါ်မြှားပုံ) ခလုတ်ကို နှိပ်ပါ။'
                    : 'Tap the Share button in Safari.'}
                </li>
                <li>
                  {lang === 'mm'
                    ? 'အောက်သို့ဆွဲပြီး "Add to Home Screen" ကို ရွေးပါ။'
                    : 'Scroll down and tap "Add to Home Screen".'}
                </li>
                <li>
                  {lang === 'mm'
                    ? 'Home Screen ပေါ်ရှိ App Icon မှ ပြန်ဖွင့်ပြီး ဖုန်း Noti Bar ကို ခွင့်ပြုပေးပါ။'
                    : 'Open the app from your Home Screen and allow notifications.'}
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 py-2 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer"
              >
                {lang === 'mm' ? 'နားလည်ပါပြီ' : 'Got it'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
