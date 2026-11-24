# Shoptopia — Cloudflare Pages & Custom Domain Deploy Guide

VPN မလိုဘဲ Buyer များနှင့် Admin ပါ တိုက်ရိုက်အသုံးပြုနိုင်စေရန် Cloudflare Pages နှင့် Custom Domain ပေါ်သို့ တင်နည်း အပြည့်အစုံဖြစ်ပါသည်။

---

## 1. ကြိုတင်ပြင်ဆင်ရန် (Prerequisites)
- **Cloudflare Account** ([dash.cloudflare.com](https://dash.cloudflare.com))
- **GitHub Account** (သို့မဟုတ် ကိုယ့်ကွန်ပျူတာတွင် Node.js 22+ ဖြင့် Build ထုတ်ပြီး တိုက်ရိုက် Upload တင်နည်း)
- **Custom Domain** (ဥပမာ `shoptopia.store`, `myshop.com` — Cloudflare Registrar မှဖြစ်စေ၊ Namecheap / GoDaddy စသည့်နေရာမှဖြစ်စေ ဝယ်ထားနိုင်သည်)
- **Firebase Console Access** (`phyokoko.ctd@gmail.com` ဖြင့် Project `sapient-buckeye-gm4ph` ဝင်ခွင့်)

---

## 2. SPA Routing စစ်ဆေးခြင်း
Project ထဲရှိ `wrangler.jsonc` ဖိုင်တွင် `"not_found_handling": "single-page-application"` ကို ထည့်သွင်းထားပြီးဖြစ်ပါသည် (Cloudflare Pages တွင်လည်း `404.html` မရှိပါက SPA fallback ကို အလိုအလျောက် လုပ်ဆောင်ပေးပါသည်)။

> **သတိပြုရန်**: Cloudflare Workers Static Assets တွင် `_redirects` ဖိုင်ထဲ `/* /index.html 200` ထည့်ပါက Infinite Loop ဖြစ်ပြီး **`[code: 100324]`** Error တက်တတ်သောကြောင့် `_redirects` ဖိုင် မသုံးဘဲ `wrangler.jsonc` ဖြင့်သာ SPA Routing ကို ချိန်ညှိထားပါသည်။

`/seller`, `/admin`, `/wishlist`, `/orders`, `/profile` စာမျက်နှာများကို တိုက်ရိုက်ဖွင့်ခြင်း သို့မဟုတ် Refresh လုပ်ခြင်းများတွင် 404 Error မတက်ဘဲ ပုံမှန်ပွင့်ပါမည်။

---

## 3. Cloudflare Dashboard တွင် Deploy တင်နည်း

### နည်းလမ်း (A) — Build / Deploy / Preview Command (၃) ခု မေးနေသည့် Screen (Cloudflare Workers Builds)
Cloudflare Dashboard တွင် GitHub ချိတ်သည့်အခါ **Build command**, **Deploy command**, **Preview command** (၃) ခု မေးလာပါက (Project ထဲတွင် `wrangler.jsonc` ထည့်ပေးထားပြီးဖြစ်၍) အောက်ပါအတိုင်း ထည့်ပါ:

- **Build command**: `npm run build`
- **Deploy command**: `npx wrangler deploy`
- **Preview command**: `npx wrangler versions upload`

*(မှတ်ချက် — Cloudflare က Preview command နေရာတွင် `npx wrangler versions upload` သို့မဟုတ် `npx wrangler preview` ကို အလိုအလျောက် ဖြည့်ပေးထားပြီးသားဖြစ်ပါက အဲဒီအတိုင်း ထားလို့ရပါသည်။)*

### နည်းလမ်း (B) — Classic Cloudflare Pages Mode (Build output directory မေးသည့် Screen)
Cloudflare ၏ Create Screen အောက်ခြေရှိ **"Looking to deploy Pages? Get started"** မှတစ်ဆင့် ဝင်ပါက:
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Environment variables** (လိုအပ်ပါက): `NODE_VERSION` = `22`

### နည်းလမ်း (C) — GitHub မသုံးဘဲ PC မှ Build ထုတ်ပြီး Direct Upload တင်နည်း
1. Terminal တွင် Project Folder ထဲဝင်ပြီး အောက်ပါ Commands များကို Run ပါ:
   ```bash
   npm install
   npm run build
   ```
2. `dist/` folder ထဲတွင် `index.html`, `assets/`, `src/assets/`, နှင့် `_redirects` ဖိုင်များ ထွက်လာပါမည်။
3. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets** ကို နှိပ်ပါ။
4. Project နာမည် (ဥပမာ `shoptopia`) ပေးပြီး `dist` folder တစ်ခုလုံးကို Drag & Drop ဆွဲထည့်ကာ **Deploy site** နှိပ်ပါ။

*(သို့မဟုတ် Wrangler CLI ဖြင့်: `npx wrangler pages deploy dist --project-name=shoptopia`)*

---

## 4. Custom Domain ချိတ်နည်း (မြန်မာ ISP များတွင် VPN မလိုဘဲ ပွင့်စေရန်)
1. ကိုယ်ပိုင် Domain ကို Cloudflare DNS ထဲ ထည့်ပါ:
   - Cloudflare Dashboard → **Add a domain** မှတစ်ဆင့် Domain ထည့်ပါ။
   - Domain ဝယ်ထားသည့် Registrar (Namecheap / GoDaddy စသည်) တွင် **Nameservers** များကို Cloudflare ပေးသည့် Nameserver (၂) ခုဖြင့် အစားထိုးပြောင်းပါ။
2. Cloudflare Pages Project → **Custom domains** → **Set up a custom domain** ကို နှိပ်ပါ။
3. Domain နာမည် (ဥပမာ `shoptopia.store` နှင့် `www.shoptopia.store`) ထည့်ပြီး Activate လုပ်ပါ။
4. Cloudflare **DNS** Tab တွင် CNAME Record ဘေးရှိ **Proxied (လိမ္မော်ရောင်တိမ်တိုက် Icon)** ကို ဖွင့်ထားကြောင်း စစ်ဆေးပါ။
5. **SSL/TLS** Tab တွင် Encryption mode ကို **Full (strict)** သို့မဟုတ် **Full** ထားပါ။

---

## 5. Firebase Authorized Domains ထည့်နည်း (မဖြစ်မနေ လုပ်ရမည့်အဆင့်)
Custom Domain (သို့) `.pages.dev` မှ Google Sign-In နှင့် Phone OTP Login များ အလုပ်လုပ်စေရန် Firebase တွင် Domain ခွင့်ပြုပေးရပါမည်။

1. [Firebase Console](https://console.firebase.google.com) ကို ဖွင့်ပြီး Project **`sapient-buckeye-gm4ph`** ကို ရွေးပါ။
2. ဘယ်ဘက် Menu မှ **Authentication** → **Settings** Tab → **Authorized domains** ကို သွားပါ။
3. **Add domain** ကို နှိပ်ပြီး အောက်ပါ Domain များကို တစ်ခုချင်း ထည့်ပါ:
   - Cloudflare Pages Link (ဥပမာ `shoptopia.pages.dev`)
   - ကိုယ်ပိုင် Custom Domain (ဥပမာ `shoptopia.store` နှင့် `www.shoptopia.store`)
4. **Add** နှိပ်ပြီး သိမ်းပါ။

---

## 6. Deploy ပြီးနောက် စစ်ဆေးရန်
- **Buyer Storefront**: `https://your-domain.com/` (Products, Cart, Wishlist, Checkout, Live Chat အလုပ်လုပ်/မလုပ် စစ်ပါ)
- **Seller / Admin Console**: `https://your-domain.com/seller` (Page Refresh လုပ်ကြည့်ပါ — `_redirects` ကြောင့် 404 မတက်ဘဲ ပုံမှန်ပွင့်ရပါမည်)
- Admin Email (`phyokoko.ctd@gmail.com`) ဖြင့် Google Sign-In ဝင်ပြီး Products / Brand Logo / Orders များ စစ်ဆေးပါ။

---

## 7. App မဖွင့်ထားလဲ ဖုန်း Notification Bar ပေါ်စေရန် (Cloudflare Background Web Push Setup)
Seller Console ၏ **Buyer Alerts** မှ စာပို့လိုက်သည့်အခါ ဝယ်သူများ App ကို ပိတ်ထားလျှင်ပင် ဖုန်း Notification Bar တွင် တန်းပေါ်စေရန် Cloudflare Worker တွင် VAPID Key တစ်စုံ ထည့်ပေးရပါမည် (တစ်ကြိမ်သာ ထည့်ရန် လိုအပ်ပါသည်)။

1. မည်သည့် Node.js Terminal (သို့မဟုတ် AI Studio / PC) တွင်မဆို အောက်ပါ Command ဖြင့် VAPID Key တစ်စုံ ထုတ်ယူပါ:
   ```bash
   node -e "const c=require('crypto');const {publicKey,privateKey}=c.generateKeyPairSync('ec',{namedCurve:'prime256v1'});const pub=publicKey.export({format:'jwk'});const priv=privateKey.export({format:'jwk'});const b64=s=>Buffer.from(s,'base64url');console.log('VAPID_PUBLIC_KEY=',Buffer.concat([Buffer.from([4]),b64(pub.x),b64(pub.y)]).toString('base64url'));console.log('VAPID_PRIVATE_KEY=',priv.d);"
   ```
2. Cloudflare Dashboard → **Workers & Pages** → **`phyo`** Worker → **Settings** → **Variables and Secrets** ကို နှိပ်ပါ။
3. **+ Add** နှိပ်ပြီး အောက်ပါ (၂) ခုကို ထည့်ပါ:
   - Variable: `VAPID_PUBLIC_KEY` (Type: Text — ထွက်လာသော Public Key ကို ထည့်ပါ)
   - Secret: `VAPID_PRIVATE_KEY` (Type: Secret — ထွက်လာသော Private Key ကို ထည့်ပါ)
   - *(Optional)* Variable: `VAPID_SUBJECT` = `mailto:phyokoko.ctd@gmail.com`
4. **Deploy / Save** နှိပ်ပါ။ ထို့နောက် Buyer များသည် **Bell (အသိပေးချက်) → ဖုန်း Noti Bar ဖွင့်မည်** ကို နှိပ်ထားရုံဖြင့် App ပိတ်ထားချိန်၌ပင် ဖုန်း Notification Bar တွင် တိုက်ရိုက်ပေါ်ပါမည်။ (iPhone ဖြစ်ပါက Safari **Share → Add to Home Screen** ဖြင့် App ထည့်ပြီးမှ ဖွင့်ပေးရပါမည်)။

