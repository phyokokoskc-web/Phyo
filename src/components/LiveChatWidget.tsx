import { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Wifi,
  WifiOff,
  AlertCircle,
  History,
  ImagePlus,
  Trash2,
  Loader2,
} from 'lucide-react';
import type { ChatThread, Language } from '../types';
import { formatDateTime, formatShortDate } from '../utils/format';
import { readImageFileAsDataUrl } from '../utils/image';
import { t } from '../i18n';
import { BuyerAuthPanel } from './BuyerAuthPanel';

interface LiveChatWidgetProps {
  open: boolean;
  isAuthenticated: boolean;
  connected: boolean;
  loadingHistory?: boolean;
  syncError?: string;
  lang: Language;
  thread: ChatThread | undefined;
  buyerName: string;
  contextTag?: string;
  onSignInGoogle: () => Promise<void>;
  onClearContext: () => void;
  onClose: () => void;
  onSendMessage: (text: string, contextTag?: string, imageUrl?: string) => Promise<void>;
  onDeleteMessage?: (threadId: string, messageId: string) => Promise<void>;
}

export function LiveChatWidget({
  open,
  isAuthenticated,
  connected,
  loadingHistory = false,
  syncError,
  lang,
  thread,
  buyerName,
  contextTag,
  onSignInGoogle,
  onClearContext,
  onClose,
  onSendMessage,
  onDeleteMessage,
}: LiveChatWidgetProps) {
  const [draft, setDraft] = useState('');
  const [attachedImage, setAttachedImage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dict = t(lang);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, thread?.messages.length]);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSendError('');
    readImageFileAsDataUrl(file, (result) => {
      if (result.length > 780000) {
        setSendError(
          lang === 'mm'
            ? 'ပုံဖိုင်အရွယ်အစား ကြီးလွန်းပါသည်။ ပုံအသေးတစ်ခု ရွေးချယ်ပါ။'
            : 'Image is too large. Please choose a smaller photo.'
        );
        return;
      }
      setAttachedImage(result);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || sending) return;
    const trimmed = draft.trim();
    const pendingImage = attachedImage;
    if (!trimmed && !pendingImage) return;
    setSendError('');
    setSending(true);
    const pendingTag = contextTag;
    setDraft('');
    setAttachedImage('');
    try {
      await onSendMessage(trimmed, pendingTag, pendingImage || undefined);
      onClearContext();
    } catch {
      setDraft(trimmed);
      setAttachedImage(pendingImage);
      setSendError(dict.chat.sendError);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!thread || !onDeleteMessage || deletingId) return;
    setSendError('');
    setDeletingId(messageId);
    try {
      await onDeleteMessage(thread.id, messageId);
      setConfirmDeleteId(null);
    } catch {
      setSendError(dict.chat.deleteError);
    } finally {
      setDeletingId(null);
    }
  };

  const activeError = sendError || syncError;
  const messages = thread?.messages || [];

  return (
    <>
      <div
        className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-50 w-[calc(100vw-1.5rem)] sm:w-[calc(100vw-2rem)] max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] shadow-2xl flex flex-col overflow-hidden"
        style={{ height: 'min(560px, calc(100dvh - 1.5rem))' }}
        role="dialog"
        aria-label={dict.chat.title}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70">
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {dict.chat.title}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              {connected ? (
                <>
                  <Wifi className="w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{dict.chat.online}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{dict.chat.reconnecting}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="truncate">{buyerName}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {!isAuthenticated ? (
            <div className="py-2 px-1">
              <BuyerAuthPanel
                lang={lang}
                onSignInGoogle={onSignInGoogle}
                compact
                title={dict.auth.buyerGateTitle}
                subtitle={dict.auth.buyerGateDesc}
              />
            </div>
          ) : loadingHistory && messages.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400 px-4">
              {dict.chat.loadingHistory}
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400 px-4 leading-relaxed">
              {dict.chat.empty}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-1.5 pb-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                <History className="w-3 h-3" />
                <span>
                  {dict.chat.savedHistory} · {messages.length} {dict.chat.messagesUnit}
                </span>
              </div>
              {messages.map((msg, idx) => {
                const isBuyer = msg.senderRole === 'buyer';
                const dayLabel = formatShortDate(msg.createdAt);
                const prevDayLabel = idx > 0 ? formatShortDate(messages[idx - 1].createdAt) : '';
                const showDateDivider = idx === 0 || dayLabel !== prevDayLabel;
                const isConfirming = confirmDeleteId === msg.id;
                const isDeleting = deletingId === msg.id;

                return (
                  <div key={msg.id} className="space-y-2">
                    {showDateDivider && (
                      <div className="flex items-center gap-2 py-1">
                        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                        <span className="text-[10px] font-mono-tabular uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                          {dayLabel}
                        </span>
                        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                    )}
                    <div className={`flex flex-col ${isBuyer ? 'items-end' : 'items-start'}`}>
                      {msg.contextTag && (
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                          Re: {msg.contextTag}
                        </span>
                      )}
                      <div
                        className={`max-w-[82%] break-words rounded-xl overflow-hidden ${
                          msg.imageUrl && !msg.text ? 'p-1.5' : 'px-3.5 py-2.5'
                        } text-xs sm:text-sm leading-relaxed space-y-2 ${
                          isBuyer
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                            : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                        }`}
                      >
                        {msg.imageUrl && (
                          <button
                            type="button"
                            onClick={() => setLightboxImage(msg.imageUrl || null)}
                            className="block w-full overflow-hidden rounded-lg bg-black/5 dark:bg-white/5 cursor-zoom-in"
                          >
                            <img
                              src={msg.imageUrl}
                              alt={msg.text || dict.chat.photoTag}
                              className="max-h-56 w-auto max-w-full rounded-lg object-contain"
                            />
                          </button>
                        )}
                        {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono-tabular">
                          {msg.senderName} · {formatDateTime(msg.createdAt)}
                        </span>
                        {isBuyer && onDeleteMessage && thread && (
                          isConfirming ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px]">
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => void handleDelete(msg.id)}
                                className="font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 cursor-pointer"
                              >
                                {isDeleting ? dict.chat.deleting : dict.chat.confirmDeleteMessage}
                              </button>
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                              >
                                {dict.chat.cancelDelete}
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(msg.id)}
                              aria-label={dict.chat.deleteMessage}
                              title={dict.chat.deleteMessage}
                              className="inline-flex items-center gap-0.5 text-[10px] text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Error Notice */}
        {activeError && (
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/40 border-t border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="leading-snug">{activeError}</span>
          </div>
        )}

        {/* Context Preview */}
        {contextTag && (
          <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-xs">
            <span className="text-zinc-600 dark:text-zinc-300 truncate">
              Inquiry: <strong>{contextTag}</strong>
            </span>
            <button
              type="button"
              onClick={onClearContext}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 ml-2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Attached Photo Preview */}
        {isAuthenticated && attachedImage && (
          <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/80 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={attachedImage}
                alt={dict.chat.photoTag}
                className="h-12 w-12 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
              />
              <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                {dict.chat.photoTag}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAttachedImage('')}
              aria-label={dict.chat.removeImage}
              title={dict.chat.removeImage}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Composer */}
        {isAuthenticated && (
          <form
            onSubmit={handleSubmit}
            className="shrink-0 flex items-center gap-2 p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F]"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={sending}
              onClick={() => fileInputRef.current?.click()}
              aria-label={dict.chat.attachImage}
              title={dict.chat.attachImage}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (sendError) setSendError('');
              }}
              placeholder={attachedImage ? dict.chat.photoPlaceholder : dict.chat.placeholder}
              disabled={sending}
              className="flex-1 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={(!draft.trim() && !attachedImage) || sending}
              aria-label={sending ? dict.chat.sending : dict.chat.send}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 cursor-pointer"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        )}
      </div>

      {/* Fullscreen Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            aria-label="Close image preview"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxImage}
            alt={dict.chat.photoTag}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
