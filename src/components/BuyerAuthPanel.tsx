import { useEffect, useId, useState } from 'react';
import { LogIn, MessageSquare, Phone, ShieldCheck, ArrowLeft, RotateCcw } from 'lucide-react';
import type { Language } from '../types';
import { t } from '../i18n';
import {
  clearPhoneRecaptcha,
  sendPhoneSmsCode,
  signInWithGoogle,
  verifyPhoneSmsCode,
  type ConfirmationResult,
} from '../firebase';
import { ensureBuyerProfileDoc } from '../services/firestoreStore';

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
  const rawId = useId();
  const recaptchaId = `recaptcha-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [fullName, setFullName] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [sendingSms, setSendingSms] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    return () => {
      clearPhoneRecaptcha(recaptchaId);
    };
  }, [recaptchaId]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const mapSmsError = (err: unknown): string => {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : '';
    const msg = err instanceof Error ? err.message : String(err || '');

    if (msg === 'INVALID_PHONE' || code === 'auth/invalid-phone-number') {
      return dict.auth.invalidPhoneError;
    }
    if (
      msg === 'INVALID_OTP_CODE' ||
      code === 'auth/invalid-verification-code' ||
      code === 'auth/missing-verification-code'
    ) {
      return dict.auth.invalidOtpError;
    }
    if (code === 'auth/operation-not-allowed') {
      return dict.auth.phoneDisabledError;
    }
    if (code === 'auth/unauthorized-domain' || code === 'auth/captcha-check-failed') {
      return dict.auth.unauthorizedDomainError;
    }
    if (code === 'auth/code-expired' || code === 'auth/session-expired') {
      return dict.auth.codeExpiredError;
    }
    if (code === 'auth/too-many-requests' || code === 'auth/quota-exceeded') {
      return dict.auth.tooManyRequestsError;
    }
    return dict.auth.genericSmsError;
  };

  const handleSendSms = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSendingSms(true);
    try {
      const res = await sendPhoneSmsCode(phoneInput, recaptchaId, lang);
      setConfirmationResult(res.confirmationResult);
      setNormalizedPhone(res.normalizedPhone);
      setOtpCode('');
      setStep('otp');
      setResendSeconds(60);
    } catch (err) {
      setErrorMsg(mapSmsError(err));
    } finally {
      setSendingSms(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setErrorMsg('');
    setVerifyingOtp(true);
    try {
      const cred = await verifyPhoneSmsCode(confirmationResult, otpCode, fullName);
      await ensureBuyerProfileDoc(cred.user.uid, {
        name: fullName.trim() || cred.user.displayName,
        email: cred.user.email,
        phone: cred.user.phoneNumber || normalizedPhone,
      });
      onAuthSuccess?.();
    } catch (err) {
      setErrorMsg(mapSmsError(err));
    } finally {
      setVerifyingOtp(false);
    }
  };

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

  const handleChangePhone = () => {
    clearPhoneRecaptcha(recaptchaId);
    setStep('phone');
    setOtpCode('');
    setConfirmationResult(null);
    setErrorMsg('');
    setResendSeconds(0);
  };

  return (
    <div className={compact ? 'space-y-3.5 text-left' : 'space-y-4 text-left'}>
      {(title || subtitle) && (
        <div className="space-y-1.5">
          {title && (
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <ShieldCheck className="w-4 h-4 shrink-0" />
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

      {/* Invisible Firebase reCAPTCHA anchor */}
      <div id={recaptchaId} />

      {step === 'phone' ? (
        <form onSubmit={handleSendSms} className="space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" />
            <span>{dict.auth.phoneSectionTitle}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {dict.auth.fullNameOptional}
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={dict.auth.fullNamePlaceholder}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {dict.auth.phoneLabel}
            </label>
            <input
              type="tel"
              required
              autoComplete="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder={dict.auth.phonePlaceholder}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs sm:text-sm font-mono-tabular text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
            {!compact && (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                {dict.auth.phoneHint}
              </p>
            )}
          </div>

          {errorMsg && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400 leading-relaxed">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={sendingSms || !phoneInput.trim()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{sendingSms ? dict.auth.sendingSms : dict.auth.sendSmsBtn}</span>
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-3">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/70 px-3 py-2.5 flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <span className="text-zinc-600 dark:text-zinc-300">{dict.auth.smsSentInfo} </span>
              <span className="font-mono-tabular font-semibold text-zinc-900 dark:text-zinc-100">
                {normalizedPhone}
              </span>
            </div>
            <button
              type="button"
              onClick={handleChangePhone}
              className="inline-flex items-center gap-1 shrink-0 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white underline cursor-pointer"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>{dict.auth.changePhone}</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {dict.auth.otpLabel}
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder={dict.auth.otpPlaceholder}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-center text-base tracking-[0.35em] font-mono-tabular font-semibold text-zinc-900 dark:text-zinc-100 placeholder:tracking-normal placeholder:text-xs placeholder:font-normal placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          {errorMsg && (
            <p className="text-xs font-medium text-red-600 dark:text-red-400 leading-relaxed">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={verifyingOtp || otpCode.trim().length < 6}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{verifyingOtp ? dict.auth.verifyingOtp : dict.auth.verifyOtpBtn}</span>
          </button>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={resendSeconds > 0 || sendingSms}
              onClick={() => void handleSendSms()}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>
                {resendSeconds > 0
                  ? `${dict.auth.resendIn} ${resendSeconds}s`
                  : dict.auth.resendSms}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Divider */}
      <div className="relative flex items-center py-0.5">
        <div className="flex-grow border-t border-zinc-200 dark:border-zinc-700" />
        <span className="mx-3 text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          {dict.auth.orDivider}
        </span>
        <div className="flex-grow border-t border-zinc-200 dark:border-zinc-700" />
      </div>

      <button
        type="button"
        disabled={googleLoading}
        onClick={() => void handleGoogle()}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
      >
        <LogIn className="w-4 h-4" />
        <span>{dict.auth.signInGoogle}</span>
      </button>
    </div>
  );
}
