import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  Smartphone,
  CreditCard,
  Building2,
  Download,
  AlertTriangle,
  ArrowRightLeft,
} from 'lucide-react';
import type {
  CartItem,
  CurrencyCode,
  Order,
  PaymentMethod,
  PaymentTransaction,
  PayoutBreakdownItem,
  Product,
  User,
} from '../types/marketplace';
import { apiRequest } from '../lib/api';
import { formatMoney, PRIORITY_COUNTRIES } from '../lib/i18n';

export interface DirectBuySelection {
  product: Product;
  quantity: number;
  orderType: 'retail' | 'wholesale';
}

interface CartCheckoutDrawerProps {
  isOpen: boolean;
  user: User | null;
  currency: CurrencyCode;
  rates: Record<string, number>;
  commissionRate: number;
  directBuyItem: DirectBuySelection | null;
  onClearDirectBuy: () => void;
  onClose: () => void;
  onRequireAuth: () => void;
  onOrderCompleted: () => void;
}

const PAYOUT_CHANNEL_LABELS: Record<string, string> = {
  mtn_momo: 'MTN Mobile Money',
  orange_money: 'Orange Money',
  wave: 'Wave',
  moov_money: 'Moov Money',
  airtel_money: 'Airtel Money',
  bank_transfer: 'Compte bancaire',
};

function getPayoutChannelLabel(method?: string): string {
  return PAYOUT_CHANNEL_LABELS[method || 'mtn_momo'] || 'Compte MoMo / Bancaire';
}

export const CartCheckoutDrawer: React.FC<CartCheckoutDrawerProps> = ({
  isOpen,
  user,
  currency,
  rates,
  commissionRate,
  directBuyItem,
  onClearDirectBuy,
  onClose,
  onRequireAuth,
  onOrderCompleted,
}) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'cart' | 'checkout' | 'verify' | 'receipt'>('cart');

  const [directQty, setDirectQty] = useState(1);
  const [directOrderType, setDirectOrderType] = useState<'retail' | 'wholesale'>('retail');

  const [countryCode, setCountryCode] = useState(user?.country_code || 'CM');
  const [shippingCity, setShippingCity] = useState('Douala');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingMode, setShippingMode] = useState<'local' | 'international' | 'air' | 'sea'>('local');
  const [availableMethods, setAvailableMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('mtn_momo');
  const [payerAccount, setPayerAccount] = useState(user?.phone || '');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [activeTx, setActiveTx] = useState<PaymentTransaction | null>(null);
  const [payoutBreakdown, setPayoutBreakdown] = useState<PayoutBreakdownItem[]>([]);
  const [providerInstruction, setProviderInstruction] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadCart = async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{ items: CartItem[] }>('/api/cart');
      setItems(res.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setCountryCode(user?.country_code || 'CM');
    setPayerAccount(user?.phone || '');

    if (directBuyItem && user) {
      setDirectOrderType(directBuyItem.orderType);
      setDirectQty(
        directBuyItem.orderType === 'wholesale'
          ? Math.max(directBuyItem.product.moq, directBuyItem.quantity)
          : Math.max(1, directBuyItem.quantity)
      );
      setIdempotencyKey(`dm-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      setStep('checkout');
      return;
    }

    if (step === 'receipt' || step === 'verify' || !directBuyItem) {
      setStep('cart');
    }
    loadCart();
  }, [isOpen, user, directBuyItem]);

  useEffect(() => {
    if (!isOpen) return;
    apiRequest<{ methods: PaymentMethod[] }>(`/api/payments/methods?country=${countryCode}`)
      .then((res) => {
        const list = res.methods || [];
        setAvailableMethods(list);
        if (list.length > 0 && !list.some((m) => m.id === paymentMethod)) {
          setPaymentMethod(list[0].id);
        }
      })
      .catch(() => setAvailableMethods([]));
  }, [countryCode, isOpen]);

  const isDirectMode = Boolean(directBuyItem);

  const activeLineItems = useMemo(() => {
    if (directBuyItem) {
      const p = directBuyItem.product;
      const unit =
        directOrderType === 'wholesale' && directQty >= p.moq
          ? p.wholesale_price_xaf
          : p.retail_price_xaf;
      return [
        {
          key: `direct-${p.id}`,
          productId: p.id,
          shopId: p.shop_id,
          shopName: p.shop_name,
          title: p.title,
          imageUrl: p.image_url,
          quantity: directQty,
          orderType: directOrderType,
          unitPriceXaf: unit,
          lineTotalXaf: unit * directQty,
          payoutMethod: p.shop_payout_method || 'mtn_momo',
          payoutBankName: p.shop_payout_bank_name || getPayoutChannelLabel(p.shop_payout_method),
          payoutAccountMasked: p.shop_payout_account || 'Compte fournisseur enregistré',
        },
      ];
    }

    return items.map((item) => {
      const unit =
        item.order_type === 'wholesale' && item.quantity >= item.moq
          ? item.wholesale_price_xaf
          : item.retail_price_xaf;
      return {
        key: `cart-${item.id}`,
        productId: item.product_id,
        shopId: item.shop_id,
        shopName: item.shop_name,
        title: item.title,
        imageUrl: item.image_url,
        quantity: item.quantity,
        orderType: item.order_type,
        unitPriceXaf: unit,
        lineTotalXaf: unit * item.quantity,
        payoutMethod: item.shop_payout_method || 'mtn_momo',
        payoutBankName: item.shop_payout_bank_name || getPayoutChannelLabel(item.shop_payout_method),
        payoutAccountMasked: item.shop_payout_account || 'Compte fournisseur enregistré',
      };
    });
  }, [directBuyItem, directOrderType, directQty, items]);

  const previewPayoutBreakdown = useMemo<PayoutBreakdownItem[]>(() => {
    const map = new Map<number, PayoutBreakdownItem>();
    for (const line of activeLineItems) {
      const appFee = Math.round((line.lineTotalXaf * commissionRate) / 100);
      const net = line.lineTotalXaf - appFee;
      const existing = map.get(line.shopId) || {
        shopId: line.shopId,
        shopName: line.shopName,
        payoutMethod: line.payoutMethod,
        payoutBankName: line.payoutBankName,
        payoutAccountMasked: line.payoutAccountMasked,
        grossXaf: 0,
        appFeeXaf: 0,
        netSellerXaf: 0,
      };
      existing.grossXaf += line.lineTotalXaf;
      existing.appFeeXaf += appFee;
      existing.netSellerXaf += net;
      map.set(line.shopId, existing);
    }
    return Array.from(map.values());
  }, [activeLineItems, commissionRate]);

  if (!isOpen) return null;

  const subtotalXaf = activeLineItems.reduce((sum, line) => sum + line.lineTotalXaf, 0);
  const appFeeXaf = Math.round((subtotalXaf * commissionRate) / 100);
  const netSuppliersTotalXaf = subtotalXaf - appFeeXaf;

  const shippingFeeMap: Record<string, number> = {
    local: 3500,
    international: 22000,
    air: 45000,
    sea: 18000,
  };
  const shippingFeeXaf = activeLineItems.length > 0 ? shippingFeeMap[shippingMode] : 0;
  const totalXaf = subtotalXaf + shippingFeeXaf;
  const selectedMethodObj = availableMethods.find((m) => m.id === paymentMethod);

  const handleCloseDrawer = () => {
    onClearDirectBuy();
    onClose();
  };

  const updateQty = async (itemId: number, qty: number) => {
    await apiRequest(`/api/cart/${itemId}`, { method: 'PUT', body: { quantity: qty } });
    await loadCart();
    onOrderCompleted();
  };

  const removeItem = async (itemId: number) => {
    await apiRequest(`/api/cart/${itemId}`, { method: 'DELETE' });
    await loadCart();
    onOrderCompleted();
  };

  const handleGoCheckout = () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setIdempotencyKey(`dm-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    setError('');
    setStep('checkout');
  };

  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await apiRequest<{
        order: Order;
        transaction: PaymentTransaction;
        payoutBreakdown?: PayoutBreakdownItem[];
        providerInstruction: string;
      }>('/api/orders/checkout', {
        method: 'POST',
        body: {
          countryCode,
          shippingAddress,
          shippingCity,
          shippingMode,
          paymentMethod,
          payerAccount,
          idempotencyKey,
          currencyCode: currency,
          ...(directBuyItem
            ? {
                directItem: {
                  productId: directBuyItem.product.id,
                  quantity: directQty,
                  orderType: directOrderType,
                },
              }
            : {}),
        },
      });
      setActiveOrder(res.order);
      setActiveTx(res.transaction);
      setPayoutBreakdown(res.payoutBreakdown || previewPayoutBreakdown);
      setProviderInstruction(res.providerInstruction);
      setStep('verify');
      onOrderCompleted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyPayment = async (outcome: 'confirmed' | 'failed') => {
    if (!activeTx) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await apiRequest<{
        order: Order;
        transaction: PaymentTransaction;
        payoutBreakdown?: PayoutBreakdownItem[];
      }>(`/api/payments/${activeTx.id}/verify`, { method: 'POST', body: { outcome } });
      setActiveOrder(res.order);
      setActiveTx(res.transaction);
      if (res.payoutBreakdown && res.payoutBreakdown.length > 0) {
        setPayoutBreakdown(res.payoutBreakdown);
      }
      if (res.transaction.status === 'confirmed') {
        setStep('receipt');
      } else {
        setError('Le prestataire a retourné un échec de transaction. La commande n’est pas passée au statut PAYÉ.');
      }
      onOrderCompleted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadReceipt = () => {
    if (!activeOrder || !activeTx) return;
    const payoutRows = payoutBreakdown
      .map(
        (p) =>
          `<tr><td>${p.shopName} (${getPayoutChannelLabel(p.payoutMethod)} — ${p.payoutBankName} ${p.payoutAccountMasked})</td><td>${p.appFeeXaf.toLocaleString('fr-FR')} FCFA</td><td><strong>${p.netSellerXaf.toLocaleString('fr-FR')} FCFA</strong></td></tr>`
      )
      .join('');

    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu ${activeTx.receipt_code}</title>
    <style>body{font-family:Arial,sans-serif;max-width:720px;margin:32px auto;color:#0F1E2E}h1{font-size:20px}h2{font-size:15px;margin-top:22px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #e2e8f0;padding:10px;text-align:left;font-size:13px}</style></head>
    <body><h1>DILANE MARKET — Reçu électronique officiel</h1>
    <p><strong>Reçu :</strong> ${activeTx.receipt_code}<br>
    <strong>Commande :</strong> ${activeOrder.order_number}<br>
    <strong>Suivi colis :</strong> ${activeOrder.tracking_number}<br>
    <strong>Prestataire :</strong> ${activeTx.provider.toUpperCase()} (${activeTx.provider_reference})<br>
    <strong>Statut vérifié côté serveur :</strong> PAYÉ</p>
    <table><tr><th>Sous-total marchandises</th><td>${activeOrder.subtotal_xaf.toLocaleString('fr-FR')} FCFA</td></tr>
    <tr><th>Frais d'utilisation de l'application DILANE MARKET (${commissionRate}%)</th><td>${activeOrder.commission_xaf.toLocaleString('fr-FR')} FCFA (inclus)</td></tr>
    <tr><th>Livraison (${activeOrder.shipping_mode})</th><td>${activeOrder.shipping_fee_xaf.toLocaleString('fr-FR')} FCFA</td></tr>
    <tr><th>Total payé par l'acheteur</th><td><strong>${activeOrder.total_xaf.toLocaleString('fr-FR')} FCFA</strong></td></tr></table>
    ${
      payoutRows
        ? `<h2>Affectation vers le compte MoMo / bancaire du fournisseur</h2>
    <table><thead><tr><th>Fournisseur & compte bénéficiaire</th><th>Frais application</th><th>Net versé au fournisseur</th></tr></thead><tbody>${payoutRows}</tbody></table>`
        : ''
    }
    <p style="margin-top:20px;font-size:12px;color:#64748b">DILANE MARKET — Le monde du commerce à portée de main.</p></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recu-${activeOrder.order_number}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/55 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Panier et Paiement"
    >
      <div className="bg-white w-full max-w-lg h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0F1E2E]">
              {step === 'cart' && 'Votre panier'}
              {step === 'checkout' && (isDirectMode ? 'Achat direct — Paiement' : 'Livraison & Paiement sécurisé')}
              {step === 'verify' && 'Confirmation côté serveur'}
              {step === 'receipt' && 'Commande payée & Reçu officiel'}
            </h2>
            {step === 'checkout' && (
              <p className="text-xs text-slate-500">
                Choisissez votre moyen de paiement · versement direct vers le compte du fournisseur
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleCloseDrawer}
            className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer shrink-0"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 'cart' && (
            <>
              {!user ? (
                <div className="py-12 text-center space-y-4">
                  <p className="text-sm text-slate-600">
                    Connectez-vous pour enregistrer votre panier, comparer les tarifs gros et payer via MTN Mobile Money, Orange Money ou carte internationale.
                  </p>
                  <button
                    type="button"
                    onClick={onRequireAuth}
                    className="px-5 py-2.5 text-sm font-semibold bg-[#0F1E2E] text-white rounded-xl cursor-pointer"
                  >
                    Connexion / Inscription
                  </button>
                </div>
              ) : loading ? (
                <p className="text-sm text-slate-500 py-8 text-center">Chargement du panier...</p>
              ) : items.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="font-display font-semibold text-[#0F1E2E]">Votre panier est vide</p>
                  <p className="text-sm text-slate-500">
                    Ajoutez des produits au détail ou en gros, ou cliquez sur « Acheter » pour régler directement.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => {
                    const unit =
                      item.order_type === 'wholesale' && item.quantity >= item.moq
                        ? item.wholesale_price_xaf
                        : item.retail_price_xaf;
                    return (
                      <div
                        key={item.id}
                        className="flex gap-3 pb-4 border-b border-slate-100"
                      >
                        <img
                          src={item.image_url}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-18 h-18 rounded-lg object-cover bg-slate-100 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-500">
                            {item.shop_name} · {item.order_type === 'wholesale' ? `Gros (MOQ ${item.moq})` : 'Détail'}
                          </div>
                          <h4 className="text-sm font-semibold text-[#0F1E2E] line-clamp-1">
                            {item.title}
                          </h4>
                          <div className="font-mono text-sm font-semibold text-[#0F1E2E] tabular-nums mt-1">
                            {formatMoney(unit * item.quantity, currency, rates)}
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="inline-flex items-center border border-slate-300 rounded-md">
                              <button
                                type="button"
                                onClick={() => updateQty(item.id, item.quantity - 1)}
                                className="px-2.5 py-0.5 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                              >
                                −
                              </button>
                              <span className="px-2.5 py-0.5 font-mono text-xs tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateQty(item.id, item.quantity + 1)}
                                className="px-2.5 py-0.5 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                              aria-label="Retirer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {step === 'checkout' && (
            <form id="checkout-form" onSubmit={handleInitiatePayment} className="space-y-5">
              {/* Direct Buy Item Quick Summary & Quantity Controls */}
              {directBuyItem && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex gap-3">
                    <img
                      src={directBuyItem.product.image_url}
                      alt={directBuyItem.product.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-lg object-cover bg-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-slate-500 truncate">
                        Fournisseur : {directBuyItem.product.shop_name}
                      </div>
                      <h3 className="text-sm font-semibold text-[#0F1E2E] line-clamp-2">
                        {directBuyItem.product.title}
                      </h3>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <div className="inline-flex rounded-lg border border-slate-300 bg-white overflow-hidden text-[11px] font-semibold">
                          <button
                            type="button"
                            onClick={() => {
                              setDirectOrderType('retail');
                              setDirectQty(1);
                            }}
                            className={`px-2 py-1 cursor-pointer ${
                              directOrderType === 'retail' ? 'bg-[#0F1E2E] text-white' : 'text-slate-600'
                            }`}
                          >
                            Détail
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDirectOrderType('wholesale');
                              setDirectQty((q) => Math.max(directBuyItem.product.moq, q));
                            }}
                            className={`px-2 py-1 cursor-pointer ${
                              directOrderType === 'wholesale' ? 'bg-[#0F1E2E] text-white' : 'text-slate-600'
                            }`}
                          >
                            Gros ({directBuyItem.product.moq}+)
                          </button>
                        </div>

                        <div className="inline-flex items-center border border-slate-300 rounded-md bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              setDirectQty((q) =>
                                Math.max(directOrderType === 'wholesale' ? directBuyItem.product.moq : 1, q - 1)
                              )
                            }
                            className="px-2 py-0.5 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                          >
                            −
                          </button>
                          <span className="px-2.5 py-0.5 font-mono text-xs tabular-nums font-semibold">
                            {directQty}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setDirectQty((q) => Math.min(Math.max(1, directBuyItem.product.stock), q + 1))
                            }
                            className="px-2 py-0.5 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Payment Methods Selection (immediately visible) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#0F1E2E]">
                    1. Choisissez votre moyen de paiement ({availableMethods.length})
                  </h3>
                  <select
                    aria-label="Pays de paiement"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded-lg bg-white"
                  >
                    {PRIORITY_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  {availableMethods.map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        paymentMethod === m.id
                          ? 'border-amber-600 bg-amber-50/40'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={m.id}
                        checked={paymentMethod === m.id}
                        onChange={() => setPaymentMethod(m.id)}
                        className="mt-1 accent-amber-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#0F1E2E] inline-flex items-center gap-1.5">
                            {m.category === 'mobile_money' && <Smartphone className="w-4 h-4 text-amber-600" />}
                            {m.category === 'card' && <CreditCard className="w-4 h-4 text-slate-700" />}
                            {m.category === 'bank' && <Building2 className="w-4 h-4 text-slate-700" />}
                            {m.name}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {m.liveConfigured ? 'API Live' : 'Sandbox sécurisé'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{m.description}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {selectedMethodObj?.requiresPhone && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Votre numéro {selectedMethodObj.name} (ne saisissez jamais votre code PIN)
                    </label>
                    <input
                      type="tel"
                      required
                      value={payerAccount}
                      onChange={(e) => setPayerAccount(e.target.value)}
                      placeholder="Ex. +237 678 321 595"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Transparent Application Fees & Direct Supplier MoMo/Bank Payout Routing */}
              {previewPayoutBreakdown.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0F1E2E]">
                    <ArrowRightLeft className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Frais d’utilisation de l’application & versement fournisseur</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {previewPayoutBreakdown.map((entry) => (
                      <div
                        key={entry.shopId}
                        className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[#0F1E2E]">{entry.shopName}</span>
                          <span className="text-[11px] font-medium text-emerald-700">
                            {getPayoutChannelLabel(entry.payoutMethod)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Compte bénéficiaire : <strong className="text-slate-700">{entry.payoutBankName}</strong> ·{' '}
                          <span className="font-mono">{entry.payoutAccountMasked}</span>
                        </div>
                        <div className="pt-1.5 border-t border-slate-100 space-y-1">
                          <div className="flex justify-between text-slate-600">
                            <span>Frais d’utilisation DILANE MARKET ({commissionRate}%)</span>
                            <span className="font-mono tabular-nums text-amber-800 font-medium">
                              − {formatMoney(entry.appFeeXaf, currency, rates)}
                            </span>
                          </div>
                          <div className="flex justify-between font-semibold text-[#0F1E2E]">
                            <span>Montant net reversé au fournisseur</span>
                            <span className="font-mono tabular-nums text-emerald-700">
                              {formatMoney(entry.netSellerXaf, currency, rates)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Après vérification serveur du paiement, le montant net est affecté vers le compte Mobile Money ou bancaire enregistré par le fournisseur (déduction faite des frais d’utilisation de l’application de {commissionRate}%).
                  </p>
                </div>
              )}

              {/* Step 2: Delivery Address */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <h3 className="text-sm font-bold text-[#0F1E2E]">2. Adresse et mode de livraison</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Ville de livraison</label>
                    <input
                      type="text"
                      required
                      value={shippingCity}
                      onChange={(e) => setShippingCity(e.target.value)}
                      placeholder="Ex. Douala, Yaoundé, Abidjan..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Mode de livraison</label>
                    <select
                      value={shippingMode}
                      onChange={(e) => setShippingMode(e.target.value as any)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="local">Locale express (+{formatMoney(3500, currency, rates)})</option>
                      <option value="sea">Maritime LCL (+{formatMoney(18000, currency, rates)})</option>
                      <option value="international">Internationale (+{formatMoney(22000, currency, rates)})</option>
                      <option value="air">Fret aérien (+{formatMoney(45000, currency, rates)})</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Quartier / Adresse complète</label>
                  <input
                    type="text"
                    required
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="Rue, immeuble, point de repère..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-[#0F1E2E]">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Sécurité financière DILANE MARKET</span>
                  </div>
                  <p>
                    Aucun code PIN Mobile Money n’est jamais demandé sur cette application. Protection anti-double paiement active (clé unique).
                  </p>
                </div>
              </div>
            </form>
          )}

          {step === 'verify' && activeOrder && activeTx && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="text-xs font-semibold text-amber-900">
                  Demande de paiement initiée · Réf. {activeTx.provider_reference}
                </div>
                <p className="text-sm text-amber-950 leading-relaxed">{providerInstruction}</p>
              </div>

              <dl className="divide-y divide-slate-100 text-sm">
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Commande</dt>
                  <dd className="font-mono font-semibold">{activeOrder.order_number}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Compte payeur</dt>
                  <dd className="font-mono">{activeTx.payer_account}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Frais d’utilisation app ({commissionRate}%)</dt>
                  <dd className="font-mono tabular-nums text-amber-800 font-medium">
                    {formatMoney(activeOrder.commission_xaf, currency, rates)}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Montant total payé</dt>
                  <dd className="font-mono font-bold tabular-nums">
                    {formatMoney(activeOrder.total_xaf, currency, rates)}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Statut actuel</dt>
                  <dd className="font-semibold text-amber-700">En attente de vérification serveur</dd>
                </div>
              </dl>

              {payoutBreakdown.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="font-semibold text-[#0F1E2E]">Versement fournisseur programmé après confirmation</div>
                  {payoutBreakdown.map((p) => (
                    <div key={p.shopId} className="flex items-start justify-between gap-2 pt-1.5 border-t border-slate-200/70">
                      <div>
                        <div className="font-medium text-[#0F1E2E]">{p.shopName}</div>
                        <div className="text-slate-500">
                          {getPayoutChannelLabel(p.payoutMethod)} · {p.payoutBankName} ({p.payoutAccountMasked})
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-emerald-700 tabular-nums shrink-0">
                        {formatMoney(p.netSellerXaf, currency, rates)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-slate-500">
                Conformément aux règles de sécurité, aucune capture d’écran n’est acceptée. La commande ne passe au statut <strong>PAYÉ</strong> qu’après interrogation et confirmation serveur.
              </p>

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleVerifyPayment('confirmed')}
                  className="w-full py-3 text-sm font-semibold bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Vérification serveur...' : 'Vérifier et confirmer le paiement'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleVerifyPayment('failed')}
                  className="w-full py-2.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Simuler un échec / annulation prestataire
                </button>
              </div>
            </div>
          )}

          {step === 'receipt' && activeOrder && activeTx && (
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
                <h3 className="font-display text-lg font-bold text-emerald-950">
                  Paiement confirmé côté serveur
                </h3>
                <p className="text-xs text-emerald-800">
                  Commande passée automatiquement au statut PAYÉ. Le versement net vers le compte du fournisseur est enregistré.
                </p>
              </div>

              <dl className="divide-y divide-slate-100 text-sm">
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Reçu électronique</dt>
                  <dd className="font-mono font-semibold text-[#0F1E2E]">{activeTx.receipt_code}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Numéro de commande</dt>
                  <dd className="font-mono font-semibold">{activeOrder.order_number}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Numéro de suivi colis</dt>
                  <dd className="font-mono font-semibold text-amber-700">{activeOrder.tracking_number}</dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Frais d’utilisation app ({commissionRate}%)</dt>
                  <dd className="font-mono tabular-nums text-amber-800 font-medium">
                    {formatMoney(activeOrder.commission_xaf, currency, rates)}
                  </dd>
                </div>
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500">Montant total réglé</dt>
                  <dd className="font-mono font-bold tabular-nums">
                    {formatMoney(activeOrder.total_xaf, currency, rates)}
                  </dd>
                </div>
              </dl>

              {payoutBreakdown.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="font-semibold text-[#0F1E2E]">Affectation compte fournisseur</div>
                  {payoutBreakdown.map((p) => (
                    <div key={p.shopId} className="flex items-start justify-between gap-2 pt-1.5 border-t border-slate-200/70">
                      <div>
                        <div className="font-medium text-[#0F1E2E]">{p.shopName}</div>
                        <div className="text-slate-500">
                          {getPayoutChannelLabel(p.payoutMethod)} · {p.payoutBankName} ({p.payoutAccountMasked})
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-emerald-700 tabular-nums shrink-0">
                        {formatMoney(p.netSellerXaf, currency, rates)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={downloadReceipt}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 text-sm font-semibold bg-[#0F1E2E] text-white rounded-xl hover:bg-slate-800 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger le reçu / facture</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="w-full py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Continuer mes achats
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Totals */}
        {(step === 'cart' || step === 'checkout') && activeLineItems.length > 0 && (
          <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-2.5">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Sous-total marchandises</span>
              <span className="font-mono tabular-nums font-medium text-[#0F1E2E]">
                {formatMoney(subtotalXaf, currency, rates)}
              </span>
            </div>
            {step === 'checkout' && (
              <>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Dont frais d’utilisation app ({commissionRate}%)</span>
                  <span className="font-mono tabular-nums text-amber-800 font-medium">
                    {formatMoney(appFeeXaf, currency, rates)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Net affecté au(x) fournisseur(s)</span>
                  <span className="font-mono tabular-nums text-emerald-700 font-semibold">
                    {formatMoney(netSuppliersTotalXaf, currency, rates)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Livraison ({shippingMode})</span>
                  <span className="font-mono tabular-nums font-medium text-[#0F1E2E]">
                    {formatMoney(shippingFeeXaf, currency, rates)}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between text-base font-bold text-[#0F1E2E] pt-2 border-t border-slate-200">
              <span>Total à payer</span>
              <span className="font-mono tabular-nums">
                {formatMoney(step === 'checkout' ? totalXaf : subtotalXaf, currency, rates)}
              </span>
            </div>

            {step === 'cart' ? (
              <button
                type="button"
                onClick={handleGoCheckout}
                className="w-full py-3 text-sm font-semibold bg-amber-600 text-white rounded-xl hover:bg-amber-700 cursor-pointer"
              >
                Passer la commande
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isDirectMode) {
                      handleCloseDrawer();
                    } else {
                      setStep('cart');
                    }
                  }}
                  className="px-4 py-3 text-sm font-semibold border border-slate-300 bg-white text-slate-700 rounded-xl cursor-pointer whitespace-nowrap"
                >
                  {isDirectMode ? 'Annuler' : 'Retour'}
                </button>
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={submitting}
                  className="flex-1 py-3 text-sm font-semibold bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Initiation...' : 'Payer et verser au fournisseur'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
