import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import {
  generateVapidKeyPair,
  sendWebPushMessage,
  verifyFirebaseAdminToken,
  type PushNotificationPayload,
  type PushSubscriptionInput,
  type VapidConfig,
} from './shared/webPush.ts';
import type {
  Address,
  BannerSlide,
  BuyerAccount,
  ChatMessage,
  ChatThread,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentSettings,
  Product,
  UserProfile,
  WsServerEvent,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
const FIREBASE_CONFIG_FILE = path.resolve(__dirname, 'firebase-applet-config.json');
const ADMIN_EMAIL = 'phyokoko.ctd@gmail.com';

interface StoreData {
  products: Product[];
  categories: string[];
  banners: BannerSlide[];
  orders: Order[];
  buyers: Record<string, BuyerAccount>;
  profile?: UserProfile;
  addresses?: Address[];
  wishlist?: string[];
  chatThreads: ChatThread[];
  paymentSettings: PaymentSettings;
  analyticsResetAt?: string;
}

function defaultPaymentSettings(): PaymentSettings {
  return {
    kpay: {
      enabled: true,
      accountName: 'Shoptopia Official (KBZPay)',
      phone: '09-784-512-900',
      qrImage: '',
    },
    wavepay: {
      enabled: true,
      accountName: 'Shoptopia Official (WavePay)',
      phone: '09-799-310-445',
      qrImage: '',
    },
    bankAccounts: [
      {
        id: 'bank-1',
        bankName: 'KBZ Bank',
        accountNumber: '0443-0104-9002-1820',
        accountHolder: 'Shoptopia Co., Ltd',
        enabled: true,
      },
      {
        id: 'bank-2',
        bankName: 'CB Bank',
        accountNumber: '0010-6005-0008-4912',
        accountHolder: 'Shoptopia Co., Ltd',
        enabled: true,
      },
      {
        id: 'bank-3',
        bankName: 'AYA Bank',
        accountNumber: '2001-4102-8834-0019',
        accountHolder: 'Shoptopia Co., Ltd',
        enabled: true,
      },
    ],
  };
}

function daysAgoIso(daysAgo: number, hourOffset = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hourOffset, 25, 0, 0);
  return d.toISOString();
}

function createSeedData(): StoreData {
  const categories = ['Audio & Tech', 'Watches & Carry', 'Home & Living', 'Footwear'];

  const banners: BannerSlide[] = [
    {
      id: 'bn-1',
      kicker: 'Acoustic Collection',
      kickerMm: 'အသံပိုင်းဆိုင်ရာ စုစည်းမှု',
      title: 'Studio-Grade Wireless Audio',
      titleMm: 'ကြည်လင်ပြတ်သားသော Wireless အသံစနစ်များ',
      subtitle: 'Active noise cancellation and machined aluminum acoustics built for quiet focus.',
      subtitleMm: 'ဆူညံသံလျှော့ချစနစ်နှင့် ဒီဇိုင်းသေသပ်သော နားကြပ်နှင့် စပီကာများ။',
      ctaLabel: 'Shop Audio & Tech',
      ctaLabelMm: 'Audio & Tech ကြည့်ရန်',
      targetCategory: 'Audio & Tech',
      image: '/src/assets/images/banner_tech_audio_1794984087921.jpg',
    },
    {
      id: 'bn-2',
      kicker: 'Morning Rituals',
      kickerMm: 'မနက်ခင်း အိမ်သုံးပစ္စည်းများ',
      title: 'Artisan Ceramic & Oak Living',
      titleMm: 'လက်ရာမြောက် ကြွေထည်နှင့် အိမ်အလှဆင်ပစ္စည်းများ',
      subtitle: 'Hand-glazed stoneware pour-over sets and cordless architectural lighting.',
      subtitleMm: 'သဘာဝအရောင်အသွေးနှင့် ခေတ်မီအိမ်သုံး ကြွေထည်နှင့် မီးအိမ်များ။',
      ctaLabel: 'Explore Home & Living',
      ctaLabelMm: 'Home & Living ကြည့်ရန်',
      targetCategory: 'Home & Living',
      image: '/src/assets/images/banner_lifestyle_home_1794984088929.jpg',
    },
    {
      id: 'bn-3',
      kicker: 'Everyday Carry',
      kickerMm: 'နေ့စဉ်သုံး ဖက်ရှင်နှင့် လက်ပတ်နာရီ',
      title: 'Tailored Carry & Field Watches',
      titleMm: 'သေသပ်ခိုင်ခံ့သော ကျောပိုးအိတ်နှင့် နာရီများ',
      subtitle: 'Brushed steel timepieces, waxed canvas packs, and full-grain leather goods.',
      subtitleMm: 'သားရေစစ်နှင့် Stainless Steel လက်ပတ်နာရီ၊ ခရီးဆောင်အိတ်များ။',
      ctaLabel: 'Shop Watches & Carry',
      ctaLabelMm: 'Watches & Carry ကြည့်ရန်',
      targetCategory: 'Watches & Carry',
      image: '/src/assets/images/banner_apparel_craft_1794984088843.jpg',
    },
  ];

  const products: Product[] = [
    {
      id: 'prod-1',
      sku: 'YG-AUD-01',
      name: 'Kanso ANC Wireless Headphones',
      nameMm: 'Kanso ANC ကြိုးမဲ့ နားကြပ်',
      category: 'Audio & Tech',
      price: 245000,
      compareAtPrice: 280000,
      stock: 18,
      popular: true,
      rating: 4.9,
      soldCount: 64,
      image: '/src/assets/images/prod_headphones_1794984089139.jpg',
      variants: ['Matte Charcoal', 'Warm Stone'],
      description:
        '40mm custom acoustic drivers with hybrid active noise cancellation, 45-hour battery life, and memory-foam lambskin ear cushions.',
      descriptionMm:
        'ဆူညံသံလျှော့ချပေးသည့် Hybrid ANC စနစ်၊ ၄၅ နာရီအထိ အသုံးခံသော ဘက်ထရီနှင့် နူးညံ့သည့် နားကြပ်ဖော့များ ပါဝင်ပါသည်။',
      createdAt: daysAgoIso(14),
    },
    {
      id: 'prod-2',
      sku: 'YG-WTC-02',
      name: 'Instrumen Automatic Field Watch',
      nameMm: 'Instrumen အော်တိုမက်တစ် လက်ပတ်နာရီ',
      category: 'Watches & Carry',
      price: 385000,
      compareAtPrice: 420000,
      stock: 9,
      popular: true,
      rating: 4.9,
      soldCount: 41,
      image: '/src/assets/images/prod_watch_1794984089780.jpg',
      variants: ['Cream Dial / Saddle Tan', 'Cream Dial / Espresso'],
      description:
        '39mm brushed 316L stainless steel case with sapphire crystal, 100m water resistance, and Japanese automatic movement.',
      descriptionMm:
        '316L Stainless Steel ကိုယ်ထည်၊ ခြစ်ရာမထင်သည့် Sapphire မှန်နှင့် ရေစိုခံ 100m အော်တိုမက်တစ် နာရီဖြစ်ပါသည်။',
      createdAt: daysAgoIso(12),
    },
    {
      id: 'prod-3',
      sku: 'YG-CRY-03',
      name: 'Vero Waxed Canvas Rolltop Pack',
      nameMm: 'Vero ရေစိုခံ Canvas ကျောပိုးအိတ်',
      category: 'Watches & Carry',
      price: 165000,
      stock: 22,
      popular: true,
      rating: 4.8,
      soldCount: 53,
      image: '/src/assets/images/prod_backpack_1794984090552.jpg',
      variants: ['Slate Gray', 'Olive Bark'],
      description:
        'Water-resistant 18oz waxed cotton canvas with vegetable-tanned leather base, brass buckles, and padded 16-inch laptop sleeve.',
      descriptionMm:
        'ရေစိုခံ Waxed Canvas နှင့် သားရေအောက်ခံဖြင့် ချုပ်လုပ်ထားပြီး ၁၆ လက်မ Laptop ထည့်သွင်းနိုင်ပါသည်။',
      createdAt: daysAgoIso(10),
    },
    {
      id: 'prod-4',
      sku: 'YG-HOM-04',
      name: 'Sora Stoneware Pour-Over Set',
      nameMm: 'Sora ကြွေထည် ကော်ဖီနှပ်အိုးအစုံ',
      category: 'Home & Living',
      price: 78000,
      compareAtPrice: 92000,
      stock: 30,
      popular: true,
      rating: 4.9,
      soldCount: 89,
      image: '/src/assets/images/prod_ceramic_set_1794984090569.jpg',
      variants: ['Speckled Sand (Carafe + Mug)', 'Carafe Only'],
      description:
        'Kiln-fired matte stoneware dripper carafe paired with a matching saucer mug and braided collar for clean daily coffee brewing.',
      descriptionMm:
        'လက်ရာမြောက် မီးဖုတ်ကြွေထည်ဖြင့် ပြုလုပ်ထားသော ကော်ဖီနှပ်အိုးနှင့် ခွက်အစုံဖြစ်ပါသည်။',
      createdAt: daysAgoIso(9),
    },
    {
      id: 'prod-5',
      sku: 'YG-FTW-05',
      name: 'Isobel Suede Low-Top Sneakers',
      nameMm: 'Isobel Suede ဖိနပ်',
      category: 'Footwear',
      price: 145000,
      stock: 15,
      popular: false,
      rating: 4.7,
      soldCount: 37,
      image: '/src/assets/images/prod_sneakers_1794984090294.jpg',
      variants: ['Chalk EU 40', 'Chalk EU 41', 'Chalk EU 42', 'Chalk EU 43'],
      description:
        'Heavyweight organic canvas and Italian suede upper on a vulcanized natural rubber cupsole for all-day walking comfort.',
      descriptionMm:
        'နူးညံ့သော Suede သားရေနှင့် သဘာဝရာဘာအောက်ခံတို့ဖြင့် သက်တောင့်သက်သာ ဝတ်ဆင်နိုင်သော ဖိနပ်ဖြစ်ပါသည်။',
      createdAt: daysAgoIso(7),
    },
    {
      id: 'prod-6',
      sku: 'YG-AUD-06',
      name: 'Tactile 75 Aluminum Mechanical Keyboard',
      nameMm: 'Tactile 75 Aluminum ကီးဘုတ်',
      category: 'Audio & Tech',
      price: 215000,
      stock: 11,
      popular: false,
      rating: 4.8,
      soldCount: 29,
      image: '/src/assets/images/prod_keyboard_1794984091169.jpg',
      variants: ['Linear Red Switch', 'Tactile Brown Switch'],
      description:
        'CNC-machined anodized aluminum 75% gasket-mounted keyboard with rotary volume knob, PBT keycaps, and tri-mode wireless connectivity.',
      descriptionMm:
        'CNC Aluminum ကိုယ်ထည်၊ အသံအတိုးအချဲ့ ခလုတ်နှင့် Bluetooth/2.4GHz ကြိုးမဲ့ချိတ်ဆက်နိုင်သော Mechanical Keyboard ဖြစ်ပါသည်။',
      createdAt: daysAgoIso(5),
    },
    {
      id: 'prod-7',
      sku: 'YG-HOM-07',
      name: 'Atelier Cordless Brass Table Lamp',
      nameMm: 'Atelier ကြိုးမဲ့ စားပွဲတင်မီးအိမ်',
      category: 'Home & Living',
      price: 118000,
      stock: 14,
      popular: false,
      rating: 4.8,
      soldCount: 44,
      image: '/src/assets/images/prod_lamp_1794984091178.jpg',
      variants: ['Matte Black / Brushed Brass'],
      description:
        'Touch-dimmable warm 2700K LED portable table lamp with brushed brass stem and USB-C rechargeable 36-hour battery.',
      descriptionMm:
        'အလင်းအမှောင် ထိတွေ့ချိန်ညှိနိုင်ပြီး USB-C ဖြင့် အားသွင်းကာ ၃၆ နာရီအထိ အသုံးခံသော စားပွဲတင်မီးအိမ်ဖြစ်ပါသည်။',
      createdAt: daysAgoIso(4),
    },
    {
      id: 'prod-8',
      sku: 'YG-CRY-08',
      name: 'Saddle Leather Crossbody Satchel',
      nameMm: 'သားရေစစ် ဘေးလွယ်အိတ်',
      category: 'Watches & Carry',
      price: 195000,
      compareAtPrice: 225000,
      stock: 7,
      popular: false,
      rating: 4.9,
      soldCount: 24,
      image: '/src/assets/images/banner_apparel_craft_1794984088843.jpg',
      variants: ['Cognac Tan', 'Dark Chestnut'],
      description:
        'Full-grain vegetable-tanned leather satchel with solid brass buckle closure and adjustable shoulder strap.',
      descriptionMm:
        'သားရေစစ်နှင့် ကြေးဝါကလစ်တို့ဖြင့် လက်ရာသေသပ်စွာ ချုပ်လုပ်ထားသော ဘေးလွယ်အိတ်ဖြစ်ပါသည်။',
      createdAt: daysAgoIso(2),
    },
  ];

  const defaultAddress: Address = {
    id: 'addr-1',
    label: 'Home',
    recipientName: 'Kyaw Zin Htet',
    phone: '09-784-112-309',
    city: 'Yangon',
    township: 'Sanchaung',
    streetAddress: 'No. 42, Kyun Taw Street, 4th Floor',
    notes: 'Call upon arrival at gate',
    isDefault: true,
  };

  const secondaryAddress: Address = {
    id: 'addr-2',
    label: 'Office',
    recipientName: 'Kyaw Zin Htet',
    phone: '09-784-112-309',
    city: 'Yangon',
    township: 'Bahan',
    streetAddress: 'Level 6, Kabar Aye Pagoda Road',
    notes: 'Leave with reception desk',
    isDefault: false,
  };

  const orders: Order[] = [
    {
      id: 'YG-1041',
      buyerId: 'buyer-1',
      customerName: 'Su Myat Noe',
      customerPhone: '09-421-889-120',
      shippingAddress: {
        id: 'addr-ext-1',
        label: 'Home',
        recipientName: 'Su Myat Noe',
        phone: '09-421-889-120',
        city: 'Mandalay',
        township: 'Chanayethazan',
        streetAddress: '73rd Street, Bet 30th & 31st',
        isDefault: true,
      },
      items: [
        {
          productId: 'prod-1',
          name: 'Kanso ANC Wireless Headphones',
          nameMm: 'Kanso ANC ကြိုးမဲ့ နားကြပ်',
          price: 245000,
          quantity: 1,
          variant: 'Matte Charcoal',
          image: '/src/assets/images/prod_headphones_1794984089139.jpg',
        },
      ],
      subtotal: 245000,
      shippingFee: 0,
      total: 245000,
      paymentMethod: 'KPay',
      paymentReference: 'KP-774920',
      status: 'Delivered',
      trackingHistory: [
        { status: 'Pending', timestamp: daysAgoIso(5, 9), note: 'Order submitted via KPay' },
        { status: 'Verified', timestamp: daysAgoIso(5, 10), note: 'KPay transfer KP-774920 confirmed' },
        { status: 'Shipped', timestamp: daysAgoIso(4, 14), note: 'Dispatched with Yangon-Mandalay Express' },
        { status: 'Delivered', timestamp: daysAgoIso(3, 11), note: 'Signed by recipient' },
      ],
      createdAt: daysAgoIso(5, 9),
      updatedAt: daysAgoIso(3, 11),
    },
    {
      id: 'YG-1042',
      buyerId: 'buyer-1',
      customerName: 'Kyaw Zin Htet',
      customerPhone: '09-784-112-309',
      shippingAddress: defaultAddress,
      items: [
        {
          productId: 'prod-4',
          name: 'Sora Stoneware Pour-Over Set',
          nameMm: 'Sora ကြွေထည် ကော်ဖီနှပ်အိုးအစုံ',
          price: 78000,
          quantity: 1,
          variant: 'Speckled Sand (Carafe + Mug)',
          image: '/src/assets/images/prod_ceramic_set_1794984090569.jpg',
        },
        {
          productId: 'prod-7',
          name: 'Atelier Cordless Brass Table Lamp',
          nameMm: 'Atelier ကြိုးမဲ့ စားပွဲတင်မီးအိမ်',
          price: 118000,
          quantity: 1,
          variant: 'Matte Black / Brushed Brass',
          image: '/src/assets/images/prod_lamp_1794984091178.jpg',
        },
      ],
      subtotal: 196000,
      shippingFee: 0,
      total: 196000,
      paymentMethod: 'WavePay',
      paymentReference: 'WV-551084',
      status: 'Shipped',
      trackingHistory: [
        { status: 'Pending', timestamp: daysAgoIso(2, 11), note: 'Order submitted via WavePay' },
        { status: 'Verified', timestamp: daysAgoIso(2, 12), note: 'WavePay reference WV-551084 verified' },
        { status: 'Shipped', timestamp: daysAgoIso(1, 15), note: 'Out for delivery in Sanchaung Township' },
      ],
      createdAt: daysAgoIso(2, 11),
      updatedAt: daysAgoIso(1, 15),
    },
    {
      id: 'YG-1043',
      buyerId: 'buyer-2',
      customerName: 'Min Khant',
      customerPhone: '09-975-204-812',
      shippingAddress: {
        id: 'addr-ext-2',
        label: 'Office',
        recipientName: 'Min Khant',
        phone: '09-975-204-812',
        city: 'Yangon',
        township: 'Yankin',
        streetAddress: 'No. 18, Moe Kaung Road',
        isDefault: true,
      },
      items: [
        {
          productId: 'prod-2',
          name: 'Instrumen Automatic Field Watch',
          nameMm: 'Instrumen အော်တိုမက်တစ် လက်ပတ်နာရီ',
          price: 385000,
          quantity: 1,
          variant: 'Cream Dial / Saddle Tan',
          image: '/src/assets/images/prod_watch_1794984089780.jpg',
        },
      ],
      subtotal: 385000,
      shippingFee: 0,
      total: 385000,
      paymentMethod: 'BankTransfer',
      paymentReference: 'KBZ-902184',
      bankName: 'KBZ Bank',
      status: 'Verified',
      trackingHistory: [
        { status: 'Pending', timestamp: daysAgoIso(1, 10), note: 'Bank transfer receipt submitted' },
        { status: 'Verified', timestamp: daysAgoIso(1, 13), note: 'KBZ Bank deposit confirmed' },
      ],
      createdAt: daysAgoIso(1, 10),
      updatedAt: daysAgoIso(1, 13),
    },
    {
      id: 'YG-1044',
      buyerId: 'buyer-1',
      customerName: 'Kyaw Zin Htet',
      customerPhone: '09-784-112-309',
      shippingAddress: secondaryAddress,
      items: [
        {
          productId: 'prod-6',
          name: 'Tactile 75 Aluminum Mechanical Keyboard',
          nameMm: 'Tactile 75 Aluminum ကီးဘုတ်',
          price: 215000,
          quantity: 1,
          variant: 'Tactile Brown Switch',
          image: '/src/assets/images/prod_keyboard_1794984091169.jpg',
        },
      ],
      subtotal: 215000,
      shippingFee: 0,
      total: 215000,
      paymentMethod: 'KPay',
      paymentReference: 'KP-904312',
      status: 'Pending',
      trackingHistory: [
        { status: 'Pending', timestamp: daysAgoIso(0, 9), note: 'Awaiting KPay verification' },
      ],
      createdAt: daysAgoIso(0, 9),
      updatedAt: daysAgoIso(0, 9),
    },
    {
      id: 'YG-1040',
      buyerId: 'buyer-3',
      customerName: 'Hnin Wai Lwin',
      customerPhone: '09-254-331-708',
      shippingAddress: {
        id: 'addr-ext-3',
        label: 'Home',
        recipientName: 'Hnin Wai Lwin',
        phone: '09-254-331-708',
        city: 'Yangon',
        township: 'Kamayut',
        streetAddress: 'No. 9, Inya Myaing Lane',
        isDefault: true,
      },
      items: [
        {
          productId: 'prod-3',
          name: 'Vero Waxed Canvas Rolltop Pack',
          nameMm: 'Vero ရေစိုခံ Canvas ကျောပိုးအိတ်',
          price: 165000,
          quantity: 1,
          variant: 'Slate Gray',
          image: '/src/assets/images/prod_backpack_1794984090552.jpg',
        },
        {
          productId: 'prod-5',
          name: 'Isobel Suede Low-Top Sneakers',
          nameMm: 'Isobel Suede ဖိနပ်',
          price: 145000,
          quantity: 1,
          variant: 'Chalk EU 41',
          image: '/src/assets/images/prod_sneakers_1794984090294.jpg',
        },
      ],
      subtotal: 310000,
      shippingFee: 0,
      total: 310000,
      paymentMethod: 'WavePay',
      paymentReference: 'WV-319204',
      status: 'Delivered',
      trackingHistory: [
        { status: 'Pending', timestamp: daysAgoIso(6, 10), note: 'Order submitted via WavePay' },
        { status: 'Verified', timestamp: daysAgoIso(6, 11), note: 'WavePay confirmed' },
        { status: 'Shipped', timestamp: daysAgoIso(5, 13), note: 'Out for delivery' },
        { status: 'Delivered', timestamp: daysAgoIso(4, 16), note: 'Delivered to recipient' },
      ],
      createdAt: daysAgoIso(6, 10),
      updatedAt: daysAgoIso(4, 16),
    },
  ];

  const chatThreads: ChatThread[] = [
    {
      id: 'thread-buyer-1',
      buyerId: 'buyer-1',
      buyerName: 'Kyaw Zin Htet',
      buyerPhone: '09-784-112-309',
      lastMessageAt: daysAgoIso(0, 9),
      messages: [
        {
          id: 'msg-1',
          threadId: 'thread-buyer-1',
          senderRole: 'buyer',
          senderName: 'Kyaw Zin Htet',
          text: 'Mingalaba! Is the Tactile 75 keyboard in stock for same-day Yangon delivery?',
          contextTag: 'Tactile 75 Aluminum Mechanical Keyboard',
          createdAt: daysAgoIso(0, 8),
          read: true,
        },
        {
          id: 'msg-2',
          threadId: 'thread-buyer-1',
          senderRole: 'admin',
          senderName: 'Shoptopia Support',
          text: 'Mingalaba Kyaw Zin Htet! Yes, both Linear Red and Tactile Brown switches are ready in our Bahan warehouse for same-day Yangon courier dispatch.',
          createdAt: daysAgoIso(0, 9),
          read: true,
        },
      ],
    },
  ];

  return {
    products,
    categories,
    banners,
    orders,
    buyers: {
      'buyer-1': {
        profile: {
          id: 'buyer-1',
          name: 'Kyaw Zin Htet',
          email: 'kyawzin@example.com',
          phone: '09-784-112-309',
        },
        addresses: [defaultAddress, secondaryAddress],
        wishlist: ['prod-1', 'prod-2'],
      },
    },
    chatThreads,
    paymentSettings: defaultPaymentSettings(),
  };
}

function loadStore(): StoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      const seed = createSeedData();
      fs.writeFileSync(STORE_FILE, JSON.stringify(seed, null, 2), 'utf-8');
      return seed;
    }
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as StoreData;
    if (!parsed.paymentSettings) {
      parsed.paymentSettings = defaultPaymentSettings();
    }
    if (!parsed.buyers || typeof parsed.buyers !== 'object') {
      const legacyId = parsed.profile?.id || 'buyer-1';
      parsed.buyers = {
        [legacyId]: {
          profile: parsed.profile || {
            id: legacyId,
            name: 'Kyaw Zin Htet',
            email: 'kyawzin@example.com',
            phone: '09-784-112-309',
          },
          addresses: Array.isArray(parsed.addresses) ? parsed.addresses : [],
          wishlist: Array.isArray(parsed.wishlist) ? parsed.wishlist : [],
        },
      };
      delete parsed.profile;
      delete parsed.addresses;
      delete parsed.wishlist;
      fs.writeFileSync(STORE_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    return parsed;
  } catch (err) {
    console.error('Failed to load store, creating fresh seed:', err);
    const seed = createSeedData();
    fs.writeFileSync(STORE_FILE, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }
}

let store: StoreData = loadStore();

function saveStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function resolveBuyerId(rawId?: unknown): string {
  const clean = typeof rawId === 'string' ? rawId.trim() : '';
  return clean || 'buyer-1';
}

function getOrCreateBuyer(rawId?: unknown): BuyerAccount {
  const id = resolveBuyerId(rawId);
  if (!store.buyers[id]) {
    store.buyers[id] = {
      profile: {
        id,
        name: 'Guest Buyer',
        email: '',
        phone: '',
      },
      addresses: [],
      wishlist: [],
    };
    saveStore();
  }
  return store.buyers[id];
}

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(event: WsServerEvent) {
  const payload = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function appendChatMessage(input: {
  threadId: string;
  buyerId?: string;
  buyerName?: string;
  buyerPhone?: string;
  senderRole: 'buyer' | 'admin';
  senderName: string;
  text: string;
  contextTag?: string;
}): { thread: ChatThread; message: ChatMessage } {
  const now = new Date().toISOString();
  const resolvedBuyerId = resolveBuyerId(
    input.buyerId || input.threadId.replace(/^thread-/, '')
  );
  const buyer = getOrCreateBuyer(resolvedBuyerId);

  let thread = store.chatThreads.find((t) => t.id === input.threadId);
  if (!thread) {
    thread = {
      id: input.threadId,
      buyerId: resolvedBuyerId,
      buyerName: input.buyerName || buyer.profile.name || 'Guest Buyer',
      buyerPhone: input.buyerPhone || buyer.profile.phone || '',
      lastMessageAt: now,
      messages: [],
    };
    store.chatThreads.unshift(thread);
  } else if (input.senderRole === 'buyer') {
    if (input.buyerName) thread.buyerName = input.buyerName;
    if (input.buyerPhone) thread.buyerPhone = input.buyerPhone;
  }
  const message: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    threadId: thread.id,
    senderRole: input.senderRole,
    senderName: input.senderName,
    text: input.text.trim(),
    contextTag: input.contextTag,
    createdAt: now,
    read: false,
  };
  thread.messages.push(message);
  thread.lastMessageAt = now;
  saveStore();
  broadcast({
    type: 'chat:message',
    payload: { threadId: thread.id, message, thread },
  });
  return { thread, message };
}

wss.on('connection', (ws) => {
  ws.send(
    JSON.stringify({
      type: 'init',
      payload: { connectedClients: wss.clients.size },
    } satisfies WsServerEvent)
  );

  ws.on('message', (raw) => {
    try {
      const parsed = JSON.parse(raw.toString()) as {
        type: string;
        payload?: Record<string, unknown>;
      };
      if (parsed.type === 'chat:send' && parsed.payload) {
        const text = String(parsed.payload.text || '').trim();
        if (!text) return;
        const buyerId = resolveBuyerId(parsed.payload.buyerId);
        const buyer = getOrCreateBuyer(buyerId);
        const threadId = String(parsed.payload.threadId || `thread-${buyerId}`);
        const senderRole = parsed.payload.senderRole === 'admin' ? 'admin' : 'buyer';
        const senderName = String(
          parsed.payload.senderName ||
            (senderRole === 'admin' ? 'Shoptopia Support' : buyer.profile.name || 'Guest Buyer')
        );
        const contextTag = parsed.payload.contextTag ? String(parsed.payload.contextTag) : undefined;
        appendChatMessage({
          threadId,
          buyerId,
          senderRole,
          senderName,
          text,
          contextTag,
          buyerName: buyer.profile.name,
          buyerPhone: buyer.profile.phone,
        });
      } else if (parsed.type === 'chat:read' && parsed.payload) {
        const threadId = String(parsed.payload.threadId || 'thread-buyer-1');
        const readerRole = parsed.payload.readerRole === 'admin' ? 'admin' : 'buyer';
        const thread = store.chatThreads.find((t) => t.id === threadId);
        if (thread) {
          let changed = false;
          for (const msg of thread.messages) {
            if (msg.senderRole !== readerRole && !msg.read) {
              msg.read = true;
              changed = true;
            }
          }
          if (changed) {
            saveStore();
            broadcast({ type: 'chat:read', payload: { threadId, readerRole } });
          }
        }
      } else if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (err) {
      console.error('WS message error:', err);
    }
  });
});

// Keep WebSocket connections alive across reverse proxies
setInterval(() => {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.ping();
    }
  }
}, 20000);

// REST API Endpoints
app.get('/api/bootstrap', (req, res) => {
  const role = req.query.role === 'admin' ? 'admin' : 'buyer';
  const buyerIdParam = typeof req.query.buyerId === 'string' ? req.query.buyerId : undefined;

  if (role === 'admin') {
    const defaultBuyer = getOrCreateBuyer('buyer-1');
    res.json({
      products: store.products,
      categories: store.categories,
      banners: store.banners,
      orders: store.orders,
      profile: defaultBuyer.profile,
      addresses: defaultBuyer.addresses,
      wishlist: defaultBuyer.wishlist,
      chatThreads: store.chatThreads,
      paymentSettings: store.paymentSettings,
      analyticsResetAt: store.analyticsResetAt,
    });
    return;
  }

  const buyer = getOrCreateBuyer(buyerIdParam);
  res.json({
    products: store.products,
    categories: store.categories,
    banners: store.banners,
    orders: store.orders.filter((o) => o.buyerId === buyer.profile.id),
    profile: buyer.profile,
    addresses: buyer.addresses,
    wishlist: buyer.wishlist,
    chatThreads: store.chatThreads.filter(
      (th) => th.buyerId === buyer.profile.id || th.id === `thread-${buyer.profile.id}`
    ),
    paymentSettings: store.paymentSettings,
    analyticsResetAt: store.analyticsResetAt,
  });
});

// Buyer Account Login / Switch / Create New
app.post('/api/buyers/login', (req, res) => {
  const { mode, identifier } = (req.body || {}) as {
    mode?: 'new' | 'find';
    identifier?: string;
  };

  if (mode === 'new') {
    const newId = `buyer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const buyer = getOrCreateBuyer(newId);
    res.status(201).json({
      buyerId: newId,
      profile: buyer.profile,
      addresses: buyer.addresses,
      wishlist: buyer.wishlist,
      orders: [],
      chatThreads: [],
    });
    return;
  }

  const rawQuery = (identifier || '').trim().toLowerCase();
  const normalizedPhone = rawQuery.replace(/[\s-]/g, '');
  if (!rawQuery) {
    res.status(400).json({ error: 'Phone number or email is required' });
    return;
  }

  const matched = Object.values(store.buyers).find((b) => {
    const emailMatch = b.profile.email && b.profile.email.trim().toLowerCase() === rawQuery;
    const phoneClean = (b.profile.phone || '').replace(/[\s-]/g, '');
    const phoneMatch = normalizedPhone.length >= 5 && phoneClean === normalizedPhone;
    return Boolean(emailMatch || phoneMatch);
  });

  if (!matched) {
    res.status(404).json({ error: 'No saved buyer account matched that phone or email' });
    return;
  }

  const id = matched.profile.id;
  res.json({
    buyerId: id,
    profile: matched.profile,
    addresses: matched.addresses,
    wishlist: matched.wishlist,
    orders: store.orders.filter((o) => o.buyerId === id),
    chatThreads: store.chatThreads.filter(
      (th) => th.buyerId === id || th.id === `thread-${id}`
    ),
  });
});

app.post('/api/products', (req, res) => {
  const body = req.body as Partial<Product>;
  if (!body.name || typeof body.price !== 'number') {
    res.status(400).json({ error: 'Product name and valid price are required' });
    return;
  }
  const newProduct: Product = {
    id: `prod-${Date.now()}`,
    sku: body.sku?.trim() || `YG-${Math.floor(100 + Math.random() * 900)}`,
    name: body.name.trim(),
    nameMm: body.nameMm?.trim() || body.name.trim(),
    category: body.category?.trim() || store.categories[0],
    price: Math.max(0, Number(body.price)),
    compareAtPrice: body.compareAtPrice ? Number(body.compareAtPrice) : undefined,
    stock: Math.max(0, Number(body.stock ?? 10)),
    popular: Boolean(body.popular),
    rating: 4.9,
    soldCount: 0,
    image: body.image?.trim() || '/src/assets/images/prod_ceramic_set_1794984090569.jpg',
    variants:
      Array.isArray(body.variants) && body.variants.length > 0
        ? body.variants
        : ['Standard'],
    description: body.description?.trim() || 'Crafted everyday essential from Shoptopia.',
    descriptionMm: body.descriptionMm?.trim() || 'Shoptopia ၏ အရည်အသွေးမြင့် ကုန်ပစ္စည်း။',
    createdAt: new Date().toISOString(),
  };

  let categoryAdded = false;
  if (!store.categories.includes(newProduct.category)) {
    store.categories.push(newProduct.category);
    categoryAdded = true;
  }
  store.products.unshift(newProduct);
  saveStore();
  broadcast({ type: 'product:created', payload: newProduct });
  if (categoryAdded) {
    broadcast({
      type: 'categories:updated',
      payload: {
        categories: store.categories,
        products: store.products,
        banners: store.banners,
      },
    });
  }
  res.status(201).json(newProduct);
});

app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const idx = store.products.findIndex((p) => p.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  const existing = store.products[idx];
  const body = req.body as Partial<Product>;
  const updated: Product = {
    ...existing,
    sku: body.sku !== undefined ? String(body.sku).trim() : existing.sku,
    name: body.name !== undefined ? String(body.name).trim() : existing.name,
    nameMm: body.nameMm !== undefined ? String(body.nameMm).trim() : existing.nameMm,
    category: body.category !== undefined ? String(body.category).trim() : existing.category,
    price: body.price !== undefined ? Math.max(0, Number(body.price)) : existing.price,
    compareAtPrice:
      body.compareAtPrice !== undefined
        ? body.compareAtPrice
          ? Number(body.compareAtPrice)
          : undefined
        : existing.compareAtPrice,
    stock: body.stock !== undefined ? Math.max(0, Number(body.stock)) : existing.stock,
    popular: body.popular !== undefined ? Boolean(body.popular) : existing.popular,
    image: body.image !== undefined ? String(body.image).trim() : existing.image,
    variants:
      Array.isArray(body.variants) && body.variants.length > 0
        ? body.variants
        : existing.variants,
    description:
      body.description !== undefined ? String(body.description).trim() : existing.description,
    descriptionMm:
      body.descriptionMm !== undefined
        ? String(body.descriptionMm).trim()
        : existing.descriptionMm,
  };
  let categoryAdded = false;
  if (updated.category && !store.categories.includes(updated.category)) {
    store.categories.push(updated.category);
    categoryAdded = true;
  }
  store.products[idx] = updated;
  saveStore();
  broadcast({ type: 'product:updated', payload: updated });
  if (categoryAdded) {
    broadcast({
      type: 'categories:updated',
      payload: {
        categories: store.categories,
        products: store.products,
        banners: store.banners,
      },
    });
  }
  res.json(updated);
});

app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const before = store.products.length;
  store.products = store.products.filter((p) => p.id !== id);
  if (store.products.length === before) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  for (const buyer of Object.values(store.buyers)) {
    buyer.wishlist = buyer.wishlist.filter((w) => w !== id);
  }
  saveStore();
  broadcast({ type: 'product:deleted', payload: { id } });
  res.json({ ok: true, id });
});

app.post('/api/orders', (req, res) => {
  const body = req.body as {
    buyerId?: string;
    items: Array<{ productId: string; quantity: number; variant: string }>;
    shippingAddress: Address;
    paymentMethod: PaymentMethod;
    paymentReference: string;
    bankName?: string;
    customerName?: string;
    customerPhone?: string;
  };

  if (!Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({ error: 'Order items are required' });
    return;
  }
  if (!body.shippingAddress || !body.paymentMethod || !body.paymentReference?.trim()) {
    res.status(400).json({ error: 'Shipping address, payment method, and reference ID are required' });
    return;
  }

  const buyer = getOrCreateBuyer(body.buyerId || req.headers['x-buyer-id']);
  const orderItems: OrderItem[] = [];
  let subtotal = 0;

  for (const item of body.items) {
    const prod = store.products.find((p) => p.id === item.productId);
    if (!prod) {
      res.status(400).json({ error: `Product ${item.productId} not found` });
      return;
    }
    const qty = Math.max(1, Math.floor(Number(item.quantity)));
    if (prod.stock < qty) {
      res.status(400).json({ error: `Insufficient stock for ${prod.name}` });
      return;
    }
    prod.stock -= qty;
    prod.soldCount += qty;
    subtotal += prod.price * qty;
    orderItems.push({
      productId: prod.id,
      name: prod.name,
      nameMm: prod.nameMm,
      price: prod.price,
      quantity: qty,
      variant: item.variant || prod.variants[0] || 'Standard',
      image: prod.image,
    });
    broadcast({ type: 'product:updated', payload: prod });
  }

  const shippingFee = subtotal >= 150000 ? 0 : 4500;
  const total = subtotal + shippingFee;
  const now = new Date().toISOString();
  const nextNum = 1045 + store.orders.length;

  const newOrder: Order = {
    id: `YG-${nextNum}`,
    buyerId: buyer.profile.id,
    customerName:
      body.customerName?.trim() ||
      body.shippingAddress.recipientName ||
      buyer.profile.name ||
      'Guest Buyer',
    customerPhone:
      body.customerPhone?.trim() || body.shippingAddress.phone || buyer.profile.phone || '',
    shippingAddress: body.shippingAddress,
    items: orderItems,
    subtotal,
    shippingFee,
    total,
    paymentMethod: body.paymentMethod,
    paymentReference: body.paymentReference.trim(),
    bankName: body.bankName,
    status: 'Pending',
    trackingHistory: [
      {
        status: 'Pending',
        timestamp: now,
        note: `Order placed via ${body.paymentMethod} (Ref: ${body.paymentReference.trim()})`,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  store.orders.unshift(newOrder);
  saveStore();
  broadcast({ type: 'order:created', payload: newOrder });
  res.status(201).json(newOrder);
});

app.patch('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body as { status: OrderStatus; note?: string };
  const validStatuses: OrderStatus[] = ['Pending', 'Verified', 'Shipped', 'Delivered', 'Cancelled'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid order status' });
    return;
  }
  const order = store.orders.find((o) => o.id === id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const now = new Date().toISOString();
  order.status = status;
  order.updatedAt = now;

  const defaultNotes: Record<OrderStatus, string> = {
    Pending: 'Awaiting payment verification',
    Verified: `${order.paymentMethod} reference ${order.paymentReference} verified by seller`,
    Shipped: `Dispatched for delivery to ${order.shippingAddress.township}, ${order.shippingAddress.city}`,
    Delivered: 'Package delivered and signed by recipient',
    Cancelled: 'Order cancelled by seller',
  };

  order.trackingHistory.push({
    status,
    timestamp: now,
    note: note?.trim() || defaultNotes[status],
  });

  saveStore();
  broadcast({ type: 'order:updated', payload: order });
  res.json(order);
});

app.put('/api/profile', (req, res) => {
  const body = req.body as Partial<UserProfile> & { buyerId?: string };
  const buyer = getOrCreateBuyer(body.buyerId || req.headers['x-buyer-id']);
  buyer.profile = {
    ...buyer.profile,
    name: body.name !== undefined ? body.name.trim() || 'Guest Buyer' : buyer.profile.name,
    email: body.email !== undefined ? body.email.trim() : buyer.profile.email,
    phone: body.phone !== undefined ? body.phone.trim() : buyer.profile.phone,
  };
  for (const th of store.chatThreads) {
    if (th.buyerId === buyer.profile.id) {
      th.buyerName = buyer.profile.name;
      th.buyerPhone = buyer.profile.phone;
    }
  }
  saveStore();
  res.json(buyer.profile);
});

app.post('/api/addresses', (req, res) => {
  const body = req.body as Partial<Address> & { buyerId?: string };
  const buyer = getOrCreateBuyer(body.buyerId || req.headers['x-buyer-id']);
  if (!body.recipientName?.trim() || !body.streetAddress?.trim() || !body.township?.trim()) {
    res.status(400).json({ error: 'Recipient name, township, and street address are required' });
    return;
  }
  const isDefault = Boolean(body.isDefault) || buyer.addresses.length === 0;
  if (isDefault) {
    buyer.addresses = buyer.addresses.map((a) => ({ ...a, isDefault: false }));
  }
  const newAddr: Address = {
    id: `addr-${Date.now()}`,
    label: body.label?.trim() || 'Address',
    recipientName: body.recipientName.trim(),
    phone: body.phone?.trim() || buyer.profile.phone,
    city: body.city?.trim() || 'Yangon',
    township: body.township.trim(),
    streetAddress: body.streetAddress.trim(),
    notes: body.notes?.trim() || '',
    isDefault,
  };
  buyer.addresses.push(newAddr);
  saveStore();
  res.status(201).json(buyer.addresses);
});

app.put('/api/addresses/:id', (req, res) => {
  const { id } = req.params;
  const body = req.body as Partial<Address> & { buyerId?: string };
  const buyer = getOrCreateBuyer(body.buyerId || req.query.buyerId || req.headers['x-buyer-id']);
  const idx = buyer.addresses.findIndex((a) => a.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Address not found' });
    return;
  }
  if (body.isDefault) {
    buyer.addresses = buyer.addresses.map((a) => ({ ...a, isDefault: false }));
  }
  const { buyerId: _ignored, ...patch } = body;
  buyer.addresses[idx] = {
    ...buyer.addresses[idx],
    ...patch,
    id,
  };
  saveStore();
  res.json(buyer.addresses);
});

app.delete('/api/addresses/:id', (req, res) => {
  const { id } = req.params;
  const buyer = getOrCreateBuyer(req.query.buyerId || req.headers['x-buyer-id']);
  buyer.addresses = buyer.addresses.filter((a) => a.id !== id);
  if (buyer.addresses.length > 0 && !buyer.addresses.some((a) => a.isDefault)) {
    buyer.addresses[0].isDefault = true;
  }
  saveStore();
  res.json(buyer.addresses);
});

app.post('/api/wishlist/toggle', (req, res) => {
  const { productId, buyerId } = req.body as { productId: string; buyerId?: string };
  if (!productId) {
    res.status(400).json({ error: 'productId is required' });
    return;
  }
  const buyer = getOrCreateBuyer(buyerId || req.headers['x-buyer-id']);
  if (buyer.wishlist.includes(productId)) {
    buyer.wishlist = buyer.wishlist.filter((id) => id !== productId);
  } else {
    buyer.wishlist.push(productId);
  }
  saveStore();
  res.json({ wishlist: buyer.wishlist });
});

app.get('/api/chat', (_req, res) => {
  res.json(store.chatThreads);
});

app.post('/api/chat/send', (req, res) => {
  const { threadId, buyerId, senderRole, senderName, text, contextTag } = req.body as {
    threadId?: string;
    buyerId?: string;
    senderRole?: 'buyer' | 'admin';
    senderName?: string;
    text?: string;
    contextTag?: string;
  };
  if (!text?.trim()) {
    res.status(400).json({ error: 'Message text is required' });
    return;
  }
  const resolvedBuyerId = resolveBuyerId(buyerId || threadId?.replace(/^thread-/, ''));
  const buyer = getOrCreateBuyer(resolvedBuyerId);
  const result = appendChatMessage({
    threadId: threadId || `thread-${resolvedBuyerId}`,
    buyerId: resolvedBuyerId,
    buyerName: buyer.profile.name,
    buyerPhone: buyer.profile.phone,
    senderRole: senderRole === 'admin' ? 'admin' : 'buyer',
    senderName:
      senderName ||
      (senderRole === 'admin' ? 'Shoptopia Support' : buyer.profile.name || 'Guest Buyer'),
    text,
    contextTag,
  });
  res.status(201).json(result);
});

// Seller Payment Gateway Settings
app.put('/api/payment-settings', (req, res) => {
  const body = req.body as Partial<PaymentSettings>;
  const current = store.paymentSettings || defaultPaymentSettings();
  const updated: PaymentSettings = {
    kpay: body.kpay ? { ...current.kpay, ...body.kpay } : current.kpay,
    wavepay: body.wavepay ? { ...current.wavepay, ...body.wavepay } : current.wavepay,
    bankAccounts: Array.isArray(body.bankAccounts) ? body.bankAccounts : current.bankAccounts,
  };
  store.paymentSettings = updated;
  saveStore();
  broadcast({ type: 'paymentSettings:updated', payload: updated });
  res.json(updated);
});

// Reset Analytics / Total Revenue
app.post('/api/analytics/reset', (req, res) => {
  const { clearOrders } = (req.body || {}) as { clearOrders?: boolean };
  const now = new Date().toISOString();
  store.analyticsResetAt = now;
  store.products = store.products.map((p) => ({ ...p, soldCount: 0 }));
  if (clearOrders) {
    store.orders = [];
  }
  saveStore();
  const payload = {
    analyticsResetAt: now,
    clearOrders: Boolean(clearOrders),
    orders: store.orders,
    products: store.products,
  };
  broadcast({ type: 'analytics:reset', payload });
  res.json(payload);
});

// Banner Slides CRUD
app.post('/api/banners', (req, res) => {
  const body = req.body as Partial<BannerSlide>;
  if (!body.title?.trim()) {
    res.status(400).json({ error: 'Banner title is required' });
    return;
  }
  const slide: BannerSlide = {
    id: `bn-${Date.now()}`,
    kicker: body.kicker?.trim() || 'Featured',
    kickerMm: body.kickerMm?.trim() || body.kicker?.trim() || 'အထူးကဏ္ဍ',
    title: body.title.trim(),
    titleMm: body.titleMm?.trim() || body.title.trim(),
    subtitle: body.subtitle?.trim() || '',
    subtitleMm: body.subtitleMm?.trim() || body.subtitle?.trim() || '',
    ctaLabel: body.ctaLabel?.trim() || 'Shop Now',
    ctaLabelMm: body.ctaLabelMm?.trim() || body.ctaLabel?.trim() || 'ကြည့်ရှုရန်',
    targetCategory: body.targetCategory?.trim() || 'All',
    image: body.image?.trim() || '/src/assets/images/banner_tech_audio_1794984087921.jpg',
  };
  store.banners.push(slide);
  saveStore();
  broadcast({ type: 'banners:updated', payload: store.banners });
  res.status(201).json(store.banners);
});

app.put('/api/banners/:id', (req, res) => {
  const { id } = req.params;
  const idx = store.banners.findIndex((b) => b.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Banner not found' });
    return;
  }
  const body = req.body as Partial<BannerSlide>;
  store.banners[idx] = {
    ...store.banners[idx],
    ...body,
    id,
  };
  saveStore();
  broadcast({ type: 'banners:updated', payload: store.banners });
  res.json(store.banners);
});

app.delete('/api/banners/:id', (req, res) => {
  const { id } = req.params;
  store.banners = store.banners.filter((b) => b.id !== id);
  saveStore();
  broadcast({ type: 'banners:updated', payload: store.banners });
  res.json(store.banners);
});

// Categories CRUD
app.post('/api/categories', (req, res) => {
  const { name } = req.body as { name?: string };
  const clean = name?.trim();
  if (!clean) {
    res.status(400).json({ error: 'Category name is required' });
    return;
  }
  if (!store.categories.includes(clean)) {
    store.categories.push(clean);
    saveStore();
    broadcast({
      type: 'categories:updated',
      payload: {
        categories: store.categories,
        products: store.products,
        banners: store.banners,
      },
    });
  }
  res.status(201).json({ categories: store.categories, products: store.products, banners: store.banners });
});

app.put('/api/categories/:name', (req, res) => {
  const oldName = decodeURIComponent(req.params.name);
  const { newName } = req.body as { newName?: string };
  const clean = newName?.trim();
  if (!clean) {
    res.status(400).json({ error: 'New category name is required' });
    return;
  }
  const idx = store.categories.indexOf(oldName);
  if (idx === -1) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }
  store.categories[idx] = clean;
  // Deduplicate if renamed into an existing category
  store.categories = Array.from(new Set(store.categories));
  store.products = store.products.map((p) =>
    p.category === oldName ? { ...p, category: clean } : p
  );
  store.banners = store.banners.map((b) =>
    b.targetCategory === oldName ? { ...b, targetCategory: clean } : b
  );
  saveStore();
  const payload = {
    categories: store.categories,
    products: store.products,
    banners: store.banners,
  };
  broadcast({ type: 'categories:updated', payload });
  res.json(payload);
});

app.delete('/api/categories/:name', (req, res) => {
  const target = decodeURIComponent(req.params.name);
  store.categories = store.categories.filter((c) => c !== target);
  const fallback = store.categories[0] || 'General';
  store.products = store.products.map((p) =>
    p.category === target ? { ...p, category: fallback } : p
  );
  store.banners = store.banners.map((b) =>
    b.targetCategory === target ? { ...b, targetCategory: 'All' } : b
  );
  saveStore();
  const payload = {
    categories: store.categories,
    products: store.products,
    banners: store.banners,
  };
  broadcast({ type: 'categories:updated', payload });
  res.json(payload);
});

let cachedVapidConfig: VapidConfig | null = null;

async function getServerVapidConfig(): Promise<VapidConfig> {
  if (cachedVapidConfig) return cachedVapidConfig;

  const envPub = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const envPriv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (process.env.VAPID_SUBJECT || `mailto:${ADMIN_EMAIL}`).trim();

  if (envPub && envPriv) {
    cachedVapidConfig = { publicKey: envPub, privateKey: envPriv, subject };
    return cachedVapidConfig;
  }

  try {
    if (fs.existsSync(VAPID_FILE)) {
      const saved = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8')) as Partial<VapidConfig>;
      if (saved.publicKey && saved.privateKey) {
        cachedVapidConfig = {
          publicKey: saved.publicKey,
          privateKey: saved.privateKey,
          subject: saved.subject || subject,
        };
        return cachedVapidConfig;
      }
    }
  } catch {
    // Regenerate if corrupt
  }

  const generated = await generateVapidKeyPair();
  cachedVapidConfig = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject,
  };
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(VAPID_FILE, JSON.stringify(cachedVapidConfig, null, 2), 'utf-8');
  } catch {
    // Non-fatal in read-only containers
  }
  return cachedVapidConfig;
}

function getFirebaseProjectId(): string {
  try {
    const parsed = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_FILE, 'utf-8')) as {
      projectId?: string;
    };
    return parsed.projectId || 'sapient-buckeye-gm4ph';
  } catch {
    return 'sapient-buckeye-gm4ph';
  }
}

app.get('/api/push/public-key', async (_req, res) => {
  try {
    const vapid = await getServerVapidConfig();
    res.json({
      configured: true,
      publicKey: vapid.publicKey,
    });
  } catch {
    res.json({ configured: false, publicKey: null });
  }
});

app.post('/api/push/send', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!idToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const projectId = getFirebaseProjectId();
  const verifiedAdmin = await verifyFirebaseAdminToken(idToken, projectId, ADMIN_EMAIL);
  if (!verifiedAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const body = (req.body || {}) as {
    subscriptions?: PushSubscriptionInput[];
    payload?: PushNotificationPayload;
  };
  const subs = Array.isArray(body.subscriptions) ? body.subscriptions.slice(0, 200) : [];
  const rawPayload = body.payload;
  if (!rawPayload?.title || !rawPayload?.body) {
    res.status(400).json({ error: 'Notification title and body are required' });
    return;
  }

  const vapid = await getServerVapidConfig();
  const cleanPayload: PushNotificationPayload = {
    title: String(rawPayload.title).slice(0, 140),
    body: String(rawPayload.body).slice(0, 600),
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: rawPayload.tag ? String(rawPayload.tag).slice(0, 120) : `shoptopia-${Date.now()}`,
    actionTarget: rawPayload.actionTarget ? String(rawPayload.actionTarget).slice(0, 120) : 'none',
    notifId: rawPayload.notifId ? String(rawPayload.notifId).slice(0, 128) : '',
    url: rawPayload.url ? String(rawPayload.url).slice(0, 240) : '/',
  };

  const validSubs = subs.filter(
    (s) =>
      s &&
      typeof s.id === 'string' &&
      typeof s.endpoint === 'string' &&
      s.endpoint.startsWith('https://') &&
      typeof s.p256dh === 'string' &&
      typeof s.auth === 'string'
  );

  const results = await Promise.all(
    validSubs.map(async (sub) => {
      const r = await sendWebPushMessage(sub, cleanPayload, vapid);
      return { id: sub.id, ...r };
    })
  );

  res.json({
    ok: true,
    configured: true,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    expiredIds: results.filter((r) => r.expired).map((r) => r.id),
  });
});

// Vite Middleware in Development / Static Build in Production
async function startServer() {
  const isProduction =
    process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (result?.code) {
          const patched = result.code.replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR disabled: WebSocket connect skipped */'
          );
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.send(patched);
          return;
        }
      } catch {
        // Fall back to Vite middleware if needed
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Shoptopia server listening on http://localhost:${PORT}`);
  });
}

startServer();
