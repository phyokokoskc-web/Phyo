export type Language = 'en' | 'mm';

export type OrderStatus = 'Pending' | 'Verified' | 'Shipped' | 'Delivered' | 'Cancelled';

export type PaymentMethod = 'KPay' | 'WavePay' | 'BankTransfer';

export interface Product {
  id: string;
  sku: string;
  name: string;
  nameMm: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  popular: boolean;
  rating: number;
  soldCount: number;
  image: string;
  variants: string[];
  description: string;
  descriptionMm: string;
  createdAt: string;
}

export interface BannerSlide {
  id: string;
  kicker: string;
  kickerMm: string;
  title: string;
  titleMm: string;
  subtitle: string;
  subtitleMm: string;
  ctaLabel: string;
  ctaLabelMm: string;
  targetCategory: string;
  image: string;
}

export interface Address {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  city: string;
  township: string;
  streetAddress: string;
  notes?: string;
  isDefault: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface BuyerAccount {
  profile: UserProfile;
  addresses: Address[];
  wishlist: string[];
}

export interface OrderItem {
  productId: string;
  name: string;
  nameMm: string;
  price: number;
  quantity: number;
  variant: string;
  image: string;
}

export interface OrderTrackingStep {
  status: OrderStatus;
  timestamp: string;
  note: string;
}

export interface Order {
  id: string;
  buyerId: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: Address;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  bankName?: string;
  status: OrderStatus;
  trackingHistory: OrderTrackingStep[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderRole: 'buyer' | 'admin';
  senderName: string;
  text: string;
  imageUrl?: string;
  contextTag?: string;
  createdAt: string;
  read: boolean;
}

export interface ChatThread {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  lastMessageAt: string;
  messages: ChatMessage[];
}

export interface CartItem {
  product: Product;
  quantity: number;
  variant: string;
}

export interface WalletAccount {
  enabled: boolean;
  accountName: string;
  phone: string;
  qrImage?: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  enabled: boolean;
}

export interface PaymentSettings {
  kpay: WalletAccount;
  wavepay: WalletAccount;
  bankAccounts: BankAccount[];
}

export interface StoreBrandConfig {
  storeName: string;
  logoImage: string;
  bannerTitle: string;
  bannerTitleMm: string;
  bannerSubtitle: string;
  bannerSubtitleMm: string;
  showLogoBanner: boolean;
}

export type NotificationType = 'promo' | 'order' | 'restock' | 'info';

export interface StoreNotification {
  id: string;
  targetBuyerId: string;
  targetBuyerName: string;
  type: NotificationType;
  title: string;
  message: string;
  actionTarget?: string;
  senderName: string;
  createdAt: string;
}

export interface BootstrapPayload {
  products: Product[];
  categories: string[];
  banners: BannerSlide[];
  orders: Order[];
  profile: UserProfile;
  addresses: Address[];
  wishlist: string[];
  chatThreads: ChatThread[];
  paymentSettings: PaymentSettings;
  brand?: StoreBrandConfig;
  analyticsResetAt?: string;
}

export type WsServerEvent =
  | { type: 'init'; payload: { connectedClients: number } }
  | { type: 'chat:message'; payload: { threadId: string; message: ChatMessage; thread?: ChatThread } }
  | { type: 'chat:read'; payload: { threadId: string; readerRole: 'buyer' | 'admin' } }
  | { type: 'order:created'; payload: Order }
  | { type: 'order:updated'; payload: Order }
  | { type: 'product:created'; payload: Product }
  | { type: 'product:updated'; payload: Product }
  | { type: 'product:deleted'; payload: { id: string } }
  | { type: 'banners:updated'; payload: BannerSlide[] }
  | { type: 'categories:updated'; payload: { categories: string[]; products: Product[]; banners: BannerSlide[] } }
  | { type: 'paymentSettings:updated'; payload: PaymentSettings }
  | { type: 'analytics:reset'; payload: { analyticsResetAt: string; clearOrders: boolean; orders: Order[]; products: Product[] } };
