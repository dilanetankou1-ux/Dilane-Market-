import React, { useEffect, useState } from 'react';
import {
  Store,
  CheckCircle2,
  Plus,
  Package,
  Truck,
  Wallet,
  ShieldCheck,
  Award,
  FileText,
} from 'lucide-react';
import type { Category, CurrencyCode, RfqRequest, Shop, User } from '../types/marketplace';
import { apiRequest } from '../lib/api';
import { formatMoney, PRIORITY_COUNTRIES } from '../lib/i18n';
import { SellerFaqSection } from './SellerFaqSection';

interface SellerDashboardViewProps {
  user: User | null;
  categories: Category[];
  currency: CurrencyCode;
  rates: Record<string, number>;
  commissionRate: number;
  premiumFeeXaf: number;
  onRequireAuth: () => void;
  onCatalogUpdated: () => void;
}

const PRESET_IMAGES = [
  { label: 'Smartphones & Tech', url: '/src/assets/images/prod_smartphone_wholesale_1795192554068.jpg' },
  { label: 'Solaire & Énergie', url: '/src/assets/images/prod_solar_industrial_1795192552667.jpg' },
  { label: 'Mode & Chaussures', url: '/src/assets/images/prod_fashion_textile_1795192554075.jpg' },
  { label: 'Machines Industrielles', url: '/src/assets/images/prod_china_import_machinery_1795192553290.jpg' },
  { label: 'Beauté & Cosmétiques', url: '/src/assets/images/prod_beauty_cosmetics_1795192553127.jpg' },
];

export const SellerDashboardView: React.FC<SellerDashboardViewProps> = ({
  user,
  categories,
  currency,
  rates,
  commissionRate,
  premiumFeeXaf,
  onRequireAuth,
  onCatalogUpdated,
}) => {
  const [subTab, setSubTab] = useState<'products' | 'orders' | 'rfqs' | 'shop' | 'wallet' | 'faq'>('products');
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [rfqs, setRfqs] = useState<RfqRequest[]>([]);
  const [walletSummary, setWalletSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  // Shop form
  const [shopName, setShopName] = useState('');
  const [shopDesc, setShopDesc] = useState('');
  const [shopCountry, setShopCountry] = useState(user?.country_code || 'CM');
  const [shopCity, setShopCity] = useState('');
  const [shopOrigin, setShopOrigin] = useState<'africa' | 'china' | 'europe' | 'global'>('africa');
  const [payoutMethod, setPayoutMethod] = useState('mtn_momo');
  const [payoutBankName, setPayoutBankName] = useState('');
  const [payoutAccount, setPayoutAccount] = useState('');

  // Verification form
  const [regNumber, setRegNumber] = useState('');
  const [idDocRef, setIdDocRef] = useState('');

  // Product form
  const [pTitle, setPTitle] = useState('');
  const [pCatId, setPCatId] = useState<number>(categories[0]?.id || 1);
  const [pSubcat, setPSubcat] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pRetail, setPRetail] = useState(25000);
  const [pWholesale, setPWholesale] = useState(18000);
  const [pMoq, setPMoq] = useState(10);
  const [pStock, setPStock] = useState(100);
  const [pImage, setPImage] = useState(PRESET_IMAGES[0].url);
  const [pVideo, setPVideo] = useState('');
  const [pPromo, setPPromo] = useState(false);
  const [pPromoPct, setPPromoPct] = useState(10);

  // RFQ response inline state
  const [quoteAmounts, setQuoteAmounts] = useState<Record<number, string>>({});
  const [quoteNotes, setQuoteNotes] = useState<Record<number, string>>({});

  const loadSellerData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [overview, wallet] = await Promise.all([
        apiRequest<{ shop: Shop | null; products: any[]; orders: any[]; rfqs: RfqRequest[] }>('/api/seller/overview'),
        apiRequest<{ sellerSummary: any }>('/api/wallet'),
      ]);
      setShop(overview.shop);
      setProducts(overview.products || []);
      setOrders(overview.orders || []);
      setRfqs(overview.rfqs || []);
      setWalletSummary(wallet.sellerSummary);
      if (overview.shop) {
        setShopName(overview.shop.name);
        setShopDesc(overview.shop.description);
        setShopCountry(overview.shop.country_code);
        setShopCity(overview.shop.city);
        setShopOrigin(overview.shop.origin_region);
        setPayoutMethod(overview.shop.payout_method || 'mtn_momo');
        setPayoutBankName(overview.shop.payout_bank_name || '');
        setPayoutAccount(overview.shop.payout_account || '');
        setRegNumber(overview.shop.business_reg_number || '');
        setIdDocRef(overview.shop.id_document_ref || '');
      }
    } catch {
      // handled gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSellerData();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 space-y-10">
        <div className="max-w-2xl mx-auto text-center space-y-4 py-6">
          <Store className="w-10 h-10 text-amber-600 mx-auto" />
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0F1E2E]">
            Ouvrez votre boutique sur DILANE MARKET
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Vendez vos produits au détail et en gros auprès d’acheteurs en Afrique, en Chine et dans le monde. Recevez vos paiements MTN Mobile Money, Orange Money et internationaux en toute sécurité.
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="px-6 py-3 text-sm font-semibold bg-[#0F1E2E] text-white rounded-xl hover:bg-slate-800 cursor-pointer"
          >
            Se connecter ou créer un compte vendeur
          </button>
        </div>

        <SellerFaqSection hasShop={false} commissionRate={commissionRate} />
      </div>
    );
  }

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    try {
      await apiRequest('/api/seller/shop', {
        method: 'POST',
        body: {
          name: shopName,
          description: shopDesc,
          countryCode: shopCountry,
          city: shopCity,
          originRegion: shopOrigin,
          payoutMethod,
          payoutBankName,
          payoutAccount,
        },
      });
      setNotice('Votre boutique a été enregistrée avec succès.');
      await loadSellerData();
      onCatalogUpdated();
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    try {
      await apiRequest('/api/seller/verification', {
        method: 'POST',
        body: { businessRegNumber: regNumber, idDocumentRef: idDocRef },
      });
      setNotice('Dossier de vérification transmis à l’administrateur. Le badge VENDEUR VÉRIFIÉ s’affichera uniquement après validation.');
      await loadSellerData();
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    try {
      await apiRequest('/api/seller/products', {
        method: 'POST',
        body: {
          categoryId: pCatId,
          subcategory: pSubcat,
          title: pTitle,
          description: pDesc,
          imageUrl: pImage,
          videoUrl: pVideo,
          retailPriceXaf: pRetail,
          wholesalePriceXaf: pWholesale,
          moq: pMoq,
          stock: pStock,
          originType: shop?.origin_region || 'africa',
          isPromo: pPromo,
          promoPercent: pPromoPct,
        },
      });
      setPTitle('');
      setPDesc('');
      setNotice('Produit publié et immédiatement visible dans le catalogue DILANE MARKET !');
      await loadSellerData();
      onCatalogUpdated();
    } catch (err: any) {
      setNotice(err.message);
    }
  };

  const handleShipOrder = async (orderId: number) => {
    await apiRequest(`/api/seller/orders/${orderId}/ship`, {
      method: 'PUT',
      body: { location: shop?.city || 'Entrepôt vendeur', note: 'Marchandise vérifiée et remise au transporteur.' },
    });
    setNotice('Commande marquée comme expédiée. L’acheteur a été notifié.');
    await loadSellerData();
  };

  const handleQuoteRfq = async (rfqId: number) => {
    const amount = Number(quoteAmounts[rfqId] || 0);
    if (!amount) return;
    await apiRequest(`/api/rfqs/${rfqId}/quote`, {
      method: 'POST',
      body: { quotedPriceXaf: amount, quotedNotes: quoteNotes[rfqId] || 'Offre fournisseur DILANE MARKET.' },
    });
    setNotice('Devis envoyé à l’acheteur.');
    await loadSellerData();
  };

  const handleUpgradePlan = async (plan: 'premium' | 'enterprise') => {
    await apiRequest('/api/seller/subscription', { method: 'POST', body: { plan } });
    setNotice(`Abonnement vendeur ${plan.toUpperCase()} activé.`);
    await loadSellerData();
    onCatalogUpdated();
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Seller Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0F1E2E]">
            Espace Vendeur {shop ? `— ${shop.name}` : ''}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
            {shop ? (
              <>
                <span>{shop.city}, {shop.country_code}</span>
                <span aria-hidden="true">·</span>
                <span>Plan {shop.subscription_plan.toUpperCase()}</span>
                <span aria-hidden="true">·</span>
                {shop.is_verified === 1 ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    VENDEUR VÉRIFIÉ
                  </span>
                ) : shop.verification_status === 'pending' ? (
                  <span className="text-amber-700 font-semibold">Vérification en attente de validation admin</span>
                ) : (
                  <span className="text-slate-500">Boutique non vérifiée (soumettez vos documents)</span>
                )}
              </>
            ) : (
              <span>Créez votre boutique virtuelle en 1 minute pour publier vos produits.</span>
            )}
          </div>
        </div>

        {shop && (
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {[
              { id: 'products', label: `Produits (${products.length})` },
              { id: 'orders', label: `Commandes (${orders.length})` },
              { id: 'rfqs', label: `Devis (${rfqs.length})` },
              { id: 'wallet', label: 'Finances' },
              { id: 'shop', label: 'Boutique & Vérif' },
              { id: 'faq', label: 'FAQ Vendeurs' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer ${
                  subTab === tab.id ? 'bg-white text-[#0F1E2E] shadow-xs' : 'text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 font-medium">
          {notice}
        </div>
      )}

      {loading && !shop ? (
        <p className="text-sm text-slate-500">Chargement de votre espace vendeur...</p>
      ) : !shop || subTab === 'shop' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Create/Edit Shop */}
          <form onSubmit={handleSaveShop} className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#0F1E2E]">
              {shop ? 'Modifier ma boutique' : 'Créer ma boutique virtuelle'}
            </h2>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Nom commercial de la boutique</label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Ex. Garoua-Boulaï Négoce & Tech"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Pays</label>
                <select
                  value={shopCountry}
                  onChange={(e) => setShopCountry(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {PRIORITY_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Ville</label>
                <input
                  type="text"
                  required
                  value={shopCity}
                  onChange={(e) => setShopCity(e.target.value)}
                  placeholder="Douala, Garoua-Boulaï, Shenzhen..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Zone d’expédition</label>
                <select
                  value={shopOrigin}
                  onChange={(e) => setShopOrigin(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="africa">Stock en Afrique</option>
                  <option value="china">Import direct Chine</option>
                  <option value="europe">Europe</option>
                  <option value="global">International</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Présentation de l’entreprise</label>
              <textarea
                rows={3}
                value={shopDesc}
                onChange={(e) => setShopDesc(e.target.value)}
                placeholder="Vos spécialités, garanties, délais de livraison gros et détail..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            {/* Direct Supplier Payout Destination (MoMo or Bank) */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-[#0F1E2E]">
                  Compte de réception des ventes (MoMo ou Bancaire)
                </h3>
                <p className="text-xs text-slate-500">
                  Les paiements acheteurs (nets des frais d’utilisation de l’application de {commissionRate}%) sont dirigés vers ce compte.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Canal de versement</label>
                  <select
                    value={payoutMethod}
                    onChange={(e) => setPayoutMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="mtn_momo">MTN Mobile Money</option>
                    <option value="orange_money">Orange Money</option>
                    <option value="wave">Wave</option>
                    <option value="moov_money">Moov Money</option>
                    <option value="airtel_money">Airtel Money</option>
                    <option value="bank_transfer">Compte bancaire / SWIFT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Opérateur ou Banque</label>
                  <input
                    type="text"
                    required
                    value={payoutBankName}
                    onChange={(e) => setPayoutBankName(e.target.value)}
                    placeholder="Ex. MTN MoMo Cameroun / Afriland First Bank"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Numéro MoMo ou IBAN / RIB</label>
                  <input
                    type="text"
                    required
                    value={payoutAccount}
                    onChange={(e) => setPayoutAccount(e.target.value)}
                    placeholder="Ex. +237 678 321 595 ou CM21..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-semibold bg-[#0F1E2E] text-white rounded-xl hover:bg-slate-800 cursor-pointer"
            >
              {shop ? 'Enregistrer les modifications' : 'Ouvrir ma boutique maintenant'}
            </button>
          </form>

          {/* Official Verification Form */}
          <div className="lg:col-span-5 space-y-6">
            <form onSubmit={handleSubmitVerification} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <h2 className="font-display text-lg font-bold text-[#0F1E2E]">
                  Vérification officielle (VENDEUR VÉRIFIÉ)
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Le badge <strong>VENDEUR VÉRIFIÉ</strong> n’est attribué qu’après contrôle de votre registre de commerce et de votre pièce d’identité par l’administrateur DILANE MARKET.
              </p>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Numéro RCCM / Licence commerciale</label>
                <input
                  type="text"
                  required
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  placeholder="Ex. RC/DLA/2026/B/1234"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Référence CNI / Passeport dirigeant</label>
                <input
                  type="text"
                  required
                  value={idDocRef}
                  onChange={(e) => setIdDocRef(e.target.value)}
                  placeholder="Ex. CNI-CM-10928374"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={!shop}
                className="w-full py-2.5 text-sm font-semibold bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 disabled:opacity-40 cursor-pointer"
              >
                Soumettre pour vérification
              </button>
            </form>

            {shop && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-600" />
                  <h3 className="font-display text-base font-bold text-[#0F1E2E]">
                    Abonnement Vendeur Premium
                  </h3>
                </div>
                <p className="text-xs text-slate-600">
                  Mise en avant prioritaire dans les résultats de recherche, statistiques avancées et accès direct aux acheteurs Import Chine. Tarif mensuel :{' '}
                  <strong className="font-mono">{formatMoney(premiumFeeXaf, currency, rates)}</strong>.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpgradePlan('premium')}
                    className="flex-1 py-2 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 cursor-pointer"
                  >
                    Activer Premium
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpgradePlan('enterprise')}
                    className="flex-1 py-2 text-xs font-semibold bg-[#0F1E2E] text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    Plan Entreprise
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Products Management & Publishing */}
      {shop && subTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form onSubmit={handleCreateProduct} className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" />
              <h2 className="font-display text-lg font-bold text-[#0F1E2E]">Publier un produit</h2>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Nom du produit</label>
              <input
                type="text"
                required
                value={pTitle}
                onChange={(e) => setPTitle(e.target.value)}
                placeholder="Ex. Groupe électrogène silencieux 5kVA"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Catégorie</label>
                <select
                  value={pCatId}
                  onChange={(e) => setPCatId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name_fr}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Sous-catégorie</label>
                <input
                  type="text"
                  value={pSubcat}
                  onChange={(e) => setPSubcat(e.target.value)}
                  placeholder="Ex. Smartphones, Solaire..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Prix détail (FCFA)</label>
                <input
                  type="number"
                  required
                  min={100}
                  value={pRetail}
                  onChange={(e) => setPRetail(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Prix gros (FCFA)</label>
                <input
                  type="number"
                  required
                  min={100}
                  value={pWholesale}
                  onChange={(e) => setPWholesale(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Quantité min. gros (MOQ)</label>
                <input
                  type="number"
                  min={1}
                  value={pMoq}
                  onChange={(e) => setPMoq(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Stock disponible</label>
                <input
                  type="number"
                  min={0}
                  value={pStock}
                  onChange={(e) => setPStock(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Visuel produit (bibliothèque studio)</label>
              <select
                value={pImage}
                onChange={(e) => setPImage(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {PRESET_IMAGES.map((img) => (
                  <option key={img.url} value={img.url}>{img.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Lien vidéo démonstration (facultatif)</label>
              <input
                type="url"
                value={pVideo}
                onChange={(e) => setPVideo(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Description détaillée</label>
              <textarea
                rows={3}
                required
                value={pDesc}
                onChange={(e) => setPDesc(e.target.value)}
                placeholder="Caractéristiques, garantie, conditions d'expédition..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pPromo}
                  onChange={(e) => setPPromo(e.target.checked)}
                  className="accent-amber-600"
                />
                <span>Activer une promotion</span>
              </label>
              {pPromo && (
                <input
                  type="number"
                  min={5}
                  max={70}
                  value={pPromoPct}
                  onChange={(e) => setPPromoPct(Number(e.target.value))}
                  className="w-20 px-2 py-1 text-xs border border-slate-300 rounded font-mono"
                />
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 text-sm font-semibold bg-amber-600 text-white rounded-xl hover:bg-amber-700 cursor-pointer"
            >
              Publier dans le catalogue
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#0F1E2E]">
              Produits de ma boutique ({products.length})
            </h2>
            {products.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
                <Package className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                Aucun produit publié pour l’instant.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 font-medium">Produit</th>
                        <th className="py-3 px-4 font-medium text-right">Détail</th>
                        <th className="py-3 px-4 font-medium text-right">Gros (MOQ)</th>
                        <th className="py-3 px-4 font-medium text-right">Stock</th>
                        <th className="py-3 px-4 font-medium text-right">Ventes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3 px-4 font-medium text-[#0F1E2E]">{p.title}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {formatMoney(p.retail_price_xaf, currency, rates)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {formatMoney(p.wholesale_price_xaf, currency, rates)} ({p.moq})
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">{p.stock}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                            {p.sales_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seller Orders */}
      {shop && subTab === 'orders' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-600" />
            <h2 className="font-display text-lg font-bold text-[#0F1E2E]">Commandes reçues</h2>
          </div>
          {orders.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Aucune commande reçue pour le moment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-medium">Commande</th>
                    <th className="py-3 px-4 font-medium">Acheteur</th>
                    <th className="py-3 px-4 font-medium">Article</th>
                    <th className="py-3 px-4 font-medium text-right">Net vendeur</th>
                    <th className="py-3 px-4 font-medium">Paiement / Statut</th>
                    <th className="py-3 px-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o, idx) => (
                    <tr key={`${o.id}-${idx}`}>
                      <td className="py-3 px-4 font-mono text-xs font-semibold">{o.order_number}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#0F1E2E]">{o.buyer_name}</div>
                        <div className="text-xs text-slate-500">{o.shipping_city}, {o.country_code}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="line-clamp-1">{o.product_title}</div>
                        <div className="text-xs text-slate-500 font-mono">Qté: {o.quantity} ({o.order_type})</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                        {formatMoney(o.seller_payout_xaf, currency, rates)}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div>{o.payment_status === 'paid' ? 'PAYÉ' : o.payment_status}</div>
                        <div className="text-slate-500">{o.order_status}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {o.payment_status === 'paid' && o.order_status === 'paid' ? (
                          <button
                            type="button"
                            onClick={() => handleShipOrder(o.id)}
                            className="px-3 py-1.5 text-xs font-semibold bg-[#0F1E2E] text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                          >
                            Expédier
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono">{o.tracking_number}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Seller RFQs */}
      {shop && subTab === 'rfqs' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600" />
            <h2 className="font-display text-lg font-bold text-[#0F1E2E]">Demandes de devis acheteurs</h2>
          </div>
          {rfqs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
              Aucune demande de devis en cours.
            </div>
          ) : (
            <div className="space-y-3">
              {rfqs.map((r) => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-[#0F1E2E]">{r.title}</h3>
                      <div className="text-xs text-slate-500">
                        Acheteur : {r.buyer_name} · Quantité : {r.quantity} · Destination : {r.target_country}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-amber-700">{r.status.toUpperCase()}</span>
                  </div>
                  <p className="text-sm text-slate-600">{r.details}</p>
                  {r.status === 'open' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-slate-100">
                      <input
                        type="number"
                        placeholder="Prix proposé (FCFA)"
                        value={quoteAmounts[r.id] || ''}
                        onChange={(e) => setQuoteAmounts({ ...quoteAmounts, [r.id]: e.target.value })}
                        className="sm:col-span-3 px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Conditions, délai d'expédition, emballage..."
                        value={quoteNotes[r.id] || ''}
                        onChange={(e) => setQuoteNotes({ ...quoteNotes, [r.id]: e.target.value })}
                        className="sm:col-span-6 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuoteRfq(r.id)}
                        className="sm:col-span-3 py-2 text-xs font-semibold bg-[#0F1E2E] text-white rounded-lg cursor-pointer"
                      >
                        Envoyer le devis
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-800 font-medium pt-2 border-t border-slate-100">
                      Offre transmise : {r.quoted_price_xaf ? formatMoney(r.quoted_price_xaf, currency, rates) : ''} — {r.quoted_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Seller Financial Wallet */}
      {shop && subTab === 'wallet' && walletSummary && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-xs text-slate-500">Chiffre d’affaires brut (payé)</div>
              <div className="font-mono text-2xl font-bold text-[#0F1E2E] tabular-nums mt-1">
                {formatMoney(walletSummary.grossSalesXaf, currency, rates)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-xs text-slate-500">Commissions plateforme ({commissionRate}%)</div>
              <div className="font-mono text-2xl font-bold text-slate-700 tabular-nums mt-1">
                {formatMoney(walletSummary.totalCommissionXaf, currency, rates)}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="text-xs text-slate-500">Solde net éligible au versement</div>
              <div className="font-mono text-2xl font-bold text-emerald-700 tabular-nums mt-1">
                {formatMoney(walletSummary.netPayoutAvailableXaf, currency, rates)}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Wallet className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-slate-600 space-y-1">
                <div className="font-semibold text-[#0F1E2E]">
                  Compte de versement enregistré : {shop.payout_bank_name || 'Non configuré'}{' '}
                  {shop.payout_account ? <span className="font-mono text-emerald-700">({shop.payout_account})</span> : null}
                </div>
                <p className="text-xs leading-relaxed">
                  Les paiements acheteurs sont affectés vers votre compte Mobile Money ou bancaire (déduction faite des frais d’utilisation de l’application de {commissionRate}%), selon les règles réglementaires des prestataires agréés dans votre pays.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSubTab('shop')}
              className="px-4 py-2 text-xs font-semibold border border-slate-300 text-[#0F1E2E] rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Modifier le compte
            </button>
          </div>
        </div>
      )}
      {/* Seller FAQ Tab or Onboarding Help below Shop Setup */}
      {(!shop || subTab === 'faq') && (
        <SellerFaqSection
          hasShop={Boolean(shop)}
          commissionRate={commissionRate}
          onNavigateTab={(target) => setSubTab(target)}
        />
      )}
    </div>
  );
};
