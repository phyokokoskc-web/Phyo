import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  ShoppingBag,
  Sun,
  Moon,
  MessageSquare,
  Globe,
  X,
} from 'lucide-react';
import type {
  Address,
  BannerSlide,
  BootstrapPayload,
  CartItem,
  ChatThread,
  Language,
  Order,
  PaymentSettings,
  Product,
  UserProfile,
  WsServerEvent,
} from './types';
import { t } from './i18n';
import { useWebSocket } from './hooks/useWebSocket';
import { BannerSlider } from './components/BannerSlider';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartCheckoutDrawer } from './components/CartCheckoutDrawer';
import { OrdersView } from './components/OrdersView';
import { ProfileView } from './components/ProfileView';
import { WishlistView } from './components/WishlistView';
import { LiveChatWidget } from './components/LiveChatWidget';
import { AdminDashboard } from './components/AdminDashboard';

type AppView = 'shop' | 'wishlist' | 'orders' | 'profile' | 'admin';
type SortOption = 'popular' | 'price-asc' | 'price-desc' | 'newest';

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
  return `/${v}`;
}

export default function App() {
  const [view, setView] = useState<AppView>(() => pathToView(window.location.pathname));
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('yg_lang') as Language) || 'en';
  });
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('yg_theme');
    return saved === 'dark';
  });

  const [buyerId, setBuyerId] = useState<string>(() => {
    const existing = localStorage.getItem('yg_buyer_id');
    if (existing) return existing;
    const generated = `buyer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    localStorage.setItem('yg_buyer_id', generated);
    return generated;
  });

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [banners, setBanners] = useState<BannerSlide[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    id: buyerId,
    name: 'Guest Buyer',
    email: '',
    phone: '',
  });
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    kpay: { enabled: true, accountName: 'Su&KoKo Official (KBZPay)', phone: '09-784-512-900', qrImage: '' },
    wavepay: { enabled: true, accountName: 'Su&KoKo Official (WavePay)', phone: '09-799-310-445', qrImage: '' },
    bankAccounts: [],
  });
  const [analyticsResetAt, setAnalyticsResetAt] = useState<string | undefined>(undefined);

  // Storefront Filter & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [popularOnly, setPopularOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('popular');

  // Cart, Modals, Chat (namespaced per buyerId)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved =
        localStorage.getItem(`yg_cart_${buyerId}`) || localStorage.getItem('yg_cart');
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [directBuyItem, setDirectBuyItem] = useState<CartItem | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);

  const isAdminRef = useRef(view === 'admin');
  const buyerIdRef = useRef(buyerId);
  useEffect(() => {
    isAdminRef.current = view === 'admin';
  }, [view]);
  useEffect(() => {
    buyerIdRef.current = buyerId;
    localStorage.setItem('yg_buyer_id', buyerId);
  }, [buyerId]);

  const catalogRef = useRef<HTMLElement | null>(null);
  const dict = t(lang);

  // Sync Dark Mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      localStorage.setItem('yg_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('yg_theme', 'light');
    }
  }, [dark]);

  useEffect(() => {
    localStorage.setItem('yg_lang', lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem(`yg_cart_${buyerId}`, JSON.stringify(cart));
  }, [cart, buyerId]);

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

  // Initial & role-scoped server bootstrap
  const isAdminView = view === 'admin';
  useEffect(() => {
    let active = true;
    const url = isAdminView
      ? '/api/bootstrap?role=admin'
      : `/api/bootstrap?buyerId=${encodeURIComponent(buyerId)}`;
    fetch(url)
      .then((res) => res.json())
      .then((data: BootstrapPayload) => {
        if (!active) return;
        setProducts(data.products);
        setCategories(data.categories);
        setBanners(data.banners);
        setOrders(data.orders);
        setProfile(data.profile);
        setAddresses(data.addresses);
        setWishlist(data.wishlist);
        setChatThreads(data.chatThreads);
        if (data.paymentSettings) setPaymentSettings(data.paymentSettings);
        setAnalyticsResetAt(data.analyticsResetAt);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAdminView, buyerId]);

  // Real-time WebSocket Event Handler (Idempotent)
  const handleWsEvent = useCallback((event: WsServerEvent) => {
    switch (event.type) {
      case 'product:created':
        setProducts((prev) =>
          prev.some((p) => p.id === event.payload.id) ? prev : [event.payload, ...prev]
        );
        break;
      case 'product:updated':
        setProducts((prev) =>
          prev.map((p) => (p.id === event.payload.id ? event.payload : p))
        );
        break;
      case 'product:deleted':
        setProducts((prev) => prev.filter((p) => p.id !== event.payload.id));
        break;
      case 'order:created':
        if (!isAdminRef.current && event.payload.buyerId !== buyerIdRef.current) break;
        setOrders((prev) =>
          prev.some((o) => o.id === event.payload.id) ? prev : [event.payload, ...prev]
        );
        break;
      case 'order:updated':
        if (!isAdminRef.current && event.payload.buyerId !== buyerIdRef.current) break;
        setOrders((prev) =>
          prev.map((o) => (o.id === event.payload.id ? event.payload : o))
        );
        break;
      case 'chat:message': {
        const { threadId, message, thread } = event.payload;
        if (
          !isAdminRef.current &&
          threadId !== `thread-${buyerIdRef.current}` &&
          thread?.buyerId !== buyerIdRef.current
        ) {
          break;
        }
        setChatThreads((prev) => {
          const exists = prev.find((th) => th.id === threadId);
          if (!exists) {
            return thread ? [thread, ...prev] : prev;
          }
          return prev.map((th) => {
            if (th.id !== threadId) return th;
            if (th.messages.some((m) => m.id === message.id)) return th;
            return {
              ...th,
              lastMessageAt: message.createdAt,
              messages: [...th.messages, message],
            };
          });
        });
        break;
      }
      case 'chat:read': {
        const { threadId, readerRole } = event.payload;
        if (!isAdminRef.current && threadId !== `thread-${buyerIdRef.current}`) break;
        setChatThreads((prev) =>
          prev.map((th) => {
            if (th.id !== threadId) return th;
            return {
              ...th,
              messages: th.messages.map((m) =>
                m.senderRole !== readerRole ? { ...m, read: true } : m
              ),
            };
          })
        );
        break;
      }
      case 'banners:updated':
        setBanners(event.payload);
        break;
      case 'categories:updated':
        setCategories(event.payload.categories);
        setProducts(event.payload.products);
        setBanners(event.payload.banners);
        break;
      case 'paymentSettings:updated':
        setPaymentSettings(event.payload);
        break;
      case 'analytics:reset':
        setAnalyticsResetAt(event.payload.analyticsResetAt);
        setOrders(
          isAdminRef.current
            ? event.payload.orders
            : event.payload.orders.filter((o) => o.buyerId === buyerIdRef.current)
        );
        setProducts(event.payload.products);
        break;
      default:
        break;
    }
  }, []);

  const { connected, sendMessage } = useWebSocket(handleWsEvent);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 2400);
  };

  // Cart Handlers
  const handleAddToBag = (product: Product, variant?: string) => {
    if (product.stock <= 0) return;
    const chosenVariant = variant || product.variants[0] || 'Standard';
    setCart((prev) => {
      const existing = prev.find(
        (c) => c.product.id === product.id && c.variant === chosenVariant
      );
      if (existing) {
        return prev.map((c) =>
          c.product.id === product.id && c.variant === chosenVariant
            ? { ...c, quantity: Math.min(product.stock, c.quantity + 1) }
            : c
        );
      }
      return [...prev, { product, quantity: 1, variant: chosenVariant }];
    });
    showToast(`${lang === 'mm' ? product.nameMm : product.name} added to bag`);
  };

  const handleBuyNow = (product: Product, variant?: string) => {
    if (product.stock <= 0) return;
    const chosenVariant = variant || product.variants[0] || 'Standard';
    setDirectBuyItem({ product, quantity: 1, variant: chosenVariant });
    setCartOpen(true);
  };

  const handleUpdateDirectBuyQty = (delta: number) => {
    setDirectBuyItem((prev) => {
      if (!prev) return null;
      const nextQty = Math.max(1, Math.min(prev.product.stock, prev.quantity + delta));
      return { ...prev, quantity: nextQty };
    });
  };

  const handleUpdateQty = (productId: string, variant: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product.id === productId && c.variant === variant) {
            const nextQty = c.quantity + delta;
            if (nextQty <= 0) return null;
            return { ...c, quantity: Math.min(c.product.stock, nextQty) };
          }
          return c;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveCartItem = (productId: string, variant: string) => {
    setCart((prev) =>
      prev.filter((c) => !(c.product.id === productId && c.variant === variant))
    );
  };

  // Wishlist Toggle
  const handleToggleWishlist = async (productId: string) => {
    const res = await fetch('/api/wishlist/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, buyerId }),
    });
    if (res.ok) {
      const data = (await res.json()) as { wishlist: string[] };
      setWishlist(data.wishlist);
    }
  };

  // Chat Actions
  const buyerThread =
    chatThreads.find((th) => th.id === `thread-${buyerId}` || th.buyerId === buyerId) ||
    undefined;
  const unreadBuyerCount = buyerThread
    ? buyerThread.messages.filter((m) => m.senderRole === 'admin' && !m.read).length
    : 0;

  const openChatWithContext = (tag?: string) => {
    setChatContext(tag);
    setChatOpen(true);
    if (buyerThread) {
      sendMessage('chat:read', { threadId: buyerThread.id, readerRole: 'buyer' });
    }
  };

  const handleSendBuyerChat = (text: string, contextTag?: string) => {
    const threadId = buyerThread?.id || `thread-${buyerId}`;
    const senderName = profile.name || 'Guest Buyer';
    const sent = sendMessage('chat:send', {
      threadId,
      buyerId,
      senderRole: 'buyer',
      senderName,
      text,
      contextTag,
    });
    if (!sent) {
      fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          buyerId,
          senderRole: 'buyer',
          senderName,
          text,
          contextTag,
        }),
      });
    }
  };

  const handleSendAdminChat = (threadId: string, text: string) => {
    const sent = sendMessage('chat:send', {
      threadId,
      senderRole: 'admin',
      senderName: 'Su&KoKo Support',
      text,
    });
    if (!sent) {
      fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          senderRole: 'admin',
          senderName: 'Su&KoKo Support',
          text,
        }),
      });
    }
  };

  const handleMarkThreadRead = (threadId: string) => {
    sendMessage('chat:read', { threadId, readerRole: 'admin' });
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
      if (sortBy === 'newest') return b.createdAt.localeCompare(a.createdAt);
      return b.soldCount - a.soldCount;
    });
  }, [products, selectedCategory, popularOnly, searchQuery, sortBy]);

  const totalBagCount = cart.reduce((s, c) => s + c.quantity, 0);
  const myOrders = orders.filter((o) => o.buyerId === profile.id);

  const jumpToCategory = (cat: string) => {
    navigate('shop');
    setSelectedCategory(cat);
    window.setTimeout(() => {
      catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-zinc-900 dark:bg-[#0D0F12] dark:text-zinc-100 transition-colors">
      {/* Buyer Storefront Navigation Bar (Hidden on dedicated /admin route) */}
      {view !== 'admin' ? (
        <>
          <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-[#12151B]/95 backdrop-blur-sm">
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
              {/* Zone 1: Single-line Brand Wordmark */}
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('shop');
                }}
                className="font-display text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Su&KoKo
              </a>

              {/* Zone 2: Concise Single-line Buyer Nav Links */}
              <nav className="flex items-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar text-sm font-medium">
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
                  setDirectBuyItem(null);
                  setCartOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs sm:text-sm font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="font-mono-tabular">
                  {dict.nav.bag} ({totalBagCount})
                </span>
              </button>
            </div>
          </header>

          {/* Secondary Workspace Utility Strip */}
          <div className="border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#12151B]">
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">
                {dict.home.freeDeliveryBanner}
              </span>

              <div className="flex items-center gap-3">
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
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Dedicated Seller Admin Header */
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#12151B]">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-display text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                {dict.brand}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
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
        {loading ? (
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
          <AdminDashboard
            lang={lang}
            products={products}
            categories={categories}
            banners={banners}
            orders={orders}
            chatThreads={chatThreads}
            paymentSettings={paymentSettings}
            analyticsResetAt={analyticsResetAt}
            connected={connected}
            onExitAdmin={() => navigate('shop')}
            onProductCreated={(prod) =>
              setProducts((prev) => (prev.some((p) => p.id === prod.id) ? prev : [prod, ...prev]))
            }
            onProductUpdated={(prod) =>
              setProducts((prev) => prev.map((p) => (p.id === prod.id ? prod : p)))
            }
            onProductDeleted={(id) => setProducts((prev) => prev.filter((p) => p.id !== id))}
            onOrderUpdated={(ord) =>
              setOrders((prev) => prev.map((o) => (o.id === ord.id ? ord : o)))
            }
            onBannersUpdated={setBanners}
            onCategoriesUpdated={(payload) => {
              setCategories(payload.categories);
              setProducts(payload.products);
              setBanners(payload.banners);
            }}
            onPaymentSettingsUpdated={setPaymentSettings}
            onAnalyticsReset={(payload) => {
              setAnalyticsResetAt(payload.analyticsResetAt);
              setOrders(payload.orders);
              setProducts(payload.products);
            }}
            onSendAdminChat={handleSendAdminChat}
            onMarkThreadRead={handleMarkThreadRead}
          />
        ) : view === 'wishlist' ? (
          <WishlistView
            products={products}
            wishlistIds={wishlist}
            lang={lang}
            onRemoveWishlist={handleToggleWishlist}
            onMoveToBag={(prod) => {
              handleAddToBag(prod);
              handleToggleWishlist(prod.id);
            }}
            onBuyNow={(prod) => handleBuyNow(prod)}
            onOpenDetail={setDetailProduct}
          />
        ) : view === 'orders' ? (
          <OrdersView
            orders={myOrders}
            lang={lang}
            onChatAboutOrder={(ord) => openChatWithContext(`Order #${ord.id}`)}
          />
        ) : view === 'profile' ? (
          <ProfileView
            buyerId={buyerId}
            profile={profile}
            addresses={addresses}
            lang={lang}
            onProfileSaved={setProfile}
            onAddressesUpdated={setAddresses}
            onAccountSwitched={(nextBuyerId, data) => {
              setBuyerId(nextBuyerId);
              setProfile(data.profile);
              setAddresses(data.addresses);
              setWishlist(data.wishlist);
              setOrders(data.orders);
              setChatThreads(data.chatThreads);
              try {
                const saved = localStorage.getItem(`yg_cart_${nextBuyerId}`);
                setCart(saved ? (JSON.parse(saved) as CartItem[]) : []);
              } catch {
                setCart([]);
              }
            }}
          />
        ) : (
          /* STOREFRONT HOME VIEW (Strictly 3 sections: Banner Slider -> Popular Items -> Filterable Catalog) */
          <div className="space-y-12">
            {/* 1. Banner Slider */}
            <BannerSlider banners={banners} lang={lang} onSelectCategory={jumpToCategory} />

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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {popularProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      lang={lang}
                      isWishlisted={wishlist.includes(product.id)}
                      onToggleWishlist={handleToggleWishlist}
                      onAddToBag={handleAddToBag}
                      onBuyNow={handleBuyNow}
                      onOpenDetail={setDetailProduct}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCatalog.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      lang={lang}
                      isWishlisted={wishlist.includes(product.id)}
                      onToggleWishlist={handleToggleWishlist}
                      onAddToBag={handleAddToBag}
                      onBuyNow={handleBuyNow}
                      onOpenDetail={setDetailProduct}
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
                Su&KoKo
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
        onClose={() => setDetailProduct(null)}
        onToggleWishlist={handleToggleWishlist}
        onAddToBag={handleAddToBag}
        onBuyNow={handleBuyNow}
        onAskSeller={(prod) =>
          openChatWithContext(lang === 'mm' ? prod.nameMm : prod.name)
        }
      />

      {/* Cart & Checkout Slide-over Drawer */}
      <CartCheckoutDrawer
        open={cartOpen}
        lang={lang}
        buyerId={buyerId}
        profile={profile}
        cart={cart}
        directBuyItem={directBuyItem}
        addresses={addresses}
        paymentSettings={paymentSettings}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateQty}
        onUpdateDirectBuyQty={handleUpdateDirectBuyQty}
        onCancelDirectBuy={() => setDirectBuyItem(null)}
        onRemoveItem={handleRemoveCartItem}
        onClearCart={() => setCart([])}
        onAddressesUpdated={setAddresses}
        onGoToProfile={() => navigate('profile')}
        onGoToOrders={() => navigate('orders')}
        onOrderCreated={(ord) =>
          setOrders((prev) => (prev.some((o) => o.id === ord.id) ? prev : [ord, ...prev]))
        }
      />

      {/* Real-Time Buyer Chat Drawer */}
      <LiveChatWidget
        open={chatOpen}
        connected={connected}
        lang={lang}
        thread={buyerThread}
        buyerName={profile.name}
        contextTag={chatContext}
        onClearContext={() => setChatContext(undefined)}
        onClose={() => setChatOpen(false)}
        onSendMessage={handleSendBuyerChat}
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
