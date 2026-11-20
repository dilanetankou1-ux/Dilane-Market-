import React, { useEffect, useState } from 'react';
import {
  Package,
  Wallet,
  Bell,
  Heart,
  User as UserIcon,
  LogOut,
  CheckCircle2,
  Download,
  AlertTriangle,
} from 'lucide-react';
import type {
  CurrencyCode,
  LanguageCode,
  NotificationItem,
  Order,
  PaymentTransaction,
  Product,
  User,
} from '../types/marketplace';
import { apiRequest, setAuthToken } from '../lib/api';
import { CURRENCIES, formatMoney, LANGUAGES, PRIORITY_COUNTRIES } from '../lib/i18n';
import { ProductCard } from './ProductCard';

interface BuyerAccountViewProps {
  user: User;
  products: Product[];
  favoriteIds: number[];
  currency: CurrencyCode;
  rates: Record<string, number>;
  lang: LanguageCode;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
  onToggleFavorite: (id: number) => void;
  onSelectProduct: (p: Product) => void;
  onQuickAdd: (p: Product, type: 'retail' | 'wholesale') => void;
  onBuyNow: (p: Product, type: 'retail' | 'wholesale') => void;
  onNotificationsRead: () => void;
}

export const BuyerAccountView: React.FC<BuyerAccountViewProps> = ({
  user,
  products,
  favoriteIds,
  currency,
  rates,
  lang,
  onUserUpdated,
  onLogout,
  onToggleFavorite,
  onSelectProduct,
  onQuickAdd,
  onBuyNow,
  onNotificationsRead,
}) => {
  const [subTab, setSubTab] = useState<'orders' | 'wallet' | 'favorites' | 'notifications' | 'profile'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [statusMsg, setStatusMsg] = useState('');

  // Profile form
  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone || '');
  const [countryCode, setCountryCode] = useState(user.country_code);
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(user.currency_code);
  const [language, setLanguage] = useState<LanguageCode>(user.language);

  // Dispute form
  const [disputeOrderId, setDisputeOrderId] = useState<number | null>(null);
  const [disputeReason, setDisputeReason] = useState('');

  const loadData = async () => {
    const [ordRes, walRes, notRes] = await Promise.all([
      apiRequest<{ orders: Order[] }>('/api/buyer/orders'),
      apiRequest<{ transactions: PaymentTransaction[] }>('/api/wallet'),
      apiRequest<{ notifications: NotificationItem[] }>('/api/notifications'),
    ]);
    setOrders(ordRes.orders || []);
    setTransactions(walRes.transactions || []);
    setNotifications(notRes.notifications || []);
  };

  useEffect(() => {
    loadData().catch(() => {});
  }, [user.id]);

  const handleConfirmReceipt = async (orderId: number) => {
    await apiRequest(`/api/buyer/orders/${orderId}/confirm-receipt`, { method: 'POST' });
    setStatusMsg('Réception de la commande confirmée.');
    await loadData();
  };

  const handleOpenDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeOrderId) return;
    await apiRequest('/api/disputes', {
      method: 'POST',
      body: { orderId: disputeOrderId, reason: disputeReason },
    });
    setDisputeOrderId(null);
    setDisputeReason('');
    setStatusMsg('Votre réclamation a été transmise à l’équipe litiges DILANE MARKET.');
    await loadData();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ user: User }>('/api/auth/profile', {
        method: 'PUT',
        body: { fullName, phone, countryCode, currencyCode, language },
      });
      onUserUpdated(res.user);
      setStatusMsg('Profil mis à jour.');
    } catch (err: any) {
      setStatusMsg(err.message);
    }
  };

  const handleMarkNotifsRead = async () => {
    await apiRequest('/api/notifications/read-all', { method: 'POST' });
    await loadData();
    onNotificationsRead();
  };

  const handleLogoutClick = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAuthToken(null);
    onLogout();
  };

  const downloadInvoice = (order: Order) => {
    const rowsHtml = (order.items || [])
      .map(
        (it) =>
          `<tr><td>${it.product_title}</td><td>${it.quantity}</td><td>${it.unit_price_xaf.toLocaleString('fr-FR')} FCFA</td></tr>`
      )
      .join('');
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Facture ${order.order_number}</title>
    <style>body{font-family:Arial,sans-serif;max-width:720px;margin:32px auto;color:#0F1E2E}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #cbd5e1;padding:10px;text-align:left}</style></head>
    <body><h1>Facture DILANE MARKET — ${order.order_number}</h1>
    <p><strong>Client :</strong> ${user.full_name}<br>
    <strong>Adresse :</strong> ${order.shipping_address}, ${order.shipping_city} (${order.country_code})<br>
    <strong>Suivi :</strong> ${order.tracking_number} · <strong>Paiement :</strong> ${order.payment_status.toUpperCase()}</p>
    <table><thead><tr><th>Produit</th><th>Qté</th><th>Prix unitaire</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    <p><strong>Livraison :</strong> ${order.shipping_fee_xaf.toLocaleString('fr-FR')} FCFA<br>
    <strong>Total :</strong> ${order.total_xaf.toLocaleString('fr-FR')} FCFA</p></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facture-${order.order_number}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const favoriteProducts = products.filter((p) => favoriteIds.includes(p.id));

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0F1E2E]">
            Mon Espace — {user.full_name}
          </h1>
          <div className="text-xs text-slate-500 mt-1">
            {user.email || user.phone} · Rôle : {user.role.toUpperCase()} · Pays : {user.country_code}
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogoutClick}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-100 self-start cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Déconnexion</span>
        </button>
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit max-w-full overflow-x-auto">
        {[
          { id: 'orders', label: `Commandes (${orders.length})`, icon: Package },
          { id: 'wallet', label: `Portefeuille (${transactions.length})`, icon: Wallet },
          { id: 'favorites', label: `Favoris (${favoriteProducts.length})`, icon: Heart },
          { id: 'notifications', label: `Notifications (${notifications.filter((n) => n.is_read === 0).length})`, icon: Bell },
          { id: 'profile', label: 'Profil', icon: UserIcon },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id as any)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
              subTab === tab.id ? 'bg-white text-[#0F1E2E] shadow-xs' : 'text-slate-600'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 font-medium">
          {statusMsg}
        </div>
      )}

      {/* Orders Tab */}
      {subTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
              Vous n’avez pas encore passé de commande.
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="font-mono text-sm font-bold text-[#0F1E2E]">{order.order_number}</div>
                    <div className="text-xs text-slate-500">
                      Suivi : <span className="font-mono text-amber-700 font-semibold">{order.tracking_number}</span> · {order.carrier_name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-base font-bold text-[#0F1E2E] tabular-nums">
                      {formatMoney(order.total_xaf, currency, rates)}
                    </div>
                    <div className="text-xs font-semibold text-emerald-700">
                      Paiement : {order.payment_status.toUpperCase()} · Colis : {order.order_status.toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-1.5 text-sm">
                  {(order.items || []).map((it) => (
                    <div key={it.id} className="flex justify-between text-slate-700">
                      <span>{it.product_title} × {it.quantity} ({it.order_type})</span>
                      <span className="font-mono tabular-nums">{formatMoney(it.unit_price_xaf * it.quantity, currency, rates)}</span>
                    </div>
                  ))}
                </div>

                {/* Tracking timeline */}
                {order.events && order.events.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="text-xs font-semibold text-slate-700">Historique logistique</div>
                    {order.events.map((ev) => (
                      <div key={ev.id} className="text-xs text-slate-600 flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>{ev.status_label}</strong> ({ev.location}) — {ev.description}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => downloadInvoice(order)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger facture</span>
                  </button>
                  {order.payment_status === 'paid' && order.order_status !== 'delivered' && (
                    <button
                      type="button"
                      onClick={() => handleConfirmReceipt(order.id)}
                      className="px-3.5 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 cursor-pointer"
                    >
                      Confirmer la réception
                    </button>
                  )}
                  {order.order_status !== 'disputed' && (
                    <button
                      type="button"
                      onClick={() => setDisputeOrderId(order.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Signaler un litige</span>
                    </button>
                  )}
                </div>

                {disputeOrderId === order.id && (
                  <form onSubmit={handleOpenDispute} className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                    <label className="block text-xs font-semibold text-rose-900">Motif de la réclamation</label>
                    <input
                      type="text"
                      required
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="Article endommagé, retard important, non conforme..."
                      className="w-full px-3 py-2 text-xs border border-rose-300 rounded-lg bg-white"
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="px-3 py-1.5 text-xs font-semibold bg-rose-700 text-white rounded-lg cursor-pointer">
                        Ouvrir le litige
                      </button>
                      <button type="button" onClick={() => setDisputeOrderId(null)} className="px-3 py-1.5 text-xs text-slate-600 cursor-pointer">
                        Annuler
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Wallet Tab */}
      {subTab === 'wallet' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="font-display text-lg font-bold text-[#0F1E2E]">Historique du portefeuille financier</h2>
          </div>
          {transactions.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Aucune transaction enregistrée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-medium">Référence</th>
                    <th className="py-3 px-4 font-medium">Commande</th>
                    <th className="py-3 px-4 font-medium">Prestataire</th>
                    <th className="py-3 px-4 font-medium">Statut</th>
                    <th className="py-3 px-4 font-medium text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-3 px-4 font-mono text-xs">{tx.provider_reference}</td>
                      <td className="py-3 px-4 font-mono text-xs">{tx.order_number}</td>
                      <td className="py-3 px-4 text-xs uppercase font-medium">{tx.provider} ({tx.payer_account})</td>
                      <td className="py-3 px-4 text-xs font-semibold">
                        {tx.status === 'confirmed' && <span className="text-emerald-700">Réussie ({tx.receipt_code})</span>}
                        {tx.status === 'pending_confirmation' && <span className="text-amber-700">En attente</span>}
                        {tx.status === 'failed' && <span className="text-rose-700">Échouée</span>}
                        {tx.status === 'refunded' && <span className="text-slate-600">Remboursée</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                        {formatMoney(tx.amount_xaf, currency, rates)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Favorites Tab */}
      {subTab === 'favorites' && (
        favoriteProducts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
            Aucun produit dans vos favoris.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {favoriteProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                currency={currency}
                rates={rates}
                lang={lang}
                isFavorite={true}
                onToggleFavorite={onToggleFavorite}
                onSelect={onSelectProduct}
                onQuickAdd={onQuickAdd}
                onBuyNow={onBuyNow}
              />
            ))}
          </div>
        )
      )}

      {/* Notifications Tab */}
      {subTab === 'notifications' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#0F1E2E]">Notifications</h2>
            <button
              type="button"
              onClick={handleMarkNotifsRead}
              className="text-xs font-semibold text-amber-700 hover:underline cursor-pointer"
            >
              Tout marquer comme lu
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">Aucune notification.</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`p-4 ${n.is_read === 0 ? 'bg-amber-50/40' : ''}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-[#0F1E2E]">{n.title}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{n.created_at}</div>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{n.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Profile Tab */}
      {subTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="max-w-xl bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#0F1E2E]">Modifier mon profil</h2>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Nom complet</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Téléphone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Pays</label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {PRIORITY_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Devise</label>
              <select
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value as CurrencyCode)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Langue</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 text-sm font-semibold bg-[#0F1E2E] text-white rounded-xl hover:bg-slate-800 cursor-pointer"
          >
            Enregistrer le profil
          </button>
        </form>
      )}
    </div>
  );
};
