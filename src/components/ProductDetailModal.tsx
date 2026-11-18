import { useState, useEffect } from 'react';
import { X, Heart, ShoppingBag, MessageSquare, Zap } from 'lucide-react';
import type { Language, Product } from '../types';
import { formatMMK } from '../utils/format';
import { t } from '../i18n';
import { SmartImage } from './SmartImage';

interface ProductDetailModalProps {
  product: Product | null;
  lang: Language;
  isWishlisted: boolean;
  onClose: () => void;
  onToggleWishlist: (productId: string) => void;
  onAddToBag: (product: Product, variant: string) => void;
  onBuyNow: (product: Product, variant: string) => void;
  onAskSeller: (product: Product) => void;
}

export function ProductDetailModal({
  product,
  lang,
  isWishlisted,
  onClose,
  onToggleWishlist,
  onAddToBag,
  onBuyNow,
  onAskSeller,
}: ProductDetailModalProps) {
  const [selectedVariant, setSelectedVariant] = useState('');

  useEffect(() => {
    if (product) {
      setSelectedVariant(product.variants[0] || 'Standard');
    }
  }, [product]);

  if (!product) return null;

  const dict = t(lang);
  const title = lang === 'mm' ? product.nameMm : product.name;
  const desc = lang === 'mm' ? product.descriptionMm : product.description;
  const outOfStock = product.stock <= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#16191F] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product details"
          className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 items-stretch">
          <div className="aspect-[4/3] md:aspect-auto md:h-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden">
            <SmartImage
              src={product.image}
              alt={title}
              fallbackLabel={title}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-col p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-2">
              <span>{product.category}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">{product.sku}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {product.soldCount} {dict.pdp.sold}
              </span>
            </div>

            <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-3 pr-8">
              {title}
            </h2>

            <div className="flex items-baseline gap-3 mb-4">
              <span className="font-mono-tabular text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatMMK(product.price)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="font-mono-tabular text-sm text-zinc-400 line-through">
                  {formatMMK(product.compareAtPrice)}
                </span>
              )}
            </div>

            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 mb-6">
              {desc}
            </p>

            {/* Variants */}
            <div className="mb-5">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                {dict.pdp.variant}
              </p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant}
                    type="button"
                    onClick={() => setSelectedVariant(variant)}
                    className={`rounded-lg px-3.5 py-2 text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                      selectedVariant === variant
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                        : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:border-zinc-400 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    {variant}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 py-3 border-y border-zinc-100 dark:border-zinc-800 mb-6">
              <span>{dict.pdp.availability}</span>
              <span
                className={`font-mono-tabular font-medium ${
                  outOfStock
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {outOfStock ? dict.home.outOfStock : `${product.stock} ${dict.pdp.unitsLeft}`}
              </span>
            </div>

            <div className="mt-auto space-y-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => {
                    onAddToBag(product, selectedVariant);
                    onClose();
                  }}
                  className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  <span>{dict.pdp.addToBag}</span>
                </button>
                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => {
                    onBuyNow(product, selectedVariant);
                    onClose();
                  }}
                  className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Zap className="w-4 h-4 shrink-0" />
                  <span>{outOfStock ? dict.home.outOfStock : dict.pdp.buyNow}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleWishlist(product.id)}
                  aria-label={isWishlisted ? dict.pdp.savedWishlist : dict.pdp.saveWishlist}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                    isWishlisted
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  onAskSeller(product);
                  onClose();
                }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{dict.pdp.chatAbout}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
