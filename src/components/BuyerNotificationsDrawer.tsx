import { Bell, CheckCheck, Info, PackageCheck, Sparkles, Tag, X } from 'lucide-react';
import type { Language, NotificationType, StoreNotification } from '../types';
import { t } from '../i18n';
import { formatDateTime } from '../utils/format';

interface BuyerNotificationsDrawerProps {
  open: boolean;
  lang: Language;
  notifications: StoreNotification[];
  readIds: string[];
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onAction: (notif: StoreNotification) => void;
}

function NotifIcon({ type }: { type: NotificationType }) {
  if (type === 'promo') return <Tag className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
  if (type === 'restock')
    return <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
  if (type === 'order')
    return <PackageCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
  return <Info className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />;
}

function getActionLabel(actionTarget: string | undefined, lang: Language): string | null {
  if (!actionTarget || actionTarget === 'none') return null;
  const dict = t(lang);
  if (actionTarget === 'orders') return dict.notifications.openOrders;
  if (actionTarget === 'chat') return dict.notifications.openChat;
  if (actionTarget === 'shop') return dict.notifications.openShop;
  if (actionTarget.startsWith('category:')) {
    const cat = actionTarget.slice('category:'.length);
    return lang === 'mm' ? `${cat} ကြည့်ရန်` : `Explore ${cat}`;
  }
  return dict.notifications.viewAll;
}

export function BuyerNotificationsDrawer({
  open,
  lang,
  notifications,
  readIds,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onAction,
}: BuyerNotificationsDrawerProps) {
  if (!open) return null;
  const dict = t(lang);
  const readSet = new Set(readIds);
  const unreadCount = notifications.filter((n) => !readSet.has(n.id)).length;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dict.notifications.drawerTitle}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-white dark:bg-[#16191F] border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col"
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {dict.notifications.drawerTitle}
              </h2>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                ● {dict.notifications.liveBadge}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{dict.notifications.markAllRead}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={dict.notifications.dismiss}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                <Bell className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {dict.notifications.empty}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
                {dict.notifications.emptySub}
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isUnread = !readSet.has(notif.id);
              const actionLabel = getActionLabel(notif.actionTarget, lang);
              return (
                <div
                  key={notif.id}
                  onClick={() => onMarkRead(notif.id)}
                  className={`rounded-xl border p-4 transition-colors cursor-pointer space-y-2 ${
                    isUnread
                      ? 'border-amber-300/80 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/20'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                        <NotifIcon type={notif.type} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                            {dict.notifications.types[notif.type]}
                          </span>
                          {notif.targetBuyerId !== 'all' && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                              {dict.notifications.directTag}
                            </span>
                          )}
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] font-mono-tabular text-zinc-400 dark:text-zinc-500">
                          {formatDateTime(notif.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                    {notif.title}
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                    {notif.message}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                      {notif.senderName}
                    </span>
                    {actionLabel && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkRead(notif.id);
                          onAction(notif);
                        }}
                        className="rounded-md bg-zinc-900 dark:bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer"
                      >
                        {actionLabel}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

interface LiveNotificationBannerProps {
  lang: Language;
  notification: StoreNotification | null;
  onDismiss: () => void;
  onOpen: (notif: StoreNotification) => void;
}

export function LiveNotificationBanner({
  lang,
  notification,
  onDismiss,
  onOpen,
}: LiveNotificationBannerProps) {
  if (!notification) return null;
  const dict = t(lang);

  return (
    <div
      role="alert"
      className="fixed top-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-amber-300 dark:border-amber-700/70 bg-white dark:bg-[#16191F] p-4 shadow-2xl space-y-2.5 animate-in fade-in slide-in-from-top-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/60">
            <NotifIcon type={notification.type} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              {dict.notifications.newArrival}
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {notification.senderName} · {dict.notifications.types[notification.type]}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dict.notifications.dismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div>
        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
          {notification.title}
        </h4>
        <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 line-clamp-3 whitespace-pre-wrap">
          {notification.message}
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
        >
          {dict.notifications.dismiss}
        </button>
        <button
          type="button"
          onClick={() => onOpen(notification)}
          className="rounded-md bg-zinc-900 dark:bg-zinc-100 px-3.5 py-1 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer"
        >
          {getActionLabel(notification.actionTarget, lang) || dict.notifications.viewAll}
        </button>
      </div>
    </div>
  );
}
