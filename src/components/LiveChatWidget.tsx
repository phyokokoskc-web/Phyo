import { useState, useEffect, useRef } from 'react';
import { X, Send, Wifi, WifiOff } from 'lucide-react';
import type { ChatThread, Language } from '../types';
import { formatDateTime } from '../utils/format';
import { t } from '../i18n';

interface LiveChatWidgetProps {
  open: boolean;
  connected: boolean;
  lang: Language;
  thread: ChatThread | undefined;
  buyerName: string;
  contextTag?: string;
  onClearContext: () => void;
  onClose: () => void;
  onSendMessage: (text: string, contextTag?: string) => void;
}

export function LiveChatWidget({
  open,
  connected,
  lang,
  thread,
  buyerName,
  contextTag,
  onClearContext,
  onClose,
  onSendMessage,
}: LiveChatWidgetProps) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const dict = t(lang);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, thread?.messages.length]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSendMessage(trimmed, contextTag);
    setDraft('');
    onClearContext();
  };

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] shadow-2xl flex flex-col overflow-hidden"
      style={{ height: 'min(540px, calc(100vh - 2rem))' }}
      role="dialog"
      aria-label={dict.chat.title}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70">
        <div>
          <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {dict.chat.title}
          </h3>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            {connected ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>{dict.chat.online}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>{dict.chat.reconnecting}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{buyerName}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!thread || thread.messages.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400 px-4 leading-relaxed">
            {dict.chat.empty}
          </div>
        ) : (
          thread.messages.map((msg) => {
            const isBuyer = msg.senderRole === 'buyer';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isBuyer ? 'items-end' : 'items-start'}`}
              >
                {msg.contextTag && (
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-1">
                    Re: {msg.contextTag}
                  </span>
                )}
                <div
                  className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                    isBuyer
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 font-mono-tabular">
                  {msg.senderName} · {formatDateTime(msg.createdAt)}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Context Preview */}
      {contextTag && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 text-xs">
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

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F]"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={dict.chat.placeholder}
          className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label={dict.chat.send}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
