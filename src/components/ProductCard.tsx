import React, { useState } from 'react';
import { Heart, CheckCircle2, ShoppingBag, Package, CreditCard } from 'lucide-react';
import type { CurrencyCode, LanguageCode, Product } from '../types/marketplace';
import { formatMoney, getCountryName, t } from '../lib/i18n';

interface ProductCardProps {
  product: Product;
  currency: CurrencyCode;
  rates: Record<string, number>;
  lang: LanguageCode;
  isFavorite: boolean;
  onToggleFavorite: (productId: number) => void;
  onSelect: (product: Product) => void;
  onQuickAdd: (product: Product, orderType: 'retail' | 'wholesale') => void;
  onBuyNow: (product: Product, orderType: 'retail' | 'wholesale') => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  currency,
  rates,
  lang,
  isFavorite,
  onToggleFavorite,
  onSelect,
  onQuickAdd,
  onBuyNow,
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <article className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      {/* Uniform 4:3 Image Area */}
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        <button
          type="button"
          onClick={() => onSelect(product)}
          className="w-full h-full block text-left cursor-pointer"
          aria-label={`Voir ${product.title}`}
        >
          {!imgError && product.image_url ? (
            <img
              src={product.image_url}
              alt={product.title}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-4 text-center">
              <Package className="w-8 h-8 mb-2" />
              <span className="text-xs font-medium text-slate-500 line-clamp-2">{product.title}</span>
            </div>
          )}
        </button>

        {/* Single subtle text indicator if promo or China import (max 1 tag) */}
        {product.is_promo === 1 && product.promo_percent > 0 ? (
          <span className="absolute top-3 left-3 bg-[#0F1E2E]/90 text-white text-[11px] font-mono font-semibold tabular-nums px-2 py-0.5 rounded">
            -{product.promo_percent}%
          </span>
        ) : product.origin_type === 'china' ? (
          <span className="absolute top-3 left-3 bg-[#0F1E2E]/90 text-amber-300 text-[11px] font-medium px-2 py-0.5 rounded">
            Import Chine
          </span>
        ) : null}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
          aria-label="Ajouter aux favoris"
          className={`absolute top-3 right-3 w-9 h-9 rounded-lg flex items-center justify-center bg-white/90 hover:bg-white transition-colors cursor-pointer ${
            isFavorite ? 'text-rose-600' : 'text-slate-600'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Card Body */}
      <div className="p-4 flex flex-col flex-1">
        {/* Clean unboxed metadata */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate mb-1.5">
          <span className="truncate">{product.category_name_fr}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{getCountryName(product.shop_country)}</span>
        </div>

        <button
          type="button"
          onClick={() => onSelect(product)}
          className="text-left font-display text-[15px] font-semibold text-[#0F1E2E] leading-snug line-clamp-2 hover:text-amber-700 transition-colors cursor-pointer mb-2"
        >
          {product.title}
        </button>

        {/* Verified Seller Line */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-3">
          <span className="truncate font-medium">{product.shop_name}</span>
          {product.shop_verified === 1 && (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t(lang, 'verifiedVendor')}</span>
            </span>
          )}
        </div>

        {/* Pricing Block — aligned baseline with tabular numerals */}
        <div className="mt-auto pt-3 border-t border-slate-100 space-y-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <div className="text-[11px] text-slate-500">
                {t(lang, 'wholesaleLabel')} {product.moq} pcs
              </div>
              <div className="font-mono text-[15px] font-semibold text-[#0F1E2E] tabular-nums">
                {formatMoney(product.wholesale_price_xaf, currency, rates)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500">{t(lang, 'retailLabel')}</div>
              <div className="font-mono text-sm font-medium text-slate-700 tabular-nums">
                {formatMoney(product.retail_price_xaf, currency, rates)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={() => onBuyNow(product, 'retail')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Acheter</span>
            </button>
            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={() => onQuickAdd(product, 'retail')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-[#0F1E2E] text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Ajouter au panier"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Panier</span>
            </button>
            <button
              type="button"
              onClick={() => onSelect(product)}
              className="px-2.5 py-2 text-xs font-semibold text-[#0F1E2E] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Gros
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
