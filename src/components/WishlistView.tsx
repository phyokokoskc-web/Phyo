import { Heart, ShoppingBag, Trash2, Zap } from 'lucide-react';
import type { Language, Product } from '../types';
import { formatMMK } from '../utils/format';
import { t } from '../i18n';
import { SmartImage } from './SmartImage';

interface WishlistViewProps {
  products: Product[];
  wishlistIds: string[];
  lang: Language;
  onRemoveWishlist: (productId: string) => void;
  onMoveToBag: (product: Product) => void;
  onBuyNow: (product: Product) => void;
  onOpenDetail: (product: Product) => void;
}

export function WishlistView({
  products,
  wishlistIds,
  lang,
  onRemoveWishlist,
  onMoveToBag,
  onBuyNow,
  onOpenDetail,
}: WishlistViewProps) {
  const dict = t(lang);
  const items = products.filter((p) => wishlistIds.includes(p.id));

  return (
    <section className="space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          {dict.wishlist.heading}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{dict.wishlist.subtitle}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] p-12 text-center">
          <Heart className="mx-auto w-9 h-9 text-zinc-300 dark:text-zinc-600 mb-3" />
          <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            {dict.wishlist.empty}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{dict.wishlist.emptySub}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <div className="flex flex-1 flex-col p-5">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                    {product.category}
                  </div>
                  <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2 line-clamp-1">
                    {title}
                  </h3>
                  <div className="font-mono-tabular text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                    {formatMMK(product.price)}
                  </div>
                  <div className="mt-auto flex items-center gap-2">
                    <button
                      type="button"
                      disabled={outOfStock}
                      onClick={() => onMoveToBag(product)}
                      className="flex-1 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 whitespace-nowrap cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                      <span>{dict.wishlist.moveToBag}</span>
                    </button>
                    <button
                      type="button"
                      disabled={outOfStock}
                      onClick={() => onBuyNow(product)}
                      className="flex-1 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-2 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 whitespace-nowrap cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 shrink-0" />
                      <span>{outOfStock ? dict.home.outOfStock : dict.home.buyNow}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveWishlist(product.id)}
                      aria-label={dict.wishlist.remove}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
