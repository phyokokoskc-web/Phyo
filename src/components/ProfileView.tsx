import { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  Trash2,
  Check,
  Edit3,
  LogOut,
  Package,
  Heart,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { Address, Language, UserProfile } from '../types';
import { t } from '../i18n';
import { BuyerAuthPanel } from './BuyerAuthPanel';
import {
  deleteAddressDoc,
  saveAddressDoc,
  saveBuyerProfileDoc,
  setDefaultAddressDoc,
} from '../services/firestoreStore';

interface ProfileViewProps {
  isAuthenticated: boolean;
  authEmail?: string | null;
  authName?: string | null;
  authPhone?: string | null;
  buyerId: string;
  profile: UserProfile;
  addresses: Address[];
  ordersCount?: number;
  wishlistCount?: number;
  chatCount?: number;
  lang: Language;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSwitchAccount?: () => void;
  onGoToOrders?: () => void;
  onGoToWishlist?: () => void;
  onOpenChat?: () => void;
}

const emptyForm = {
  label: 'Home',
  recipientName: '',
  phone: '',
  city: 'Yangon',
  township: '',
  streetAddress: '',
  notes: '',
  isDefault: false,
};

export function ProfileView({
  isAuthenticated,
  authEmail,
  authName,
  authPhone,
  buyerId,
  profile,
  addresses,
  ordersCount = 0,
  wishlistCount = 0,
  chatCount = 0,
  lang,
  onSignInGoogle,
  onSignOut,
  onSwitchAccount,
  onGoToOrders,
  onGoToWishlist,
  onOpenChat,
}: ProfileViewProps) {
  const dict = t(lang);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [showAddrForm, setShowAddrForm] = useState(false);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState(emptyForm);
  const [savingAddr, setSavingAddr] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setEmail(profile.email);
    setPhone(profile.phone);
  }, [profile.id, profile.name, profile.email, profile.phone]);

  if (!isAuthenticated) {
    return (
      <section className="space-y-8">
        <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {dict.profile.heading}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{dict.profile.subtitle}</p>
        </div>

        <div className="max-w-lg rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-6">
          <BuyerAuthPanel
            lang={lang}
            onSignInGoogle={onSignInGoogle}
            title={dict.auth.buyerGateTitle}
            subtitle={dict.auth.buyerGateDesc}
          />
        </div>
      </section>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await saveBuyerProfileDoc(buyerId, { name, email, phone });
      setProfileSaved(true);
      window.setTimeout(() => setProfileSaved(false), 2000);
    } finally {
      setSavingProfile(false);
    }
  };

  const openNewAddress = () => {
    setEditingAddrId(null);
    setAddrForm({
      ...emptyForm,
      recipientName: profile.name === 'Guest Buyer' ? '' : profile.name,
      phone: profile.phone,
    });
    setShowAddrForm(true);
  };

  const openEditAddress = (addr: Address) => {
    setEditingAddrId(addr.id);
    setAddrForm({
      label: addr.label,
      recipientName: addr.recipientName,
      phone: addr.phone,
      city: addr.city,
      township: addr.township,
      streetAddress: addr.streetAddress,
      notes: addr.notes || '',
      isDefault: addr.isDefault,
    });
    setShowAddrForm(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAddr(true);
    try {
      await saveAddressDoc(
        buyerId,
        {
          ...(editingAddrId ? { id: editingAddrId } : {}),
          ...addrForm,
        },
        addresses,
        { name: authName || profile.name, email: authEmail || profile.email }
      );
      setShowAddrForm(false);
    } finally {
      setSavingAddr(false);
    }
  };

  const handleSetDefault = async (addrId: string) => {
    await setDefaultAddressDoc(buyerId, addrId, addresses);
  };

  const handleDeleteAddress = async (addrId: string) => {
    await deleteAddressDoc(buyerId, addrId, addresses);
  };

  return (
    <section className="space-y-8">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {dict.profile.heading}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{dict.profile.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] px-4 py-2.5">
          <div className="text-xs">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              {profile.name !== 'Guest Buyer' ? profile.name : authName || authPhone || 'Buyer'}
            </div>
            <div className="text-zinc-500 dark:text-zinc-400 font-mono-tabular">
              {authPhone || profile.phone || authEmail || profile.email}
            </div>
          </div>
          {onSwitchAccount && (
            <button
              type="button"
              onClick={onSwitchAccount}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{dict.profile.switchAccountBtn}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{dict.auth.signOut}</span>
          </button>
        </div>
      </div>

      {/* Synced Account & Returning History Summary */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{dict.profile.accountSection}</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {dict.profile.accountHint}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            {authPhone ? dict.profile.verifiedViaPhone : dict.profile.verifiedViaGmail}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={onGoToOrders}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 p-3.5 text-left hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span>{dict.profile.pastOrdersLabel}</span>
              <Package className="w-3.5 h-3.5" />
            </div>
            <div className="font-mono-tabular text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {ordersCount}
            </div>
            <div className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 underline mt-1">
              {dict.profile.viewOrdersBtn}
            </div>
          </button>

          <button
            type="button"
            onClick={onGoToWishlist}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 p-3.5 text-left hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span>{dict.profile.savedWishlistLabel}</span>
              <Heart className="w-3.5 h-3.5" />
            </div>
            <div className="font-mono-tabular text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {wishlistCount}
            </div>
            <div className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 underline mt-1">
              {dict.profile.viewWishlistBtn}
            </div>
          </button>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 p-3.5 text-left">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span>{dict.profile.savedAddressesLabel}</span>
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div className="font-mono-tabular text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {addresses.length}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenChat}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 p-3.5 text-left hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span>{dict.profile.chatHistoryLabel}</span>
              <MessageSquare className="w-3.5 h-3.5" />
            </div>
            <div className="font-mono-tabular text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {chatCount}
            </div>
            <div className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300 underline mt-1">
              {dict.profile.openChatBtn}
            </div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Account Form */}
        <form
          onSubmit={handleSaveProfile}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-6 space-y-4"
        >
          <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {dict.profile.personalInfo}
          </h2>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              {dict.profile.fullName}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              {dict.profile.email}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
              {dict.profile.phone}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono-tabular text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {profileSaved ? (
              <>
                <Check className="w-4 h-4" />
                <span>{dict.profile.savedSuccess}</span>
              </>
            ) : (
              <span>{dict.profile.saveProfile}</span>
            )}
          </button>
        </form>

        {/* Saved Addresses Manager */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-zinc-500" />
              <span>{dict.profile.addressesHeading}</span>
            </h2>
            <button
              type="button"
              onClick={openNewAddress}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3.5 py-2 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{dict.profile.addAddress}</span>
            </button>
          </div>

          {showAddrForm && (
            <form
              onSubmit={handleSaveAddress}
              className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#16191F] p-6 space-y-4"
            >
              <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {editingAddrId ? dict.profile.editAddress : dict.profile.addAddress}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {dict.profile.labelField}
                  </label>
                  <input
                    type="text"
                    required
                    value={addrForm.label}
                    onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {dict.profile.recipientField}
                  </label>
                  <input
                    type="text"
                    required
                    value={addrForm.recipientName}
                    onChange={(e) => setAddrForm({ ...addrForm, recipientName: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {dict.profile.phone}
                  </label>
                  <input
                    type="tel"
                    required
                    value={addrForm.phone}
                    onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono-tabular text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {dict.profile.cityField}
                    </label>
                    <input
                      type="text"
                      required
                      value={addrForm.city}
                      onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {dict.profile.townshipField}
                    </label>
                    <input
                      type="text"
                      required
                      value={addrForm.township}
                      onChange={(e) => setAddrForm({ ...addrForm, township: e.target.value })}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {dict.profile.streetField}
                </label>
                <input
                  type="text"
                  required
                  value={addrForm.streetAddress}
                  onChange={(e) => setAddrForm({ ...addrForm, streetAddress: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {dict.profile.notesField}
                </label>
                <input
                  type="text"
                  value={addrForm.notes}
                  onChange={(e) => setAddrForm({ ...addrForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addrForm.isDefault}
                  onChange={(e) => setAddrForm({ ...addrForm, isDefault: e.target.checked })}
                  className="rounded accent-zinc-900 dark:accent-zinc-100"
                />
                <span>{dict.profile.setDefault}</span>
              </label>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddrForm(false)}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
                >
                  {dict.profile.cancel}
                </button>
                <button
                  type="submit"
                  disabled={savingAddr}
                  className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 disabled:opacity-50 cursor-pointer"
                >
                  {dict.profile.saveAddress}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className="flex flex-col justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {addr.label}
                    </span>
                    {addr.isDefault && (
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        {dict.profile.defaultLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {addr.recipientName}
                  </p>
                  <p className="text-xs font-mono-tabular text-zinc-500 dark:text-zinc-400 mb-2">
                    {addr.phone}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {addr.streetAddress}, {addr.township}, {addr.city}
                  </p>
                  {addr.notes && (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{addr.notes}</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                  {!addr.isDefault ? (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(addr.id)}
                      className="font-medium text-zinc-600 dark:text-zinc-300 hover:underline cursor-pointer"
                    >
                      {dict.profile.setDefault}
                    </button>
                  ) : (
                    <span className="text-zinc-400">·</span>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openEditAddress(addr)}
                      className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{dict.profile.delete}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
