import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  ShoppingBag,
  Sun,
  Moon,
  MessageSquare,
  Globe,
  X,
  LogIn,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  LayoutGrid,
  List,
  Bell,
  Store,
  Heart,
  Package,
} from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import type {
  Address,
  BannerSlide,
  BootstrapPayload,
  CartItem,
  ChatMessage,
  ChatThread,
  Language,
  Order,
  PaymentSettings,
  Product,
  StoreBrandConfig,
  StoreNotification,
  UserProfile,
} from './types';
import { t } from './i18n';
import {
  auth,
  db,
  handleFirestoreError,
  isAdminEmail,
  OperationType,
  signInWithGoogle,
  signOutUser,
} from './firebase';
import {
  DEFAULT_PAYMENT_SETTINGS,
  DEFAULT_STORE_BRAND,
  deleteChatMessageDoc,
  ensureBuyerProfileDoc,
  markThreadMessagesRead,
  removePushSubscriptionDoc,
  sendChatMessageDoc,
  syncLocalSeedToFirestoreIfEmpty,
  toggleWishlistDoc,
  upsertPushSubscriptionDoc,
} from './services/firestoreStore';
import {
  fetchPushPublicKey,
  getCurrentBrowserPushEndpoint,
  getNotificationPermissionState,
  isIOSNeedsHomeScreen,
  isServiceWorkerPushSupported,
  showOsNotificationBarAlert,
  subscribeBrowserToWebPush,
  unsubscribeBrowserFromWebPush,
} from './services/pushNotifications';
import { BannerSlider } from './components/BannerSlider';
import { StoreLogoBanner } from './components/StoreLogoBanner';
import { ProductCard, type ProductLayoutMode } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartCheckoutDrawer } from './components/CartCheckoutDrawer';
import { OrdersView } from './components/OrdersView';
import { ProfileView } from './components/ProfileView';
import { WishlistView } from './components/WishlistView';
import { LiveChatWidget } from './components/LiveChatWidget';
import { AdminDashboard } from './components/AdminDashboard';
import { BuyerAuthPanel } from './components/BuyerAuthPanel';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  BuyerNotificationsDrawer,
  LiveNotificationBanner,
} from './components/BuyerNotificationsDrawer';
import { normalizeImageSrcSync } from './utils/imageUrl';

type AppView = 'shop' | 'wishlist' | 'orders' | 'profile' | 'admin';
type SortOption = 'popular' | 'price-asc' | 'price-desc' | 'newest';

interface CartRef {
  productId: string;
  quantity: number;
  variant: string;
}

function safeGetStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors in restricted WebViews
  }
}

function loadCartRefs(storageKey: string): CartRef[] {
  try {
    const raw = safeGetStorage(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{
      productId?: string;
      product?: { id?: string };
      quantity?: number;
      variant?: string;
    }>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        productId: item.productId || item.product?.id || '',
        quantity: Math.max(1, Number(item.quantity) || 1),
        variant: item.variant || 'Standard',
      }))
      .filter((item) => Boolean(item.productId));
  } catch {
    return [];
  }
}

function loadCachedChatThreads(scopeKey: string): ChatThread[] {
  try {
    const raw = safeGetStorage(`yg_chat_threads_${scopeKey}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatThread[]) : [];
  } catch {
    return [];
  }
}

function loadCachedChatMessages(scopeKey: string): Record<string, ChatMessage[]> {
  try {
    const raw = safeGetStorage(`yg_chat_msgs_${scopeKey}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, ChatMessage[]>)
      : {};
  } catch {
    return {};
  }
}

function pathToView(pathname: string): AppView {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  if (clean === '/admin' || clean === '/seller') return 'admin';
  if (clean === '/wishlist') return 'wishlist';
  if (clean === '/orders') return 'orders';
  if (clean === '/profile') return 'profile';
  return 'shop';
}

function viewToPath(v: AppView): string {
  if (v === 'shop') return '/';
  if (v === 'admin') return '/seller';
  return `/${v}`;
}

export default function App() {
  const [view, setView] = useState<AppView>(() => pathToView(window.location.pathname));
  const [lang, setLang] = useState<Language>(() => {
    const saved = safeGetStorage('yg_lang');
    return saved === 'mm' ? 'mm' : 'en';
  });
  const [dark, setDark] = useState<boolean>(() => safeGetStorage('yg_theme') === 'dark');

  // Firebase Auth State
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authUiError, setAuthUiError] = useState('');

  const isAuthenticated = Boolean(authUser);
  const isSellerAdmin = Boolean(authUser && isAdminEmail(authUser.email, authUser.emailVerified));
  const buyerId = authUser?.uid || 'guest';

  // Cloud Public Storefront State
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [cloudCatalogExists, setCloudCatalogExists] = useState(false);
  const [cloudProducts, setCloudProducts] = useState<Product[]>([]);
  const [cloudCategories, setCloudCategories] = useState<string[]>([]);
  const [cloudBanners, setCloudBanners] = useState<BannerSlide[]>([]);
  const [cloudPaymentSettings, setCloudPaymentSettings] = useState<PaymentSettings>(
    DEFAULT_PAYMENT_SETTINGS
  );
  const [cloudBrand, setCloudBrand] = useState<StoreBrandConfig>(DEFAULT_STORE_BRAND);
  const [analyticsResetAt, setAnalyticsResetAt] = useState<string | undefined>(undefined);
  const [fallbackSeed, setFallbackSeed] = useState<BootstrapPayload | null>(null);
  const [cloudConnected, setCloudConnected] = useState(true);

  // Authenticated Private Buyer / Admin State
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    id: 'guest',
    name: 'Guest Buyer',
    email: '',
    phone: '',
  });
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [threadMessagesMap, setThreadMessagesMap] = useState<Record<string, ChatMessage[]>>({});
  const [selectedAdminThreadId, setSelectedAdminThreadId] = useState<string>('');
  const [chatThreadsLoaded, setChatThreadsLoaded] = useState(false);
  const [loadedThreadIds, setLoadedThreadIds] = useState<Record<string, boolean>>({});
  const [chatSyncError, setChatSyncError] = useState('');

  // Storefront Filter & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [popularOnly, setPopularOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [buyerProductLayout, setBuyerProductLayout] = useState<ProductLayoutMode>(() => {
    const saved = safeGetStorage('yg_buyer_layout');
    return saved === 'list' ? 'list' : 'grid2';
  });
  const updateBuyerProductLayout = useCallback((mode: ProductLayoutMode) => {
    setBuyerProductLayout(mode);
    safeSetStorage('yg_buyer_layout', mode);
  }, []);

  // Compact Cart Refs & Drawers
  const [cartRefs, setCartRefs] = useState<CartRef[]>(() => loadCartRefs('yg_cart_refs_guest'));
  const [cartOpen, setCartOpen] = useState(false);
  const [directBuyRef, setDirectBuyRef] = useState<CartRef | null>(null);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<string | undefined>(undefined);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingWishlistId, setPendingWishlistId] = useState<string | null>(null);
  const [profileLoadedUid, setProfileLoadedUid] = useState<string | null>(null);
  const [ordersLoadedUid, setOrdersLoadedUid] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Real-Time Seller -> Buyer Notifications State
  const [broadcastNotifs, setBroadcastNotifs] = useState<StoreNotification[]>([]);
  const [targetedNotifs, setTargetedNotifs] = useState<StoreNotification[]>([]);
  const [adminAllNotifs, setAdminAllNotifs] = useState<StoreNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [liveIncomingNotif, setLiveIncomingNotif] = useState<StoreNotification | null>(null);
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      const raw = safeGetStorage('yg_read_notifs_guest');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  });
  const knownNotifIdsRef = useRef<Set<string>>(new Set());
  const broadcastInitDoneRef = useRef(false);
  const targetedInitDoneRef = useRef(false);

  // Web Push (Closed-App Phone Notification Bar) State
  const [pushVapidPublicKey, setPushVapidPublicKey] = useState<string | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermissionState()
  );
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushEnabling, setPushEnabling] = useState(false);
  const [pendingPushEnable, setPendingPushEnable] = useState(false);
  const pushSupported = isServiceWorkerPushSupported();
  const iosNeedsHomeScreen = isIOSNeedsHomeScreen();

  const catalogRef = useRef<HTMLElement | null>(null);
  const dict = t(lang);
  const syncErrorTextRef = useRef(dict.chat.syncError);
  syncErrorTextRef.current = dict.chat.syncError;
  const isAdminStream = view === 'admin' && isSellerAdmin;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 2600);
  }, []);

  // Dark Mode & Language Persistence
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      safeSetStorage('yg_theme', 'dark');
    } else {
      root.classList.remove('dark');
      safeSetStorage('yg_theme', 'light');
    }
  }, [dark]);

  useEffect(() => {
    safeSetStorage('yg_lang', lang);
  }, [lang]);

  useEffect(() => {
    safeSetStorage(`yg_cart_refs_${buyerId}`, JSON.stringify(cartRefs));
  }, [cartRefs, buyerId]);

  useEffect(() => {
    const onPopState = () => {
      setView(pathToView(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((nextView: AppView) => {
    const targetPath = viewToPath(nextView);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Firebase Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      setAuthUiError('');
      setProfileLoadedUid(null);
      setOrdersLoadedUid(null);
      setOrders([]);
      setAddresses([]);
      setWishlist([]);
      setChatThreads([]);
      setThreadMessagesMap({});
      setChatThreadsLoaded(false);
      setLoadedThreadIds({});
      setChatSyncError('');

      if (user) {
        const guestCart = loadCartRefs('yg_cart_refs_guest');
        const userCart = loadCartRefs(`yg_cart_refs_${user.uid}`);
        const mergedCart = [...userCart];
        for (const gItem of guestCart) {
          const idx = mergedCart.findIndex(
            (uItem) => uItem.productId === gItem.productId && uItem.variant === gItem.variant
          );
          if (idx >= 0) {
            mergedCart[idx] = {
              ...mergedCart[idx],
              quantity: mergedCart[idx].quantity + gItem.quantity,
            };
          } else {
            mergedCart.push(gItem);
          }
        }
        setCartRefs(mergedCart);
        safeSetStorage(`yg_cart_refs_${user.uid}`, JSON.stringify(mergedCart));
        if (guestCart.length > 0) {
          safeSetStorage('yg_cart_refs_guest', '[]');
        }

        void ensureBuyerProfileDoc(user.uid, {
          name: user.displayName,
          email: user.email,
          phone: user.phoneNumber,
        }).catch(() => undefined);

        if (isAdminEmail(user.email, user.emailVerified)) {
          void syncLocalSeedToFirestoreIfEmpty();
        }
      } else {
        setProfile({
          id: 'guest',
          name: 'Guest Buyer',
          email: '',
          phone: '',
        });
        setCartRefs(loadCartRefs('yg_cart_refs_guest'));
      }
    });
    return () => unsub();
  }, []);

  // Public Real-Time Firestore Listeners (Zero Login Wall — Always Synced Across Shared Links)
  useEffect(() => {
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        setCloudConnected(true);
        const list: Product[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as Product);
        });
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setCloudProducts(list);
        setProductsLoaded(true);
      },
      (err) => {
        setCloudConnected(false);
        handleFirestoreError(err, OperationType.LIST, 'products');
      }
    );

    const unsubBanners = onSnapshot(
      collection(db, 'banners'),
      (snap) => {
        const items: Array<BannerSlide & { sortOrder?: number }> = [];
        snap.forEach((docSnap) => {
          items.push(docSnap.data() as BannerSlide & { sortOrder?: number });
        });
        items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        setCloudBanners(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'banners');
      }
    );

    const unsubCatalog = onSnapshot(
      doc(db, 'storeCatalog', 'main'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as {
            categories?: string[];
            brand?: Partial<StoreBrandConfig>;
            analyticsResetAt?: string;
          };
          setCloudCatalogExists(true);
          setCloudCategories(Array.isArray(data.categories) ? data.categories : []);
          setCloudBrand(
            data.brand ? { ...DEFAULT_STORE_BRAND, ...data.brand } : DEFAULT_STORE_BRAND
          );
          setAnalyticsResetAt(data.analyticsResetAt);
        } else {
          setCloudCatalogExists(false);
          setCloudCategories([]);
          setCloudBrand(DEFAULT_STORE_BRAND);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'storeCatalog/main');
      }
    );

    const unsubPay = onSnapshot(
      doc(db, 'paymentConfig', 'main'),
      (docSnap) => {
        if (docSnap.exists()) {
          setCloudPaymentSettings(docSnap.data() as PaymentSettings);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'paymentConfig/main');
      }
    );

    const unsubBroadcastNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('targetBuyerId', '==', 'all')),
      (snap) => {
        const list: StoreNotification[] = [];
        snap.forEach((docSnap) => {
          list.push(docSnap.data() as StoreNotification);
        });
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setBroadcastNotifs(list);

        if (!broadcastInitDoneRef.current) {
          for (const n of list) knownNotifIdsRef.current.add(n.id);
          broadcastInitDoneRef.current = true;
        } else {
          const fresh = list.find((n) => !knownNotifIdsRef.current.has(n.id));
          for (const n of list) knownNotifIdsRef.current.add(n.id);
          if (fresh && window.location.pathname !== '/seller' && window.location.pathname !== '/admin') {
            setLiveIncomingNotif(fresh);
            void showOsNotificationBarAlert(fresh);
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'notifications');
      }
    );

    return () => {
      unsubProducts();
      unsubBanners();
      unsubCatalog();
      unsubPay();
      unsubBroadcastNotifs();
    };
  }, []);

  // One-time pre-seed fallback ONLY if Firestore hasn't been seeded yet
  useEffect(() => {
    if (!productsLoaded) return;
    if (cloudProducts.length === 0 && !cloudCatalogExists && !fallbackSeed) {
      let active = true;
      fetch('/api/bootstrap?buyerId=guest', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: BootstrapPayload | null) => {
          if (active && data) {
            setFallbackSeed(data);
          }
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }
  }, [productsLoaded, cloudProducts.length, cloudCatalogExists, fallbackSeed]);

  // Authenticated Private Buyer Listeners (Wait for authReady && authUser)
  useEffect(() => {
    if (!authReady || !authUser) return;
    const uid = authUser.uid;

    const unsubProfile = onSnapshot(
      doc(db, 'users', uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as {
            id?: string;
            name?: string;
            email?: string;
            phone?: string;
            wishlist?: string[];
          };
          setProfile({
            id: data.id || uid,
            name: data.name || authUser.displayName || authUser.phoneNumber || 'Buyer',
            email: data.email || authUser.email || '',
            phone: data.phone || authUser.phoneNumber || '',
          });
          setWishlist(Array.isArray(data.wishlist) ? data.wishlist : []);
          setProfileLoadedUid(uid);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      }
    );

    const unsubAddresses = onSnapshot(
      collection(db, 'users', uid, 'addresses'),
      (snap) => {
        const list: Address[] = [];
        snap.forEach((d) => list.push(d.data() as Address));
        list.sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
        setAddresses(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `users/${uid}/addresses`);
      }
    );

    return () => {
      unsubProfile();
      unsubAddresses();
    };
  }, [authReady, authUser]);

  // Close auth modal and complete any pending wishlist save once profile snapshot is synced
  useEffect(() => {
    if (authUser && authModalOpen) {
      setAuthModalOpen(false);
    }
  }, [authUser, authModalOpen]);

  useEffect(() => {
    if (!authUser || !pendingWishlistId || profileLoadedUid !== authUser.uid) return;
    const productId = pendingWishlistId;
    setPendingWishlistId(null);
    if (!wishlist.includes(productId)) {
      void toggleWishlistDoc(authUser.uid, productId, wishlist, {
        name: authUser.displayName,
        email: authUser.email,
        phone: authUser.phoneNumber,
      });
    }
  }, [authUser, pendingWishlistId, profileLoadedUid, wishlist]);

  // Orders & ChatThreads Listeners (Role-aware: Seller Admin on /seller vs Signed-in Buyer)
  useEffect(() => {
    if (!authReady || !authUser) return;
    const chatScopeKey = `${authUser.uid}_${isAdminStream ? 'admin' : 'buyer'}`;

    const cachedThreads = loadCachedChatThreads(chatScopeKey);
    const cachedMsgs = loadCachedChatMessages(chatScopeKey);
    setChatThreads(cachedThreads);
    setThreadMessagesMap(cachedMsgs);
    setChatThreadsLoaded(false);

    const ordersSource = isAdminStream
      ? collection(db, 'orders')
      : query(collection(db, 'orders'), where('buyerId', '==', authUser.uid));

    const unsubOrders = onSnapshot(
      ordersSource,
      (snap) => {
        const list: Order[] = [];
        snap.forEach((d) => list.push(d.data() as Order));
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setOrders(list);
        setOrdersLoadedUid(authUser.uid);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'orders');
      }
    );

    const threadsSource = isAdminStream
      ? collection(db, 'chatThreads')
      : query(collection(db, 'chatThreads'), where('buyerId', '==', authUser.uid));

    const unsubThreads = onSnapshot(
      threadsSource,
      (snap) => {
        setChatSyncError('');
        const list: ChatThread[] = [];
        snap.forEach((d) => {
          const data = d.data() as Omit<ChatThread, 'messages'> & {
            lastMessagePreview?: string;
            unreadByAdmin?: number;
            unreadByBuyer?: number;
          };
          list.push({
            ...data,
            messages: [],
          } as ChatThread);
        });
        list.sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
        setChatThreads(list);
        setChatThreadsLoaded(true);
        safeSetStorage(`yg_chat_threads_${chatScopeKey}`, JSON.stringify(list));
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'chatThreads');
        } catch {
          setChatSyncError(syncErrorTextRef.current);
        }
      }
    );

    let unsubUserNotifs = () => {};
    if (isAdminStream) {
      unsubUserNotifs = onSnapshot(
        collection(db, 'notifications'),
        (snap) => {
          const list: StoreNotification[] = [];
          snap.forEach((d) => list.push(d.data() as StoreNotification));
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setAdminAllNotifs(list);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'notifications');
        }
      );
    } else {
      targetedInitDoneRef.current = false;
      unsubUserNotifs = onSnapshot(
        query(collection(db, 'notifications'), where('targetBuyerId', '==', authUser.uid)),
        (snap) => {
          const list: StoreNotification[] = [];
          snap.forEach((d) => list.push(d.data() as StoreNotification));
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setTargetedNotifs(list);

          if (!targetedInitDoneRef.current) {
            for (const n of list) knownNotifIdsRef.current.add(n.id);
            targetedInitDoneRef.current = true;
          } else {
            const fresh = list.find((n) => !knownNotifIdsRef.current.has(n.id));
            for (const n of list) knownNotifIdsRef.current.add(n.id);
            if (fresh && window.location.pathname !== '/seller' && window.location.pathname !== '/admin') {
              setLiveIncomingNotif(fresh);
              void showOsNotificationBarAlert(fresh);
            }
          }
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'notifications');
        }
      );
    }

    return () => {
      unsubOrders();
      unsubThreads();
      unsubUserNotifs();
    };
  }, [authReady, authUser, isAdminStream]);

  // Sync read notification IDs per buyerId and clear targeted notifications on sign out
  useEffect(() => {
    if (!authUser) {
      setTargetedNotifs([]);
      setAdminAllNotifs([]);
    }
    try {
      const raw = safeGetStorage(`yg_read_notifs_${buyerId}`);
      const parsed = raw ? JSON.parse(raw) : [];
      setReadNotifIds(Array.isArray(parsed) ? (parsed as string[]) : []);
    } catch {
      setReadNotifIds([]);
    }
  }, [authUser, buyerId]);

  useEffect(() => {
    if (!liveIncomingNotif) return;
    const timer = window.setTimeout(() => {
      setLiveIncomingNotif((curr) => (curr?.id === liveIncomingNotif.id ? null : curr));
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [liveIncomingNotif]);

  const buyerNotifications = useMemo(() => {
    const map = new Map<string, StoreNotification>();
    for (const n of broadcastNotifs) map.set(n.id, n);
    if (authUser) {
      for (const n of targetedNotifs) map.set(n.id, n);
    }
    return Array.from(map.values()).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  }, [broadcastNotifs, targetedNotifs, authUser]);

  const unreadNotifCount = useMemo(() => {
    const readSet = new Set(readNotifIds);
    return buyerNotifications.filter((n) => !readSet.has(n.id)).length;
  }, [buyerNotifications, readNotifIds]);

  const markNotificationRead = useCallback(
    (notifId: string) => {
      setReadNotifIds((prev) => {
        if (prev.includes(notifId)) return prev;
        const next = [notifId, ...prev].slice(0, 300);
        safeSetStorage(`yg_read_notifs_${buyerId}`, JSON.stringify(next));
        return next;
      });
    },
    [buyerId]
  );

  const markAllNotificationsRead = useCallback(() => {
    const allIds = Array.from(new Set([...buyerNotifications.map((n) => n.id), ...readNotifIds])).slice(0, 300);
    setReadNotifIds(allIds);
    safeSetStorage(`yg_read_notifs_${buyerId}`, JSON.stringify(allIds));
  }, [buyerNotifications, readNotifIds, buyerId]);

  // Web Push Key & Subscription Status Sync
  useEffect(() => {
    let active = true;
    void fetchPushPublicKey().then((res) => {
      if (active && res.configured && res.publicKey) {
        setPushVapidPublicKey(res.publicKey);
      }
    });
    void getCurrentBrowserPushEndpoint().then((endpoint) => {
      if (active) {
        setPushSubscribed(Boolean(endpoint));
        setPushPermission(getNotificationPermissionState());
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const syncDevicePushSubscription = useCallback(
    async (user: User, vapidKey: string) => {
      const keys = await subscribeBrowserToWebPush(vapidKey);
      if (!keys) return false;
      const buyerDisplay =
        user.displayName || user.phoneNumber || user.email?.split('@')[0] || 'Buyer';
      await upsertPushSubscriptionDoc({
        uid: user.uid,
        buyerName: buyerDisplay,
        endpoint: keys.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser',
      });
      setPushSubscribed(true);
      return true;
    },
    []
  );

  // Sync existing or pending Web Push subscription once signed in
  useEffect(() => {
    if (!authUser || !pushVapidPublicKey) return;
    if (pendingPushEnable && Notification.permission === 'granted') {
      setPendingPushEnable(false);
      setPushEnabling(true);
      void syncDevicePushSubscription(authUser, pushVapidPublicKey)
        .then((ok) => {
          if (ok) {
            showToast(
              lang === 'mm'
                ? 'ဖုန်း Notification Bar ဖွင့်ပြီးပါပြီ!'
                : 'Phone notification bar alerts enabled!'
            );
          }
        })
        .catch(() => undefined)
        .finally(() => setPushEnabling(false));
      return;
    }

    if (Notification.permission === 'granted') {
      void getCurrentBrowserPushEndpoint().then((endpoint) => {
        if (endpoint) {
          void syncDevicePushSubscription(authUser, pushVapidPublicKey).catch(() => undefined);
        }
      });
    }
  }, [authUser, pushVapidPublicKey, pendingPushEnable, syncDevicePushSubscription, showToast, lang]);

  const handleEnablePhonePush = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPushEnabling(true);
    try {
      let perm: NotificationPermission = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
      }
      setPushPermission(perm);
      if (perm !== 'granted') {
        return;
      }

      if (!authUser) {
        setPendingPushEnable(true);
        setNotificationsOpen(false);
        setAuthModalOpen(true);
        return;
      }

      let vapidKey = pushVapidPublicKey;
      if (!vapidKey) {
        const res = await fetchPushPublicKey();
        if (res.configured && res.publicKey) {
          vapidKey = res.publicKey;
          setPushVapidPublicKey(res.publicKey);
        }
      }

      if (vapidKey && isServiceWorkerPushSupported()) {
        const ok = await syncDevicePushSubscription(authUser, vapidKey);
        if (ok) {
          showToast(
            lang === 'mm'
              ? 'ဖုန်း Notification Bar ဖွင့်ပြီးပါပြီ!'
              : 'Phone notification bar alerts enabled!'
          );
          return;
        }
      }

      showToast(
        lang === 'mm'
          ? 'Browser Notification Bar ခွင့်ပြုပြီးပါပြီ'
          : 'Browser notification bar alerts allowed!'
      );
    } catch {
      showToast(
        lang === 'mm'
          ? 'ဖုန်း Notification Bar ဖွင့်မရပါ'
          : 'Could not enable phone notifications'
      );
    } finally {
      setPushEnabling(false);
    }
  }, [authUser, pushVapidPublicKey, syncDevicePushSubscription, showToast, lang]);

  const handleDisablePhonePush = useCallback(async () => {
    setPushEnabling(true);
    try {
      const removedEndpoint = await unsubscribeBrowserFromWebPush();
      if (removedEndpoint && authUser) {
        await removePushSubscriptionDoc(authUser.uid, removedEndpoint).catch(() => undefined);
      }
      setPushSubscribed(false);
      showToast(
        lang === 'mm' ? 'ဖုန်း Noti Bar ပိတ်လိုက်ပါပြီ' : 'Phone notification bar alerts turned off'
      );
    } finally {
      setPushEnabling(false);
    }
  }, [authUser, showToast, lang]);

  // Active Chat Thread Messages Listener (Only attached when thread doc exists in Firestore)
  const activeListenThreadId = useMemo(() => {
    if (!authReady || !authUser) return '';
    if (isAdminStream) {
      if (selectedAdminThreadId && chatThreads.some((th) => th.id === selectedAdminThreadId)) {
        return selectedAdminThreadId;
      }
      return chatThreads[0]?.id || '';
    }
    const buyerExpectedId = `thread-${authUser.uid}`;
    const found = chatThreads.find(
      (th) => th.id === buyerExpectedId || th.buyerId === authUser.uid
    );
    return found?.id || '';
  }, [authReady, authUser, isAdminStream, selectedAdminThreadId, chatThreads]);

  useEffect(() => {
    if (!activeListenThreadId || !authUser) return;
    const chatScopeKey = `${authUser.uid}_${isAdminStream ? 'admin' : 'buyer'}`;
    const msgsPath = `chatThreads/${activeListenThreadId}/messages`;
    const unsubMsgs = onSnapshot(
      collection(db, 'chatThreads', activeListenThreadId, 'messages'),
      (snap) => {
        setChatSyncError('');
        const list: ChatMessage[] = [];
        snap.forEach((d) => list.push(d.data() as ChatMessage));
        list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        setLoadedThreadIds((prev) => ({
          ...prev,
          [activeListenThreadId]: true,
        }));
        setThreadMessagesMap((prev) => {
          const next = {
            ...prev,
            [activeListenThreadId]: list,
          };
          safeSetStorage(`yg_chat_msgs_${chatScopeKey}`, JSON.stringify(next));
          return next;
        });
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, msgsPath);
        } catch {
          setChatSyncError(syncErrorTextRef.current);
        }
      }
    );
    return () => unsubMsgs();
  }, [activeListenThreadId, authUser, isAdminStream]);

  // Resolved Public Storefront Collections (Cloud takes precedence; pre-seed fallback only before first cloud seed)
  const useSeedFallback = productsLoaded && cloudProducts.length === 0 && !cloudCatalogExists;
  const products = useMemo(
    () => (useSeedFallback ? fallbackSeed?.products || [] : cloudProducts),
    [useSeedFallback, fallbackSeed, cloudProducts]
  );
  const banners = useMemo(
    () =>
      cloudBanners.length > 0
        ? cloudBanners
        : useSeedFallback
        ? fallbackSeed?.banners || []
        : [],
    [cloudBanners, useSeedFallback, fallbackSeed]
  );
  const categories = useMemo(() => {
    const base =
      cloudCategories.length > 0
        ? cloudCategories
        : useSeedFallback
        ? fallbackSeed?.categories || []
        : [];
    const fromProducts = products.map((p) => p.category).filter(Boolean);
    return Array.from(new Set([...base, ...fromProducts]));
  }, [cloudCategories, useSeedFallback, fallbackSeed, products]);

  const paymentSettings = useMemo(
    () =>
      useSeedFallback && fallbackSeed?.paymentSettings
        ? fallbackSeed.paymentSettings
        : cloudPaymentSettings,
    [useSeedFallback, fallbackSeed, cloudPaymentSettings]
  );

  const brand = useMemo(
    () =>
      useSeedFallback && fallbackSeed?.brand
        ? { ...DEFAULT_STORE_BRAND, ...fallbackSeed.brand }
        : cloudBrand,
    [useSeedFallback, fallbackSeed, cloudBrand]
  );

  useEffect(() => {
    document.title =
      view === 'admin'
        ? `${brand.storeName} — ${dict.admin.title}`
        : `${brand.storeName} — Curated Storefront & Seller Console`;
  }, [brand.storeName, view, dict.admin.title]);

  // Hydrate compact Cart Refs & Direct Buy against live Products
  const cart: CartItem[] = useMemo(() => {
    const out: CartItem[] = [];
    for (const ref of cartRefs) {
      const prod = products.find((p) => p.id === ref.productId);
      if (prod && prod.stock > 0) {
        out.push({
          product: prod,
          quantity: Math.max(1, Math.min(prod.stock, ref.quantity)),
          variant: ref.variant || prod.variants[0] || 'Standard',
        });
      }
    }
    return out;
  }, [cartRefs, products]);

  const directBuyItem: CartItem | null = useMemo(() => {
    if (!directBuyRef) return null;
    const prod = products.find((p) => p.id === directBuyRef.productId);
    if (!prod || prod.stock <= 0) return null;
    return {
      product: prod,
      quantity: Math.max(1, Math.min(prod.stock, directBuyRef.quantity)),
      variant: directBuyRef.variant || prod.variants[0] || 'Standard',
    };
  }, [directBuyRef, products]);

  const detailProduct = useMemo(() => {
    if (!detailProductId) return null;
    return products.find((p) => p.id === detailProductId) || null;
  }, [detailProductId, products]);

  const hydratedChatThreads: ChatThread[] = useMemo(() => {
    return chatThreads.map((th) => ({
      ...th,
      messages: threadMessagesMap[th.id] || th.messages || [],
    }));
  }, [chatThreads, threadMessagesMap]);

  // Auth Actions
  const handleGoogleSignIn = useCallback(async () => {
    setAuthUiError('');
    await signInWithGoogle();
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutUser();
  }, []);

  // Cart Handlers
  const handleAddToBag = (product: Product, variant?: string) => {
    if (product.stock <= 0) return;
    const chosenVariant = variant || product.variants[0] || 'Standard';
    setCartRefs((prev) => {
      const existing = prev.find(
        (c) => c.productId === product.id && c.variant === chosenVariant
      );
      if (existing) {
        return prev.map((c) =>
          c.productId === product.id && c.variant === chosenVariant
            ? { ...c, quantity: Math.min(product.stock, c.quantity + 1) }
            : c
        );
      }
      return [...prev, { productId: product.id, quantity: 1, variant: chosenVariant }];
    });
    showToast(`${lang === 'mm' ? product.nameMm : product.name} added to bag`);
  };

  const handleBuyNow = (product: Product, variant?: string) => {
    if (product.stock <= 0) return;
    const chosenVariant = variant || product.variants[0] || 'Standard';
    setDirectBuyRef({ productId: product.id, quantity: 1, variant: chosenVariant });
    setCartOpen(true);
  };

  const handleUpdateDirectBuyQty = (delta: number) => {
    setDirectBuyRef((prev) => {
      if (!prev) return null;
      const prod = products.find((p) => p.id === prev.productId);
      const maxStock = prod ? prod.stock : 99;
      const nextQty = Math.max(1, Math.min(maxStock, prev.quantity + delta));
      return { ...prev, quantity: nextQty };
    });
  };

  const handleUpdateQty = (productId: string, variant: string, delta: number) => {
    const prod = products.find((p) => p.id === productId);
    const maxStock = prod ? prod.stock : 99;
    setCartRefs((prev) =>
      prev
        .map((c) => {
          if (c.productId === productId && c.variant === variant) {
            const nextQty = c.quantity + delta;
            if (nextQty <= 0) return null;
            return { ...c, quantity: Math.min(maxStock, nextQty) };
          }
          return c;
        })
        .filter(Boolean) as CartRef[]
    );
  };

  const handleRemoveCartItem = (productId: string, variant: string) => {
    setCartRefs((prev) =>
      prev.filter((c) => !(c.productId === productId && c.variant === variant))
    );
  };

  // Wishlist Toggle
  const handleToggleWishlist = async (productId: string) => {
    if (!authUser) {
      setPendingWishlistId(productId);
      setAuthModalOpen(true);
      return;
    }
    await toggleWishlistDoc(authUser.uid, productId, wishlist, {
      name: authUser.displayName,
      email: authUser.email,
      phone: authUser.phoneNumber,
    });
  };

  // Chat Actions
  const buyerThread = authUser
    ? hydratedChatThreads.find(
        (th) => th.id === `thread-${authUser.uid}` || th.buyerId === authUser.uid
      )
    : undefined;

  const unreadBuyerCount = buyerThread
    ? Math.max(
        buyerThread.messages.filter((m) => m.senderRole === 'admin' && !m.read).length,
        Number((buyerThread as ChatThread & { unreadByBuyer?: number }).unreadByBuyer || 0)
      )
    : 0;

  const openChatWithContext = (tag?: string) => {
    setChatContext(tag);
    setChatOpen(true);
    if (authUser && buyerThread && unreadBuyerCount > 0) {
      void markThreadMessagesRead(buyerThread.id, 'buyer').catch(() => undefined);
    }
  };

  useEffect(() => {
    if (chatOpen && authUser && buyerThread && unreadBuyerCount > 0) {
      void markThreadMessagesRead(buyerThread.id, 'buyer').catch(() => undefined);
    }
  }, [chatOpen, authUser, buyerThread?.id, unreadBuyerCount]);

  const handleSendBuyerChat = async (text: string, contextTag?: string, imageUrl?: string) => {
    if (!authUser) {
      throw new Error('AUTH_REQUIRED');
    }
    const threadId = buyerThread?.id || `thread-${authUser.uid}`;
    const senderName =
      profile.name && profile.name !== 'Guest Buyer'
        ? profile.name
        : authUser.displayName || authUser.phoneNumber || 'Buyer';
    await sendChatMessageDoc({
      threadId,
      buyerId: authUser.uid,
      buyerName: senderName,
      buyerPhone: profile.phone || authUser.phoneNumber || '',
      senderRole: 'buyer',
      senderUid: authUser.uid,
      senderName,
      text,
      imageUrl,
      contextTag,
    });
  };

  const handleSendAdminChat = async (threadId: string, text: string, imageUrl?: string) => {
    if (!authUser || !isSellerAdmin) {
      throw new Error('ADMIN_REQUIRED');
    }
    const th = chatThreads.find((c) => c.id === threadId);
    await sendChatMessageDoc({
      threadId,
      buyerId: th?.buyerId || threadId.replace(/^thread-/, ''),
      buyerName: th?.buyerName || 'Buyer',
      buyerPhone: th?.buyerPhone || '',
      senderRole: 'admin',
      senderUid: authUser.uid,
      senderName: `${brand.storeName || 'Shoptopia'} Support`,
      text,
      imageUrl,
    });
  };

  const handleDeleteChatMessage = async (threadId: string, messageId: string) => {
    if (!authUser) {
      throw new Error('AUTH_REQUIRED');
    }
    await deleteChatMessageDoc(threadId, messageId);
  };

  const handleMarkThreadRead = (threadId: string) => {
    if (!authUser || !isSellerAdmin) return;
    if (!chatThreads.some((c) => c.id === threadId)) return;
    void markThreadMessagesRead(threadId, 'admin').catch(() => undefined);
  };

  // Popular & Filtered Catalog
  const popularProducts = useMemo(() => {
    return products.filter((p) => p.popular).slice(0, 3);
  }, [products]);

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = products.filter((p) => {
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (popularOnly && !p.popular) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.nameMm.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'newest') return (b.createdAt || '').localeCompare(a.createdAt || '');
      return (b.soldCount || 0) - (a.soldCount || 0);
    });
  }, [products, selectedCategory, popularOnly, searchQuery, sortBy]);

  const totalBagCount = cart.reduce((s, c) => s + c.quantity, 0);
  const myOrders = authUser ? orders.filter((o) => o.buyerId === authUser.uid) : [];
  const loading = !productsLoaded && !fallbackSeed;

  const jumpToCategory = useCallback((cat: string) => {
    navigate('shop');
    setSelectedCategory(cat);
    window.setTimeout(() => {
      catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }, [navigate]);

  // Deep-link handling from OS Notification Bar clicks (?openChat=1, ?category=..., or SW postMessage)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldOpenChat = params.get('openChat') === '1';
    const targetCategory = params.get('category');
    if (shouldOpenChat || targetCategory) {
      if (shouldOpenChat) {
        setChatOpen(true);
      } else if (targetCategory) {
        jumpToCategory(targetCategory);
      }
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (!('serviceWorker' in navigator)) return;
    const onSwMessage = (event: MessageEvent) => {
      const payload = event.data as {
        type?: string;
        actionTarget?: string;
        notifId?: string;
      } | null;
      if (!payload || payload.type !== 'NOTIFICATION_CLICKED') return;
      if (payload.notifId) markNotificationRead(payload.notifId);
      const target = payload.actionTarget || 'none';
      if (target === 'orders') {
        navigate('orders');
      } else if (target === 'chat') {
        setChatOpen(true);
      } else if (target === 'shop') {
        navigate('shop');
      } else if (target.startsWith('category:')) {
        jumpToCategory(target.slice('category:'.length));
      } else {
        setNotificationsOpen(true);
      }
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
  }, [jumpToCategory, markNotificationRead, navigate]);

  const handleUtilitySignIn = () => {
    setAuthUiError('');
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-zinc-900 dark:bg-[#0D0F12] dark:text-zinc-100 transition-colors">
      {/* Buyer Storefront Navigation Bar (Hidden on dedicated /seller or /admin route) */}
      {view !== 'admin' ? (
        <>
          <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-[#12151B]/95 backdrop-blur-sm">
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-3 md:gap-8">
              {/* Zone 1: Single-line Brand Wordmark */}
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('shop');
                }}
                className="inline-flex items-center gap-2 min-w-0 font-display text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 whitespace-nowrap cursor-pointer"
              >
                {brand.logoImage && (
                  <img
                    src={normalizeImageSrcSync(brand.logoImage)}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={(e) => e.currentTarget.classList.add('hidden')}
                    onLoad={(e) => e.currentTarget.classList.remove('hidden')}
                    className="h-7 w-7 rounded-md object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                  />
                )}
                <span className="truncate">{brand.storeName}</span>
              </a>

              {/* Zone 2: Desktop Single-line Buyer Nav Links */}
              <nav
                aria-label="Primary navigation"
                className="hidden md:flex items-center gap-6 lg:gap-7 text-sm font-medium"
              >
                {(
                  [
                    { id: 'shop', href: '/', label: dict.nav.shop },
                    {
                      id: 'wishlist',
                      href: '/wishlist',
                      label: `${dict.nav.wishlist}${wishlist.length ? ` (${wishlist.length})` : ''}`,
                    },
                    { id: 'orders', href: '/orders', label: dict.nav.orders },
                    { id: 'profile', href: '/profile', label: dict.nav.profile },
                  ] as const
                ).map((item) => {
                  const active = view === item.id;
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(item.id);
                      }}
                      className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100 font-semibold'
                          : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                      }`}
                    >
                      {item.label}
                    </a>
                  );
                })}
              </nav>

              {/* Zone 3: Single Primary Action */}
              <button
                type="button"
                onClick={() => {
                  setDirectBuyRef(null);
                  setCartOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="font-mono-tabular">
                  {dict.nav.bag} ({totalBagCount})
                </span>
              </button>
            </div>

            {/* Mobile Primary Navigation Row (Always visible on phone screens) */}
            <nav
              aria-label="Mobile navigation"
              className="md:hidden border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-900/50"
            >
              <div className="mx-auto max-w-[1280px] grid grid-cols-4 px-1">
                {(
                  [
                    { id: 'shop', href: '/', label: dict.nav.shop, Icon: Store, count: 0 },
                    {
                      id: 'wishlist',
                      href: '/wishlist',
                      label: dict.nav.wishlist,
                      Icon: Heart,
                      count: wishlist.length,
                    },
                    { id: 'orders', href: '/orders', label: dict.nav.orders, Icon: Package, count: 0 },
                    { id: 'profile', href: '/profile', label: dict.nav.profile, Icon: UserIcon, count: 0 },
                  ] as const
                ).map(({ id, href, label, Icon, count }) => {
                  const active = view === id;
                  return (
                    <a
                      key={id}
                      href={href}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(id);
                      }}
                      className={`flex flex-col items-center justify-center gap-1 py-2 px-1 border-b-2 text-[11px] leading-tight transition-colors cursor-pointer ${
                        active
                          ? 'border-zinc-900 dark:border-zinc-100 bg-white dark:bg-[#12151B] text-zinc-900 dark:text-zinc-100 font-semibold'
                          : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium'
                      }`}
                    >
                      <span className="relative inline-flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                        {count > 0 && (
                          <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[9px] font-mono-tabular font-bold flex items-center justify-center">
                            {count}
                          </span>
                        )}
                      </span>
                      <span className="truncate max-w-full">{label}</span>
                    </a>
                  );
                })}
              </div>
            </nav>
          </header>

          {/* Secondary Workspace Utility Strip */}
          <div className="border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#12151B]">
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-2 flex flex-wrap items-center justify-start sm:justify-end gap-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => navigate('profile')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                    <span className="max-w-[120px] truncate">
                      {profile.name !== 'Guest Buyer'
                        ? profile.name
                        : authUser?.displayName || authUser?.phoneNumber || dict.nav.profile}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleUtilitySignIn}
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{dict.auth.signInOrUp}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setLang((l) => (l === 'en' ? 'mm' : 'en'))}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{lang === 'en' ? 'EN / မြန်မာ' : 'မြန်မာ / EN'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDark((d) => !d)}
                  aria-label="Toggle dark mode"
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>{dark ? dict.modes.light : dict.modes.dark}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openChatWithContext()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{dict.modes.liveChat}</span>
                  {unreadBuyerCount > 0 && (
                    <span className="font-mono-tabular font-bold text-amber-600 dark:text-amber-400">
                      ({unreadBuyerCount})
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setNotificationsOpen(true)}
                  aria-label={dict.notifications.bellLabel}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>{dict.notifications.bellLabel}</span>
                  {unreadNotifCount > 0 && (
                    <span className="font-mono-tabular font-bold text-amber-600 dark:text-amber-400">
                      ({unreadNotifCount})
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Dedicated Seller Admin Header */
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12151B]">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 min-w-0">
              {brand.logoImage && (
                <img
                  src={brand.logoImage}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={(e) => e.currentTarget.classList.add('hidden')}
                  onLoad={(e) => e.currentTarget.classList.remove('hidden')}
                  className="h-6 w-6 rounded object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                />
              )}
              <span className="font-display text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100 whitespace-nowrap truncate">
                {brand.storeName}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                {dict.admin.title}
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => setLang((l) => (l === 'en' ? 'mm' : 'en'))}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{lang === 'en' ? 'EN / မြန်မာ' : 'မြန်မာ / EN'}</span>
              </button>
              <button
                type="button"
                onClick={() => setDark((d) => !d)}
                aria-label="Toggle dark mode"
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 whitespace-nowrap cursor-pointer"
              >
                {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span>{dark ? dict.modes.light : dict.modes.dark}</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Container */}
      <main className="flex-1 mx-auto w-full max-w-[1280px] px-4 sm:px-6 py-8">
        {loading || (view === 'admin' && !authReady) ? (
          <div className="space-y-8">
            <div className="h-72 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-80 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : view === 'admin' ? (
          !authUser ? (
            <div className="max-w-md mx-auto my-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-8 space-y-5 shadow-sm">
              <div className="flex items-center gap-2.5 text-zinc-900 dark:text-zinc-100">
                <ShieldCheck className="w-5 h-5" />
                <h1 className="font-display text-lg font-bold">{dict.auth.sellerGateTitle}</h1>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {dict.auth.sellerGateDesc}
              </p>
              {authUiError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  {authUiError}
                </p>
              )}
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={async () => {
                    setAuthUiError('');
                    try {
                      await handleGoogleSignIn();
                    } catch {
                      setAuthUiError(dict.auth.popupError);
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-5 py-2.5 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{dict.auth.signInGoogle}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('shop')}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  {dict.admin.backToStore}
                </button>
              </div>
            </div>
          ) : !isSellerAdmin ? (
            <div className="max-w-md mx-auto my-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-8 space-y-5 shadow-sm">
              <h1 className="font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {dict.auth.sellerGateTitle}
              </h1>
              <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                {dict.auth.sellerUnauthorized} ({authUser.email})
              </p>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{dict.auth.signOut}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('shop')}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
                >
                  {dict.admin.backToStore}
                </button>
              </div>
            </div>
          ) : (
            <AdminDashboard
              lang={lang}
              adminEmail={authUser.email}
              products={products}
              categories={categories}
              banners={banners}
              orders={orders}
              chatThreads={hydratedChatThreads}
              notifications={adminAllNotifs}
              activeThreadId={activeListenThreadId}
              paymentSettings={paymentSettings}
              brand={brand}
              analyticsResetAt={analyticsResetAt}
              connected={cloudConnected}
              chatSyncError={chatSyncError}
              loadingActiveThread={Boolean(activeListenThreadId && !loadedThreadIds[activeListenThreadId])}
              onExitAdmin={() => navigate('shop')}
              onSignOut={() => void handleSignOut()}
              onSelectThread={setSelectedAdminThreadId}
              onSendAdminChat={handleSendAdminChat}
              onDeleteAdminMessage={handleDeleteChatMessage}
              onMarkThreadRead={handleMarkThreadRead}
            />
          )
        ) : view === 'wishlist' ? (
          <WishlistView
            isAuthenticated={isAuthenticated}
            products={products}
            wishlistIds={wishlist}
            lang={lang}
            layout={buyerProductLayout}
            onChangeLayout={updateBuyerProductLayout}
            onSignInGoogle={handleGoogleSignIn}
            onRemoveWishlist={(id) => void handleToggleWishlist(id)}
            onMoveToBag={(prod) => {
              handleAddToBag(prod);
              void handleToggleWishlist(prod.id);
            }}
            onBuyNow={(prod) => handleBuyNow(prod)}
            onOpenDetail={(prod) => setDetailProductId(prod.id)}
          />
        ) : view === 'orders' ? (
          <OrdersView
            isAuthenticated={isAuthenticated}
            loading={Boolean(authUser) && ordersLoadedUid !== authUser?.uid}
            orders={myOrders}
            products={products}
            lang={lang}
            onSignInGoogle={handleGoogleSignIn}
            onChatAboutOrder={(ord) => openChatWithContext(`Order #${ord.id}`)}
          />
        ) : view === 'profile' ? (
          <ProfileView
            isAuthenticated={isAuthenticated}
            authEmail={authUser?.email}
            authName={authUser?.displayName}
            buyerId={buyerId}
            profile={profile}
            addresses={addresses}
            ordersCount={myOrders.length}
            wishlistCount={wishlist.length}
            chatCount={buyerThread?.messages.length || 0}
            lang={lang}
            onSignInGoogle={handleGoogleSignIn}
            onSignOut={handleSignOut}
            onSwitchAccount={() => {
              void handleSignOut().then(() => setAuthModalOpen(true));
            }}
            onGoToOrders={() => navigate('orders')}
            onGoToWishlist={() => navigate('wishlist')}
            onOpenChat={() => openChatWithContext()}
          />
        ) : (
          /* STOREFRONT HOME VIEW (Logo Banner + Banner Slider -> Popular Items -> Filterable Catalog) */
          <div className="space-y-12">
            {/* 1. Compact Home Logo Banner & Hero Slider */}
            <div className="space-y-4">
              <StoreLogoBanner brand={brand} lang={lang} />
              <BannerSlider banners={banners} lang={lang} onSelectCategory={jumpToCategory} />
            </div>

            {/* 2. Popular Items Showcase */}
            {popularProducts.length > 0 && (
              <section aria-label={dict.home.popularHeading} className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                      {dict.home.popularHeading}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {dict.home.popularSub}
                    </p>
                  </div>

                  <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#16191F] p-0.5">
                    <button
                      type="button"
                      onClick={() => updateBuyerProductLayout('grid2')}
                      aria-label={dict.home.grid2View}
                      title={dict.home.grid2View}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        buyerProductLayout === 'grid2'
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{dict.home.grid2View}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateBuyerProductLayout('list')}
                      aria-label={dict.home.listView}
                      title={dict.home.listView}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        buyerProductLayout === 'list'
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{dict.home.listView}</span>
                    </button>
                  </div>
                </div>

                <div
                  className={
                    buyerProductLayout === 'list'
                      ? 'grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-5'
                      : 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6'
                  }
                >
                  {popularProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      lang={lang}
                      layout={buyerProductLayout}
                      isWishlisted={wishlist.includes(product.id)}
                      onToggleWishlist={(id) => void handleToggleWishlist(id)}
                      onAddToBag={handleAddToBag}
                      onBuyNow={handleBuyNow}
                      onOpenDetail={(prod) => setDetailProductId(prod.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 3. Full Collection with Categories & Search/Filter System */}
            <section
              ref={catalogRef}
              aria-label={dict.home.catalogHeading}
              className="space-y-6 pt-4 border-t border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {dict.home.catalogHeading}
                </h2>

                {/* Search + Sort + Popular Filter */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 sm:flex-none sm:w-72">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={dict.home.searchPlaceholder}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#16191F] pl-9 pr-8 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPopularOnly((p) => !p)}
                    className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      popularOnly
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                        : 'bg-white dark:bg-[#16191F] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                    }`}
                  >
                    {dict.home.popularOnly}
                  </button>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    aria-label="Sort products"
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#16191F] px-3 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 focus:outline-none cursor-pointer"
                  >
                    <option value="popular">{dict.home.sortPopular}</option>
                    <option value="price-asc">{dict.home.sortPriceAsc}</option>
                    <option value="price-desc">{dict.home.sortPriceDesc}</option>
                    <option value="newest">{dict.home.sortNewest}</option>
                  </select>

                  <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#16191F] p-0.5">
                    <button
                      type="button"
                      onClick={() => updateBuyerProductLayout('grid2')}
                      aria-label={dict.home.grid2View}
                      title={dict.home.grid2View}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        buyerProductLayout === 'grid2'
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{dict.home.grid2View}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateBuyerProductLayout('list')}
                      aria-label={dict.home.listView}
                      title={dict.home.listView}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        buyerProductLayout === 'list'
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

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {['All', ...categories].map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'bg-zinc-200/70 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {cat === 'All' ? dict.home.allCategories : cat}
                    </button>
                  );
                })}
              </div>

              {/* Product Grid */}
              {filteredCatalog.length === 0 ? (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-12 text-center">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
                    {dict.home.noResults}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setSearchQuery('');
                      setPopularOnly(false);
                    }}
                    className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 cursor-pointer"
                  >
                    {dict.home.clearFilters}
                  </button>
                </div>
              ) : (
                <div
                  className={
                    buyerProductLayout === 'list'
                      ? 'grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-5'
                      : 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6'
                  }
                >
                  {filteredCatalog.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      lang={lang}
                      layout={buyerProductLayout}
                      isWishlisted={wishlist.includes(product.id)}
                      onToggleWishlist={(id) => void handleToggleWishlist(id)}
                      onAddToBag={handleAddToBag}
                      onBuyNow={handleBuyNow}
                      onOpenDetail={(prod) => setDetailProductId(prod.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Clean Editorial Footer (Buyer Storefront only) */}
      {view !== 'admin' && (
        <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12151B] mt-16">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <div>
              <span className="font-display font-semibold text-zinc-900 dark:text-zinc-100">
                {brand.storeName}
              </span>
              <span className="mx-2">·</span>
              <span>Yangon & Mandalay Retail · KPay, WavePay & Bank Transfer Accepted</span>
            </div>
            <div className="flex items-center gap-5">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('shop');
                }}
                className="hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                {dict.nav.shop}
              </a>
              <a
                href="/wishlist"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('wishlist');
                }}
                className="hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                {dict.nav.wishlist}
              </a>
              <a
                href="/orders"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('orders');
                }}
                className="hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                {dict.nav.orders}
              </a>
              <a
                href="/profile"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('profile');
                }}
                className="hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              >
                {dict.nav.profile}
              </a>
            </div>
          </div>
        </footer>
      )}

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={detailProduct}
        lang={lang}
        isWishlisted={detailProduct ? wishlist.includes(detailProduct.id) : false}
        onClose={() => setDetailProductId(null)}
        onToggleWishlist={(id) => void handleToggleWishlist(id)}
        onAddToBag={handleAddToBag}
        onBuyNow={handleBuyNow}
        onAskSeller={(prod) =>
          openChatWithContext(lang === 'mm' ? prod.nameMm : prod.name)
        }
      />

      {/* Cart & Checkout Slide-over Drawer */}
      <CartCheckoutDrawer
        open={cartOpen}
        isAuthenticated={isAuthenticated}
        lang={lang}
        buyerId={buyerId}
        profile={profile}
        cart={cart}
        directBuyItem={directBuyItem}
        addresses={addresses}
        paymentSettings={paymentSettings}
        onSignInGoogle={handleGoogleSignIn}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onUpdateDirectBuyQty={handleUpdateDirectBuyQty}
        onCancelDirectBuy={() => setDirectBuyRef(null)}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={() => setCartRefs([])}
        onGoToProfile={() => navigate('profile')}
        onGoToOrders={() => navigate('orders')}
      />

      {/* Real-Time Buyer Chat Drawer */}
      <LiveChatWidget
        open={chatOpen}
        isAuthenticated={isAuthenticated}
        connected={cloudConnected}
        loadingHistory={Boolean(
          authUser &&
            (!chatThreadsLoaded ||
              (buyerThread && !loadedThreadIds[buyerThread.id]))
        )}
        syncError={chatSyncError}
        lang={lang}
        thread={buyerThread}
        buyerName={
          profile.name !== 'Guest Buyer'
            ? profile.name
            : authUser?.displayName || authUser?.phoneNumber || 'Buyer'
        }
        contextTag={chatContext}
        onSignInGoogle={handleGoogleSignIn}
        onClearContext={() => setChatContext(undefined)}
        onClose={() => setChatOpen(false)}
        onSendMessage={handleSendBuyerChat}
        onDeleteMessage={handleDeleteChatMessage}
      />

      {/* Floating Chat Trigger (Buyer Mode when closed) */}
      {!chatOpen && view !== 'admin' && (
        <button
          type="button"
          onClick={() => openChatWithContext()}
          aria-label={dict.modes.liveChat}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-zinc-900 dark:bg-zinc-100 px-4 py-3 text-xs font-semibold text-white dark:text-zinc-900 shadow-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-transform hover:-translate-y-0.5 cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>{dict.modes.liveChat}</span>
          {unreadBuyerCount > 0 && (
            <span className="font-mono-tabular px-1.5 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold">
              {unreadBuyerCount}
            </span>
          )}
        </button>
      )}

      {/* Buyer Sign-In / Sign-Up Modal (Gmail / Google only) */}
      {authModalOpen && !isAuthenticated && view !== 'admin' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label={dict.auth.signInOrUp}
          onClick={() => {
            setAuthModalOpen(false);
            setPendingWishlistId(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setAuthModalOpen(false);
                setPendingWishlistId(null);
              }}
              aria-label="Close sign-in dialog"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pr-8">
              <BuyerAuthPanel
                lang={lang}
                onSignInGoogle={handleGoogleSignIn}
                onAuthSuccess={() => setAuthModalOpen(false)}
                title={dict.auth.buyerGateTitle}
                subtitle={dict.auth.buyerGateDesc}
              />
            </div>
          </div>
        </div>
      )}

      {/* Buyer Real-Time Notifications Drawer & Live Incoming Alert Banner */}
      {view !== 'admin' && (
        <>
          <BuyerNotificationsDrawer
            open={notificationsOpen}
            lang={lang}
            notifications={buyerNotifications}
            readIds={readNotifIds}
            isAuthenticated={isAuthenticated}
            pushSupported={pushSupported}
            pushPermission={pushPermission}
            pushSubscribed={pushSubscribed}
            pushEnabling={pushEnabling}
            iosNeedsHomeScreen={iosNeedsHomeScreen}
            onEnablePush={() => void handleEnablePhonePush()}
            onDisablePush={() => void handleDisablePhonePush()}
            onOpenSignIn={() => {
              setNotificationsOpen(false);
              setAuthModalOpen(true);
            }}
            onClose={() => setNotificationsOpen(false)}
            onMarkRead={markNotificationRead}
            onMarkAllRead={markAllNotificationsRead}
            onAction={(notif) => {
              markNotificationRead(notif.id);
              setNotificationsOpen(false);
              if (notif.actionTarget === 'orders') {
                navigate('orders');
              } else if (notif.actionTarget === 'chat') {
                openChatWithContext();
              } else if (notif.actionTarget === 'shop') {
                navigate('shop');
              } else if (notif.actionTarget?.startsWith('category:')) {
                jumpToCategory(notif.actionTarget.slice('category:'.length));
              }
            }}
          />

          <LiveNotificationBanner
            lang={lang}
            notification={liveIncomingNotif}
            onDismiss={() => setLiveIncomingNotif(null)}
            onOpen={(notif) => {
              markNotificationRead(notif.id);
              setLiveIncomingNotif(null);
              if (notif.actionTarget === 'orders') {
                navigate('orders');
              } else if (notif.actionTarget === 'chat') {
                openChatWithContext();
              } else if (notif.actionTarget === 'shop') {
                navigate('shop');
              } else if (notif.actionTarget?.startsWith('category:')) {
                jumpToCategory(notif.actionTarget.slice('category:'.length));
              } else {
                setNotificationsOpen(true);
              }
            }}
          />
        </>
      )}

      <OfflineIndicator lang={lang} />

      {/* Brief Non-Intrusive Feedback Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2.5 text-xs font-medium text-white dark:text-zinc-900 shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
