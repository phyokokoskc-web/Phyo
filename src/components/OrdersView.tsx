import { CheckCircle2, Clock, Truck, PackageCheck, XCircle, MessageSquare } from 'lucide-react';
import type { Language, Order, OrderStatus, Product } from '../types';
import { formatDateTime, formatMMK } from '../utils/format';
import { t } from '../i18n';
import { SmartImage } from './SmartImage';
import { BuyerAuthPanel } from './BuyerAuthPanel';

interface OrdersViewProps {
  isAuthenticated: boolean;
  loading?: boolean;
  orders: Order[];
  products?: Product[];
  lang: Language;
  onSignInGoogle: () => Promise<void>;
  onChatAboutOrder: (order: Order) => void;
}

const PROGRESS_STEPS: OrderStatus[] = ['Pending', 'Verified', 'Shipped', 'Delivered'];

export function OrdersView({
  isAuthenticated,
  loading = false,
  orders,
  products = [],
  lang,
  onSignInGoogle,
  onChatAboutOrder,
}: OrdersViewProps) {
  const dict = t(lang);

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'Delivered':
        return 'text-emerald-700 dark:text-emerald-400';
      case 'Shipped':
        return 'text-blue-700 dark:text-blue-400';
      case 'Verified':
        return 'text-indigo-700 dark:text-indigo-400';
      case 'Cancelled':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-amber-700 dark:text-amber-400';
    }
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'Delivered':
        return PackageCheck;
      case 'Shipped':
        return Truck;
      case 'Verified':
        return CheckCircle2;
      case 'Cancelled':
        return XCircle;
      default:
        return Clock;
    }
  };

  return (
    <section className="space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          {dict.orders.heading}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{dict.orders.subtitle}</p>
      </div>

      {!isAuthenticated ? (
        <div className="max-w-lg rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-6">
          <BuyerAuthPanel
            lang={lang}
            onSignInGoogle={onSignInGoogle}
            title={dict.auth.buyerGateTitle}
            subtitle={dict.auth.buyerGateDesc}
          />
        </div>
      ) : loading ? (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{dict.profile.loadingHistory}</p>
          <div className="h-44 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-12 text-center">
          <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            {dict.orders.empty}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{dict.orders.emptySub}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const StatusIcon = getStatusIcon(order.status);
            const activeStepIdx = PROGRESS_STEPS.indexOf(order.status);

            return (
              <article
                key={order.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] overflow-hidden"
              >
                {/* Order Summary Top Row */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-zinc-50/70 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-mono-tabular font-bold text-zinc-900 dark:text-zinc-100">
                      {dict.orders.orderId} #{order.id}
                    </span>
                    <span className="text-zinc-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono-tabular">
                      {formatDateTime(order.createdAt)}
                    </span>
                    <span className="text-zinc-400" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-xs text-zinc-600 dark:text-zinc-300">
                      {order.paymentMethod}
                      {order.bankName ? ` (${order.bankName})` : ''} · Ref{' '}
                      <span className="font-mono-tabular">{order.paymentReference}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${getStatusColor(
                        order.status
                      )}`}
                    >
                      <StatusIcon className="w-4 h-4" />
                      <span>{dict.orders.steps[order.status]}</span>
                    </div>
                    <span className="font-mono-tabular text-base font-bold text-zinc-900 dark:text-zinc-100">
                      {formatMMK(order.total)}
                    </span>
                  </div>
                </div>

                {/* Live 4-Step Tracking Stepper */}
                <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
                  {order.status === 'Cancelled' ? (
                    <div className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      <span>{dict.orders.steps.Cancelled}</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {PROGRESS_STEPS.map((step, idx) => {
                        const completed = activeStepIdx >= idx;
                        const current = activeStepIdx === idx;
                        const historyMatch = order.trackingHistory.find((h) => h.status === step);
                        return (
                          <div key={step} className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-mono-tabular font-semibold ${
                                  completed
                                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                                    : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <div
                                className={`h-0.5 flex-1 ${
                                  idx < PROGRESS_STEPS.length - 1
                                    ? activeStepIdx > idx
                                      ? 'bg-zinc-900 dark:bg-zinc-100'
                                      : 'bg-zinc-200 dark:bg-zinc-800'
                                    : 'bg-transparent'
                                }`}
                              />
                            </div>
                            <span
                              className={`text-xs font-semibold ${
                                current || completed
                                  ? 'text-zinc-900 dark:text-zinc-100'
                                  : 'text-zinc-400 dark:text-zinc-500'
                              }`}
                            >
                              {dict.orders.steps[step]}
                            </span>
                            {historyMatch && (
                              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono-tabular mt-0.5">
                                {formatDateTime(historyMatch.timestamp)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Items & Address Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
                  <div className="md:col-span-2 space-y-3">
                    {order.items.map((item, i) => {
                      const fallbackImg =
                        item.image ||
                        products.find((p) => p.id === item.productId)?.image ||
                        '';
                      return (
                      <div key={`${item.productId}-${i}`} className="flex items-center gap-3.5">
                        <div className="h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                          <SmartImage
                            src={fallbackImg}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {lang === 'mm' ? item.nameMm : item.name}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {item.variant} · Qty <span className="font-mono-tabular">{item.quantity}</span>
                          </div>
                        </div>
                        <div className="font-mono-tabular text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatMMK(item.price * item.quantity)}
                        </div>
                      </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-col justify-between gap-4 md:border-l md:border-zinc-100 dark:md:border-zinc-800 md:pl-6">
                    <div className="text-xs space-y-1">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                        {dict.orders.deliverTo}
                      </div>
                      <div className="text-zinc-700 dark:text-zinc-300">
                        {order.shippingAddress.recipientName} ·{' '}
                        <span className="font-mono-tabular">{order.shippingAddress.phone}</span>
                      </div>
                      <div className="text-zinc-500 dark:text-zinc-400">
                        {order.shippingAddress.streetAddress}, {order.shippingAddress.township},{' '}
                        {order.shippingAddress.city}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onChatAboutOrder(order)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{dict.orders.chatOrder}</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
