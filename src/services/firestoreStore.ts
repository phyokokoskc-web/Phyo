import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  Address,
  BannerSlide,
  BootstrapPayload,
  NotificationType,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentSettings,
  Product,
  StoreBrandConfig,
  UserProfile,
} from '../types';

export const DEFAULT_STORE_BRAND: StoreBrandConfig = {
  storeName: 'Shoptopia',
  logoImage: '',
  bannerTitle: 'Curated Lifestyle & Everyday Essentials',
  bannerTitleMm: 'နေ့စဉ်သုံးနှင့် အထူးကုန်ပစ္စည်းများ',
  bannerSubtitle:
    'Authentic quality across Yangon & Mandalay · Real-time stock & direct seller support',
  bannerSubtitleMm:
    'ရန်ကုန်နှင့် မန္တလေး အမြန်ပို့ဆောင်မှု · စစ်မှန်သော အရည်အသွေးနှင့် တိုက်ရိုက်မေးမြန်းနိုင်မှု',
  showLogoBanner: true,
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
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

function clampStr(val: string | undefined | null, maxLen: number, fallback = ''): string {
  const s = (val ?? fallback).toString();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-');
  return cleaned.slice(0, 128) || `id-${Date.now()}`;
}

export function normalizeProductPayload(prod: Product) {
  const variants =
    Array.isArray(prod.variants) && prod.variants.length > 0
      ? prod.variants.slice(0, 20).map((v) => clampStr(v, 80, 'Standard') || 'Standard')
      : ['Standard'];
  const base: Record<string, unknown> = {
    id: sanitizeId(prod.id),
    sku: clampStr(prod.sku, 64, 'SK-001') || 'SK-001',
    name: clampStr(prod.name, 200, 'Product') || 'Product',
    nameMm: clampStr(prod.nameMm || prod.name, 300, 'ကုန်ပစ္စည်း') || 'ကုန်ပစ္စည်း',
    category: clampStr(prod.category, 100, 'General') || 'General',
    price: Math.max(0, Number(prod.price) || 0),
    stock: Math.max(0, Number(prod.stock) || 0),
    popular: Boolean(prod.popular),
    rating: Math.min(5, Math.max(0, Number(prod.rating) || 4.9)),
    soldCount: Math.max(0, Number(prod.soldCount) || 0),
    image: clampStr(prod.image, 800000, ''),
    variants,
    description: clampStr(prod.description, 2000, ''),
    descriptionMm: clampStr(prod.descriptionMm, 2000, ''),
    createdAt: clampStr(prod.createdAt || new Date().toISOString(), 64),
    updatedAt: serverTimestamp(),
  };
  if (typeof prod.compareAtPrice === 'number' && prod.compareAtPrice > 0) {
    base.compareAtPrice = prod.compareAtPrice;
  }
  return base;
}

export async function ensureBuyerProfileDoc(
  uid: string,
  defaults: { name?: string | null; email?: string | null; phone?: string | null }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: uid,
        name:
          clampStr(defaults.name || defaults.phone || 'Buyer', 120, 'Buyer') || 'Buyer',
        email: clampStr(defaults.email || '', 160, ''),
        phone: clampStr(defaults.phone || '', 40, ''),
        wishlist: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existing = snap.data() as { name?: string; phone?: string; email?: string };
      const patch: Record<string, unknown> = {};
      if (
        defaults.name?.trim() &&
        (!existing.name || existing.name === 'Buyer' || existing.name === existing.phone)
      ) {
        patch.name = clampStr(defaults.name.trim(), 120, 'Buyer');
      }
      if (defaults.phone?.trim() && !existing.phone) {
        patch.phone = clampStr(defaults.phone.trim(), 40, '');
      }
      if (defaults.email?.trim() && !existing.email) {
        patch.email = clampStr(defaults.email.trim(), 160, '');
      }
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = serverTimestamp();
        await updateDoc(ref, patch);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveBuyerProfileDoc(
  uid: string,
  patch: Pick<UserProfile, 'name' | 'email' | 'phone'>
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await ensureBuyerProfileDoc(uid, {
      name: patch.name,
      email: patch.email,
      phone: patch.phone,
    });
    await updateDoc(doc(db, 'users', uid), {
      name: clampStr(patch.name.trim() || 'Buyer', 120, 'Buyer'),
      email: clampStr(patch.email.trim(), 160, ''),
      phone: clampStr(patch.phone.trim(), 40, ''),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function toggleWishlistDoc(
  uid: string,
  productId: string,
  currentWishlist: string[],
  userDefaults: { name?: string | null; email?: string | null; phone?: string | null }
): Promise<string[]> {
  const path = `users/${uid}`;
  try {
    await ensureBuyerProfileDoc(uid, userDefaults);
    const next = currentWishlist.includes(productId)
      ? currentWishlist.filter((id) => id !== productId)
      : [...currentWishlist, productId].slice(0, 200);
    await updateDoc(doc(db, 'users', uid), {
      wishlist: next,
      updatedAt: serverTimestamp(),
    });
    return next;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function saveAddressDoc(
  uid: string,
  input: Omit<Address, 'id'> & { id?: string },
  existingAddresses: Address[],
  userDefaults: { name?: string | null; email?: string | null; phone?: string | null }
): Promise<void> {
  const addrId = sanitizeId(input.id || `addr-${Date.now()}`);
  const path = `users/${uid}/addresses/${addrId}`;
  try {
    await ensureBuyerProfileDoc(uid, userDefaults);
    const makeDefault = Boolean(input.isDefault) || existingAddresses.length === 0;
    const batch = writeBatch(db);
    if (makeDefault) {
      for (const existing of existingAddresses) {
        if (existing.id !== addrId && existing.isDefault) {
          batch.update(doc(db, 'users', uid, 'addresses', existing.id), {
            isDefault: false,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }
    const payload: Record<string, unknown> = {
      id: addrId,
      label: clampStr(input.label.trim() || 'Home', 60, 'Home'),
      recipientName: clampStr(input.recipientName.trim(), 120, 'Recipient'),
      phone: clampStr(input.phone.trim(), 40, '-'),
      city: clampStr(input.city.trim() || 'Yangon', 80, 'Yangon'),
      township: clampStr(input.township.trim(), 80, '-'),
      streetAddress: clampStr(input.streetAddress.trim(), 300, '-'),
      isDefault: makeDefault,
      updatedAt: serverTimestamp(),
    };
    if (input.notes?.trim()) {
      payload.notes = clampStr(input.notes.trim(), 300, '');
    }
    batch.set(doc(db, 'users', uid, 'addresses', addrId), payload);
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function setDefaultAddressDoc(
  uid: string,
  targetId: string,
  existingAddresses: Address[]
): Promise<void> {
  const path = `users/${uid}/addresses/${targetId}`;
  try {
    const batch = writeBatch(db);
    for (const addr of existingAddresses) {
      if (addr.id === targetId || addr.isDefault) {
        batch.update(doc(db, 'users', uid, 'addresses', addr.id), {
          isDefault: addr.id === targetId,
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteAddressDoc(
  uid: string,
  targetId: string,
  existingAddresses: Address[]
): Promise<void> {
  const path = `users/${uid}/addresses/${targetId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', uid, 'addresses', targetId));
    const remaining = existingAddresses.filter((a) => a.id !== targetId);
    if (remaining.length > 0 && !remaining.some((a) => a.isDefault)) {
      batch.update(doc(db, 'users', uid, 'addresses', remaining[0].id), {
        isDefault: true,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function createOrderTransaction(input: {
  uid: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: Address;
  items: Array<{ productId: string; quantity: number; variant: string }>;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  bankName?: string;
}): Promise<Order> {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const orderId = `YG-${Date.now()}-${suffix}`;
  const path = `orders/${orderId}`;
  try {
    return await runTransaction(db, async (tx) => {
      const productSnaps = await Promise.all(
        input.items.map((item) => tx.get(doc(db, 'products', item.productId)))
      );
      const orderItems: OrderItem[] = [];
      let subtotal = 0;

      for (let i = 0; i < input.items.length; i++) {
        const reqItem = input.items[i];
        const snap = productSnaps[i];
        if (!snap.exists()) {
          throw new Error(`Product ${reqItem.productId} not found`);
        }
        const prod = snap.data() as Product;
        const qty = Math.max(1, Math.floor(Number(reqItem.quantity)));
        if (prod.stock < qty) {
          throw new Error(`Insufficient stock for ${prod.name}`);
        }
        tx.update(doc(db, 'products', prod.id), {
          stock: prod.stock - qty,
          soldCount: (prod.soldCount || 0) + qty,
          updatedAt: serverTimestamp(),
        });
        subtotal += prod.price * qty;
        const safeImage =
          prod.image && prod.image.startsWith('data:') && prod.image.length > 800
            ? ''
            : clampStr(prod.image, 800, '');
        orderItems.push({
          productId: prod.id,
          name: clampStr(prod.name, 200),
          nameMm: clampStr(prod.nameMm || prod.name, 300),
          price: prod.price,
          quantity: qty,
          variant: clampStr(reqItem.variant || prod.variants?.[0] || 'Standard', 80),
          image: safeImage,
        });
      }

      const shippingFee = subtotal >= 150000 ? 0 : 4500;
      const total = subtotal + shippingFee;
      const nowIso = new Date().toISOString();

      const cleanAddress: Address = {
        id: sanitizeId(input.shippingAddress.id || 'addr-1'),
        label: clampStr(input.shippingAddress.label, 60, 'Home'),
        recipientName: clampStr(input.shippingAddress.recipientName, 120, 'Recipient'),
        phone: clampStr(input.shippingAddress.phone, 40, '-'),
        city: clampStr(input.shippingAddress.city, 80, 'Yangon'),
        township: clampStr(input.shippingAddress.township, 80, '-'),
        streetAddress: clampStr(input.shippingAddress.streetAddress, 300, '-'),
        isDefault: Boolean(input.shippingAddress.isDefault),
        ...(input.shippingAddress.notes?.trim()
          ? { notes: clampStr(input.shippingAddress.notes.trim(), 300) }
          : {}),
      };

      const orderDoc: Record<string, unknown> = {
        id: orderId,
        buyerId: input.uid,
        customerName: clampStr(
          input.customerName.trim() || cleanAddress.recipientName || 'Buyer',
          120
        ),
        customerPhone: clampStr(input.customerPhone.trim() || cleanAddress.phone || '', 40),
        shippingAddress: cleanAddress,
        items: orderItems,
        subtotal,
        shippingFee,
        total,
        paymentMethod: input.paymentMethod,
        paymentReference: clampStr(input.paymentReference.trim(), 120),
        status: 'Pending',
        trackingHistory: [
          {
            status: 'Pending',
            timestamp: nowIso,
            note: `Order placed via ${input.paymentMethod} (Ref: ${input.paymentReference.trim()})`,
          },
        ],
        createdAt: nowIso,
        serverCreatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (input.bankName?.trim()) {
        orderDoc.bankName = clampStr(input.bankName.trim(), 80);
      }

      tx.set(doc(db, 'orders', orderId), orderDoc);

      return {
        id: orderId,
        buyerId: input.uid,
        customerName: orderDoc.customerName as string,
        customerPhone: orderDoc.customerPhone as string,
        shippingAddress: cleanAddress,
        items: orderItems,
        subtotal,
        shippingFee,
        total,
        paymentMethod: input.paymentMethod,
        paymentReference: orderDoc.paymentReference as string,
        bankName: orderDoc.bankName as string | undefined,
        status: 'Pending',
        trackingHistory: orderDoc.trackingHistory as Order['trackingHistory'],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('Insufficient stock') || err.message.includes('not found'))
    ) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function sendChatMessageDoc(input: {
  threadId: string;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  senderRole: 'buyer' | 'admin';
  senderUid: string;
  senderName: string;
  text: string;
  imageUrl?: string;
  contextTag?: string;
}): Promise<void> {
  const cleanThreadId = sanitizeId(input.threadId);
  const cleanBuyerId = sanitizeId(input.buyerId);
  const cleanSenderUid = sanitizeId(input.senderUid);
  const cleanBuyerName = clampStr(input.buyerName.trim() || 'Buyer', 120, 'Buyer') || 'Buyer';
  const cleanSenderName = clampStr(input.senderName.trim() || 'User', 120, 'User') || 'User';
  const cleanBuyerPhone = clampStr(input.buyerPhone.trim(), 40, '');
  const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const threadPath = `chatThreads/${cleanThreadId}`;
  const msgPath = `${threadPath}/messages/${msgId}`;
  const nowIso = new Date().toISOString();
  const cleanText = clampStr(input.text.trim(), 2000);
  const cleanImageUrl = input.imageUrl?.trim() ? clampStr(input.imageUrl.trim(), 800000) : '';
  if (!cleanText && !cleanImageUrl) return;
  const previewText = clampStr(cleanText || '[Photo]', 300);

  try {
    const threadRef = doc(db, 'chatThreads', cleanThreadId);
    const threadSnap = await getDoc(threadRef);
    if (!threadSnap.exists()) {
      await setDoc(threadRef, {
        id: cleanThreadId,
        buyerId: cleanBuyerId,
        buyerName: cleanBuyerName,
        buyerPhone: cleanBuyerPhone,
        lastMessageAt: nowIso,
        lastMessagePreview: previewText,
        unreadByAdmin: input.senderRole === 'buyer' ? 1 : 0,
        unreadByBuyer: input.senderRole === 'admin' ? 1 : 0,
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = threadSnap.data() || {};
      const updatePayload: Record<string, unknown> = {
        lastMessageAt: nowIso,
        lastMessagePreview: previewText,
        updatedAt: serverTimestamp(),
      };
      if (typeof existingData.buyerPhone !== 'string') {
        updatePayload.buyerPhone = cleanBuyerPhone;
      }
      if (typeof existingData.buyerName !== 'string' || !existingData.buyerName.trim()) {
        updatePayload.buyerName = cleanBuyerName;
      }
      if (input.senderRole === 'buyer') {
        updatePayload.buyerName = cleanBuyerName;
        if (cleanBuyerPhone) {
          updatePayload.buyerPhone = cleanBuyerPhone;
        }
        updatePayload.unreadByAdmin = increment(1);
        if (typeof existingData.unreadByBuyer !== 'number') {
          updatePayload.unreadByBuyer = 0;
        }
      } else {
        updatePayload.unreadByBuyer = increment(1);
        updatePayload.unreadByAdmin = 0;
      }
      await updateDoc(threadRef, updatePayload);
    }

    const msgPayload: Record<string, unknown> = {
      id: msgId,
      threadId: cleanThreadId,
      senderRole: input.senderRole,
      senderUid: cleanSenderUid,
      senderName: cleanSenderName,
      text: cleanText,
      createdAt: nowIso,
      serverCreatedAt: serverTimestamp(),
      read: false,
    };
    if (cleanImageUrl) {
      msgPayload.imageUrl = cleanImageUrl;
    }
    if (input.contextTag?.trim()) {
      msgPayload.contextTag = clampStr(input.contextTag.trim(), 200);
    }
    await setDoc(doc(db, 'chatThreads', cleanThreadId, 'messages', msgId), msgPayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, msgPath);
  }
}

export async function deleteChatMessageDoc(
  threadId: string,
  messageId: string
): Promise<void> {
  const cleanThreadId = sanitizeId(threadId);
  const cleanMsgId = sanitizeId(messageId);
  const msgPath = `chatThreads/${cleanThreadId}/messages/${cleanMsgId}`;
  try {
    await deleteDoc(doc(db, 'chatThreads', cleanThreadId, 'messages', cleanMsgId));
    const msgsSnap = await getDocs(collection(db, 'chatThreads', cleanThreadId, 'messages'));
    const remaining: Array<{ createdAt?: string; text?: string; imageUrl?: string }> = [];
    msgsSnap.forEach((d) => {
      remaining.push(d.data() as { createdAt?: string; text?: string; imageUrl?: string });
    });
    remaining.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const latest = remaining[remaining.length - 1];
    const threadRef = doc(db, 'chatThreads', cleanThreadId);
    if (latest) {
      const preview = clampStr((latest.text || '').trim() || (latest.imageUrl ? '[Photo]' : ''), 300);
      await updateDoc(threadRef, {
        lastMessageAt: clampStr(latest.createdAt || '', 64),
        lastMessagePreview: preview,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(threadRef, {
        lastMessageAt: '',
        lastMessagePreview: '',
        unreadByAdmin: 0,
        unreadByBuyer: 0,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, msgPath);
  }
}

export async function markThreadMessagesRead(
  threadId: string,
  readerRole: 'buyer' | 'admin'
): Promise<void> {
  const cleanThreadId = sanitizeId(threadId);
  const path = `chatThreads/${cleanThreadId}/messages`;
  try {
    const threadRef = doc(db, 'chatThreads', cleanThreadId);
    const msgsSnap = await getDocs(collection(db, 'chatThreads', cleanThreadId, 'messages'));
    const unreadDocs: typeof msgsSnap.docs = [];
    msgsSnap.forEach((mDoc) => {
      const data = mDoc.data();
      if (data.senderRole !== readerRole && !data.read) {
        unreadDocs.push(mDoc);
      }
    });

    if (unreadDocs.length > 0) {
      const batch = writeBatch(db);
      for (const mDoc of unreadDocs.slice(0, 450)) {
        batch.update(mDoc.ref, { read: true });
      }
      batch.update(threadRef, {
        ...(readerRole === 'admin' ? { unreadByAdmin: 0 } : { unreadByBuyer: 0 }),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } else {
      await updateDoc(threadRef, {
        ...(readerRole === 'admin' ? { unreadByAdmin: 0 } : { unreadByBuyer: 0 }),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// --- Admin Operations ---
export async function saveProductDoc(
  prod: Product,
  isEdit: boolean,
  currentCategories: string[],
  analyticsResetAt?: string
): Promise<void> {
  const path = `products/${prod.id}`;
  try {
    const batch = writeBatch(db);
    const payload = normalizeProductPayload(prod);
    if (isEdit && typeof prod.compareAtPrice !== 'number') {
      payload.compareAtPrice = deleteField();
    }
    const prodRef = doc(db, 'products', sanitizeId(prod.id));
    if (isEdit) {
      batch.update(prodRef, payload);
    } else {
      batch.set(prodRef, payload);
    }
    const cleanCat = clampStr(prod.category.trim(), 100);
    if (cleanCat && !currentCategories.includes(cleanCat)) {
      const nextCats = [...currentCategories, cleanCat].slice(0, 40);
      batch.set(
        doc(db, 'storeCatalog', 'main'),
        {
          categories: nextCats,
          ...(analyticsResetAt ? { analyticsResetAt } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function quickPatchProductDoc(
  prod: Product,
  patch: Partial<Product>
): Promise<void> {
  const merged: Product = { ...prod, ...patch };
  return saveProductDoc(merged, true, [merged.category]);
}

export async function deleteProductDoc(id: string): Promise<void> {
  const path = `products/${id}`;
  try {
    await deleteDoc(doc(db, 'products', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function updateOrderStatusDoc(
  order: Order,
  status: OrderStatus,
  note?: string
): Promise<void> {
  const path = `orders/${order.id}`;
  try {
    const nowIso = new Date().toISOString();
    const defaultNotes: Record<OrderStatus, string> = {
      Pending: 'Awaiting payment verification',
      Verified: `${order.paymentMethod} reference ${order.paymentReference} verified by seller`,
      Shipped: `Dispatched for delivery to ${order.shippingAddress.township}, ${order.shippingAddress.city}`,
      Delivered: 'Package delivered and signed by recipient',
      Cancelled: 'Order cancelled by seller',
    };
    const nextHistory = [
      ...order.trackingHistory,
      {
        status,
        timestamp: nowIso,
        note: note?.trim() || defaultNotes[status],
      },
    ].slice(0, 30);

    await updateDoc(doc(db, 'orders', order.id), {
      status,
      trackingHistory: nextHistory,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function saveBannerDoc(
  banner: BannerSlide & { sortOrder?: number },
  isEdit: boolean
): Promise<void> {
  const id = sanitizeId(banner.id);
  const path = `banners/${id}`;
  try {
    const payload = {
      id,
      kicker: clampStr(banner.kicker, 120, 'Featured'),
      kickerMm: clampStr(banner.kickerMm || banner.kicker, 200, 'အထူးကဏ္ဍ'),
      title: clampStr(banner.title, 200, 'Featured') || 'Featured',
      titleMm: clampStr(banner.titleMm || banner.title, 300, ''),
      subtitle: clampStr(banner.subtitle, 500, ''),
      subtitleMm: clampStr(banner.subtitleMm || banner.subtitle, 600, ''),
      ctaLabel: clampStr(banner.ctaLabel || 'Shop Now', 80, 'Shop Now'),
      ctaLabelMm: clampStr(banner.ctaLabelMm || banner.ctaLabel, 120, 'ကြည့်ရှုရန်'),
      targetCategory: clampStr(banner.targetCategory || 'All', 100, 'All'),
      image: clampStr(banner.image, 800000, ''),
      sortOrder: Number(banner.sortOrder ?? Date.now()),
      updatedAt: serverTimestamp(),
    };
    if (isEdit) {
      await updateDoc(doc(db, 'banners', id), payload);
    } else {
      await setDoc(doc(db, 'banners', id), payload);
    }
  } catch (err) {
    handleFirestoreError(err, isEdit ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteBannerDoc(id: string): Promise<void> {
  const path = `banners/${id}`;
  try {
    await deleteDoc(doc(db, 'banners', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveStoreBrandDoc(
  brand: StoreBrandConfig,
  currentCategories: string[],
  analyticsResetAt?: string
): Promise<void> {
  const path = 'storeCatalog/main';
  try {
    const cleanCats = Array.from(
      new Set(currentCategories.map((c) => clampStr(c.trim(), 100)).filter(Boolean))
    ).slice(0, 40);
    if (cleanCats.length === 0) cleanCats.push('General');

    const cleanBrand: StoreBrandConfig = {
      storeName: clampStr(brand.storeName.trim() || 'Shoptopia', 80, 'Shoptopia') || 'Shoptopia',
      logoImage: clampStr(brand.logoImage.trim(), 800000, ''),
      bannerTitle: clampStr(brand.bannerTitle.trim(), 120, ''),
      bannerTitleMm: clampStr(brand.bannerTitleMm.trim(), 180, ''),
      bannerSubtitle: clampStr(brand.bannerSubtitle.trim(), 240, ''),
      bannerSubtitleMm: clampStr(brand.bannerSubtitleMm.trim(), 300, ''),
      showLogoBanner: Boolean(brand.showLogoBanner),
    };

    await setDoc(
      doc(db, 'storeCatalog', 'main'),
      {
        categories: cleanCats,
        brand: cleanBrand,
        ...(analyticsResetAt ? { analyticsResetAt } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveCategoriesList(
  categories: string[],
  analyticsResetAt?: string
): Promise<void> {
  const path = 'storeCatalog/main';
  try {
    const cleanCats = Array.from(
      new Set(categories.map((c) => clampStr(c.trim(), 100)).filter(Boolean))
    ).slice(0, 40);
    if (cleanCats.length === 0) cleanCats.push('General');
    await setDoc(
      doc(db, 'storeCatalog', 'main'),
      {
        categories: cleanCats,
        ...(analyticsResetAt ? { analyticsResetAt } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function renameCategoryBatch(
  oldName: string,
  newName: string,
  categories: string[],
  products: Product[],
  banners: BannerSlide[],
  analyticsResetAt?: string
): Promise<void> {
  const path = 'storeCatalog/main';
  try {
    const clean = clampStr(newName.trim(), 100);
    if (!clean || clean === oldName) return;
    const nextCats = Array.from(
      new Set(categories.map((c) => (c === oldName ? clean : c)))
    ).slice(0, 40);

    const batch = writeBatch(db);
    batch.set(
      doc(db, 'storeCatalog', 'main'),
      {
        categories: nextCats,
        ...(analyticsResetAt ? { analyticsResetAt } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    for (const p of products) {
      if (p.category === oldName) {
        batch.update(doc(db, 'products', p.id), {
          category: clean,
          updatedAt: serverTimestamp(),
        });
      }
    }
    for (const b of banners) {
      if (b.targetCategory === oldName) {
        batch.update(doc(db, 'banners', b.id), {
          targetCategory: clean,
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCategoryBatch(
  target: string,
  categories: string[],
  products: Product[],
  banners: BannerSlide[],
  analyticsResetAt?: string
): Promise<void> {
  const path = 'storeCatalog/main';
  try {
    const remaining = categories.filter((c) => c !== target);
    const fallback = remaining[0] || 'General';
    if (remaining.length === 0) remaining.push('General');

    const batch = writeBatch(db);
    batch.set(
      doc(db, 'storeCatalog', 'main'),
      {
        categories: remaining,
        ...(analyticsResetAt ? { analyticsResetAt } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    for (const p of products) {
      if (p.category === target) {
        batch.update(doc(db, 'products', p.id), {
          category: fallback,
          updatedAt: serverTimestamp(),
        });
      }
    }
    for (const b of banners) {
      if (b.targetCategory === target) {
        batch.update(doc(db, 'banners', b.id), {
          targetCategory: 'All',
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function savePaymentConfigDoc(settings: PaymentSettings): Promise<void> {
  const path = 'paymentConfig/main';
  try {
    await setDoc(doc(db, 'paymentConfig', 'main'), {
      kpay: {
        enabled: Boolean(settings.kpay.enabled),
        accountName: clampStr(settings.kpay.accountName, 120),
        phone: clampStr(settings.kpay.phone, 40),
        qrImage: clampStr(settings.kpay.qrImage || '', 800000),
      },
      wavepay: {
        enabled: Boolean(settings.wavepay.enabled),
        accountName: clampStr(settings.wavepay.accountName, 120),
        phone: clampStr(settings.wavepay.phone, 40),
        qrImage: clampStr(settings.wavepay.qrImage || '', 800000),
      },
      bankAccounts: (settings.bankAccounts || []).slice(0, 15).map((b) => ({
        id: sanitizeId(b.id),
        bankName: clampStr(b.bankName, 80),
        accountNumber: clampStr(b.accountNumber, 80),
        accountHolder: clampStr(b.accountHolder, 120),
        enabled: Boolean(b.enabled),
      })),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function resetAnalyticsBatch(
  categories: string[],
  products: Product[],
  orders: Order[],
  clearOrders: boolean
): Promise<string> {
  const path = 'storeCatalog/main';
  const nowIso = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'storeCatalog', 'main'),
      {
        categories: categories.length > 0 ? categories : ['General'],
        analyticsResetAt: nowIso,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    for (const p of products) {
      if (p.soldCount !== 0) {
        batch.update(doc(db, 'products', p.id), {
          soldCount: 0,
          updatedAt: serverTimestamp(),
        });
      }
    }
    if (clearOrders) {
      for (const o of orders) {
        batch.delete(doc(db, 'orders', o.id));
      }
    }
    await batch.commit();
    return nowIso;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Seeds Firestore automatically on first Admin login if Firestore catalog is empty,
 * preserving any existing local store.json edits (such as seller-edited items).
 */
export async function syncLocalSeedToFirestoreIfEmpty(): Promise<boolean> {
  try {
    const existingProds = await getDocs(collection(db, 'products'));
    const existingCatalog = await getDoc(doc(db, 'storeCatalog', 'main'));
    if (!existingProds.empty && existingCatalog.exists()) {
      return false;
    }

    const res = await fetch('/api/bootstrap?role=admin', { cache: 'no-store' });
    if (!res.ok) return false;
    const data = (await res.json()) as BootstrapPayload;

    const mergedCategories = Array.from(
      new Set([
        ...(data.categories || []),
        ...(data.products || []).map((p) => p.category).filter(Boolean),
      ])
    ).slice(0, 40);
    if (mergedCategories.length === 0) mergedCategories.push('General');

    const batch = writeBatch(db);
    if (existingProds.empty && Array.isArray(data.products)) {
      for (const p of data.products) {
        const clean = normalizeProductPayload(p);
        batch.set(doc(db, 'products', clean.id as string), clean);
      }
    }
    const existingBanners = await getDocs(collection(db, 'banners'));
    if (existingBanners.empty && Array.isArray(data.banners)) {
      data.banners.forEach((b, idx) => {
        const id = sanitizeId(b.id);
        batch.set(doc(db, 'banners', id), {
          id,
          kicker: clampStr(b.kicker, 120),
          kickerMm: clampStr(b.kickerMm || b.kicker, 200),
          title: clampStr(b.title, 200, 'Featured') || 'Featured',
          titleMm: clampStr(b.titleMm || b.title, 300),
          subtitle: clampStr(b.subtitle, 500),
          subtitleMm: clampStr(b.subtitleMm || b.subtitle, 600),
          ctaLabel: clampStr(b.ctaLabel || 'Shop Now', 80),
          ctaLabelMm: clampStr(b.ctaLabelMm || b.ctaLabel, 120),
          targetCategory: clampStr(b.targetCategory || 'All', 100),
          image: clampStr(b.image, 800000),
          sortOrder: idx,
          updatedAt: serverTimestamp(),
        });
      });
    }
    if (!existingCatalog.exists()) {
      batch.set(
        doc(db, 'storeCatalog', 'main'),
        {
          categories: mergedCategories,
          ...(data.analyticsResetAt ? { analyticsResetAt: data.analyticsResetAt } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    const existingPay = await getDoc(doc(db, 'paymentConfig', 'main'));
    if (!existingPay.exists()) {
      const pay = data.paymentSettings || DEFAULT_PAYMENT_SETTINGS;
      batch.set(doc(db, 'paymentConfig', 'main'), {
        kpay: {
          enabled: Boolean(pay.kpay.enabled),
          accountName: clampStr(pay.kpay.accountName, 120),
          phone: clampStr(pay.kpay.phone, 40),
          qrImage: clampStr(pay.kpay.qrImage || '', 800000),
        },
        wavepay: {
          enabled: Boolean(pay.wavepay.enabled),
          accountName: clampStr(pay.wavepay.accountName, 120),
          phone: clampStr(pay.wavepay.phone, 40),
          qrImage: clampStr(pay.wavepay.qrImage || '', 800000),
        },
        bankAccounts: (pay.bankAccounts || []).slice(0, 15).map((b) => ({
          id: sanitizeId(b.id),
          bankName: clampStr(b.bankName, 80),
          accountNumber: clampStr(b.accountNumber, 80),
          accountHolder: clampStr(b.accountHolder, 120),
          enabled: Boolean(b.enabled),
        })),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return true;
  } catch (err) {
    console.error('Initial cloud seed error:', err);
    return false;
  }
}

export async function sendNotificationDoc(input: {
  targetBuyerId: string;
  targetBuyerName: string;
  type: NotificationType;
  title: string;
  message: string;
  actionTarget?: string;
  senderName: string;
}): Promise<string> {
  const notifId = sanitizeId(`notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const path = `notifications/${notifId}`;
  const cleanTitle = clampStr(input.title.trim(), 140);
  const cleanMessage = clampStr(input.message.trim(), 600);
  if (!cleanTitle || !cleanMessage) {
    throw new Error('NOTIFICATION_TITLE_AND_MESSAGE_REQUIRED');
  }
  const targetId =
    input.targetBuyerId === 'all' ? 'all' : sanitizeId(input.targetBuyerId || 'all');
  const payload: Record<string, unknown> = {
    id: notifId,
    targetBuyerId: targetId,
    targetBuyerName: clampStr(
      input.targetBuyerName.trim() || (targetId === 'all' ? 'All Buyers' : 'Buyer'),
      120
    ),
    type: (['promo', 'order', 'restock', 'info'] as const).includes(input.type)
      ? input.type
      : 'info',
    title: cleanTitle,
    message: cleanMessage,
    senderName: clampStr(input.senderName.trim() || 'Shoptopia', 80, 'Shoptopia'),
    createdAt: new Date().toISOString(),
    serverCreatedAt: serverTimestamp(),
  };
  if (input.actionTarget && input.actionTarget !== 'none') {
    payload.actionTarget = clampStr(input.actionTarget, 120);
  }
  try {
    await setDoc(doc(db, 'notifications', notifId), payload);
    return notifId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteNotificationDoc(notifId: string): Promise<void> {
  const cleanId = sanitizeId(notifId);
  const path = `notifications/${cleanId}`;
  try {
    await deleteDoc(doc(db, 'notifications', cleanId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
