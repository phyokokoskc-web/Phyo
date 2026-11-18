import { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Check, Edit3, Users, UserPlus, LogIn } from 'lucide-react';
import type { Address, ChatThread, Language, Order, UserProfile } from '../types';
import { t } from '../i18n';

interface SwitchedAccountPayload {
  profile: UserProfile;
  addresses: Address[];
  wishlist: string[];
  orders: Order[];
  chatThreads: ChatThread[];
}

interface ProfileViewProps {
  buyerId: string;
  profile: UserProfile;
  addresses: Address[];
  lang: Language;
  onProfileSaved: (profile: UserProfile) => void;
  onAddressesUpdated: (addresses: Address[]) => void;
  onAccountSwitched: (nextBuyerId: string, data: SwitchedAccountPayload) => void;
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
  buyerId,
  profile,
  addresses,
  lang,
  onProfileSaved,
  onAddressesUpdated,
  onAccountSwitched,
}: ProfileViewProps) {
  const dict = t(lang);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [profileSaved, setProfileSaved] = useState(false);

  const [lookupInput, setLookupInput] = useState('');
  const [switchStatus, setSwitchStatus] = useState('');
  const [switchError, setSwitchError] = useState('');
  const [switching, setSwitching] = useState(false);

  const [showAddrForm, setShowAddrForm] = useState(false);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState(emptyForm);

  useEffect(() => {
    setName(profile.name);
    setEmail(profile.email);
    setPhone(profile.phone);
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerId, name, email, phone }),
    });
    if (res.ok) {
      const updated = (await res.json()) as UserProfile;
      onProfileSaved(updated);
      setProfileSaved(true);
      window.setTimeout(() => setProfileSaved(false), 2000);
    }
  };

  const handleFindAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSwitchError('');
    setSwitchStatus('');
    if (!lookupInput.trim()) return;
    setSwitching(true);
    try {
      const res = await fetch('/api/buyers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'find', identifier: lookupInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSwitchError(dict.profile.accountNotFound);
        return;
      }
      onAccountSwitched(data.buyerId, data);
      setLookupInput('');
      setSwitchStatus(dict.profile.switchedSuccess);
      window.setTimeout(() => setSwitchStatus(''), 2400);
    } finally {
      setSwitching(false);
    }
  };

  const handleCreateNewAccount = async () => {
    setSwitchError('');
    setSwitchStatus('');
    setSwitching(true);
    try {
      const res = await fetch('/api/buyers/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'new' }),
      });
      if (res.ok) {
        const data = await res.json();
        onAccountSwitched(data.buyerId, data);
        setSwitchStatus(dict.profile.switchedSuccess);
        window.setTimeout(() => setSwitchStatus(''), 2400);
      }
    } finally {
      setSwitching(false);
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
    const url = editingAddrId ? `/api/addresses/${editingAddrId}` : '/api/addresses';
    const method = editingAddrId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...addrForm, buyerId }),
    });
    if (res.ok) {
      const updated = (await res.json()) as Address[];
      onAddressesUpdated(updated);
      setShowAddrForm(false);
    }
  };

  const handleSetDefault = async (addrId: string) => {
    const res = await fetch(`/api/addresses/${addrId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerId, isDefault: true }),
    });
    if (res.ok) {
      onAddressesUpdated((await res.json()) as Address[]);
    }
  };

  const handleDeleteAddress = async (addrId: string) => {
    const res = await fetch(
      `/api/addresses/${addrId}?buyerId=${encodeURIComponent(buyerId)}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      onAddressesUpdated((await res.json()) as Address[]);
    }
  };

  return (
    <section className="space-y-8">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          {dict.profile.heading}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{dict.profile.subtitle}</p>
      </div>

      {/* Account Session & Multi-User Switcher */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <h2 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {dict.profile.accountSection}
            </h2>
            <span className="font-mono-tabular text-[11px] text-zinc-500 dark:text-zinc-400">
              ({buyerId})
            </span>
          </div>
          <button
            type="button"
            disabled={switching}
            onClick={handleCreateNewAccount}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{dict.profile.newAccount}</span>
          </button>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">{dict.profile.accountHint}</p>

        <form onSubmit={handleFindAccount} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={lookupInput}
            onChange={(e) => setLookupInput(e.target.value)}
            placeholder={dict.profile.findPlaceholder}
            className="flex-1 min-w-[220px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
          />
          <button
            type="submit"
            disabled={switching || !lookupInput.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 whitespace-nowrap cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{dict.profile.switchAccount}</span>
          </button>
        </form>

        {switchError && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">{switchError}</p>
        )}
        {switchStatus && (
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {switchStatus}
          </p>
        )}
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
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer"
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
                  className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 cursor-pointer"
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
