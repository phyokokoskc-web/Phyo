import { Heart, ShoppingBag, Zap } from 'lucide-react';
import type { Language, Product } from '../types';
import { formatMMK } from '../utils/format';
import { t } from '../i18n';
import { SmartImage } from './SmartImage';

export type ProductLayoutMode = 'grid2' | 'list';

interface ProductCardProps {
  product: Product;
  lang: Language;
  layout?: ProductLayoutMode;
  isWishlisted: boolean;
  onToggleWishlist: (productId: string) => void;
  onAddToBag: (product: Product) => void;
  onBuyNow: (product: Product) => void;
  onOpenDetail: (product: Product) => void;
}

export function ProductCard({
  product,
  lang,
  layout = 'grid2',
  isWishlisted,
  onToggleWishlist,
  onAddToBag,
  onBuyNow,
  onOpenDetail,
}: ProductCardProps) {
  const dict = t(lang);
  const title = lang === 'mm' ? product.nameMm : product.name;
  const outOfStock = product.stock <= 0;

  if (layout === 'list') {
    return (
      <article className="group flex flex-row rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] overflow-hidden transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
        <div className="relative w-32 sm:w-44 shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => onOpenDetail(product)}
            className="block h-full w-full text-left cursor-pointer"
            aria-label={`View ${title}`}
          >
            <SmartImage
              src={product.image}
              alt={title}
              fallbackLabel={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </button>

          <button
            type="button"
            onClick={() => onToggleWishlist(product.id)}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            className={`absolute top-2 left-2 flex h-8 w-8 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
              isWishlisted
                ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white'
                : 'bg-white/90 text-zinc-700 border-zinc-200 hover:bg-white dark:bg-zinc-900/90 dark:text-zinc-200 dark:border-zinc-700'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isWishlisted ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="flex flex-1 flex-col min-w-0 p-3 sm:p-4">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="truncate">{product.category}</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                outOfStock
                  ? 'text-red-600 dark:text-red-400 font-medium shrink-0'
                  : product.stock <= 5
                  ? 'text-amber-700 dark:text-amber-400 font-medium shrink-0'
                  : 'shrink-0'
              }
            >
              {outOfStock
                ? dict.home.outOfStock
                : product.stock <= 5
                ? dict.home.lowStock
                : dict.home.inStock}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onOpenDetail(product)}
            className="text-left cursor-pointer mb-1.5"
          >
            <h3 className="font-display text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:underline leading-snug">
              {title}
            </h3>
          </button>

          <div className="flex items-baseline gap-2 min-w-0 mb-2.5">
            <span className="font-mono-tabular text-sm sm:text-[15px] font-bold text-zinc-900 dark:text-zinc-100">
              {formatMMK(product.price)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="font-mono-tabular text-[11px] sm:text-xs text-zinc-400 line-through">
                {formatMMK(product.compareAtPrice)}
              </span>
            )}
          </div>

          <div className="mt-auto grid grid-cols-2 gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => onAddToBag(product)}
              className="inline-flex min-h-[34px] sm:min-h-[38px] items-center justify-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{dict.home.addToBag}</span>
            </button>

            <button
              type="button"
              disabled={outOfStock}
              onClick={() => onBuyNow(product)}
              className="inline-flex min-h-[34px] sm:min-h-[38px] items-center justify-center gap-1 rounded-lg bg-zinc-900 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {outOfStock ? dict.home.outOfStock : dict.home.buyNow}
              </span>
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] overflow-hidden transition-transform duration-200 hover:-translate-y-0.5">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => onOpenDetail(product)}
          className="block h-full w-full text-left cursor-pointer"
          aria-label={`View ${title}`}
        >
          <SmartImage
            src={product.image}
            alt={title}
            fallbackLabel={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </button>

        <button
          type="button"
          onClick={() => onToggleWishlist(product.id)}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
          className={`absolute top-2 right-2 sm:top-3 sm:right-3 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
            isWishlisted
              ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white'
              : 'bg-white/90 text-zinc-700 border-zinc-200 hover:bg-white dark:bg-zinc-900/90 dark:text-zinc-200 dark:border-zinc-700'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-5">
        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 mb-1 sm:mb-1.5">
          <span className="truncate">{product.category}</span>
          {product.popular && (
            <>
              <span className="hidden sm:inline" aria-hidden="true">
                ·
              </span>
              <span className="hidden sm:inline text-amber-700 dark:text-amber-400 font-medium">
                {dict.home.popularTag}
              </span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span
            className={`shrink-0 ${
              outOfStock
                ? 'text-red-600 dark:text-red-400 font-medium'
                : product.stock <= 5
                ? 'text-amber-700 dark:text-amber-400 font-medium'
                : ''
            }`}
          >
            {outOfStock
              ? dict.home.outOfStock
              : product.stock <= 5
              ? dict.home.lowStock
              : dict.home.inStock}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onOpenDetail(product)}
          className="text-left cursor-pointer mb-2 sm:mb-3"
        >
          <h3 className="font-display text-xs sm:text-base font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2 sm:line-clamp-1 group-hover:underline leading-snug">
            {title}
          </h3>
        </button>

        <div className="mt-auto space-y-2 sm:space-y-3 pt-2 sm:pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="flex flex-wrap items-baseline gap-1.5 sm:gap-2 min-w-0">
            <span className="font-mono-tabular text-xs sm:text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">
              {formatMMK(product.price)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="font-mono-tabular text-[10px] sm:text-xs text-zinc-400 line-through">
                {formatMMK(product.compareAtPrice)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={outOfStock}
              onClick={() => onAddToBag(product)}
              className="inline-flex min-h-[34px] sm:min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
            >
              <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate">{dict.home.addToBag}</span>
            </button>

            <button
              type="button"
              disabled={outOfStock}
              onClick={() => onBuyNow(product)}
              className="inline-flex min-h-[34px] sm:min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="truncate">
                {outOfStock ? dict.home.outOfStock : dict.home.buyNow}
              </span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
