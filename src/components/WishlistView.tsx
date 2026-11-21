import { Heart, ShoppingBag, Trash2, Zap, LayoutGrid, List } from 'lucide-react';
import type { Language, Product } from '../types';
import { formatMMK } from '../utils/format';
import { t } from '../i18n';
import { SmartImage } from './SmartImage';
import { BuyerAuthPanel } from './BuyerAuthPanel';
import type { ProductLayoutMode } from './ProductCard';

interface WishlistViewProps {
  isAuthenticated: boolean;
  products: Product[];
  wishlistIds: string[];
  lang: Language;
  layout?: ProductLayoutMode;
  onChangeLayout?: (layout: ProductLayoutMode) => void;
  onSignInGoogle: () => Promise<void>;
  onRemoveWishlist: (productId: string) => void;
  onMoveToBag: (product: Product) => void;
  onBuyNow: (product: Product) => void;
  onOpenDetail: (product: Product) => void;
}

export function WishlistView({
  isAuthenticated,
  products,
  wishlistIds,
  lang,
  layout = 'grid2',
  onChangeLayout,
  onSignInGoogle,
  onRemoveWishlist,
  onMoveToBag,
  onBuyNow,
  onOpenDetail,
}: WishlistViewProps) {
  const dict = t(lang);
  const items = products.filter((p) => wishlistIds.includes(p.id));

  return (
    <section className="space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {dict.wishlist.heading}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{dict.wishlist.subtitle}</p>
        </div>

        {isAuthenticated && items.length > 0 && onChangeLayout && (
          <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#16191F] p-0.5">
            <button
              type="button"
              onClick={() => onChangeLayout('grid2')}
              aria-label={dict.home.grid2View}
              title={dict.home.grid2View}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                layout === 'grid2'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{dict.home.grid2View}</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeLayout('list')}
              aria-label={dict.home.listView}
              title={dict.home.listView}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                layout === 'list'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{dict.home.listView}</span>
            </button>
          </div>
        )}
      </div>

      {!isAuthenticated ? (
        <div className="max-w-lg rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-6">
          <BuyerAuthPanel
            lang={lang}
            onSignInGoogle={onSignInGoogle}
            title={dict.auth.buyerGateTitle}
            subtitle={dict.auth.buyerGateDesc}
          />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-12 text-center">
          <Heart className="mx-auto w-9 h-9 text-zinc-300 dark:text-zinc-600 mb-3" />
          <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            {dict.wishlist.empty}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{dict.wishlist.emptySub}</p>
        </div>
      ) : layout === 'list' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {items.map((product) => {
            const title = lang === 'mm' ? product.nameMm : product.name;
            const outOfStock = product.stock <= 0;
            return (
              <article
                key={product.id}
                className="flex flex-row rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => onOpenDetail(product)}
                  className="w-28 sm:w-40 shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900 cursor-pointer"
                >
                  <SmartImage
                    src={product.image}
                    alt={title}
                    fallbackLabel={title}
                    className="h-full w-full object-cover"
                  />
                </button>
                <div className="flex flex-1 flex-col min-w-0 p-3 sm:p-4">
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-0.5 truncate">
                    {product.category}
                  </div>
                  <h3 className="font-display text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1 line-clamp-1">
                    {title}
                  </h3>
                  <div className="font-mono-tabular text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3">
                    {formatMMK(product.price)}
                  </div>
                  <div className="mt-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={outOfStock}
                      onClick={() => onMoveToBag(product)}
                      className="flex-1 inline-flex min-h-[34px] items-center justify-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 whitespace-nowrap cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{dict.wishlist.moveToBag}</span>
                    </button>
                    <button
                      type="button"
                      disabled={outOfStock}
                      onClick={() => onBuyNow(product)}
                      className="flex-1 inline-flex min-h-[34px] items-center justify-center gap-1 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 whitespace-nowrap cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {outOfStock ? dict.home.outOfStock : dict.home.buyNow}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveWishlist(product.id)}
                      aria-label={dict.wishlist.remove}
                      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {items.map((product) => {
            const title = lang === 'mm' ? product.nameMm : product.name;
            const outOfStock = product.stock <= 0;
            return (
              <article
                key={product.id}
                className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => onOpenDetail(product)}
                  className="aspect-[4/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900 cursor-pointer"
                >
                  <SmartImage
                    src={product.image}
                    alt={title}
                    fallbackLabel={title}
                    className="h-full w-full object-cover"
                  />
                </button>
                <div className="flex flex-1 flex-col p-3 sm:p-5">
                  <div className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 mb-0.5 sm:mb-1 truncate">
                    {product.category}
                  </div>
                  <h3 className="font-display text-xs sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5 sm:mb-2 line-clamp-2 sm:line-clamp-1">
                    {title}
                  </h3>
                  <div className="font-mono-tabular text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3 sm:mb-4">
                    {formatMMK(product.price)}
                  </div>
                  <div className="mt-auto flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      disabled={outOfStock}
                      onClick={() => onMoveToBag(product)}
                      className="flex-1 inline-flex min-h-[34px] sm:min-h-[40px] items-center justify-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 whitespace-nowrap cursor-pointer"
                    >
                      <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                      <span className="truncate">{dict.wishlist.moveToBag}</span>
                    </button>
                    <div className="flex items-center gap-1.5 sm:flex-1">
                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => onBuyNow(product)}
                        className="flex-1 inline-flex min-h-[34px] sm:min-h-[40px] items-center justify-center gap-1 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 whitespace-nowrap cursor-pointer"
                      >
                        <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                        <span className="truncate">
                          {outOfStock ? dict.home.outOfStock : dict.home.buyNow}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveWishlist(product.id)}
                        aria-label={dict.wishlist.remove}
                        className="flex h-[34px] w-[34px] sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
