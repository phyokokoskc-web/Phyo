import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Language } from '../types';
import { t } from '../i18n';
import { signInWithGoogle } from '../firebase';

interface BuyerAuthPanelProps {
  lang: Language;
  onSignInGoogle?: () => Promise<void>;
  onAuthSuccess?: () => void;
  compact?: boolean;
  title?: string;
  subtitle?: string;
}

export function BuyerAuthPanel({
  lang,
  onSignInGoogle,
  onAuthSuccess,
  compact = false,
  title,
  subtitle,
}: BuyerAuthPanelProps) {
  const dict = t(lang);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogle = async () => {
    setErrorMsg('');
    setGoogleLoading(true);
    try {
      if (onSignInGoogle) {
        await onSignInGoogle();
      } else {
        await signInWithGoogle();
      }
      onAuthSuccess?.();
    } catch {
      setErrorMsg(dict.auth.popupError);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className={compact ? 'space-y-3 text-left' : 'space-y-4 text-left'}>
      {(title || subtitle) && (
        <div className="space-y-1.5">
          {title && (
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <h3 className={`font-display font-bold ${compact ? 'text-sm' : 'text-base'}`}>
                {title}
              </h3>
            </div>
          )}
          {subtitle && (
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">{subtitle}</p>
          )}
        </div>
      )}

      {errorMsg && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400 leading-relaxed">
          {errorMsg}
        </p>
      )}

      <button
        type="button"
        disabled={googleLoading}
        onClick={() => void handleGoogle()}
        className="w-full inline-flex items-center justify-center gap-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.96H1.28v3.1A12 12 0 0 0 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.38l4-3.1Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.76c1.76 0 3.34.61 4.58 1.79l3.44-3.44C17.94 1.19 15.23 0 12 0A12 12 0 0 0 1.28 6.62l4 3.1C6.23 6.87 8.88 4.76 12 4.76Z"
          />
        </svg>
        <span>{googleLoading ? dict.auth.signingInGoogle : dict.auth.signInGoogle}</span>
      </button>
    </div>
  );
}
