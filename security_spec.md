# Shoptopia Firestore Security Specification

## 1. Data Invariants
1. **Default-Deny Catch-All**: Every path not explicitly matched is denied (`allow read, write: if false`).
2. **Public Catalog / Private PII Split**: Non-PII storefront catalog data (`/products`, `/banners`, `/storeCatalog/main`, `/paymentConfig/main`) is publicly readable so buyers opening any shared storefront link immediately receive real-time seller updates. Personal data (`/users/{userId}`, `/users/{userId}/addresses`, `/orders`, `/chatThreads`) is strictly restricted to `isOwner()` or `isAdmin()`.
3. **Admin Integrity**: Only verified admin (`request.auth.token.email == 'phyokoko.ctd@gmail.com' && request.auth.token.email_verified == true` or document in `/admins/{uid}`) may create/update/delete catalog products, banners, categories, payment settings, or change order statuses.
4. **Buyer Isolation & Verified Writes**: Any authenticated user write requires `request.auth.token.email_verified == true`, `incoming().buyerId == request.auth.uid` (or `isOwner(userId)`), strict field allowlisting (`hasOnly`), and `request.time` timestamp enforcement.
5. **Path Variable Hardening**: Single-document operations validate `isValidId(id)` (`^[a-zA-Z0-9_-]+$`, `<= 128` chars) to block ID poisoning.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Product Creation**: Anonymous client attempts `create` on `/products/prod-evil` -> `PERMISSION_DENIED` (`isAdmin()` fails).
2. **Non-Admin Price Tampering**: Verified buyer attempts `update` on `/products/prod-1` changing `price` to `1` -> `PERMISSION_DENIED` (`affectedKeys().hasOnly(['stock', 'soldCount', 'updatedAt'])` fails).
3. **Stock Inflation Exploit**: Verified buyer attempts `update` on `/products/prod-1` setting `stock` higher than `existing().stock` -> `PERMISSION_DENIED` (`incoming().stock < existing().stock` fails).
4. **Shadow Role Injection on Profile**: Verified buyer creates `/users/{uid}` with extra field `isAdmin: true` -> `PERMISSION_DENIED` (`hasOnly` check fails).
5. **Cross-User PII Read**: Buyer B attempts `get` on `/users/{buyerA}` or `/orders/{orderOfA}` -> `PERMISSION_DENIED` (`isOwner` / `buyerId` mismatch).
6. **Blanket List Query Scraping**: Buyer attempts `list` on `/orders` without `where('buyerId', '==', uid)` -> `PERMISSION_DENIED` (`resource.data.buyerId == request.auth.uid` cannot be proven).
7. **Status Shortcutting on Order Create**: Buyer creates `/orders/YG-9999` with `status: 'Delivered'` -> `PERMISSION_DENIED` (`incoming().status == 'Pending'` fails).
8. **Buyer Updating Own Order Status**: Buyer updates `/orders/{id}` from `Pending` to `Verified` -> `PERMISSION_DENIED` (`isAdmin()` required for order status updates).
9. **Spoofed Sender Role in Chat**: Buyer sends message in `/chatThreads/{threadId}/messages/{msgId}` with `senderRole: 'admin'` -> `PERMISSION_DENIED`.
10. **Orphaned Address / Message**: Buyer creates `/users/{uid}/addresses/addr-1` when `/users/{uid}` does not exist -> `PERMISSION_DENIED` (`exists(...)` master gate fails).
11. **Backdated Timestamp Forgery**: Client sends client timestamp instead of `serverTimestamp()` -> `PERMISSION_DENIED` (`== request.time` fails).
12. **Resource Poisoning / Oversized String**: Admin or buyer attempts to write a 1.5MB string into `name` or `id` -> `PERMISSION_DENIED` (`.size()` / `isValidId()` fails).
13. **Non-Admin Notification Forgery & Targeted Read Isolation**: Verified buyer attempts `create` on `/notifications/notif-evil` or Buyer B attempts `get`/`list` on a notification where `targetBuyerId == 'buyer-a'` -> `PERMISSION_DENIED`.
