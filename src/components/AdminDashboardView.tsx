import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Ban,
  Settings,
  RefreshCcw,
  AlertTriangle,
} from 'lucide-react';
import type { CurrencyCode, User } from '../types/marketplace';
import { apiRequest } from '../lib/api';
import { formatMoney } from '../lib/i18n';

interface AdminDashboardViewProps {
  user: User | null;
  currency: CurrencyCode;
  rates: Record<string, number>;
  onSettingsUpdated: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  user,
  currency,
  rates,
  onSettingsUpdated,
}) => {
  const [tab, setTab] = useState<'verifications' | 'payments' | 'users' | 'products' | 'disputes' | 'settings' | 'logs'>('verifications');
  const [data, setData] = useState<any>(null);
  const [notice, setNotice] = useState('');

  // Monetization Settings
  const [commissionRate, setCommissionRate] = useState('5.0');
  const [premiumFeeXaf, setPremiumFeeXaf] = useState('25000');
  const [featuredFeeXaf, setFeaturedFeeXaf] = useState('10000');
  const [sourcingFeeXaf, setSourcingFeeXaf] = useState('35000');

  const loadAdmin = async () => {
    const res = await apiRequest('/api/admin/overview');
    setData(res);
    setCommissionRate(String(res.settings.commissionRate));
    setPremiumFeeXaf(String(res.settings.premiumFeeXaf));
    setFeaturedFeeXaf(String(res.settings.featuredFeeXaf));
    setSourcingFeeXaf(String(res.settings.sourcingFeeXaf));
  };

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'super_admin')) {
      loadAdmin().catch(() => {});
    }
  }, [user]);

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto" />
        <h1 className="font-display text-xl font-bold text-[#0F1E2E]">Accès Administrateur Restreint</h1>
        <p className="text-sm text-slate-600">
          Connectez-vous avec votre compte Propriétaire Principal (<span className="font-mono">dilanetankou1@gmail.com</span>) pour accéder au tableau de bord administrateur.
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="max-w-[1280px] mx-auto px-4 py-12 text-sm text-slate-500">Chargement du tableau de bord administrateur...</div>;
  }

  const handleVerifyShop = async (shopId: number, approve: boolean) => {
    await apiRequest(`/api/admin/shops/${shopId}/verify`, { method: 'POST', body: { approve } });
    setNotice(approve ? 'Badge VENDEUR VÉRIFIÉ activé.' : 'Demande de vérification refusée.');
    await loadAdmin();
    onSettingsUpdated();
  };

  const handleBlockUser = async (userId: number, blocked: boolean) => {
    await apiRequest(`/api/admin/users/${userId}/block`, { method: 'POST', body: { blocked } });
    setNotice(blocked ? 'Compte utilisateur bloqué et sessions révoquées.' : 'Compte réactivé.');
    await loadAdmin();
  };

  const handleProductStatus = async (productId: number, status: string) => {
    await apiRequest(`/api/admin/products/${productId}/status`, { method: 'POST', body: { status } });
    setNotice(`Statut produit mis à jour : ${status}.`);
    await loadAdmin();
    onSettingsUpdated();
  };

  const handleRefund = async (txId: number) => {
    await apiRequest(`/api/admin/payments/${txId}/refund`, { method: 'POST' });
    setNotice('Remboursement enregistré et acheteur notifié.');
    await loadAdmin();
  };

  const handleResolveDispute = async (id: number, status: string) => {
    await apiRequest(`/api/admin/disputes/${id}/resolve`, {
      method: 'POST',
      body: { status, adminNotes: 'Traité par le Super Administrateur DILANE MARKET.' },
    });
    setNotice('Litige mis à jour.');
    await loadAdmin();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/api/admin/settings', {
      method: 'PUT',
      body: {
        commissionRate: Number(commissionRate),
        premiumFeeXaf: Number(premiumFeeXaf),
        featuredFeeXaf: Number(featuredFeeXaf),
        sourcingFeeXaf: Number(sourcingFeeXaf),
      },
    });
    setNotice('Configuration commerciale et commissions enregistrées.');
    await loadAdmin();
    onSettingsUpdated();
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0F1E2E]">
            Administration DILANE MARKET
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Propriétaire & Super Administrateur : {user.full_name} ({user.email})
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadAdmin()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-xl hover:bg-slate-50 self-start cursor-pointer"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          <span>Actualiser</span>
        </button>
      </div>

      {/* KPI Strip — Tabular Numerals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs text-slate-500">Volume payé (GMV)</div>
          <div className="font-mono text-xl font-bold text-[#0F1E2E] tabular-nums mt-1">
            {formatMoney(data.stats.totalGmvXaf, currency, rates)}
          </div>
          <div className="text-xs text-emerald-700 mt-1 font-mono tabular-nums">
            Commissions : {formatMoney(data.stats.totalCommissionXaf, currency, rates)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs text-slate-500">Volume MTN Mobile Money</div>
          <div className="font-mono text-xl font-bold text-[#0F1E2E] tabular-nums mt-1">
            {formatMoney(data.stats.mtnVolumeXaf, currency, rates)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            Orange Money : {formatMoney(data.stats.orangeVolumeXaf, currency, rates)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs text-slate-500">Boutiques & Vérifications</div>
          <div className="font-mono text-xl font-bold text-[#0F1E2E] tabular-nums mt-1">
            {data.stats.shopsCount} boutiques
          </div>
          <div className="text-xs text-amber-700 font-semibold mt-1">
            {data.stats.pendingVerifications} en attente de validation
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-xs text-slate-500">Utilisateurs & Catalogue</div>
          <div className="font-mono text-xl font-bold text-[#0F1E2E] tabular-nums mt-1">
            {data.stats.usersCount} comptes
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {data.stats.productsCount} produits · {data.stats.ordersCount} commandes
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit max-w-full overflow-x-auto">
        {[
          { id: 'verifications', label: `Vendeurs (${data.shops.length})` },
          { id: 'payments', label: `Paiements MTN/Orange (${data.transactions.length})` },
          { id: 'users', label: `Utilisateurs (${data.users.length})` },
          { id: 'products', label: `Produits (${data.products.length})` },
          { id: 'disputes', label: `Litiges (${data.disputes.length})` },
          { id: 'settings', label: 'Commissions & Tarifs' },
          { id: 'logs', label: 'Journal Audit' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id as any)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer ${
              tab === item.id ? 'bg-white text-[#0F1E2E] shadow-xs' : 'text-slate-600'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 font-medium">
          {notice}
        </div>
      )}

      {/* Shops Verification */}
      {tab === 'verifications' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-medium">Boutique</th>
                  <th className="py-3 px-4 font-medium">Documents soumis</th>
                  <th className="py-3 px-4 font-medium">Plan</th>
                  <th className="py-3 px-4 font-medium">Statut</th>
                  <th className="py-3 px-4 font-medium text-right">Validation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.shops.map((s: any) => (
                  <tr key={s.id}>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#0F1E2E]">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.city}, {s.country_code} · {s.owner_email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">
                      <div>RCCM : {s.business_reg_number || '—'}</div>
                      <div>ID : {s.id_document_ref || '—'}</div>
                    </td>
                    <td className="py-3 px-4 text-xs uppercase font-medium">{s.subscription_plan}</td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      {s.is_verified === 1 ? (
                        <span className="text-emerald-700">VENDEUR VÉRIFIÉ</span>
                      ) : (
                        <span className="text-amber-700 uppercase">{s.verification_status}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleVerifyShop(s.id, true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Valider</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVerifyShop(s.id, false)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Refuser</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payments Supervision */}
      {tab === 'payments' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-medium">Réf. Prestataire</th>
                  <th className="py-3 px-4 font-medium">Client / Commande</th>
                  <th className="py-3 px-4 font-medium">Canal</th>
                  <th className="py-3 px-4 font-medium">Statut</th>
                  <th className="py-3 px-4 font-medium text-right">Montant</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.transactions.map((tx: any) => (
                  <tr key={tx.id}>
                    <td className="py-3 px-4 font-mono text-xs">{tx.provider_reference}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-[#0F1E2E]">{tx.buyer_name}</div>
                      <div className="font-mono text-xs text-slate-500">{tx.order_number}</div>
                    </td>
                    <td className="py-3 px-4 text-xs uppercase font-semibold">
                      {tx.provider} <span className="font-normal text-slate-500">({tx.payer_account})</span>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold uppercase">{tx.status}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatMoney(tx.amount_xaf, currency, rates)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {tx.status === 'confirmed' && (
                        <button
                          type="button"
                          onClick={() => handleRefund(tx.id)}
                          className="px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          Rembourser
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Users Management */}
      {tab === 'users' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-medium">Utilisateur</th>
                  <th className="py-3 px-4 font-medium">Contact</th>
                  <th className="py-3 px-4 font-medium">Rôle</th>
                  <th className="py-3 px-4 font-medium">Pays</th>
                  <th className="py-3 px-4 font-medium text-right">Sécurité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.users.map((u: any) => (
                  <tr key={u.id}>
                    <td className="py-3 px-4 font-medium text-[#0F1E2E]">{u.full_name}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{u.email || u.phone}</td>
                    <td className="py-3 px-4 text-xs font-semibold uppercase">{u.role}</td>
                    <td className="py-3 px-4 text-xs">{u.country_code}</td>
                    <td className="py-3 px-4 text-right">
                      {u.id !== user.id && (
                        <button
                          type="button"
                          onClick={() => handleBlockUser(u.id, u.is_blocked === 0)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer ${
                            u.is_blocked === 1
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>{u.is_blocked === 1 ? 'Débloquer' : 'Bloquer'}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Products Moderation */}
      {tab === 'products' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-medium">Produit</th>
                  <th className="py-3 px-4 font-medium">Boutique</th>
                  <th className="py-3 px-4 font-medium text-right">Prix gros</th>
                  <th className="py-3 px-4 font-medium">Statut</th>
                  <th className="py-3 px-4 font-medium text-right">Modération</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.products.map((p: any) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-medium text-[#0F1E2E]">{p.title}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{p.shop_name}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {formatMoney(p.wholesale_price_xaf, currency, rates)}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold uppercase">{p.status}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleProductStatus(p.id, p.status === 'active' ? 'paused' : 'active')}
                        className="px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        {p.status === 'active' ? 'Suspendre' : 'Activer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Disputes */}
      {tab === 'disputes' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          {data.disputes.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Aucun litige client ouvert.</p>
          ) : (
            data.disputes.map((d: any) => (
              <div key={d.id} className="p-4 border border-slate-200 rounded-xl flex flex-wrap justify-between items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-sm text-[#0F1E2E]">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Commande {d.order_number} · {d.buyer_name}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{d.reason}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase text-amber-700">{d.status}</span>
                  {d.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => handleResolveDispute(d.id, 'resolved')}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#0F1E2E] text-white rounded-lg cursor-pointer"
                    >
                      Clôturer
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Monetization & Commission Settings */}
      {tab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="max-w-xl bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-600" />
            <h2 className="font-display text-lg font-bold text-[#0F1E2E]">
              Monétisation & Commissions DILANE MARKET
            </h2>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Commission sur chaque vente (%)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="35"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Abonnement Vendeur Premium (FCFA / mois)</label>
            <input
              type="number"
              value={premiumFeeXaf}
              onChange={(e) => setPremiumFeeXaf(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Mise en avant sponsorisée produit (FCFA)</label>
            <input
              type="number"
              value={featuredFeeXaf}
              onChange={(e) => setFeaturedFeeXaf(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Service de sourcing fournisseurs en Chine (FCFA)</label>
            <input
              type="number"
              value={sourcingFeeXaf}
              onChange={(e) => setSourcingFeeXaf(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 text-sm font-semibold bg-amber-600 text-white rounded-xl hover:bg-amber-700 cursor-pointer"
          >
            Enregistrer les tarifs
          </button>
        </form>
      )}

      {/* Audit Logs */}
      {tab === 'logs' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="divide-y divide-slate-100 text-xs">
            {data.auditLogs.length === 0 ? (
              <p className="p-8 text-center text-slate-500">Aucune opération administrative journalisée pour le moment.</p>
            ) : (
              data.auditLogs.map((l: any) => (
                <div key={l.id} className="p-4 flex justify-between gap-4">
                  <div>
                    <span className="font-mono font-semibold text-[#0F1E2E]">{l.action}</span>
                    <span className="text-slate-600 ml-2">
                      par {l.admin_name} · {l.target_type} #{l.target_id} ({l.details})
                    </span>
                  </div>
                  <span className="font-mono text-slate-400 shrink-0">{l.created_at}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
