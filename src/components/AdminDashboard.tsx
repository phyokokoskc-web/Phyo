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
  LogOut,
  RefreshCw,
  LayoutGrid,
  List,
  Star,
  ImagePlus,
  Loader2,
  Bell,
  BellRing,
  Smartphone,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import type {
  BankAccount,
  BannerSlide,
  ChatThread,
  Language,
  NotificationType,
  Order,
  OrderStatus,
  PaymentSettings,
  Product,
  StoreBrandConfig,
  StoreNotification,
} from '../types';
import { auth, db } from '../firebase';
import { formatDateTime, formatMMK, formatShortDate } from '../utils/format';
import { readImageFileAsDataUrl } from '../utils/image';
import { t } from '../i18n';
import { SmartImage } from './SmartImage';
import { StoreLogoBanner } from './StoreLogoBanner';
import { fetchPushPublicKey } from '../services/pushNotifications';
import {
  deleteBannerDoc,
  deleteCategoryBatch,
  deleteNotificationDoc,
  deleteProductDoc,
  dispatchBackgroundWebPush,
  quickPatchProductDoc,
  renameCategoryBatch,
  resetAnalyticsBatch,
  saveBannerDoc,
  saveCategoriesList,
  savePaymentConfigDoc,
  saveProductDoc,
  saveStoreBrandDoc,
  sendNotificationDoc,
  syncLocalSeedToFirestoreIfEmpty,
  updateOrderStatusDoc,
} from '../services/firestoreStore';

interface AdminDashboardProps {
  lang: Language;
  adminEmail?: string | null;
  products: Product[];
  categories: string[];
  banners: BannerSlide[];
  orders: Order[];
  chatThreads: ChatThread[];
  notifications: StoreNotification[];
  activeThreadId?: string;
  paymentSettings: PaymentSettings;
  brand: StoreBrandConfig;
  analyticsResetAt?: string;
  connected: boolean;
  chatSyncError?: string;
  loadingActiveThread?: boolean;
  onExitAdmin: () => void;
  onSignOut?: () => void;
  onSelectThread?: (threadId: string) => void;
  onSendAdminChat: (threadId: string, text: string, imageUrl?: string) => Promise<void> | void;
  onDeleteAdminMessage?: (threadId: string, messageId: string) => Promise<void>;
  onMarkThreadRead: (threadId: string) => void;
}

type AdminTab =
  | 'overview'
  | 'products'
  | 'orders'
  | 'storefront'
  | 'payments'
  | 'messages'
  | 'notifications';

export function AdminDashboard({
  lang,
  adminEmail,
  products,
  categories,
  banners,
  orders,
  chatThreads,
  notifications,
  activeThreadId: controlledThreadId,
  paymentSettings,
  brand,
  analyticsResetAt,
  connected,
  chatSyncError,
  loadingActiveThread = false,
  onExitAdmin,
  onSignOut,
  onSelectThread,
  onSendAdminChat,
  onDeleteAdminMessage,
  onMarkThreadRead,
}: AdminDashboardProps) {
  const dict = t(lang);
  const [tab, setTab] = useState<AdminTab>('overview');
  const [adminError, setAdminError] = useState('');
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productViewMode, setProductViewMode] = useState<'grid2' | 'list'>(() => {
    try {
      const saved = window.localStorage.getItem('yg_admin_prod_layout');
      if (saved === 'list' || saved === 'grid2') return saved;
    } catch {
      // ignore
    }
    return 'grid2';
  });
  const updateProductViewMode = (mode: 'grid2' | 'list') => {
    setProductViewMode(mode);
    try {
      window.localStorage.setItem('yg_admin_prod_layout', mode);
    } catch {
      // ignore
    }
  };
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
    images: ['', '', ''] as [string, string, string],
    variants: 'Standard',
    description: '',
    descriptionMm: '',
  });
  const [savingProd, setSavingProd] = useState(false);
  const [prodSaveError, setProdSaveError] = useState('');

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
  const [bannerSaveError, setBannerSaveError] = useState('');

  // Category Management state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Store Brand & Logo Banner Form state
  const [brandDraft, setBrandDraft] = useState<StoreBrandConfig>(brand);
  const lastBrandSigRef = useRef(JSON.stringify(brand));
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandSavedMsg, setBrandSavedMsg] = useState(false);
  const [brandSaveError, setBrandSaveError] = useState('');

  useEffect(() => {
    const nextSig = JSON.stringify(brand);
    if (nextSig !== lastBrandSigRef.current) {
      lastBrandSigRef.current = nextSig;
      setBrandDraft(brand);
    }
  }, [brand]);

  // Payment Gateways Form state
  const [payDraft, setPayDraft] = useState<PaymentSettings>(paymentSettings);
  const lastPaySigRef = useRef(JSON.stringify(paymentSettings));
  const [savingPay, setSavingPay] = useState(false);
  const [paySavedMsg, setPaySavedMsg] = useState(false);

  useEffect(() => {
    const nextSig = JSON.stringify(paymentSettings);
    if (nextSig !== lastPaySigRef.current) {
      lastPaySigRef.current = nextSig;
      setPayDraft(paymentSettings);
    }
  }, [paymentSettings]);

  // Admin Chat state
  const [localThreadId, setLocalThreadId] = useState(chatThreads[0]?.id || '');
  const activeThreadId = controlledThreadId || localThreadId || chatThreads[0]?.id || '';
  const setActiveThreadId = (id: string) => {
    setLocalThreadId(id);
    onSelectThread?.(id);
  };
  const [chatDraft, setChatDraft] = useState('');
  const [chatAttachedImage, setChatAttachedImage] = useState('');
  const [threadSearch, setThreadSearch] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatError, setChatError] = useState('');
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<string | null>(null);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const [chatLightboxImage, setChatLightboxImage] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const adminChatFileRef = useRef<HTMLInputElement | null>(null);

  // Seller -> Buyer Real-Time Notifications State
  const [notifTargetId, setNotifTargetId] = useState<string>('all');
  const [notifType, setNotifType] = useState<NotificationType>('promo');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifActionTarget, setNotifActionTarget] = useState<string>('none');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState(false);
  const [notifError, setNotifError] = useState('');
  const [confirmDeleteNotifId, setConfirmDeleteNotifId] = useState<string | null>(null);
  const [deletingNotifId, setDeletingNotifId] = useState<string | null>(null);
  const [pushServerConfigured, setPushServerConfigured] = useState<boolean | null>(null);
  const [subscribedDeviceCount, setSubscribedDeviceCount] = useState<number>(0);
  const [lastPushResult, setLastPushResult] = useState<{
    configured: boolean;
    sent: number;
    totalTargets: number;
  } | null>(null);

  useEffect(() => {
    if (tab !== 'notifications') return;
    let active = true;
    void fetchPushPublicKey().then((res) => {
      if (active) setPushServerConfigured(res.configured);
    });
    const unsub = onSnapshot(
      collection(db, 'pushSubscriptions'),
      (snap) => {
        if (!active) return;
        let count = 0;
        snap.forEach((docSnap) => {
          const data = docSnap.data() as { enabled?: boolean; endpoint?: string };
          if (data && data.enabled !== false && data.endpoint) count += 1;
        });
        setSubscribedDeviceCount(count);
      },
      () => {
        // Ignore transient permission errors
      }
    );
    return () => {
      active = false;
      unsub();
    };
  }, [tab]);

  const knownBuyers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; phone: string }>();
    for (const o of orders) {
      if (o.buyerId && o.buyerId !== 'guest' && !map.has(o.buyerId)) {
        map.set(o.buyerId, {
          id: o.buyerId,
          name: o.customerName || 'Buyer',
          phone: o.customerPhone || '',
        });
      }
    }
    for (const th of chatThreads) {
      if (th.buyerId && th.buyerId !== 'guest' && !map.has(th.buyerId)) {
        map.set(th.buyerId, {
          id: th.buyerId,
          name: th.buyerName || 'Buyer',
          phone: th.buyerPhone || '',
        });
      }
    }
    return Array.from(map.values());
  }, [orders, chatThreads]);

  const openNotifyBuyer = (
    buyerIdVal: string,
    defaultType: NotificationType = 'order',
    defaultTitle = '',
    defaultAction = 'orders'
  ) => {
    setNotifTargetId(buyerIdVal || 'all');
    setNotifType(defaultType);
    if (defaultTitle) setNotifTitle(defaultTitle);
    setNotifActionTarget(defaultAction);
    setNotifError('');
    setNotifSuccess(false);
    setTab('notifications');
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim() || sendingNotif) return;
    setSendingNotif(true);
    setNotifError('');
    setNotifSuccess(false);
    setLastPushResult(null);
    const cleanTitle = notifTitle.trim();
    const cleanMsg = notifMessage.trim();
    const targetId = notifTargetId;
    const actionTarget = notifActionTarget;
    try {
      const targetBuyer =
        targetId === 'all'
          ? null
          : knownBuyers.find((b) => b.id === targetId) || null;
      const notifId = await sendNotificationDoc({
        targetBuyerId: targetId,
        targetBuyerName:
          targetId === 'all'
            ? dict.notifications.broadcastTag
            : targetBuyer?.name || 'Buyer',
        type: notifType,
        title: cleanTitle,
        message: cleanMsg,
        actionTarget,
        senderName: brand.storeName || dict.brand,
      });

      const idToken = await auth.currentUser?.getIdToken().catch(() => '');
      if (idToken) {
        const pushRes = await dispatchBackgroundWebPush({
          idToken,
          targetBuyerId: targetId,
          notifId,
          title: cleanTitle,
          message: cleanMsg,
          actionTarget,
        });
        setLastPushResult({
          configured: pushRes.configured,
          sent: pushRes.sent,
          totalTargets: pushRes.totalTargets,
        });
      }

      setNotifTitle('');
      setNotifMessage('');
      setNotifSuccess(true);
      window.setTimeout(() => setNotifSuccess(false), 4500);
    } catch {
      setNotifError(dict.notifications.sendError);
    } finally {
      setSendingNotif(false);
    }
  };

  const handleDeleteNotification = async (notifId: string) => {
    setDeletingNotifId(notifId);
    setNotifError('');
    try {
      await deleteNotificationDoc(notifId);
      setConfirmDeleteNotifId((curr) => (curr === notifId ? null : curr));
    } catch {
      setNotifError(dict.notifications.sendError);
    } finally {
      setDeletingNotifId(null);
    }
  };

  const filteredChatThreads = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return chatThreads;
    return chatThreads.filter((th) => {
      const meta = th as ChatThread & { lastMessagePreview?: string };
      return (
        th.buyerName.toLowerCase().includes(q) ||
        th.buyerPhone.toLowerCase().includes(q) ||
        (meta.lastMessagePreview || '').toLowerCase().includes(q)
      );
    });
  }, [chatThreads, threadSearch]);

  const activeThread = chatThreads.find((th) => th.id === activeThreadId) || chatThreads[0];
  const getThreadUnread = (th: ChatThread) => {
    const meta = th as ChatThread & { unreadByAdmin?: number };
    const msgCount = th.messages.filter((m) => m.senderRole === 'buyer' && !m.read).length;
    return Math.max(msgCount, Number(meta.unreadByAdmin || 0));
  };
  const unreadTotal = chatThreads.reduce((sum, th) => sum + getThreadUnread(th), 0);
  const activeThreadUnread = activeThread ? getThreadUnread(activeThread) : 0;

  useEffect(() => {
    if (!controlledThreadId && chatThreads.length > 0 && !chatThreads.some((c) => c.id === localThreadId)) {
      setActiveThreadId(chatThreads[0].id);
    }
  }, [chatThreads, controlledThreadId, localThreadId]);

  useEffect(() => {
    if (tab === 'messages' && activeThread) {
      if (activeThreadUnread > 0) {
        onMarkThreadRead(activeThread.id);
      }
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tab, activeThread?.id, activeThread?.messages.length, activeThreadUnread]);

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

  const readFileAsDataUrl = readImageFileAsDataUrl;

  const galleryCompression = { maxDim: 800, quality: 0.74, maxChars: 220000 };

  const getProductPhotos = (p: Product): string[] => {
    const list: string[] = [];
    for (const img of p.images || []) {
      const clean = (img || '').trim();
      if (clean && !list.includes(clean)) list.push(clean);
    }
    const primary = (p.image || '').trim();
    if (primary && !list.includes(primary)) {
      list.unshift(primary);
    }
    return list;
  };

  // Product Actions
  const openAddProduct = () => {
    setEditingProd(null);
    setProdSaveError('');
    setProdForm({
      name: '',
      nameMm: '',
      sku: `YG-${Math.floor(100 + Math.random() * 900)}`,
      category: categories[0] || 'Audio & Tech',
      price: 95000,
      compareAtPrice: '',
      stock: 15,
      popular: false,
      images: ['/src/assets/images/prod_ceramic_set_1794984090569.jpg', '', ''],
      variants: 'Standard',
      description: '',
      descriptionMm: '',
    });
    setModalOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProd(p);
    setProdSaveError('');
    const photos = getProductPhotos(p);
    setProdForm({
      name: p.name,
      nameMm: p.nameMm,
      sku: p.sku,
      category: p.category,
      price: p.price,
      compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : '',
      stock: p.stock,
      popular: p.popular,
      images: [photos[0] || '', photos[1] || '', photos[2] || ''],
      variants: p.variants.join(', '),
      description: p.description,
      descriptionMm: p.descriptionMm,
    });
    setModalOpen(true);
  };

  const updateProdImageSlot = (slotIdx: 0 | 1 | 2, val: string) => {
    setProdForm((prev) => {
      const next: [string, string, string] = [...prev.images] as [string, string, string];
      next[slotIdx] = val;
      return { ...prev, images: next };
    });
  };

  const handleBatchUploadProductImages = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selected = Array.from(files).slice(0, 3);
    selected.forEach((file, fileIdx) => {
      readFileAsDataUrl(
        file,
        (dataUrl) => {
          setProdForm((prev) => {
            const next: [string, string, string] = [...prev.images] as [string, string, string];
            // Fill first empty slot, or replace slot matching fileIdx when all filled
            const emptyIdx = next.findIndex((s) => !s.trim());
            const targetIdx = emptyIdx >= 0 ? emptyIdx : Math.min(2, fileIdx);
            next[targetIdx] = dataUrl;
            return { ...prev, images: next };
          });
        },
        galleryCompression
      );
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProdSaveError('');
    setAdminError('');
    setSavingProd(true);
    try {
      const parsedVariants = prodForm.variants
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      const cleanImages = prodForm.images.map((s) => s.trim()).filter(Boolean);
      const productPayload: Product = {
        id: editingProd ? editingProd.id : `prod-${Date.now()}`,
        sku: prodForm.sku.trim() || `YG-${Date.now().toString().slice(-4)}`,
        name: prodForm.name.trim(),
        nameMm: (prodForm.nameMm || prodForm.name).trim(),
        category: prodForm.category.trim() || categories[0] || 'General',
        price: Math.max(0, Number(prodForm.price) || 0),
        ...(prodForm.compareAtPrice ? { compareAtPrice: Number(prodForm.compareAtPrice) } : {}),
        stock: Math.max(0, Number(prodForm.stock) || 0),
        popular: prodForm.popular,
        rating: editingProd?.rating ?? 4.9,
        soldCount: editingProd?.soldCount ?? 0,
        image: cleanImages[0] || '',
        images: cleanImages,
        variants: parsedVariants.length > 0 ? parsedVariants : ['Standard'],
        description: prodForm.description,
        descriptionMm: prodForm.descriptionMm || prodForm.description,
        createdAt: editingProd?.createdAt || new Date().toISOString(),
      };
      await saveProductDoc(productPayload, Boolean(editingProd), categories, analyticsResetAt);
      setModalOpen(false);
    } catch {
      setProdSaveError('Could not save product to cloud database. Please verify connection and image size.');
    } finally {
      setSavingProd(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setAdminError('');
    try {
      await deleteProductDoc(id);
    } catch {
      setAdminError('Failed to delete product.');
    }
  };

  const handleQuickPatchProduct = async (product: Product, patch: Partial<Product>) => {
    setAdminError('');
    try {
      await quickPatchProductDoc(product, patch);
    } catch {
      setAdminError('Failed to update product.');
    }
  };

  // Order Actions
  const handleUpdateOrderStatus = async (order: Order, status: OrderStatus) => {
    setAdminError('');
    try {
      await updateOrderStatusDoc(order, status);
    } catch {
      setAdminError('Failed to update order status.');
    }
  };

  // Reset Analytics Action
  const handleConfirmResetAnalytics = async () => {
    setResetting(true);
    setAdminError('');
    try {
      await resetAnalyticsBatch(categories, products, orders, resetClearOrders);
      setResetModalOpen(false);
      setResetClearOrders(false);
    } catch {
      setAdminError('Failed to reset analytics.');
    } finally {
      setResetting(false);
    }
  };

  // Banner CRUD Actions
  const openAddBanner = () => {
    setEditingBanner(null);
    setBannerSaveError('');
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
    setBannerSaveError('');
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
    setBannerSaveError('');
    setSavingBanner(true);
    try {
      const existingIdx = editingBanner
        ? banners.findIndex((b) => b.id === editingBanner.id)
        : -1;
      await saveBannerDoc(
        {
          id: editingBanner ? editingBanner.id : `banner-${Date.now()}`,
          ...bannerForm,
          sortOrder: existingIdx >= 0 ? existingIdx : banners.length,
        },
        Boolean(editingBanner)
      );
      setBannerModalOpen(false);
    } catch {
      setBannerSaveError('Could not save banner to cloud database.');
    } finally {
      setSavingBanner(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    setAdminError('');
    try {
      await deleteBannerDoc(id);
    } catch {
      setAdminError('Failed to delete banner.');
    }
  };

  // Category CRUD Actions
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCategoryName.trim();
    if (!clean) return;
    setAdminError('');
    try {
      await saveCategoriesList([...categories, clean], analyticsResetAt);
      setNewCategoryName('');
    } catch {
      setAdminError('Failed to add category.');
    }
  };

  const handleRenameCategory = async (oldName: string) => {
    if (!renameValue.trim() || renameValue.trim() === oldName) {
      setRenamingCat(null);
      return;
    }
    setAdminError('');
    try {
      await renameCategoryBatch(
        oldName,
        renameValue.trim(),
        categories,
        products,
        banners,
        analyticsResetAt
      );
      setRenamingCat(null);
    } catch {
      setAdminError('Failed to rename category.');
    }
  };

  const handleDeleteCategory = async (cat: string) => {
    setAdminError('');
    try {
      await deleteCategoryBatch(cat, categories, products, banners, analyticsResetAt);
    } catch {
      setAdminError('Failed to delete category.');
    }
  };

  // Payment Gateways Actions
  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPay(true);
    setAdminError('');
    try {
      await savePaymentConfigDoc(payDraft);
      setPaySavedMsg(true);
      window.setTimeout(() => setPaySavedMsg(false), 2400);
    } catch {
      setAdminError('Failed to save payment settings.');
    } finally {
      setSavingPay(false);
    }
  };

  const handleManualSyncCloud = async () => {
    setSyncingCloud(true);
    setAdminError('');
    try {
      await syncLocalSeedToFirestoreIfEmpty();
    } catch {
      setAdminError('Could not sync seed catalog to cloud.');
    } finally {
      setSyncingCloud(false);
    }
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandDraft.storeName.trim()) {
      setBrandSaveError(lang === 'mm' ? 'ဆိုင်နာမည် ထည့်သွင်းပေးပါ။' : 'Store brand name is required.');
      return;
    }
    setSavingBrand(true);
    setBrandSaveError('');
    setAdminError('');
    try {
      await saveStoreBrandDoc(brandDraft, categories, analyticsResetAt);
      setBrandSavedMsg(true);
      window.setTimeout(() => setBrandSavedMsg(false), 2600);
    } catch {
      setBrandSaveError(
        lang === 'mm'
          ? 'ဆိုင်နာမည်နှင့် Logo Banner ကို သိမ်းဆည်းမရပါ။ ပုံအရွယ်အစားနှင့် အင်တာနက်ကို စစ်ဆေးပါ။'
          : 'Could not save brand & logo banner. Please check connection and image size.'
      );
    } finally {
      setSavingBrand(false);
    }
  };

  const handleAddBankAccount = () => {
    const next: BankAccount = {
      id: `bank-${Date.now()}`,
      bankName: 'UAB Bank',
      accountNumber: '',
      accountHolder: `${brand.storeName || 'Shoptopia'} Co., Ltd`,
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

  const handleAdminChatFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setChatError('');
    readImageFileAsDataUrl(file, (result) => {
      if (result.length > 780000) {
        setChatError(
          lang === 'mm'
            ? 'ပုံဖိုင်အရွယ်အစား ကြီးလွန်းပါသည်။ ပုံအသေးတစ်ခု ရွေးချယ်ပါ။'
            : 'Image is too large. Please choose a smaller photo.'
        );
        return;
      }
      setChatAttachedImage(result);
    });
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || sendingChat) return;
    const trimmed = chatDraft.trim();
    const pendingImg = chatAttachedImage;
    if (!trimmed && !pendingImg) return;
    setChatError('');
    setSendingChat(true);
    setChatDraft('');
    setChatAttachedImage('');
    try {
      await onSendAdminChat(activeThread.id, trimmed, pendingImg || undefined);
    } catch {
      setChatDraft(trimmed);
      setChatAttachedImage(pendingImg);
      setChatError(dict.chat.sendError);
    } finally {
      setSendingChat(false);
    }
  };

  const handleDeleteAdminMsg = async (threadId: string, messageId: string) => {
    if (!onDeleteAdminMessage || deletingMsgId) return;
    setChatError('');
    setDeletingMsgId(messageId);
    try {
      await onDeleteAdminMessage(threadId, messageId);
      setConfirmDeleteMsgId(null);
    } catch {
      setChatError(dict.chat.deleteError);
    } finally {
      setDeletingMsgId(null);
    }
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
                  <span>Cloud Live Sync Active</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-600" />
                  <span>Reconnecting</span>
                </>
              )}
            </p>
            {adminEmail && (
              <p className="text-[11px] font-mono-tabular text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                {adminEmail}
              </p>
            )}
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
                { id: 'notifications', label: dict.notifications.adminTab, icon: Bell },
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

        <div className="mt-4 hidden lg:flex flex-col gap-2">
          <button
            type="button"
            disabled={syncingCloud}
            onClick={handleManualSyncCloud}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingCloud ? 'animate-spin' : ''}`} />
            <span>{lang === 'mm' ? 'Cloud Sync စစ်ဆေးရန်' : 'Sync Cloud Catalog'}</span>
          </button>
          <button
            type="button"
            onClick={onExitAdmin}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{dict.admin.backToStore}</span>
          </button>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{dict.auth.signOut}</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Admin Workspace */}
      <div className="flex-1 min-w-0 p-5 sm:p-8 space-y-6">
        {adminError && (
          <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-4 py-2.5 text-xs font-medium text-red-700 dark:text-red-400">
            {adminError}
          </div>
        )}
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
                : tab === 'notifications'
                ? dict.notifications.adminTab
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

        {/* Home Page Logo Banner (Visible & Editable in Admin) */}
        <StoreLogoBanner
          brand={brand}
          lang={lang}
          isAdmin
          onEdit={() => setTab('storefront')}
        />

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
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search SKU, name, or category..."
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center gap-2.5 ml-auto">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono-tabular">
                  {filteredProducts.length} items
                </span>
                <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-0.5">
                  <button
                    type="button"
                    onClick={() => updateProductViewMode('grid2')}
                    aria-label={dict.home.grid2View}
                    title={dict.home.grid2View}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      productViewMode === 'grid2'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{dict.home.grid2View}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateProductViewMode('list')}
                    aria-label={dict.home.listView}
                    title={dict.home.listView}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      productViewMode === 'list'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{dict.home.listView}</span>
                  </button>
                </div>
              </div>
            </div>

            {productViewMode === 'grid2' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {filteredProducts.map((p) => (
                  <article
                    key={p.id}
                    className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] overflow-hidden"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                      <SmartImage
                        src={p.image}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                      {getProductPhotos(p).length > 1 && (
                        <div className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-mono-tabular font-medium text-white">
                          <Images className="w-2.5 h-2.5" />
                          <span>{getProductPhotos(p).length}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleQuickPatchProduct(p, { popular: !p.popular })}
                        aria-label={`Toggle popular for ${p.name}`}
                        title={dict.admin.popularFlag}
                        className={`absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                          p.popular
                            ? 'bg-amber-500 text-zinc-950 border-amber-500'
                            : 'bg-white/90 text-zinc-600 border-zinc-200 dark:bg-zinc-900/90 dark:text-zinc-300 dark:border-zinc-700'
                        }`}
                      >
                        <Star className={`w-3 h-3 ${p.popular ? 'fill-current' : ''}`} />
                        <span className="hidden sm:inline">{dict.home.popularTag}</span>
                      </button>
                    </div>

                    <div className="flex flex-1 flex-col p-2.5 sm:p-4 space-y-2.5">
                      <div>
                        <div className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 truncate font-mono-tabular">
                          {p.sku} · {p.category}
                        </div>
                        <h3 className="font-display text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-snug mt-0.5">
                          {lang === 'mm' ? p.nameMm : p.name}
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 mt-auto pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-0.5">MMK</label>
                          <input
                            key={`g-price-${p.id}-${p.price}`}
                            type="number"
                            aria-label={`Price for ${p.name}`}
                            defaultValue={p.price}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (val >= 0 && val !== p.price) {
                                handleQuickPatchProduct(p, { price: val });
                              }
                            }}
                            className="w-full min-w-0 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1.5 py-1 text-[11px] sm:text-xs font-mono-tabular text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-0.5">Stock</label>
                          <input
                            key={`g-stock-${p.id}-${p.stock}`}
                            type="number"
                            aria-label={`Stock for ${p.name}`}
                            defaultValue={p.stock}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (val >= 0 && val !== p.stock) {
                                handleQuickPatchProduct(p, { stock: val });
                              }
                            }}
                            className="w-full min-w-0 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1.5 py-1 text-[11px] sm:text-xs font-mono-tabular text-zinc-900 dark:text-zinc-100"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditProduct(p)}
                          aria-label={`Edit ${p.name}`}
                          className="inline-flex items-center justify-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 py-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p.id)}
                          aria-label={`Delete ${p.name}`}
                          className="inline-flex items-center justify-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 py-1.5 text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Del</span>
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <>
                {/* Mobile 1-Column List Cards */}
                <div className="space-y-2.5 md:hidden">
                  {filteredProducts.map((p) => (
                    <article
                      key={p.id}
                      className="flex gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-3"
                    >
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                        <SmartImage
                          src={p.image}
                          alt={p.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex flex-1 flex-col min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                              {lang === 'mm' ? p.nameMm : p.name}
                            </div>
                            <div className="font-mono-tabular text-[11px] text-zinc-500 truncate">
                              {p.sku} · {p.category}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuickPatchProduct(p, { popular: !p.popular })}
                            aria-label={`Toggle popular for ${p.name}`}
                            className={`p-1 rounded border cursor-pointer ${
                              p.popular
                                ? 'bg-amber-500 text-zinc-950 border-amber-500'
                                : 'text-zinc-400 border-zinc-200 dark:border-zinc-700'
                            }`}
                          >
                            <Star className={`w-3 h-3 ${p.popular ? 'fill-current' : ''}`} />
                          </button>
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <input
                            key={`l-price-${p.id}-${p.price}`}
                            type="number"
                            aria-label={`Price for ${p.name}`}
                            defaultValue={p.price}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (val >= 0 && val !== p.price) {
                                handleQuickPatchProduct(p, { price: val });
                              }
                            }}
                            className="w-24 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs font-mono-tabular text-zinc-900 dark:text-zinc-100"
                          />
                          <input
                            key={`l-stock-${p.id}-${p.stock}`}
                            type="number"
                            aria-label={`Stock for ${p.name}`}
                            defaultValue={p.stock}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (val >= 0 && val !== p.stock) {
                                handleQuickPatchProduct(p, { stock: val });
                              }
                            }}
                            className="w-14 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs font-mono-tabular text-zinc-900 dark:text-zinc-100"
                          />
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditProduct(p)}
                              aria-label={`Edit ${p.name}`}
                              className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p.id)}
                              aria-label={`Delete ${p.name}`}
                              className="p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-red-600 dark:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
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
                              key={`price-${p.id}-${p.price}`}
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
                              key={`stock-${p.id}-${p.stock}`}
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
              </>
            )}
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
                          onClick={() => handleUpdateOrderStatus(order, 'Verified')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{dict.admin.verifyPayment}</span>
                        </button>
                      )}
                      {(order.status === 'Pending' || order.status === 'Verified') && (
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderStatus(order, 'Shipped')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>{dict.admin.shipOrder}</span>
                        </button>
                      )}
                      {order.status === 'Shipped' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderStatus(order, 'Delivered')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 cursor-pointer"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>{dict.admin.deliverOrder}</span>
                        </button>
                      )}
                      {order.buyerId && order.buyerId !== 'guest' && (
                        <button
                          type="button"
                          onClick={() =>
                            openNotifyBuyer(
                              order.buyerId,
                              'order',
                              lang === 'mm'
                                ? `အော်ဒါ ${order.id} အခြေအနေ`
                                : `Order ${order.id} Update`,
                              'orders'
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span>{dict.notifications.notifyBuyerShortcut}</span>
                        </button>
                      )}
                      {order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateOrderStatus(order, 'Cancelled')}
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

        {/* BRAND, BANNERS & CATEGORIES TAB */}
        {tab === 'storefront' && (
          <div className="space-y-8">
            {/* Store Brand Name & Home Logo Banner Editor */}
            <form
              onSubmit={handleSaveBrand}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 p-5 space-y-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {dict.admin.brandSectionTitle}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {dict.admin.brandSectionDesc}
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={brandDraft.showLogoBanner}
                    onChange={(e) =>
                      setBrandDraft((b) => ({ ...b, showLogoBanner: e.target.checked }))
                    }
                    className="accent-zinc-900 dark:accent-zinc-100"
                  />
                  <span>{dict.admin.showLogoBannerLabel}</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {dict.admin.storeNameLabel} *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={brandDraft.storeName}
                    onChange={(e) =>
                      setBrandDraft((b) => ({ ...b, storeName: e.target.value }))
                    }
                    placeholder={dict.admin.storeNamePlaceholder}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {dict.admin.logoImageLabel}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={brandDraft.logoImage}
                      onChange={(e) =>
                        setBrandDraft((b) => ({ ...b, logoImage: e.target.value }))
                      }
                      placeholder="https://... or upload logo image"
                      className="flex-1 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                    />
                    <label className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer whitespace-nowrap shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{dict.admin.uploadImage}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            readFileAsDataUrl(f, (res) =>
                              setBrandDraft((b) => ({ ...b, logoImage: res }))
                            );
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {brandDraft.logoImage && (
                      <button
                        type="button"
                        onClick={() => setBrandDraft((b) => ({ ...b, logoImage: '' }))}
                        className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {dict.admin.clearLogoImage}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {dict.admin.bannerHeadlineEnLabel}
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={brandDraft.bannerTitle}
                    onChange={(e) =>
                      setBrandDraft((b) => ({ ...b, bannerTitle: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {dict.admin.bannerHeadlineMmLabel}
                  </label>
                  <input
                    type="text"
                    maxLength={180}
                    value={brandDraft.bannerTitleMm}
                    onChange={(e) =>
                      setBrandDraft((b) => ({ ...b, bannerTitleMm: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {dict.admin.bannerSubtitleEnLabel}
                  </label>
                  <input
                    type="text"
                    maxLength={240}
                    value={brandDraft.bannerSubtitle}
                    onChange={(e) =>
                      setBrandDraft((b) => ({ ...b, bannerSubtitle: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {dict.admin.bannerSubtitleMmLabel}
                  </label>
                  <input
                    type="text"
                    maxLength={300}
                    value={brandDraft.bannerSubtitleMm}
                    onChange={(e) =>
                      setBrandDraft((b) => ({ ...b, bannerSubtitleMm: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Live Draft Preview */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  {lang === 'mm' ? 'ကြိုတင်မြင်ကွင်း (Live Preview)' : 'Live Preview'}
                </span>
                <StoreLogoBanner brand={brandDraft} lang={lang} />
              </div>

              {brandSaveError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {brandSaveError}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={savingBrand}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingBrand ? dict.admin.savingBrandBtn : dict.admin.saveBrandBtn}</span>
                </button>
                {brandSavedMsg && (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {dict.admin.brandSavedMsg}
                  </span>
                )}
              </div>
            </form>

            {/* Banner Slides Section */}
            <div className="pt-2 space-y-4">
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
          <div className="flex flex-col md:grid md:grid-cols-3 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden h-[min(640px,calc(100dvh-10rem))] md:h-[560px]">
            <div className="shrink-0 max-h-44 md:max-h-none md:h-full border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
              <div className="shrink-0 p-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={threadSearch}
                    onChange={(e) => setThreadSearch(e.target.value)}
                    placeholder={dict.chat.searchThreads}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {chatThreads.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                    {dict.chat.noThreads}
                  </div>
                ) : filteredChatThreads.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
                    {dict.chat.noMatchingThreads}
                  </div>
                ) : (
                  filteredChatThreads.map((th) => {
                    const meta = th as ChatThread & { lastMessagePreview?: string };
                    const unread = getThreadUnread(th);
                    const lastMsg = th.messages[th.messages.length - 1];
                    return (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => {
                          setChatError('');
                          setActiveThreadId(th.id);
                          if (unread > 0) {
                            onMarkThreadRead(th.id);
                          }
                        }}
                        className={`w-full text-left p-3.5 md:p-4 border-b border-zinc-100 dark:border-zinc-800 transition-colors cursor-pointer ${
                          activeThread?.id === th.id
                            ? 'bg-zinc-100 dark:bg-zinc-800/70'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                            {th.buyerName}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {th.lastMessageAt && (
                              <span className="font-mono-tabular text-[10px] text-zinc-400 dark:text-zinc-500">
                                {formatShortDate(th.lastMessageAt)}
                              </span>
                            )}
                            {unread > 0 && (
                              <span className="font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950">
                                {unread}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                          {lastMsg?.text ||
                            (lastMsg?.imageUrl ? `[${dict.chat.photoTag}]` : '') ||
                            meta.lastMessagePreview ||
                            dict.chat.noThreads}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 md:col-span-2 flex flex-col md:h-full overflow-hidden">
              {activeThread ? (
                <>
                  <div className="shrink-0 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 bg-zinc-50/50 dark:bg-zinc-900/40">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {activeThread.buyerName}
                      </div>
                      {activeThread.buyerPhone && (
                        <div className="text-[11px] font-mono-tabular text-zinc-500 truncate">
                          {activeThread.buyerPhone}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {activeThread.buyerId && activeThread.buyerId !== 'guest' && (
                        <button
                          type="button"
                          onClick={() =>
                            openNotifyBuyer(activeThread.buyerId, 'info', '', 'chat')
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          <Bell className="w-3 h-3" />
                          <span>{dict.notifications.notifyBuyerShortcut}</span>
                        </button>
                      )}
                      {activeThread.messages.length > 0 && (
                        <span className="shrink-0 font-mono-tabular text-[11px] text-zinc-500 dark:text-zinc-400">
                          {activeThread.messages.length} {dict.chat.messagesUnit}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                    {loadingActiveThread && activeThread.messages.length === 0 ? (
                      <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400">
                        {dict.chat.loadingHistory}
                      </div>
                    ) : (
                      activeThread.messages.map((msg, idx) => {
                        const isAdmin = msg.senderRole === 'admin';
                        const dayLabel = formatShortDate(msg.createdAt);
                        const prevDayLabel =
                          idx > 0 ? formatShortDate(activeThread.messages[idx - 1].createdAt) : '';
                        const showDateDivider = idx === 0 || dayLabel !== prevDayLabel;
                        const isConfirming = confirmDeleteMsgId === msg.id;
                        const isDeleting = deletingMsgId === msg.id;
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
                            <div
                              className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                            >
                              {msg.contextTag && (
                                <span className="text-[11px] text-zinc-500 mb-1">
                                  Re: {msg.contextTag}
                                </span>
                              )}
                              <div
                                className={`max-w-[80%] break-words rounded-xl overflow-hidden ${
                                  msg.imageUrl && !msg.text ? 'p-1.5' : 'px-3.5 py-2'
                                } text-xs sm:text-sm space-y-2 ${
                                  isAdmin
                                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                                    : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                                }`}
                              >
                                {msg.imageUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setChatLightboxImage(msg.imageUrl || null)}
                                    className="block w-full overflow-hidden rounded-lg bg-black/5 dark:bg-white/5 cursor-zoom-in"
                                  >
                                    <img
                                      src={msg.imageUrl}
                                      alt={msg.text || dict.chat.photoTag}
                                      className="max-h-60 w-auto max-w-full rounded-lg object-contain"
                                    />
                                  </button>
                                )}
                                {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-zinc-400 font-mono-tabular">
                                  {formatDateTime(msg.createdAt)}
                                </span>
                                {onDeleteAdminMessage && (
                                  isConfirming ? (
                                    <span className="inline-flex items-center gap-1.5 text-[10px]">
                                      <button
                                        type="button"
                                        disabled={isDeleting}
                                        onClick={() => void handleDeleteAdminMsg(activeThread.id, msg.id)}
                                        className="font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 cursor-pointer"
                                      >
                                        {isDeleting ? dict.chat.deleting : dict.chat.confirmDeleteMessage}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isDeleting}
                                        onClick={() => setConfirmDeleteMsgId(null)}
                                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                      >
                                        {dict.chat.cancelDelete}
                                      </button>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteMsgId(msg.id)}
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
                      })
                    )}
                    <div ref={chatBottomRef} />
                  </div>
                  {(chatError || chatSyncError) && (
                    <div className="shrink-0 px-4 py-2 bg-red-50 dark:bg-red-950/40 border-t border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                      {chatError || chatSyncError}
                    </div>
                  )}
                  {chatAttachedImage && (
                    <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/80 border-t border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={chatAttachedImage}
                          alt={dict.chat.photoTag}
                          className="h-12 w-12 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                        />
                        <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                          {dict.chat.photoTag}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setChatAttachedImage('')}
                        aria-label={dict.chat.removeImage}
                        title={dict.chat.removeImage}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <form
                    onSubmit={handleSendChat}
                    className="shrink-0 flex items-center gap-2 p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F]"
                  >
                    <input
                      ref={adminChatFileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAdminChatFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={sendingChat}
                      onClick={() => adminChatFileRef.current?.click()}
                      aria-label={dict.chat.attachImage}
                      title={dict.chat.attachImage}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                    >
                      <ImagePlus className="w-4 h-4" />
                    </button>
                    <input
                      type="text"
                      value={chatDraft}
                      onChange={(e) => {
                        setChatDraft(e.target.value);
                        if (chatError) setChatError('');
                      }}
                      disabled={sendingChat}
                      placeholder={
                        chatAttachedImage ? dict.chat.photoPlaceholder : dict.chat.replyPlaceholder
                      }
                      className="flex-1 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={(!chatDraft.trim() && !chatAttachedImage) || sendingChat}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 disabled:opacity-40 cursor-pointer"
                    >
                      {sendingChat ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{sendingChat ? dict.chat.sending : dict.chat.send}</span>
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-zinc-500 p-6 text-center">
                  {dict.chat.selectThread}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BUYER REAL-TIME NOTIFICATIONS TAB */}
        {tab === 'notifications' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Composer */}
            <form
              onSubmit={handleSendNotification}
              className="lg:col-span-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 p-5 space-y-4 h-fit"
            >
              <div>
                <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {dict.notifications.composerTitle}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {dict.notifications.composerSub}
                </p>
              </div>

              {/* Background Phone Notification Bar Readiness Box */}
              <div
                className={`rounded-lg border px-3.5 py-2.5 text-[11px] space-y-1 ${
                  pushServerConfigured
                    ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                    : 'border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    {pushServerConfigured ? (
                      <BellRing className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Smartphone className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{dict.notifications.pushSellerDevicesLabel}:</span>
                  </span>
                  <span className="font-mono-tabular text-xs font-bold">
                    {subscribedDeviceCount}
                  </span>
                </div>
                <p className="leading-relaxed opacity-90">
                  {pushServerConfigured === false
                    ? dict.notifications.pushSellerOpenTabOnlyNote
                    : dict.notifications.pushSellerReadyNote}
                </p>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  {dict.notifications.quickPresetsLabel}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNotifType('promo');
                      setNotifTitle(dict.notifications.presetPromoTitle);
                      setNotifMessage(dict.notifications.presetPromoMsg);
                      setNotifActionTarget('shop');
                    }}
                    className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    {dict.notifications.types.promo}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifType('restock');
                      setNotifTitle(dict.notifications.presetRestockTitle);
                      setNotifMessage(dict.notifications.presetRestockMsg);
                      setNotifActionTarget('shop');
                    }}
                    className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    {dict.notifications.types.restock}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifType('info');
                      setNotifTitle(dict.notifications.presetDeliveryTitle);
                      setNotifMessage(dict.notifications.presetDeliveryMsg);
                      setNotifActionTarget('orders');
                    }}
                    className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    {dict.notifications.types.info}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {dict.notifications.targetLabel}
                  </label>
                  <select
                    value={notifTargetId}
                    onChange={(e) => setNotifTargetId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="all">{dict.notifications.allBuyersOption}</option>
                    {knownBuyers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.phone ? `(${b.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {dict.notifications.typeLabel}
                  </label>
                  <select
                    value={notifType}
                    onChange={(e) => setNotifType(e.target.value as NotificationType)}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="promo">{dict.notifications.types.promo}</option>
                    <option value="restock">{dict.notifications.types.restock}</option>
                    <option value="order">{dict.notifications.types.order}</option>
                    <option value="info">{dict.notifications.types.info}</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {dict.notifications.titleLabel}
                  </label>
                  <span className="text-[10px] font-mono-tabular text-zinc-400">
                    {notifTitle.length}/140
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder={dict.notifications.titlePlaceholder}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {dict.notifications.messageLabel}
                  </label>
                  <span className="text-[10px] font-mono-tabular text-zinc-400">
                    {notifMessage.length}/600
                  </span>
                </div>
                <textarea
                  rows={3}
                  required
                  maxLength={600}
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  placeholder={dict.notifications.messagePlaceholder}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {dict.notifications.actionLabel}
                </label>
                <select
                  value={notifActionTarget}
                  onChange={(e) => setNotifActionTarget(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100"
                >
                  <option value="none">{dict.notifications.actionNone}</option>
                  <option value="shop">{dict.notifications.actionShop}</option>
                  <option value="orders">{dict.notifications.actionOrders}</option>
                  <option value="chat">{dict.notifications.actionChat}</option>
                  {categories.map((cat) => (
                    <option key={cat} value={`category:${cat}`}>
                      {lang === 'mm' ? `Category: ${cat}` : `Category: ${cat}`}
                    </option>
                  ))}
                </select>
              </div>

              {notifError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {notifError}
                </p>
              )}
              {notifSuccess && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>{dict.notifications.sentSuccess}</span>
                  </p>
                  {lastPushResult && lastPushResult.totalTargets > 0 && (
                    <p className="text-[11px] font-mono-tabular text-zinc-600 dark:text-zinc-300 pl-5">
                      {dict.notifications.pushDeliveredCount} {lastPushResult.sent} / {lastPushResult.totalTargets}
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={sendingNotif || !notifTitle.trim() || !notifMessage.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 cursor-pointer"
              >
                {sendingNotif ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>
                  {sendingNotif ? dict.notifications.sendingBtn : dict.notifications.sendBtn}
                </span>
              </button>
            </form>

            {/* Sent Notifications History */}
            <div className="lg:col-span-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {dict.notifications.historyTitle}
                </h3>
                <span className="font-mono-tabular text-xs text-zinc-500 dark:text-zinc-400">
                  {notifications.length}
                </span>
              </div>

              {notifications.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  {dict.notifications.historyEmpty}
                </div>
              ) : (
                <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                  {notifications.map((n) => {
                    const isConfirming = confirmDeleteNotifId === n.id;
                    const isDeleting = deletingNotifId === n.id;
                    return (
                      <div
                        key={n.id}
                        className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3.5 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                            <span className="font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                              {dict.notifications.types[n.type]}
                            </span>
                            <span className="font-medium text-zinc-600 dark:text-zinc-300">
                              → {n.targetBuyerId === 'all' ? dict.notifications.broadcastTag : n.targetBuyerName}
                            </span>
                          </div>
                          {isConfirming ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] shrink-0">
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => void handleDeleteNotification(n.id)}
                                className="font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 cursor-pointer"
                              >
                                {isDeleting ? dict.chat.deleting : dict.chat.confirmDeleteMessage}
                              </button>
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() => setConfirmDeleteNotifId(null)}
                                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                              >
                                {dict.chat.cancelDelete}
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteNotifId(n.id)}
                              aria-label={dict.chat.deleteMessage}
                              className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                          {n.title}
                        </p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">
                          {n.message}
                        </p>
                        <p className="text-[10px] font-mono-tabular text-zinc-400 dark:text-zinc-500">
                          {formatDateTime(n.createdAt)}
                        </p>
                      </div>
                    );
                  })}
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

            {bannerSaveError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                {bannerSaveError}
              </p>
            )}

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

            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  {dict.admin.imageLabel}
                </label>
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer whitespace-nowrap">
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>{dict.admin.uploadMultipleImages}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      handleBatchUploadProductImages(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([0, 1, 2] as const).map((slotIdx) => {
                  const slotVal = prodForm.images[slotIdx];
                  const slotLabel =
                    slotIdx === 0
                      ? dict.admin.imageSlotMain
                      : `${dict.admin.imageSlotExtra} ${slotIdx + 1}`;
                  return (
                    <div
                      key={slotIdx}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-900/60 p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                          {slotLabel}
                        </span>
                        {slotVal.trim() && (
                          <button
                            type="button"
                            onClick={() => updateProdImageSlot(slotIdx, '')}
                            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                            <span>{dict.admin.clearPhoto}</span>
                          </button>
                        )}
                      </div>

                      <div className="aspect-[4/3] w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 flex items-center justify-center">
                        {slotVal.trim() ? (
                          <SmartImage
                            src={slotVal}
                            alt={slotLabel}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-zinc-400 dark:text-zinc-600">
                            <Images className="w-5 h-5" />
                            <span className="text-[10px]">{slotLabel}</span>
                          </div>
                        )}
                      </div>

                      <input
                        type="text"
                        value={slotVal}
                        onChange={(e) => updateProdImageSlot(slotIdx, e.target.value)}
                        placeholder="https://..."
                        aria-label={`${slotLabel} URL`}
                        className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-[11px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                      />

                      <label className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
                        <Upload className="w-3 h-3" />
                        <span>{dict.admin.uploadImage}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              readFileAsDataUrl(
                                f,
                                (res) => updateProdImageSlot(slotIdx, res),
                                galleryCompression
                              );
                            }
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  );
                })}
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

            {prodSaveError && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                {prodSaveError}
              </p>
            )}

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
      {/* Chat Image Lightbox */}
      {chatLightboxImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setChatLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setChatLightboxImage(null)}
            aria-label="Close image preview"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={chatLightboxImage}
            alt={dict.chat.photoTag}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
