import { useState, useEffect } from 'react';
import {
  X,
  Minus,
  Plus,
  Trash2,
  ArrowLeft,
  Check,
  Copy,
  MapPin,
  Smartphone,
  Building2,
  QrCode,
  ShoppingBag,
} from 'lucide-react';
import type {
  Address,
  CartItem,
  Language,
  Order,
  PaymentMethod,
  PaymentSettings,
  UserProfile,
} from '../types';
import { formatMMK } from '../utils/format';
import { t } from '../i18n';
import { SmartImage } from './SmartImage';

interface CartCheckoutDrawerProps {
  open: boolean;
  lang: Language;
  buyerId: string;
  profile: UserProfile;
  cart: CartItem[];
  directBuyItem: CartItem | null;
  addresses: Address[];
  paymentSettings: PaymentSettings;
  onClose: () => void;
  onUpdateQty: (productId: string, variant: string, delta: number) => void;
  onUpdateDirectBuyQty: (delta: number) => void;
  onCancelDirectBuy: () => void;
  onRemoveItem: (productId: string, variant: string) => void;
  onClearCart: () => void;
  onAddressesUpdated: (addresses: Address[]) => void;
  onGoToProfile: () => void;
  onGoToOrders: () => void;
  onOrderCreated: (order: Order) => void;
}

export function CartCheckoutDrawer({
  open,
  lang,
  buyerId,
  profile,
  cart,
  directBuyItem,
  addresses,
  paymentSettings,
  onClose,
  onUpdateQty,
  onUpdateDirectBuyQty,
  onCancelDirectBuy,
  onRemoveItem,
  onClearCart,
  onAddressesUpdated,
  onGoToProfile,
  onGoToOrders,
  onOrderCreated,
}: CartCheckoutDrawerProps) {
  const enabledBanks = paymentSettings.bankAccounts.filter((b) => b.enabled);
  const [step, setStep] = useState<'bag' | 'checkout' | 'confirmed'>('bag');
  const [selectedAddrId, setSelectedAddrId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('KPay');
  const [selectedBank, setSelectedBank] = useState(enabledBanks[0]?.bankName || 'KBZ Bank');
  const [txRef, setTxRef] = useState('');
  const [copiedAcc, setCopiedAcc] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const [quickAddr, setQuickAddr] = useState({
    recipientName: '',
    phone: '',
    city: 'Yangon',
    township: '',
    streetAddress: '',
  });
  const [savingQuickAddr, setSavingQuickAddr] = useState(false);

  useEffect(() => {
    if (addresses.length > 0) {
      const def = addresses.find((a) => a.isDefault) || addresses[0];
      setSelectedAddrId((prev) => (addresses.some((a) => a.id === prev) ? prev : def.id));
    }
  }, [addresses]);

  useEffect(() => {
    if (!open) {
      setStep('bag');
      setPlacedOrder(null);
      setErrorMsg('');
    } else if (directBuyItem && step === 'bag') {
      setStep('checkout');
    }
  }, [open, directBuyItem, step]);

  useEffect(() => {
    if (enabledBanks.length > 0 && !enabledBanks.some((b) => b.bankName === selectedBank)) {
      setSelectedBank(enabledBanks[0].bankName);
    }
  }, [enabledBanks, selectedBank]);

  if (!open) return null;

  const dict = t(lang);
  const isDirectBuy = Boolean(directBuyItem);
  const activeItems = directBuyItem ? [directBuyItem] : cart;
  const subtotal = activeItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shippingFee = subtotal >= 150000 || subtotal === 0 ? 0 : 4500;
  const total = subtotal + shippingFee;

  const handleDrawerClose = () => {
    onClose();
    if (directBuyItem) {
      onCancelDirectBuy();
    }
  };

  const selectedAddress = addresses.find((a) => a.id === selectedAddrId) || addresses[0];
  const currentBank = enabledBanks.find((b) => b.bankName === selectedBank) || enabledBanks[0];
  const activeWallet = paymentMethod === 'KPay' ? paymentSettings.kpay : paymentSettings.wavepay;

  const handleCopy = (val: string) => {
    navigator.clipboard?.writeText(val);
    setCopiedAcc(true);
    window.setTimeout(() => setCopiedAcc(false), 1800);
  };

  const handleSaveQuickAddress = async () => {
    if (
      !quickAddr.recipientName.trim() ||
      !quickAddr.phone.trim() ||
      !quickAddr.township.trim() ||
      !quickAddr.streetAddress.trim()
    ) {
      setErrorMsg('Please fill recipient name, phone, township, and street address.');
      return;
    }
    setErrorMsg('');
    setSavingQuickAddr(true);
    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId,
          label: 'Home',
          recipientName: quickAddr.recipientName.trim(),
          phone: quickAddr.phone.trim(),
          city: quickAddr.city.trim() || 'Yangon',
          township: quickAddr.township.trim(),
          streetAddress: quickAddr.streetAddress.trim(),
          isDefault: true,
        }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Address[];
        onAddressesUpdated(updated);
      }
    } finally {
      setSavingQuickAddr(false);
    }
  };

  const handlePlaceOrder = async () => {
    setErrorMsg('');
    let addressToUse = selectedAddress;
    if (!addressToUse) {
      if (
        quickAddr.recipientName.trim() &&
        quickAddr.phone.trim() &&
        quickAddr.township.trim() &&
        quickAddr.streetAddress.trim()
      ) {
        const resAddr = await fetch('/api/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyerId,
            label: 'Home',
            recipientName: quickAddr.recipientName.trim(),
            phone: quickAddr.phone.trim(),
            city: quickAddr.city.trim() || 'Yangon',
            township: quickAddr.township.trim(),
            streetAddress: quickAddr.streetAddress.trim(),
            isDefault: true,
          }),
        });
        if (resAddr.ok) {
          const updatedAddrs = (await resAddr.json()) as Address[];
          onAddressesUpdated(updatedAddrs);
          addressToUse = updatedAddrs[0];
        }
      }
    }
    if (!addressToUse) {
      setErrorMsg('Please enter or add a delivery address first.');
      return;
    }
    if (!txRef.trim()) {
      setErrorMsg('Please enter your transaction reference ID or last 6 digits.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId,
          customerName:
            addressToUse.recipientName ||
            (profile.name !== 'Guest Buyer' ? profile.name : ''),
          customerPhone: addressToUse.phone || profile.phone,
          items: activeItems.map((c) => ({
            productId: c.product.id,
            quantity: c.quantity,
            variant: c.variant,
          })),
          shippingAddress: addressToUse,
          paymentMethod,
          paymentReference: txRef.trim(),
          bankName: paymentMethod === 'BankTransfer' ? selectedBank : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not place order.');
        return;
      }
      onOrderCreated(data as Order);
      if (isDirectBuy) {
        onCancelDirectBuy();
      } else {
        onClearCart();
      }
      setPlacedOrder(data as Order);
      setTxRef('');
      setStep('confirmed');
    } catch {
      setErrorMsg('Network error placing order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={dict.cart.title}
      onClick={handleDrawerClose}
    >
      <div
        className="flex h-full w-full max-w-lg flex-col bg-white dark:bg-[#16191F] border-l border-zinc-200 dark:border-zinc-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            {step === 'checkout' && !isDirectBuy && (
              <button
                type="button"
                onClick={() => setStep('bag')}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                aria-label={dict.cart.backToBag}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {step === 'bag'
                ? `${dict.cart.title} (${cart.reduce((s, i) => s + i.quantity, 0)})`
                : step === 'checkout'
                ? isDirectBuy
                  ? dict.cart.directCheckoutTitle
                  : dict.cart.checkoutTitle
                : dict.cart.orderConfirmed}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleDrawerClose}
            aria-label="Close drawer"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'confirmed' && placedOrder ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="font-display text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                {dict.cart.orderConfirmed}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6">
                Order <span className="font-mono-tabular font-semibold">{placedOrder.id}</span> ·{' '}
                {placedOrder.paymentMethod} ({placedOrder.paymentReference})
              </p>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-4 text-left text-sm space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">{dict.orders.deliverTo}</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 text-right">
                    {placedOrder.shippingAddress.township}, {placedOrder.shippingAddress.city}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 dark:text-zinc-400">{dict.cart.total}</span>
                  <span className="font-mono-tabular font-bold text-zinc-900 dark:text-zinc-100">
                    {formatMMK(placedOrder.total)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  handleDrawerClose();
                  onGoToOrders();
                }}
                className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 px-5 py-3 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                {dict.cart.viewTracking}
              </button>
            </div>
          ) : activeItems.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingBag className="mx-auto w-10 h-10 text-zinc-300 dark:text-zinc-600 mb-3" />
              <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                {dict.cart.emptyTitle}
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                {dict.cart.emptyDesc}
              </p>
              <button
                type="button"
                onClick={handleDrawerClose}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 cursor-pointer"
              >
                {dict.cart.browseShop}
              </button>
            </div>
          ) : step === 'bag' ? (
            <div className="space-y-4">
              {cart.map((item) => {
                const title = lang === 'mm' ? item.product.nameMm : item.product.name;
                return (
                  <div
                    key={`${item.product.id}-${item.variant}`}
                    className="flex gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                      <SmartImage
                        src={item.product.image}
                        alt={title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {title}
                        </h4>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.product.id, item.variant)}
                          aria-label="Remove item"
                          className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                        {item.variant}
                      </span>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.product.id, item.variant, -1)}
                            aria-label="Decrease quantity"
                            className="flex h-8 w-8 items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono-tabular px-2.5 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.product.id, item.variant, 1)}
                            aria-label="Increase quantity"
                            className="flex h-8 w-8 items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="font-mono-tabular text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatMMK(item.product.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Express Item Summary (Direct Buy Now) */}
              {isDirectBuy && directBuyItem && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2.5">
                    {dict.cart.instantPurchaseItem}
                  </div>
                  <div className="flex gap-3.5">
                    <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                      <SmartImage
                        src={directBuyItem.product.image}
                        alt={
                          lang === 'mm'
                            ? directBuyItem.product.nameMm
                            : directBuyItem.product.name
                        }
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col min-w-0">
                      <h4 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
                        {lang === 'mm'
                          ? directBuyItem.product.nameMm
                          : directBuyItem.product.name}
                      </h4>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                        {directBuyItem.variant}
                      </span>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                          <button
                            type="button"
                            disabled={directBuyItem.quantity <= 1}
                            onClick={() => onUpdateDirectBuyQty(-1)}
                            aria-label="Decrease quantity"
                            className="flex h-7 w-7 items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono-tabular px-2.5 text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            {directBuyItem.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={directBuyItem.quantity >= directBuyItem.product.stock}
                            onClick={() => onUpdateDirectBuyQty(1)}
                            aria-label="Increase quantity"
                            className="flex h-7 w-7 items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="font-mono-tabular text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatMMK(directBuyItem.product.price * directBuyItem.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Saved Delivery Address */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-zinc-500" />
                    <span>{dict.cart.deliveryAddress}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      handleDrawerClose();
                      onGoToProfile();
                    }}
                    className="text-xs font-medium text-zinc-600 dark:text-zinc-300 underline hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                  >
                    {dict.cart.addAddressQuick}
                  </button>
                </div>

                {addresses.length === 0 ? (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={quickAddr.recipientName}
                        onChange={(e) =>
                          setQuickAddr({ ...quickAddr, recipientName: e.target.value })
                        }
                        placeholder={dict.profile.recipientField}
                        className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                      />
                      <input
                        type="tel"
                        value={quickAddr.phone}
                        onChange={(e) => setQuickAddr({ ...quickAddr, phone: e.target.value })}
                        placeholder={dict.profile.phone}
                        className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-mono-tabular text-zinc-900 dark:text-zinc-100"
                      />
                      <input
                        type="text"
                        value={quickAddr.city}
                        onChange={(e) => setQuickAddr({ ...quickAddr, city: e.target.value })}
                        placeholder={dict.profile.cityField}
                        className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                      />
                      <input
                        type="text"
                        value={quickAddr.township}
                        onChange={(e) => setQuickAddr({ ...quickAddr, township: e.target.value })}
                        placeholder={dict.profile.townshipField}
                        className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <input
                      type="text"
                      value={quickAddr.streetAddress}
                      onChange={(e) =>
                        setQuickAddr({ ...quickAddr, streetAddress: e.target.value })
                      }
                      placeholder={dict.profile.streetField}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                    />
                    <button
                      type="button"
                      disabled={savingQuickAddr}
                      onClick={handleSaveQuickAddress}
                      className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      {dict.profile.saveAddress}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          selectedAddrId === addr.id
                            ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800/60'
                            : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="deliveryAddress"
                          checked={selectedAddrId === addr.id}
                          onChange={() => setSelectedAddrId(addr.id)}
                          className="mt-1 accent-zinc-900 dark:accent-zinc-100"
                        />
                        <div className="text-xs space-y-0.5">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {addr.label} · {addr.recipientName} ·{' '}
                            <span className="font-mono-tabular">{addr.phone}</span>
                          </div>
                          <div className="text-zinc-600 dark:text-zinc-300">
                            {addr.streetAddress}, {addr.township}, {addr.city}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Gateway Selector */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2.5">
                  {dict.cart.paymentMethod}
                </h3>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {(
                    [
                      ...(paymentSettings.kpay.enabled
                        ? [{ id: 'KPay' as const, label: dict.cart.kpayTitle, icon: Smartphone }]
                        : []),
                      ...(paymentSettings.wavepay.enabled
                        ? [{ id: 'WavePay' as const, label: dict.cart.waveTitle, icon: Smartphone }]
                        : []),
                      ...(enabledBanks.length > 0
                        ? [{ id: 'BankTransfer' as const, label: dict.cart.bankTitle, icon: Building2 }]
                        : []),
                    ]
                  ).map((gw) => {
                    const Icon = gw.icon;
                    const active = paymentMethod === gw.id;
                    return (
                      <button
                        key={gw.id}
                        type="button"
                        onClick={() => setPaymentMethod(gw.id)}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-center leading-tight">{gw.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Gateway Instructions & Account Details */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-4 space-y-3">
                  <p className="text-xs text-zinc-600 dark:text-zinc-300">
                    {dict.cart.scanOrTransfer}
                  </p>

                  {paymentMethod === 'BankTransfer' ? (
                    currentBank ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-1.5">
                          {enabledBanks.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => setSelectedBank(b.bankName)}
                              className={`rounded-md px-2.5 py-1.5 text-xs font-medium border cursor-pointer ${
                                selectedBank === b.bankName
                                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                              }`}
                            >
                              {b.bankName}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
                          <div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              {currentBank.bankName} · {currentBank.accountHolder}
                            </div>
                            <div className="font-mono-tabular text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {currentBank.accountNumber}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(currentBank.accountNumber)}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            {copiedAcc ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedAcc ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-500">No bank accounts enabled.</div>
                    )
                  ) : (
                    <div className="flex items-center gap-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                        {activeWallet.qrImage ? (
                          <img
                            src={activeWallet.qrImage}
                            alt={`${paymentMethod} QR`}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <QrCode className="w-10 h-10" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {paymentMethod === 'KPay' ? 'KBZPay Merchant' : 'WavePay Merchant'}
                        </div>
                        <div className="font-mono-tabular text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {activeWallet.phone}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          {activeWallet.accountName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(activeWallet.phone.replace(/-/g, ''))}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        {copiedAcc ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedAcc ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                      {dict.cart.txRefLabel}
                    </label>
                    <input
                      type="text"
                      value={txRef}
                      onChange={(e) => setTxRef(e.target.value)}
                      placeholder={dict.cart.txRefPlaceholder}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono-tabular text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{errorMsg}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer Totals */}
        {activeItems.length > 0 && step !== 'confirmed' && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 p-6 space-y-4 bg-zinc-50/70 dark:bg-zinc-900/40">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>{dict.cart.subtotal}</span>
                <span className="font-mono-tabular">{formatMMK(subtotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>{dict.cart.delivery}</span>
                <span className="font-mono-tabular">
                  {shippingFee === 0 ? dict.cart.free : formatMMK(shippingFee)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100">
                <span>{dict.cart.total}</span>
                <span className="font-mono-tabular text-base">{formatMMK(total)}</span>
              </div>
            </div>

            {step === 'bag' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 px-5 py-3 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer"
              >
                {dict.cart.proceedCheckout}
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handlePlaceOrder}
                className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 px-5 py-3 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {submitting ? dict.cart.placing : dict.cart.placeOrder}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
