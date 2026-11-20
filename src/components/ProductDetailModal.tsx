import React, { useEffect, useState } from 'react';
import {
  X,
  CheckCircle2,
  Heart,
  ShoppingBag,
  MessageSquare,
  FileText,
  Star,
  MapPin,
  ShieldCheck,
  Package,
  CreditCard,
} from 'lucide-react';
import type { CurrencyCode, LanguageCode, Product, User } from '../types/marketplace';
import { apiRequest } from '../lib/api';
import { formatMoney, getCountryName, t } from '../lib/i18n';

interface ProductDetailModalProps {
  product: Product | null;
  user: User | null;
  currency: CurrencyCode;
  rates: Record<string, number>;
  commissionRate: number;
  lang: LanguageCode;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (productId: number) => void;
  onAddToCart: (product: Product, orderType: 'retail' | 'wholesale', quantity: number) => Promise<void>;
  onBuyNow: (product: Product, orderType: 'retail' | 'wholesale', quantity: number) => void;
  onStartMessage: (sellerUserId: number, sellerName: string, product: Product) => void;
  onRequireAuth: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  user,
  currency,
  rates,
  commissionRate,
  lang,
  isFavorite,
  onClose,
  onToggleFavorite,
  onAddToCart,
  onBuyNow,
  onStartMessage,
  onRequireAuth,
}) => {
  const [orderType, setOrderType] = useState<'retail' | 'wholesale'>('retail');
  const [quantity, setQuantity] = useState<number>(1);
  const [reviews, setReviews] = useState<any[]>([]);
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);

  const [showRfq, setShowRfq] = useState(false);
  const [rfqQty, setRfqQty] = useState(20);
  const [rfqDetails, setRfqDetails] = useState('');
  const [rfqStatus, setRfqStatus] = useState('');

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMsg, setReviewMsg] = useState('');

  useEffect(() => {
    if (!product) return;
    setOrderType('retail');
    setQuantity(1);
    setShowRfq(false);
    setRfqStatus('');
    setReviewMsg('');
    setRfqQty(Math.max(10, product.moq));

    apiRequest<{ reviews: any[]; priceComparisons: any[] }>(`/api/products/${product.id}`)
      .then((data) => {
        setReviews(data.reviews || []);
        setComparisons(data.priceComparisons || []);
      })
      .catch(() => {
        setReviews([]);
        setComparisons([]);
      });
  }, [product]);

  if (!product) return null;

  const activeUnitPrice =
    orderType === 'wholesale' && quantity >= product.moq
      ? product.wholesale_price_xaf
      : product.retail_price_xaf;

  const handleModeChange = (mode: 'retail' | 'wholesale') => {
    setOrderType(mode);
    if (mode === 'wholesale' && quantity < product.moq) {
      setQuantity(product.moq);
    } else if (mode === 'retail' && quantity > product.stock) {
      setQuantity(1);
    }
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      await onAddToCart(product, orderType, quantity);
      onClose();
    } finally {
      setAdding(false);
    }
  };

  const handleSubmitRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      await apiRequest('/api/rfqs', {
        method: 'POST',
        body: {
          productId: product.id,
          shopId: product.shop_id,
          requestType: 'product_quote',
          title: `Demande de devis : ${product.title}`,
          details: rfqDetails || `Demande de tarif négocié pour ${rfqQty} unités.`,
          quantity: rfqQty,
          targetCountry: user.country_code || 'CM',
          transportMode: product.origin_type === 'china' ? 'sea' : 'undecided',
        },
      });
      setRfqStatus('Votre demande de devis a été envoyée directement au fournisseur.');
      setRfqDetails('');
    } catch (err: any) {
      setRfqStatus(err.message);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      await apiRequest('/api/reviews', {
        method: 'POST',
        body: { productId: product.id, rating: reviewRating, comment: reviewComment },
      });
      setReviewComment('');
      setReviewMsg('Merci, votre avis a été enregistré.');
      const fresh = await apiRequest<{ reviews: any[] }>(`/api/products/${product.id}`);
      setReviews(fresh.reviews || []);
    } catch (err: any) {
      setReviewMsg(err.message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={product.title}
    >
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
            <span>{product.category_name_fr}</span>
            {product.subcategory && (
              <>
                <span aria-hidden="true">/</span>
                <span>{product.subcategory}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{product.origin_type === 'china' ? 'Import direct Chine' : 'Stock Afrique'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-8">
          {/* Contiguous Purchase Module */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Media Column */}
            <div className="lg:col-span-6 space-y-4">
              <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                <img
                  src={product.image_url}
                  alt={product.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Specifications Table */}
              {product.specs && Object.keys(product.specs).length > 0 && (
                <div className="border-t border-slate-200 pt-4">
                  <h4 className="text-sm font-semibold text-[#0F1E2E] mb-3">
                    Caractéristiques techniques
                  </h4>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                    {Object.entries(product.specs).map(([k, v]) => (
                      <div key={k} className="border-b border-slate-100 pb-2">
                        <dt className="text-xs text-slate-500">{k}</dt>
                        <dd className="font-medium text-[#0F1E2E]">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>

            {/* Right Purchase Module */}
            <div className="lg:col-span-6 flex flex-col">
              <h2 className="font-display text-2xl font-bold text-[#0F1E2E] leading-tight mb-2">
                {product.title}
              </h2>

              {/* Supplier Info */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 mb-5">
                <span className="font-semibold text-[#0F1E2E]">{product.shop_name}</span>
                {product.shop_verified === 1 && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    {t(lang, 'verifiedVendor')}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="w-3.5 h-3.5" />
                  {product.shop_city}, {getCountryName(product.shop_country)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-amber-700">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  {product.shop_rating}
                </span>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                {product.description}
              </p>

              {/* Mode Selector: Retail vs Wholesale */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-5">
                <button
                  type="button"
                  onClick={() => handleModeChange('retail')}
                  className={`py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                    orderType === 'retail'
                      ? 'bg-white text-[#0F1E2E] shadow-xs'
                      : 'text-slate-600 hover:text-[#0F1E2E]'
                  }`}
                >
                  Détail · <span className="font-mono tabular-nums">{formatMoney(product.retail_price_xaf, currency, rates)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange('wholesale')}
                  className={`py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                    orderType === 'wholesale'
                      ? 'bg-white text-[#0F1E2E] shadow-xs'
                      : 'text-slate-600 hover:text-[#0F1E2E]'
                  }`}
                >
                  Gros (Min {product.moq}) · <span className="font-mono tabular-nums">{formatMoney(product.wholesale_price_xaf, currency, rates)}</span>
                </button>
              </div>

              {/* Quantity + Subtotal */}
              <div className="flex items-center justify-between gap-4 py-4 border-y border-slate-200 mb-5">
                <div>
                  <label htmlFor="pdp-qty" className="block text-xs text-slate-500 mb-1">
                    Quantité ({orderType === 'wholesale' ? `minimum ${product.moq}` : `stock : ${product.stock}`})
                  </label>
                  <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((q) => Math.max(orderType === 'wholesale' ? product.moq : 1, q - 1))
                      }
                      className="px-3 py-1.5 text-slate-700 hover:bg-slate-100 cursor-pointer font-semibold"
                    >
                      −
                    </button>
                    <input
                      id="pdp-qty"
                      type="number"
                      min={orderType === 'wholesale' ? product.moq : 1}
                      max={Math.max(1, product.stock)}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 text-center font-mono text-sm font-semibold tabular-nums py-1.5 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(Math.max(1, product.stock), q + 1))}
                      className="px-3 py-1.5 text-slate-700 hover:bg-slate-100 cursor-pointer font-semibold"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Sous-total estimé</div>
                  <div className="font-mono text-2xl font-bold text-[#0F1E2E] tabular-nums">
                    {formatMoney(activeUnitPrice * quantity, currency, rates)}
                  </div>
                </div>
              </div>

              {/* Transparent Fee & Direct Supplier Payout Breakdown */}
              {(() => {
                const subtotal = activeUnitPrice * quantity;
                const appFee = Math.round((subtotal * commissionRate) / 100);
                const netSeller = subtotal - appFee;
                const payoutLabelMap: Record<string, string> = {
                  mtn_momo: 'MTN Mobile Money',
                  orange_money: 'Orange Money',
                  wave: 'Wave',
                  moov_money: 'Moov Money',
                  airtel_money: 'Airtel Money',
                  bank_transfer: 'Compte bancaire',
                };
                const payoutChannel = payoutLabelMap[product.shop_payout_method || 'mtn_momo'] || 'Compte MoMo / Bancaire';
                return (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5 mb-5">
                    <div className="flex items-center gap-2 font-semibold text-[#0F1E2E]">
                      <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Répartition transparente & versement fournisseur</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Frais d’utilisation de l’application ({commissionRate}%)</span>
                      <span className="font-mono tabular-nums font-medium text-[#0F1E2E]">
                        {formatMoney(appFee, currency, rates)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Net affecté au compte fournisseur ({payoutChannel})</span>
                      <span className="font-mono tabular-nums font-semibold text-emerald-700">
                        {formatMoney(netSeller, currency, rates)}
                      </span>
                    </div>
                    {(product.shop_payout_bank_name || product.shop_payout_account) && (
                      <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/80">
                        Compte bénéficiaire : {product.shop_payout_bank_name || payoutChannel}
                        {product.shop_payout_account ? ` (${product.shop_payout_account})` : ''}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Primary & Secondary Actions */}
              <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
                <button
                  type="button"
                  disabled={product.stock <= 0}
                  onClick={() => {
                    onClose();
                    onBuyNow(product, orderType, quantity);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Acheter maintenant</span>
                </button>
                <button
                  type="button"
                  disabled={adding || product.stock <= 0}
                  onClick={handleAdd}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold bg-[#0F1E2E] text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>{adding ? 'Ajout...' : 'Panier'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(product.id)}
                  className={`px-3.5 py-3 text-sm font-semibold border rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                    isFavorite
                      ? 'border-rose-300 text-rose-700 bg-rose-50'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                  aria-label="Favori"
                >
                  <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!user) {
                      onRequireAuth();
                      return;
                    }
                    onClose();
                    onStartMessage(product.seller_user_id, product.shop_name, product);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-slate-300 text-[#0F1E2E] rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Négocier / Message</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRfq((v) => !v)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-slate-300 text-[#0F1E2E] rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>{t(lang, 'requestQuote')}</span>
                </button>
              </div>

              {/* Inline RFQ Form */}
              {showRfq && (
                <form onSubmit={handleSubmitRfq} className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <h4 className="text-sm font-semibold text-[#0F1E2E]">Demander un devis gros au fournisseur</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Quantité souhaitée</label>
                      <input
                        type="number"
                        min={1}
                        value={rfqQty}
                        onChange={(e) => setRfqQty(Number(e.target.value) || 1)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">Précisions (destination, emballage, prix cible)</label>
                      <input
                        type="text"
                        required
                        value={rfqDetails}
                        onChange={(e) => setRfqDetails(e.target.value)}
                        placeholder="Ex. Livraison Douala, besoin de 50 cartons..."
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold bg-[#0F1E2E] text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    Envoyer la demande de devis
                  </button>
                  {rfqStatus && <p className="text-xs text-emerald-700 font-medium">{rfqStatus}</p>}
                </form>
              )}
            </div>
          </div>

          {/* Price Comparison Table */}
          {comparisons.length > 0 && (
            <section className="border-t border-slate-200 pt-6">
              <h3 className="font-display text-base font-bold text-[#0F1E2E] mb-3">
                Comparer les offres dans la même catégorie
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Produit</th>
                      <th className="py-2 pr-4 font-medium">Fournisseur</th>
                      <th className="py-2 pr-4 font-medium">Origine</th>
                      <th className="py-2 pr-4 font-medium text-right">Prix gros</th>
                      <th className="py-2 font-medium text-right">MOQ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparisons.map((c) => (
                      <tr key={c.id}>
                        <td className="py-2.5 pr-4 font-medium text-[#0F1E2E]">{c.title}</td>
                        <td className="py-2.5 pr-4 text-slate-600">
                          {c.shop_name}
                          {c.shop_verified === 1 && (
                            <span className="ml-1.5 text-xs text-emerald-700 font-semibold">Vérifié</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-slate-600">{getCountryName(c.shop_country)}</td>
                        <td className="py-2.5 pr-4 text-right font-mono tabular-nums font-semibold">
                          {formatMoney(c.wholesale_price_xaf, currency, rates)}
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-slate-600">{c.moq}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Buyer Reviews */}
          <section className="border-t border-slate-200 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <h3 className="font-display text-base font-bold text-[#0F1E2E]">
                Avis clients ({reviews.length})
              </h3>
              {reviews.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Package className="w-4 h-4" />
                  <span>Aucun avis pour le moment. Soyez le premier à noter ce fournisseur.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((r) => (
                    <div key={r.id} className="pb-3 border-b border-slate-100">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span className="font-semibold text-[#0F1E2E]">
                          {r.buyer_name} · {getCountryName(r.buyer_country)}
                        </span>
                        <span className="font-mono text-amber-600 font-semibold">{r.rating}/5 ★</span>
                      </div>
                      <p className="text-sm text-slate-700">{r.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleReviewSubmit} className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 h-fit">
              <h4 className="text-sm font-semibold text-[#0F1E2E]">Déposer un avis</h4>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Note</label>
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value={5}>5 / 5 — Excellent fournisseur</option>
                  <option value={4}>4 / 5 — Très satisfait</option>
                  <option value={3}>3 / 5 — Correct</option>
                  <option value={2}>2 / 5 — Moyen</option>
                  <option value={1}>1 / 5 — Insatisfait</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Votre retour</label>
                <textarea
                  rows={3}
                  required
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Qualité de la marchandise, délais de livraison..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 text-sm font-semibold bg-[#0F1E2E] text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                Publier l’avis
              </button>
              {reviewMsg && <p className="text-xs text-emerald-700 font-medium">{reviewMsg}</p>}
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
