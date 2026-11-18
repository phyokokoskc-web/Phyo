import { useState, useMemo, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  MessageSquare,
  Plus,
  Edit3,
  Trash2,
  ArrowLeft,
  Search,
  Upload,
  X,
  Send,
  Wifi,
  WifiOff,
  CheckCircle2,
  Truck,
  PackageCheck,
  RotateCcw,
  Images,
  CreditCard,
  Check,
  Copy,
  Link2,
} from 'lucide-react';
import type {
  BankAccount,
  BannerSlide,
  ChatThread,
  Language,
  Order,
  OrderStatus,
  PaymentSettings,
  Product,
} from '../types';
import { formatDateTime, formatMMK, formatShortDate } from '../utils/format';
import { t } from '../i18n';
import { SmartImage } from './SmartImage';

interface AdminDashboardProps {
  lang: Language;
  products: Product[];
  categories: string[];
  banners: BannerSlide[];
  orders: Order[];
  chatThreads: ChatThread[];
  paymentSettings: PaymentSettings;
  analyticsResetAt?: string;
  connected: boolean;
  onExitAdmin: () => void;
  onProductCreated: (product: Product) => void;
  onProductUpdated: (product: Product) => void;
  onProductDeleted: (id: string) => void;
  onOrderUpdated: (order: Order) => void;
  onBannersUpdated: (banners: BannerSlide[]) => void;
  onCategoriesUpdated: (payload: {
    categories: string[];
    products: Product[];
    banners: BannerSlide[];
  }) => void;
  onPaymentSettingsUpdated: (settings: PaymentSettings) => void;
  onAnalyticsReset: (payload: {
    analyticsResetAt: string;
    clearOrders: boolean;
    orders: Order[];
    products: Product[];
  }) => void;
  onSendAdminChat: (threadId: string, text: string) => void;
  onMarkThreadRead: (threadId: string) => void;
}

type AdminTab = 'overview' | 'products' | 'orders' | 'storefront' | 'payments' | 'messages';

export function AdminDashboard({
  lang,
  products,
  categories,
  banners,
  orders,
  chatThreads,
  paymentSettings,
  analyticsResetAt,
  connected,
  onExitAdmin,
  onProductCreated,
  onProductUpdated,
  onProductDeleted,
  onOrderUpdated,
  onBannersUpdated,
  onCategoriesUpdated,
  onPaymentSettingsUpdated,
  onAnalyticsReset,
  onSendAdminChat,
  onMarkThreadRead,
}: AdminDashboardProps) {
  const dict = t(lang);
  const [tab, setTab] = useState<AdminTab>('overview');
  const [productSearch, setProductSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<OrderStatus | 'All'>('All');
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null);

  // Reset Analytics Modal state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetClearOrders, setResetClearOrders] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [copiedLinkKey, setCopiedLinkKey] = useState<'buyer' | 'seller' | null>(null);

  const originUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-pre-5aumizyvpixdghcn6lw3uk-646865261940.us-west2.run.app';
  const buyerLink = `${originUrl}/`;
  const sellerLink = `${originUrl}/seller`;

  const copyStoreLink = (key: 'buyer' | 'seller', url: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedLinkKey(key);
    window.setTimeout(() => setCopiedLinkKey((curr) => (curr === key ? null : curr)), 1800);
  };

  // Product Form Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState({
    name: '',
    nameMm: '',
    sku: '',
    category: categories[0] || 'Audio & Tech',
    price: 0,
    compareAtPrice: '',
    stock: 10,
    popular: false,
    image: '',
    variants: 'Standard',
    description: '',
    descriptionMm: '',
  });
  const [savingProd, setSavingProd] = useState(false);

  // Banner Form Modal state
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerSlide | null>(null);
  const [bannerForm, setBannerForm] = useState({
    kicker: '',
    kickerMm: '',
    title: '',
    titleMm: '',
    subtitle: '',
    subtitleMm: '',
    ctaLabel: 'Shop Now',
    ctaLabelMm: 'ကြည့်ရှုရန်',
    targetCategory: 'All',
    image: '',
  });
  const [savingBanner, setSavingBanner] = useState(false);

  // Category Management state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Payment Gateways Form state
  const [payDraft, setPayDraft] = useState<PaymentSettings>(paymentSettings);
  const [savingPay, setSavingPay] = useState(false);
  const [paySavedMsg, setPaySavedMsg] = useState(false);

  useEffect(() => {
    setPayDraft(paymentSettings);
  }, [paymentSettings]);

  // Admin Chat state
  const [activeThreadId, setActiveThreadId] = useState(chatThreads[0]?.id || 'thread-buyer-1');
  const [chatDraft, setChatDraft] = useState('');
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const activeThread = chatThreads.find((th) => th.id === activeThreadId) || chatThreads[0];
  const unreadTotal = chatThreads.reduce(
    (sum, th) => sum + th.messages.filter((m) => m.senderRole === 'buyer' && !m.read).length,
    0
  );

  useEffect(() => {
    if (tab === 'messages' && activeThread) {
      onMarkThreadRead(activeThread.id);
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tab, activeThread?.id, activeThread?.messages.length]);

  // Revenue & Sales Analytics (respects analyticsResetAt)
  const analytics = useMemo(() => {
    const validOrders = orders.filter((o) => {
      if (o.status === 'Cancelled') return false;
      if (analyticsResetAt && o.createdAt < analyticsResetAt) return false;
      return true;
    });
    const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);
    const aov = validOrders.length > 0 ? totalRevenue / validOrders.length : 0;

    const days: Array<{ key: string; label: string; revenue: number; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        key,
        label: formatShortDate(d.toISOString()),
        revenue: 0,
        count: 0,
      });
    }
    for (const o of validOrders) {
      const oKey = o.createdAt.slice(0, 10);
      const bucket = days.find((d) => d.key === oKey);
      if (bucket) {
        bucket.revenue += o.total;
        bucket.count += 1;
      }
    }

    const gatewayTotals = {
      KPay: validOrders.filter((o) => o.paymentMethod === 'KPay').reduce((s, o) => s + o.total, 0),
      WavePay: validOrders
        .filter((o) => o.paymentMethod === 'WavePay')
        .reduce((s, o) => s + o.total, 0),
      BankTransfer: validOrders
        .filter((o) => o.paymentMethod === 'BankTransfer')
        .reduce((s, o) => s + o.total, 0),
    };

    const lowStockCount = products.filter((p) => p.stock <= 5).length;
    const maxDayRevenue = Math.max(...days.map((d) => d.revenue), 100000);

    return {
      totalRevenue,
      orderCount: validOrders.length,
      aov,
      lowStockCount,
      days,
      maxDayRevenue,
      gatewayTotals,
    };
  }, [orders, products, analyticsResetAt]);

  const filteredProducts = products.filter((p) => {
    const q = productSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.nameMm.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const filteredOrders =
    orderFilter === 'All' ? orders : orders.filter((o) => o.status === orderFilter);

  const readFileAsDataUrl = (file: File, onLoad: (result: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onLoad(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Product Actions
  const openAddProduct = () => {
    setEditingProd(null);
    setProdForm({
      name: '',
      nameMm: '',
      sku: `YG-${Math.floor(100 + Math.random() * 900)}`,
      category: categories[0] || 'Audio & Tech',
      price: 95000,
      compareAtPrice: '',
      stock: 15,
      popular: false,
      image: '/src/assets/images/prod_ceramic_set_1794984090569.jpg',
      variants: 'Standard',
      description: '',
      descriptionMm: '',
    });
    setModalOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProd(p);
    setProdForm({
      name: p.name,
      nameMm: p.nameMm,
      sku: p.sku,
      category: p.category,
      price: p.price,
      compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : '',
      stock: p.stock,
      popular: p.popular,
      image: p.image,
      variants: p.variants.join(', '),
      description: p.description,
      descriptionMm: p.descriptionMm,
    });
    setModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProd(true);
    try {
      const payload = {
        name: prodForm.name,
        nameMm: prodForm.nameMm || prodForm.name,
        sku: prodForm.sku,
        category: prodForm.category,
        price: Number(prodForm.price),
        compareAtPrice: prodForm.compareAtPrice ? Number(prodForm.compareAtPrice) : undefined,
        stock: Number(prodForm.stock),
        popular: prodForm.popular,
        image: prodForm.image,
        variants: prodForm.variants
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
        description: prodForm.description,
        descriptionMm: prodForm.descriptionMm || prodForm.description,
      };
      const url = editingProd ? `/api/products/${editingProd.id}` : '/api/products';
      const method = editingProd ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved = (await res.json()) as Product;
        if (editingProd) {
          onProductUpdated(saved);
        } else {
          onProductCreated(saved);
        }
        setModalOpen(false);
      }
    } finally {
      setSavingProd(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      onProductDeleted(id);
    }
  };

  const handleQuickPatchProduct = async (product: Product, patch: Partial<Product>) => {
    const res = await fetch(`/api/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      onProductUpdated((await res.json()) as Product);
    }
  };

  // Order Actions
  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      onOrderUpdated((await res.json()) as Order);
    }
  };

  // Reset Analytics Action
  const handleConfirmResetAnalytics = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/analytics/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearOrders: resetClearOrders }),
      });
      if (res.ok) {
        const data = await res.json();
        onAnalyticsReset(data);
        setResetModalOpen(false);
        setResetClearOrders(false);
      }
    } finally {
      setResetting(false);
    }
  };

  // Banner CRUD Actions
  const openAddBanner = () => {
    setEditingBanner(null);
    setBannerForm({
      kicker: 'Featured Collection',
      kickerMm: 'အထူးကဏ္ဍ',
      title: '',
      titleMm: '',
      subtitle: '',
      subtitleMm: '',
      ctaLabel: 'Shop Collection',
      ctaLabelMm: 'ကြည့်ရှုရန်',
      targetCategory: categories[0] || 'All',
      image: '/src/assets/images/banner_tech_audio_1794984087921.jpg',
    });
    setBannerModalOpen(true);
  };

  const openEditBanner = (b: BannerSlide) => {
    setEditingBanner(b);
    setBannerForm({
      kicker: b.kicker,
      kickerMm: b.kickerMm,
      title: b.title,
      titleMm: b.titleMm,
      subtitle: b.subtitle,
      subtitleMm: b.subtitleMm,
      ctaLabel: b.ctaLabel,
      ctaLabelMm: b.ctaLabelMm,
      targetCategory: b.targetCategory,
      image: b.image,
    });
    setBannerModalOpen(true);
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBanner(true);
    try {
      const url = editingBanner ? `/api/banners/${editingBanner.id}` : '/api/banners';
      const method = editingBanner ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bannerForm),
      });
      if (res.ok) {
        onBannersUpdated((await res.json()) as BannerSlide[]);
        setBannerModalOpen(false);
      }
    } finally {
      setSavingBanner(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    const res = await fetch(`/api/banners/${id}`, { method: 'DELETE' });
    if (res.ok) {
      onBannersUpdated((await res.json()) as BannerSlide[]);
    }
  };

  // Category CRUD Actions
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategoryName.trim() }),
    });
    if (res.ok) {
      onCategoriesUpdated(await res.json());
      setNewCategoryName('');
    }
  };

  const handleRenameCategory = async (oldName: string) => {
    if (!renameValue.trim() || renameValue.trim() === oldName) {
      setRenamingCat(null);
      return;
    }
    const res = await fetch(`/api/categories/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName: renameValue.trim() }),
    });
    if (res.ok) {
      onCategoriesUpdated(await res.json());
      setRenamingCat(null);
    }
  };

  const handleDeleteCategory = async (cat: string) => {
    const res = await fetch(`/api/categories/${encodeURIComponent(cat)}`, { method: 'DELETE' });
    if (res.ok) {
      onCategoriesUpdated(await res.json());
    }
  };

  // Payment Gateways Actions
  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPay(true);
    try {
      const res = await fetch('/api/payment-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payDraft),
      });
      if (res.ok) {
        onPaymentSettingsUpdated((await res.json()) as PaymentSettings);
        setPaySavedMsg(true);
        window.setTimeout(() => setPaySavedMsg(false), 2400);
      }
    } finally {
      setSavingPay(false);
    }
  };

  const handleAddBankAccount = () => {
    const next: BankAccount = {
      id: `bank-${Date.now()}`,
      bankName: 'UAB Bank',
      accountNumber: '',
      accountHolder: 'Su&KoKo Co., Ltd',
      enabled: true,
    };
    setPayDraft((prev) => ({ ...prev, bankAccounts: [...prev.bankAccounts, next] }));
  };

  const handleUpdateBank = (id: string, patch: Partial<BankAccount>) => {
    setPayDraft((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  };

  const handleRemoveBank = (id: string) => {
    setPayDraft((prev) => ({
      ...prev,
      bankAccounts: prev.bankAccounts.filter((b) => b.id !== id),
    }));
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || !chatDraft.trim()) return;
    onSendAdminChat(activeThread.id, chatDraft.trim());
    setChatDraft('');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col lg:flex-row rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 p-4 flex flex-col justify-between">
        <div>
          <div className="px-2 pb-4 mb-3 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="font-display text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {dict.admin.title}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
              {connected ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Live Sync Active</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-600" />
                  <span>Reconnecting</span>
                </>
              )}
            </p>
          </div>

          <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5">
            {(
              [
                { id: 'overview', label: dict.admin.overview, icon: LayoutDashboard },
                { id: 'products', label: dict.admin.products, icon: Package },
                { id: 'orders', label: dict.admin.orders, icon: ClipboardList },
                { id: 'storefront', label: dict.admin.storefrontTab, icon: Images },
                { id: 'payments', label: dict.admin.paymentsTab, icon: CreditCard },
                { id: 'messages', label: dict.admin.messages, icon: MessageSquare, badge: unreadTotal },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {'badge' in item && item.badge ? (
                    <span className="font-mono-tabular text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={onExitAdmin}
          className="mt-4 hidden lg:inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{dict.admin.backToStore}</span>
        </button>
      </aside>

      {/* Main Admin Workspace */}
      <div className="flex-1 min-w-0 p-5 sm:p-8 space-y-6">
        {/* Contextual Top Breadcrumb Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            <span>{dict.admin.title}</span>
            <span className="mx-2">/</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {tab === 'overview'
                ? dict.admin.overview
                : tab === 'products'
                ? dict.admin.products
                : tab === 'orders'
                ? dict.admin.orders
                : tab === 'storefront'
                ? dict.admin.storefrontTab
                : tab === 'payments'
                ? dict.admin.paymentsTab
                : dict.admin.messages}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExitAdmin}
              className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{dict.admin.backToStore}</span>
            </button>
            {tab === 'overview' && (
              <button
                type="button"
                onClick={() => setResetModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 px-3.5 py-2 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{dict.admin.resetAnalytics}</span>
              </button>
            )}
            <button
              type="button"
              onClick={openAddProduct}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3.5 py-2 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{dict.admin.addProduct}</span>
            </button>
          </div>
        </div>

        {/* OVERVIEW TAB */}
        {tab === 'overview' && (
          <div className="space-y-8">
            {analyticsResetAt && (
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-2.5 text-xs text-zinc-600 dark:text-zinc-300">
                <span>
                  Metrics counting orders since reset on{' '}
                  <span className="font-mono-tabular font-semibold">
                    {formatDateTime(analyticsResetAt)}
                  </span>
                </span>
              </div>
            )}

            {/* 4 KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                  {dict.admin.kpiRevenue}
                </div>
                <div className="font-mono-tabular text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {formatMMK(analytics.totalRevenue)}
                </div>
                <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  All verified & active orders
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                  {dict.admin.kpiOrders}
                </div>
                <div className="font-mono-tabular text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {analytics.orderCount}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {orders.filter((o) => o.status === 'Pending').length} pending verification
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                  {dict.admin.kpiAov}
                </div>
                <div className="font-mono-tabular text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {formatMMK(analytics.aov)}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Free shipping over Ks 150,000
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                  {dict.admin.kpiCatalog}
                </div>
                <div className="font-mono-tabular text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {products.length}
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  {analytics.lowStockCount} low stock items
                </div>
              </div>
            </div>

            {/* Chart + Payment Gateway Split */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {dict.admin.revenueChartTitle}
                  </h3>
                  {hoveredBarIdx !== null && (
                    <span className="font-mono-tabular text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      {analytics.days[hoveredBarIdx].label}:{' '}
                      {formatMMK(analytics.days[hoveredBarIdx].revenue)} (
                      {analytics.days[hoveredBarIdx].count} orders)
                    </span>
                  )}
                </div>

                <div className="h-56 flex items-end gap-3 pt-4">
                  {analytics.days.map((day, idx) => {
                    const pct = Math.max(
                      day.revenue > 0 ? 10 : 3,
                      Math.round((day.revenue / analytics.maxDayRevenue) * 100)
                    );
                    return (
                      <div
                        key={day.key}
                        onMouseEnter={() => setHoveredBarIdx(idx)}
                        onMouseLeave={() => setHoveredBarIdx(null)}
                        className="flex-1 flex flex-col items-center h-full justify-end gap-2 group cursor-pointer"
                      >
                        <div className="w-full flex-1 flex items-end">
                          <div
                            style={{ height: `${pct}%` }}
                            className={`w-full rounded-t-md transition-colors ${
                              day.revenue > 0
                                ? 'bg-zinc-900 group-hover:bg-zinc-700 dark:bg-zinc-100 dark:group-hover:bg-zinc-300'
                                : 'bg-zinc-200 dark:bg-zinc-800'
                            }`}
                          />
                        </div>
                        <span className="font-mono-tabular text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                          {day.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-5">
                    {dict.admin.paymentSplitTitle}
                  </h3>
                  <div className="space-y-4">
                    {(
                      [
                        { label: 'KBZPay (KPay)', val: analytics.gatewayTotals.KPay },
                        { label: 'WavePay', val: analytics.gatewayTotals.WavePay },
                        { label: 'Bank Transfer', val: analytics.gatewayTotals.BankTransfer },
                      ] as const
                    ).map((gw) => {
                      const pct =
                        analytics.totalRevenue > 0
                          ? Math.round((gw.val / analytics.totalRevenue) * 100)
                          : 0;
                      return (
                        <div key={gw.label} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">
                              {gw.label}
                            </span>
                            <span className="font-mono-tabular text-zinc-900 dark:text-zinc-100 font-semibold">
                              {formatMMK(gw.val)} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 mt-6 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                  Real-time ledger updates automatically when orders are verified or placed.
                </div>
              </div>
            </div>

            {/* Recent Orders Feed */}
            <div>
              <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                {dict.admin.recentOrdersTitle}
              </h3>
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="py-3 px-4 font-medium">Order ID</th>
                      <th className="py-3 px-4 font-medium">Customer</th>
                      <th className="py-3 px-4 font-medium">Gateway</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-zinc-500">
                          No orders recorded yet.
                        </td>
                      </tr>
                    ) : (
                      orders.slice(0, 6).map((order) => (
                        <tr
                          key={order.id}
                          className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40"
                        >
                          <td className="py-3 px-4 font-mono-tabular font-semibold text-zinc-900 dark:text-zinc-100">
                            {order.id}
                          </td>
                          <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                            {order.customerName}
                          </td>
                          <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                            {order.paymentMethod} ·{' '}
                            <span className="font-mono-tabular">{order.paymentReference}</span>
                          </td>
                          <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                            {dict.orders.steps[order.status]}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-zinc-900 dark:text-zinc-100">
                            {formatMMK(order.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Saved Store Links */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <h3 className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {lang === 'mm' ? 'သိမ်းဆည်းထားသော ဆိုင် Link များ' : 'Saved Store Links'}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      Buyer Storefront
                    </div>
                    <div className="font-mono-tabular text-xs text-zinc-900 dark:text-zinc-100 truncate">
                      {buyerLink}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyStoreLink('buyer', buyerLink)}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0 cursor-pointer"
                  >
                    {copiedLinkKey === 'buyer' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedLinkKey === 'buyer' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      Seller Console
                    </div>
                    <div className="font-mono-tabular text-xs text-zinc-900 dark:text-zinc-100 truncate">
                      {sellerLink}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyStoreLink('seller', sellerLink)}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0 cursor-pointer"
                  >
                    {copiedLinkKey === 'seller' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedLinkKey === 'seller' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS & PRICING TAB */}
        {tab === 'products' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search SKU, name, or category..."
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono-tabular">
                {filteredProducts.length} items
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-4 font-medium">Product</th>
                    <th className="py-3 px-4 font-medium">Category</th>
                    <th className="py-3 px-4 font-medium text-right">Price (MMK)</th>
                    <th className="py-3 px-4 font-medium text-right">Stock</th>
                    <th className="py-3 px-4 font-medium text-center">Popular</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-12 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
                            <SmartImage
                              src={p.image}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {lang === 'mm' ? p.nameMm : p.name}
                            </div>
                            <div className="font-mono-tabular text-[11px] text-zinc-500">
                              {p.sku}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-600 dark:text-zinc-300">{p.category}</td>
                      <td className="py-3 px-4 text-right">
                        <input
                          type="number"
                          aria-label={`Price for ${p.name}`}
                          defaultValue={p.price}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (val >= 0 && val !== p.price) {
                              handleQuickPatchProduct(p, { price: val });
                            }
                          }}
                          className="w-28 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-right font-mono-tabular text-zinc-900 dark:text-zinc-100"
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <input
                          type="number"
                          aria-label={`Stock for ${p.name}`}
                          defaultValue={p.stock}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (val >= 0 && val !== p.stock) {
                              handleQuickPatchProduct(p, { stock: val });
                            }
                          }}
                          className="w-16 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-right font-mono-tabular text-zinc-900 dark:text-zinc-100"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={p.popular}
                          onChange={(e) =>
                            handleQuickPatchProduct(p, { popular: e.target.checked })
                          }
                          aria-label={`Toggle popular for ${p.name}`}
                          className="accent-zinc-900 dark:accent-zinc-100 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditProduct(p)}
                            aria-label={`Edit ${p.name}`}
                            className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p.id)}
                            aria-label={`Delete ${p.name}`}
                            className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ORDERS MANAGEMENT TAB */}
        {tab === 'orders' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 w-fit">
              {(['All', 'Pending', 'Verified', 'Shipped', 'Delivered', 'Cancelled'] as const).map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setOrderFilter(st)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      orderFilter === st
                        ? 'bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    {st === 'All' ? 'All' : dict.orders.steps[st]}
                  </button>
                )
              )}
            </div>

            <div className="space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-10 text-center text-xs text-zinc-500">
                  No orders in this status.
                </div>
              ) : (
                filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono-tabular text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {order.id}
                        </span>
                        <span className="text-zinc-400">·</span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {order.customerName}
                        </span>
                        <span className="text-zinc-400">·</span>
                        <span className="font-mono-tabular text-zinc-500">
                          {order.customerPhone}
                        </span>
                        <span className="text-zinc-400">·</span>
                        <span className="text-zinc-600 dark:text-zinc-300">
                          {order.paymentMethod} ({order.paymentReference})
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                          {dict.orders.steps[order.status]}
                        </span>
                        <span className="font-mono-tabular text-sm font-bold text-zinc-900 dark:text-zinc-100">
                          {formatMMK(order.total)}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {order.shippingAddress.streetAddress}, {order.shippingAddress.township},{' '}
                      {order.shippingAddress.city} ·{' '}
                      {order.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      {order.status === 'Pending' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderStatus(order.id, 'Verified')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{dict.admin.verifyPayment}</span>
                        </button>
                      )}
                      {(order.status === 'Pending' || order.status === 'Verified') && (
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderStatus(order.id, 'Shipped')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>{dict.admin.shipOrder}</span>
                        </button>
                      )}
                      {order.status === 'Shipped' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderStatus(order.id, 'Delivered')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 cursor-pointer"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>{dict.admin.deliverOrder}</span>
                        </button>
                      )}
                      {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderStatus(order.id, 'Cancelled')}
                          className="ml-auto text-xs font-medium text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                        >
                          {dict.admin.cancelOrder}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* BANNERS & CATEGORIES TAB */}
        {tab === 'storefront' && (
          <div className="space-y-8">
            {/* Banner Slides Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    Home Hero Banner Slides ({banners.length})
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Edit campaign headlines, target categories, and slider images synced live to storefront.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openAddBanner}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3.5 py-2 text-xs font-semibold text-white dark:text-zinc-900 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{dict.admin.addBanner}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {banners.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
                  >
                    <div className="aspect-[16/9] w-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
                      <SmartImage
                        src={b.image}
                        alt={b.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {b.kicker} · Target: <span className="font-semibold">{b.targetCategory}</span>
                        </div>
                        <h4 className="font-display text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                          {lang === 'mm' ? b.titleMm : b.title}
                        </h4>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-1">
                          {lang === 'mm' ? b.subtitleMm : b.subtitle}
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={() => openEditBanner(b)}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBanner(b.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Categories Section */}
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
              <div>
                <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Product Categories ({categories.length})
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Renaming a category automatically updates all matching products and banner links.
                </p>
              </div>

              <form onSubmit={handleAddCategory} className="flex items-center gap-2 max-w-md">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name (e.g. Skincare & Fragrance)"
                  className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{dict.admin.addCategory}</span>
                </button>
              </form>

              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800">
                {categories.map((cat) => {
                  const count = products.filter((p) => p.category === cat).length;
                  const isRenaming = renamingCat === cat;
                  return (
                    <div key={cat} className="flex items-center justify-between gap-4 px-4 py-3 text-xs">
                      {isRenaming ? (
                        <div className="flex items-center gap-2 flex-1 max-w-sm">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="flex-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100"
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameCategory(cat)}
                            className="rounded bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingCat(null)}
                            className="rounded border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{cat}</span>
                          <span className="text-zinc-500 dark:text-zinc-400 font-mono-tabular">
                            {count} products
                          </span>
                        </div>
                      )}

                      {!isRenaming && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingCat(cat);
                              setRenameValue(cat);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{dict.admin.renameCategory}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            disabled={categories.length <= 1}
                            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PAYMENT GATEWAYS TAB (KPay, WavePay, Mobile Banking) */}
        {tab === 'payments' && (
          <form onSubmit={handleSavePaymentSettings} className="space-y-6 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* KBZPay Settings */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    KBZPay (KPay)
                  </h3>
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={payDraft.kpay.enabled}
                      onChange={(e) =>
                        setPayDraft((p) => ({
                          ...p,
                          kpay: { ...p.kpay, enabled: e.target.checked },
                        }))
                      }
                      className="accent-zinc-900 dark:accent-zinc-100"
                    />
                    <span>Enabled</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Merchant / Account Name
                  </label>
                  <input
                    type="text"
                    value={payDraft.kpay.accountName}
                    onChange={(e) =>
                      setPayDraft((p) => ({
                        ...p,
                        kpay: { ...p.kpay, accountName: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    KPay Phone Number
                  </label>
                  <input
                    type="text"
                    value={payDraft.kpay.phone}
                    onChange={(e) =>
                      setPayDraft((p) => ({
                        ...p,
                        kpay: { ...p.kpay, phone: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-mono-tabular text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    KPay QR Image (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={payDraft.kpay.qrImage || ''}
                      onChange={(e) =>
                        setPayDraft((p) => ({
                          ...p,
                          kpay: { ...p.kpay, qrImage: e.target.value },
                        }))
                      }
                      placeholder="QR image URL or upload..."
                      className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                    />
                    <label className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-2 text-xs font-medium cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap">
                      <Upload className="w-3.5 h-3.5" />
                      <span>QR</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            readFileAsDataUrl(f, (res) =>
                              setPayDraft((p) => ({ ...p, kpay: { ...p.kpay, qrImage: res } }))
                            );
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* WavePay Settings */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    WavePay
                  </h3>
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={payDraft.wavepay.enabled}
                      onChange={(e) =>
                        setPayDraft((p) => ({
                          ...p,
                          wavepay: { ...p.wavepay, enabled: e.target.checked },
                        }))
                      }
                      className="accent-zinc-900 dark:accent-zinc-100"
                    />
                    <span>Enabled</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Merchant / Account Name
                  </label>
                  <input
                    type="text"
                    value={payDraft.wavepay.accountName}
                    onChange={(e) =>
                      setPayDraft((p) => ({
                        ...p,
                        wavepay: { ...p.wavepay, accountName: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    WavePay Phone Number
                  </label>
                  <input
                    type="text"
                    value={payDraft.wavepay.phone}
                    onChange={(e) =>
                      setPayDraft((p) => ({
                        ...p,
                        wavepay: { ...p.wavepay, phone: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-mono-tabular text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    WavePay QR Image (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={payDraft.wavepay.qrImage || ''}
                      onChange={(e) =>
                        setPayDraft((p) => ({
                          ...p,
                          wavepay: { ...p.wavepay, qrImage: e.target.value },
                        }))
                      }
                      placeholder="QR image URL or upload..."
                      className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                    />
                    <label className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-2 text-xs font-medium cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap">
                      <Upload className="w-3.5 h-3.5" />
                      <span>QR</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            readFileAsDataUrl(f, (res) =>
                              setPayDraft((p) => ({
                                ...p,
                                wavepay: { ...p.wavepay, qrImage: res },
                              }))
                            );
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Banking / Bank Transfer Accounts */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Mobile Banking & Bank Transfer Accounts
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Edit bank names, account numbers, and account holder names shown at checkout.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddBankAccount}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{dict.admin.addBank}</span>
                </button>
              </div>

              <div className="space-y-3">
                {payDraft.bankAccounts.map((bank) => (
                  <div
                    key={bank.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-3"
                  >
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        value={bank.bankName}
                        onChange={(e) => handleUpdateBank(bank.id, { bankName: e.target.value })}
                        placeholder="Bank Name"
                        className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={bank.accountNumber}
                        onChange={(e) =>
                          handleUpdateBank(bank.id, { accountNumber: e.target.value })
                        }
                        placeholder="Account Number"
                        className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-mono-tabular text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        value={bank.accountHolder}
                        onChange={(e) =>
                          handleUpdateBank(bank.id, { accountHolder: e.target.value })
                        }
                        placeholder="Account Holder"
                        className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-center justify-end gap-3">
                      <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bank.enabled}
                          onChange={(e) => handleUpdateBank(bank.id, { enabled: e.target.checked })}
                          className="accent-zinc-900 dark:accent-zinc-100"
                        />
                        <span>Active</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveBank(bank.id)}
                        aria-label="Remove bank"
                        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={savingPay}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-5 py-2.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
              >
                {paySavedMsg ? <Check className="w-4 h-4" /> : null}
                <span>{paySavedMsg ? dict.admin.paymentsSaved : dict.admin.savePayments}</span>
              </button>
            </div>
          </form>
        )}

        {/* LIVE MESSAGES TAB */}
        {tab === 'messages' && (
          <div className="grid grid-cols-1 md:grid-cols-3 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden h-[520px]">
            <div className="border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto">
              {chatThreads.map((th) => {
                const unread = th.messages.filter(
                  (m) => m.senderRole === 'buyer' && !m.read
                ).length;
                const lastMsg = th.messages[th.messages.length - 1];
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => {
                      setActiveThreadId(th.id);
                      onMarkThreadRead(th.id);
                    }}
                    className={`w-full text-left p-4 border-b border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer ${
                      activeThread?.id === th.id
                        ? 'bg-zinc-100 dark:bg-zinc-800/70'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                        {th.buyerName}
                      </span>
                      {unread > 0 && (
                        <span className="font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950">
                          {unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                      {lastMsg?.text || 'No messages yet'}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="md:col-span-2 flex flex-col h-full">
              {activeThread ? (
                <>
                  <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/40">
                    <div>
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {activeThread.buyerName}
                      </div>
                      <div className="text-[11px] font-mono-tabular text-zinc-500">
                        {activeThread.buyerPhone}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {activeThread.messages.map((msg) => {
                      const isAdmin = msg.senderRole === 'admin';
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                        >
                          {msg.contextTag && (
                            <span className="text-[11px] text-zinc-500 mb-1">
                              Re: {msg.contextTag}
                            </span>
                          )}
                          <div
                            className={`max-w-[80%] rounded-xl px-3.5 py-2 text-xs sm:text-sm ${
                              isAdmin
                                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                                : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                            }`}
                          >
                            {msg.text}
                          </div>
                          <span className="text-[10px] text-zinc-400 mt-1 font-mono-tabular">
                            {formatDateTime(msg.createdAt)}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={chatBottomRef} />
                  </div>
                  <form
                    onSubmit={handleSendChat}
                    className="flex items-center gap-2 p-3 border-t border-zinc-200 dark:border-zinc-800"
                  >
                    <input
                      type="text"
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      placeholder="Reply to customer in real time..."
                      className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100"
                    />
                    <button
                      type="submit"
                      disabled={!chatDraft.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 disabled:opacity-40 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">
                  Select a buyer conversation
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reset Analytics Confirmation Modal */}
      {resetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          onClick={() => setResetModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-6 space-y-4 shadow-2xl"
          >
            <h3 className="font-display text-base font-bold text-zinc-900 dark:text-zinc-100">
              {dict.admin.resetConfirmTitle}
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {dict.admin.resetConfirmDesc}
            </p>
            <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={resetClearOrders}
                onChange={(e) => setResetClearOrders(e.target.checked)}
                className="accent-red-600"
              />
              <span>{dict.admin.resetAlsoOrders}</span>
            </label>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                {dict.profile.cancel}
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={handleConfirmResetAnalytics}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {dict.admin.confirmReset}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Banner Modal */}
      {bannerModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          onClick={() => setBannerModalOpen(false)}
        >
          <form
            onSubmit={handleSaveBanner}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {editingBanner ? dict.admin.editBanner : dict.admin.addBanner}
              </h3>
              <button
                type="button"
                onClick={() => setBannerModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Title (EN)
                </label>
                <input
                  type="text"
                  required
                  value={bannerForm.title}
                  onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Title (MM)
                </label>
                <input
                  type="text"
                  value={bannerForm.titleMm}
                  onChange={(e) => setBannerForm({ ...bannerForm, titleMm: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Kicker (EN)
                </label>
                <input
                  type="text"
                  value={bannerForm.kicker}
                  onChange={(e) => setBannerForm({ ...bannerForm, kicker: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Kicker (MM)
                </label>
                <input
                  type="text"
                  value={bannerForm.kickerMm}
                  onChange={(e) => setBannerForm({ ...bannerForm, kickerMm: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  CTA Button Label (EN)
                </label>
                <input
                  type="text"
                  value={bannerForm.ctaLabel}
                  onChange={(e) => setBannerForm({ ...bannerForm, ctaLabel: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Target Category
                </label>
                <select
                  value={bannerForm.targetCategory}
                  onChange={(e) =>
                    setBannerForm({ ...bannerForm, targetCategory: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                >
                  <option value="All">All</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Subtitle (EN)
                </label>
                <textarea
                  rows={2}
                  value={bannerForm.subtitle}
                  onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Subtitle (MM)
                </label>
                <textarea
                  rows={2}
                  value={bannerForm.subtitleMm}
                  onChange={(e) => setBannerForm({ ...bannerForm, subtitleMm: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Banner Image (16:9 URL or Upload)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={bannerForm.image}
                  onChange={(e) => setBannerForm({ ...bannerForm, image: e.target.value })}
                  className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{dict.admin.uploadImage}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        readFileAsDataUrl(f, (res) =>
                          setBannerForm((prev) => ({ ...prev, image: res }))
                        );
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setBannerModalOpen(false)}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                {dict.profile.cancel}
              </button>
              <button
                type="submit"
                disabled={savingBanner}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-5 py-2 text-xs font-semibold text-white dark:text-zinc-900 cursor-pointer"
              >
                Save Banner
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          onClick={() => setModalOpen(false)}
        >
          <form
            onSubmit={handleSaveProduct}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {editingProd ? dict.admin.editProduct : dict.admin.addProduct}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {dict.admin.productName}
                </label>
                <input
                  type="text"
                  required
                  value={prodForm.name}
                  onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {dict.admin.productNameMm}
                </label>
                <input
                  type="text"
                  value={prodForm.nameMm}
                  onChange={(e) => setProdForm({ ...prodForm, nameMm: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {dict.admin.sku}
                </label>
                <input
                  type="text"
                  required
                  value={prodForm.sku}
                  onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono-tabular text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {dict.admin.category}
                </label>
                <input
                  type="text"
                  list="category-options"
                  required
                  value={prodForm.category}
                  onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
                <datalist id="category-options">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {dict.admin.price}
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={prodForm.price}
                  onChange={(e) => setProdForm({ ...prodForm, price: Number(e.target.value) })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono-tabular text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {dict.admin.comparePrice}
                </label>
                <input
                  type="number"
                  min={0}
                  value={prodForm.compareAtPrice}
                  onChange={(e) => setProdForm({ ...prodForm, compareAtPrice: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono-tabular text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {dict.admin.stock}
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={prodForm.stock}
                  onChange={(e) => setProdForm({ ...prodForm, stock: Number(e.target.value) })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono-tabular text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {dict.admin.variantsLabel}
                </label>
                <input
                  type="text"
                  value={prodForm.variants}
                  onChange={(e) => setProdForm({ ...prodForm, variants: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                {dict.admin.imageLabel}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={prodForm.image}
                  onChange={(e) => setProdForm({ ...prodForm, image: e.target.value })}
                  className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{dict.admin.uploadImage}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        readFileAsDataUrl(f, (res) =>
                          setProdForm((prev) => ({ ...prev, image: res }))
                        );
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {dict.admin.descLabel}
                </label>
                <textarea
                  rows={2}
                  value={prodForm.description}
                  onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  {dict.admin.descMmLabel}
                </label>
                <textarea
                  rows={2}
                  value={prodForm.descriptionMm}
                  onChange={(e) => setProdForm({ ...prodForm, descriptionMm: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={prodForm.popular}
                onChange={(e) => setProdForm({ ...prodForm, popular: e.target.checked })}
                className="accent-zinc-900 dark:accent-zinc-100"
              />
              <span>{dict.admin.popularFlag}</span>
            </label>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
              >
                {dict.profile.cancel}
              </button>
              <button
                type="submit"
                disabled={savingProd}
                className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-5 py-2 text-xs font-semibold text-white dark:text-zinc-900 cursor-pointer"
              >
                {dict.admin.saveProduct}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
