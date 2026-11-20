import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Globe2,
  CheckCircle2,
  ArrowRight,
  SlidersHorizontal,
  ShieldCheck,
  MapPin,
  X,
} from 'lucide-react';
import type {
  CurrencyCode,
  LanguageCode,
  PlatformBootstrap,
  Product,
  User,
} from './types/marketplace';
import { apiRequest } from './lib/api';
import {
  CURRENCIES,
  getCategoryName,
  getCountryName,
  LANGUAGES,
  PRIORITY_COUNTRIES,
  t,
} from './lib/i18n';
import { Navbar, type ActiveTab } from './components/Navbar';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { AuthModal } from './components/AuthModal';
import { CartCheckoutDrawer, type DirectBuySelection } from './components/CartCheckoutDrawer';
import { ImportChinaView } from './components/ImportChinaView';
import { SellerDashboardView } from './components/SellerDashboardView';
import { BuyerAccountView } from './components/BuyerAccountView';
import { MessagingView } from './components/MessagingView';
import { LogisticsView } from './components/LogisticsView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { BrandLogo } from './components/BrandLogo';

const HERO_IMAGE = '/src/assets/images/hero_trade_corridor_1795192551987.jpg';

export default function App() {
  const [bootstrap, setBootstrap] = useState<PlatformBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [lang, setLang] = useState<LanguageCode>('fr');
  const [currency, setCurrency] = useState<CurrencyCode>('XAF');
  const [country, setCountry] = useState<string>('CM');

  // Catalog Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<'all' | 'africa' | 'china' | 'promo' | 'new'>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'price_asc' | 'price_desc'>('popular');

  // Modals & Drawers
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [cartOpen, setCartOpen] = useState(false);
  const [directBuyItem, setDirectBuyItem] = useState<DirectBuySelection | null>(null);
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [toast, setToast] = useState('');

  // Messaging draft target
  const [messageDraft, setMessageDraft] = useState<{
    receiverId: number;
    receiverName: string;
    product?: Product;
  } | null>(null);

  const fetchBootstrap = async () => {
    try {
      const data = await apiRequest<PlatformBootstrap>('/api/bootstrap');
      setBootstrap(data);
      setLoadError('');
      if (data.user) {
        setCountry(data.user.country_code || 'CM');
        setCurrency((data.user.currency_code as CurrencyCode) || 'XAF');
        setLang((data.user.language as LanguageCode) || 'fr');
      }
    } catch (err: any) {
      setLoadError(err.message || 'Impossible de contacter le serveur DILANE MARKET.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBootstrap();
  }, []);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? '' : cur)), 3200);
  };

  const handleToggleFavorite = async (productId: number) => {
    if (!bootstrap?.user) {
      setAuthMode('login');
      setAuthModalOpen(true);
      return;
    }
    const res = await apiRequest<{ favorited: boolean }>(`/api/favorites/${productId}`, {
      method: 'POST',
    });
    showToast(res.favorited ? 'Ajouté aux favoris.' : 'Retiré des favoris.');
    await fetchBootstrap();
  };

  const handleAddToCart = async (
    product: Product,
    orderType: 'retail' | 'wholesale',
    quantity?: number
  ) => {
    if (!bootstrap?.user) {
      setAuthMode('login');
      setAuthModalOpen(true);
      return;
    }
    const qty = quantity ?? (orderType === 'wholesale' ? product.moq : 1);
    await apiRequest('/api/cart', {
      method: 'POST',
      body: { productId: product.id, quantity: qty, orderType },
    });
    await fetchBootstrap();
    showToast(`Ajouté au panier (${qty} × ${product.title.slice(0, 32)}...)`);
    setDirectBuyItem(null);
    setCartOpen(true);
  };

  const handleBuyNow = (
    product: Product,
    orderType: 'retail' | 'wholesale',
    quantity?: number
  ) => {
    const qty = quantity ?? (orderType === 'wholesale' ? product.moq : 1);
    setDirectBuyItem({ product, orderType, quantity: qty });
    if (!bootstrap?.user) {
      setAuthMode('login');
      setAuthModalOpen(true);
      showToast('Connectez-vous pour accéder directement au choix du moyen de paiement.');
      return;
    }
    setCartOpen(true);
  };

  const handleStartMessage = (sellerUserId: number, sellerName: string, product: Product) => {
    setMessageDraft({ receiverId: sellerUserId, receiverName: sellerName, product });
    setActiveTab('messages');
  };

  const handleCountryChange = (code: string) => {
    setCountry(code);
    const found = PRIORITY_COUNTRIES.find((c) => c.code === code);
    if (found) setCurrency(found.defaultCurrency);
  };

  const categories = bootstrap?.categories || [];
  const products = bootstrap?.products || [];
  const shops = bootstrap?.shops || [];
  const rates = bootstrap?.settings.exchangeRates || { XAF: 1, USD: 0.00165, EUR: 0.00152, CNY: 0.0119 };

  const activeCategoryObj = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = products.filter((p) => {
      if (selectedCategoryId !== 'all' && p.category_id !== selectedCategoryId) return false;
      if (selectedSubcategory !== 'all' && p.subcategory !== selectedSubcategory) return false;
      if (originFilter === 'africa' && p.origin_type !== 'africa') return false;
      if (originFilter === 'china' && p.origin_type !== 'china') return false;
      if (originFilter === 'promo' && p.is_promo !== 1) return false;
      if (originFilter === 'new' && p.is_new_arrival !== 1) return false;
      if (q) {
        const hay = `${p.title} ${p.description} ${p.shop_name} ${p.category_name_fr} ${p.subcategory} ${p.shop_city}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'price_asc') {
      list = [...list].sort((a, b) => a.wholesale_price_xaf - b.wholesale_price_xaf);
    } else if (sortBy === 'price_desc') {
      list = [...list].sort((a, b) => b.wholesale_price_xaf - a.wholesale_price_xaf);
    } else {
      list = [...list].sort((a, b) => b.sales_count - a.sales_count);
    }
    return list;
  }, [products, selectedCategoryId, selectedSubcategory, originFilter, searchQuery, sortBy]);

  const verifiedShops = useMemo(() => shops.filter((s) => s.is_verified === 1), [shops]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="text-center space-y-3">
          <BrandLogo />
          <p className="text-sm text-slate-500">Chargement de la plateforme commerciale...</p>
        </div>
      </div>
    );
  }

  if (loadError || !bootstrap) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-6">
        <div className="max-w-md bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4">
          <BrandLogo />
          <p className="text-sm text-rose-700">{loadError || 'Erreur de chargement.'}</p>
          <button
            type="button"
            onClick={() => fetchBootstrap()}
            className="px-5 py-2.5 text-sm font-semibold bg-[#0F1E2E] text-white rounded-xl cursor-pointer"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#0F1E2E] pb-16 md:pb-0">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={bootstrap.user}
        cartCount={bootstrap.cartCount}
        unreadMessages={bootstrap.unreadMessages}
        unreadNotifications={bootstrap.unreadNotifications}
        lang={lang}
        onOpenCart={() => {
          setDirectBuyItem(null);
          setCartOpen(true);
        }}
        onOpenAuth={(mode) => {
          setAuthMode(mode);
          setAuthModalOpen(true);
        }}
      />

      {/* Toast Feedback */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 bg-[#0F1E2E] text-white px-4 py-3 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <main className="flex-1">
        {activeTab === 'home' && (
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-12">
            {/* Workspace Locale & Smart Search Toolbar */}
            <section className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t(lang, 'searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-amber-600"
                />
              </div>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <select
                  aria-label="Pays"
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="px-3 py-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
                >
                  {PRIORITY_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Devise"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className="px-3 py-2.5 text-xs font-mono font-medium bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Langue"
                  value={lang}
                  onChange={(e) => setLang(e.target.value as LanguageCode)}
                  className="px-3 py-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {/* Section 1: Storefront Split Hero */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-6 bg-[#0F1E2E] text-white rounded-2xl p-7 sm:p-10 flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="text-xs font-medium text-amber-400">
                    {t(lang, 'slogan')} · Cameroun · Afrique · Chine · Europe
                  </div>
                  <h1 className="font-display text-3xl sm:text-4xl font-bold leading-[1.14] text-balance">
                    {t(lang, 'heroHeadline')}
                  </h1>
                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
                    {t(lang, 'heroSub')}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href="#catalogue"
                      className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors"
                    >
                      <span>{t(lang, 'ctaExplore')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setActiveTab('import_china')}
                      className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold bg-white/10 text-white border border-white/20 rounded-xl hover:bg-white/15 transition-colors cursor-pointer"
                    >
                      <Globe2 className="w-4 h-4" />
                      <span>{t(lang, 'ctaImportChina')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('seller')}
                      className="px-4 py-3 text-sm font-semibold text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
                    >
                      {t(lang, 'ctaBecomeSeller')}
                    </button>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-300">
                    <span>MTN Mobile Money</span>
                    <span>·</span>
                    <span>Orange Money</span>
                    <span>·</span>
                    <span>Wave & Moov</span>
                    <span>·</span>
                    <span>Visa / Mastercard</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 rounded-2xl overflow-hidden bg-slate-200 min-h-[280px] relative">
                <img
                  src={HERO_IMAGE}
                  alt="Showroom commercial international DILANE MARKET reliant l’Afrique et l’Asie"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent p-6 text-white">
                  <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="font-mono text-lg font-bold tabular-nums">{categories.length}</div>
                      <div className="text-slate-200">Secteurs B2B & B2C</div>
                    </div>
                    <div>
                      <div className="font-mono text-lg font-bold tabular-nums">{verifiedShops.length}</div>
                      <div className="text-slate-200">Fournisseurs vérifiés</div>
                    </div>
                    <div>
                      <div className="font-mono text-lg font-bold tabular-nums">13+</div>
                      <div className="text-slate-200">Marchés couverts</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Interactive 14-Category Directory & Filtered Product Catalog */}
            <section id="catalogue" className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#0F1E2E]">
                    Catalogue international ({filteredProducts.length} offres)
                  </h2>
                  <p className="text-sm text-slate-600">
                    Filtrez par catégorie, origine (Afrique ou Import Chine), promotions du jour et nouveaux arrivages.
                  </p>
                </div>

                {/* Origin & Collection Segmented Controls */}
                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl overflow-x-auto max-w-full">
                  {[
                    { id: 'all', label: 'Tous' },
                    { id: 'africa', label: 'Stock Afrique' },
                    { id: 'china', label: 'Import Chine' },
                    { id: 'promo', label: 'Promotions' },
                    { id: 'new', label: 'Nouveautés' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setOriginFilter(f.id as any)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer transition-colors ${
                        originFilter === f.id
                          ? 'bg-white text-[#0F1E2E] shadow-xs'
                          : 'text-slate-600 hover:text-[#0F1E2E]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 14 Categories Interactive Strip */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId('all');
                      setSelectedSubcategory('all');
                    }}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-lg border whitespace-nowrap cursor-pointer ${
                      selectedCategoryId === 'all'
                        ? 'bg-[#0F1E2E] text-white border-[#0F1E2E]'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {t(lang, 'allCategories')}
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        setSelectedSubcategory('all');
                      }}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-lg border whitespace-nowrap cursor-pointer ${
                        selectedCategoryId === cat.id
                          ? 'bg-[#0F1E2E] text-white border-[#0F1E2E]'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {getCategoryName(cat, lang)}
                    </button>
                  ))}
                </div>

                {/* Subcategories & Sort Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {activeCategoryObj && activeCategoryObj.subcategories.length > 0 && (
                      <>
                        <span className="text-xs text-slate-500">Sous-catégories :</span>
                        <button
                          type="button"
                          onClick={() => setSelectedSubcategory('all')}
                          className={`px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                            selectedSubcategory === 'all'
                              ? 'bg-amber-100 text-amber-900 font-semibold'
                              : 'text-slate-600 hover:bg-slate-200/70'
                          }`}
                        >
                          Toutes
                        </button>
                        {activeCategoryObj.subcategories.map((sub) => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setSelectedSubcategory(sub)}
                            className={`px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                              selectedSubcategory === sub
                                ? 'bg-amber-100 text-amber-900 font-semibold'
                                : 'text-slate-600 hover:bg-slate-200/70'
                            }`}
                          >
                            {sub}
                          </button>
                        ))}
                      </>
                    )}
                  </div>

                  <div className="inline-flex items-center gap-2 text-xs text-slate-600 ml-auto">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <select
                      aria-label="Trier les produits"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                    >
                      <option value="popular">Meilleures ventes</option>
                      <option value="price_asc">Prix gros croissant</option>
                      <option value="price_desc">Prix gros décroissant</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 3-Column Product Grid */}
              {filteredProducts.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
                  <p className="font-display font-semibold text-[#0F1E2E]">
                    Aucun produit ne correspond à votre recherche
                  </p>
                  <p className="text-sm text-slate-500">
                    Réinitialisez vos filtres ou soumettez une demande de sourcing dans l’espace Import Chine.
                  </p>
                  <div className="flex justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategoryId('all');
                        setSelectedSubcategory('all');
                        setOriginFilter('all');
                      }}
                      className="px-4 py-2 text-xs font-semibold bg-[#0F1E2E] text-white rounded-lg cursor-pointer"
                    >
                      Afficher tout le catalogue
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('import_china')}
                      className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg cursor-pointer"
                    >
                      Demander un sourcing Chine
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      currency={currency}
                      rates={rates}
                      lang={lang}
                      isFavorite={bootstrap.favoriteIds.includes(product.id)}
                      onToggleFavorite={handleToggleFavorite}
                      onSelect={setSelectedProduct}
                      onQuickAdd={(p, type) => handleAddToCart(p, type)}
                      onBuyNow={(p, type) => handleBuyNow(p, type)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Section 3: Recommended Verified Suppliers */}
            <section className="border-t border-slate-200 pt-10 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#0F1E2E]">
                    {t(lang, 'sectionSuppliers')}
                  </h2>
                  <p className="text-sm text-slate-600">
                    Entreprises contrôlées sur justificatifs commerciaux et pièces d’identité par l’administration DILANE MARKET.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('seller')}
                  className="text-sm font-semibold text-amber-700 hover:underline cursor-pointer self-start sm:self-auto"
                >
                  Ouvrir ma boutique vendeur →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {verifiedShops.map((shop) => (
                  <div
                    key={shop.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t(lang, 'verifiedVendor')}
                        </span>
                        <span className="font-mono text-amber-700 font-semibold">{shop.rating_avg}/5 ★</span>
                      </div>
                      <h3 className="font-display text-lg font-bold text-[#0F1E2E]">{shop.name}</h3>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>
                          {shop.city}, {getCountryName(shop.country_code)} · {shop.origin_region === 'china' ? 'Usine Export Chine' : 'Grossiste Afrique'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                        {shop.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery(shop.name);
                        window.scrollTo({ top: 540, behavior: 'smooth' });
                      }}
                      className="w-full py-2 text-xs font-semibold border border-slate-300 text-[#0F1E2E] rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      Voir les produits de ce fournisseur
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'import_china' && (
          <ImportChinaView
            products={products}
            user={bootstrap.user}
            currency={currency}
            rates={rates}
            sourcingFeeXaf={bootstrap.settings.sourcingFeeXaf}
            lang={lang}
            favoriteIds={bootstrap.favoriteIds}
            onToggleFavorite={handleToggleFavorite}
            onSelectProduct={setSelectedProduct}
            onQuickAdd={(p, type) => handleAddToCart(p, type)}
            onBuyNow={(p, type) => handleBuyNow(p, type)}
            onRequireAuth={() => {
              setAuthMode('login');
              setAuthModalOpen(true);
            }}
          />
        )}

        {activeTab === 'seller' && (
          <SellerDashboardView
            user={bootstrap.user}
            categories={categories}
            currency={currency}
            rates={rates}
            commissionRate={bootstrap.settings.commissionRate}
            premiumFeeXaf={bootstrap.settings.premiumFeeXaf}
            onRequireAuth={() => {
              setAuthMode('register');
              setAuthModalOpen(true);
            }}
            onCatalogUpdated={fetchBootstrap}
          />
        )}

        {activeTab === 'messages' && (
          <MessagingView
            user={bootstrap.user}
            currency={currency}
            rates={rates}
            draftTarget={messageDraft}
            onRequireAuth={() => {
              setAuthMode('login');
              setAuthModalOpen(true);
            }}
            onMessagesLoaded={fetchBootstrap}
          />
        )}

        {activeTab === 'logistics' && <LogisticsView user={bootstrap.user} />}

        {activeTab === 'account' && bootstrap.user && (
          <BuyerAccountView
            user={bootstrap.user}
            products={products}
            favoriteIds={bootstrap.favoriteIds}
            currency={currency}
            rates={rates}
            lang={lang}
            onUserUpdated={() => fetchBootstrap()}
            onLogout={() => {
              setActiveTab('home');
              fetchBootstrap();
            }}
            onToggleFavorite={handleToggleFavorite}
            onSelectProduct={setSelectedProduct}
            onQuickAdd={(p, type) => handleAddToCart(p, type)}
            onBuyNow={(p, type) => handleBuyNow(p, type)}
            onNotificationsRead={fetchBootstrap}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboardView
            user={bootstrap.user}
            currency={currency}
            rates={rates}
            onSettingsUpdated={fetchBootstrap}
          />
        )}
      </main>

      {/* Clean Editorial Footer */}
      <footer className="bg-[#0F1E2E] text-slate-300 mt-16 border-t border-slate-800">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-12 gap-8 text-sm">
          <div className="md:col-span-5 space-y-3">
            <BrandLogo light />
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Le monde du commerce à portée de main. Plateforme internationale B2B et B2C reliant les commerçants africains aux fabricants locaux, chinois et européens.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Transactions vérifiées côté serveur · Aucun code PIN Mobile Money demandé</span>
            </div>
          </div>

          <div className="md:col-span-4 space-y-2">
            <div className="font-semibold text-white text-xs">Navigation rapide</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button type="button" onClick={() => setActiveTab('home')} className="text-left hover:text-white cursor-pointer">
                Catalogue gros & détail
              </button>
              <button type="button" onClick={() => setActiveTab('import_china')} className="text-left hover:text-white cursor-pointer">
                Import Chine & Sourcing
              </button>
              <button type="button" onClick={() => setActiveTab('seller')} className="text-left hover:text-white cursor-pointer">
                Devenir vendeur
              </button>
              <button type="button" onClick={() => setActiveTab('logistics')} className="text-left hover:text-white cursor-pointer">
                Suivi logistique
              </button>
            </div>
          </div>

          <div className="md:col-span-3 space-y-2">
            <div className="font-semibold text-white text-xs">Conformité & Sécurité</div>
            <div className="flex flex-col gap-1.5 text-xs">
              <button type="button" onClick={() => setLegalModal('privacy')} className="text-left hover:text-white cursor-pointer">
                Politique de confidentialité
              </button>
              <button type="button" onClick={() => setLegalModal('terms')} className="text-left hover:text-white cursor-pointer">
                Conditions générales d’utilisation
              </button>
              <span className="text-slate-400">Direction & Propriétaire : DILANE MARKET</span>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} DILANE MARKET — Tous droits réservés.
        </div>
      </footer>

      {/* Modals & Drawers */}
      <ProductDetailModal
        product={selectedProduct}
        user={bootstrap.user}
        currency={currency}
        rates={rates}
        commissionRate={bootstrap.settings.commissionRate}
        lang={lang}
        isFavorite={selectedProduct ? bootstrap.favoriteIds.includes(selectedProduct.id) : false}
        onClose={() => setSelectedProduct(null)}
        onToggleFavorite={handleToggleFavorite}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        onStartMessage={handleStartMessage}
        onRequireAuth={() => {
          setSelectedProduct(null);
          setAuthMode('login');
          setAuthModalOpen(true);
        }}
      />

      <AuthModal
        isOpen={authModalOpen}
        initialMode={authMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={async (loggedUser: User) => {
          await fetchBootstrap();
          showToast(`Bienvenue, ${loggedUser.full_name}`);
          if (directBuyItem) {
            setCartOpen(true);
          } else if (loggedUser.role === 'super_admin' || loggedUser.role === 'admin') {
            setActiveTab('admin');
          }
        }}
      />

      <CartCheckoutDrawer
        isOpen={cartOpen}
        user={bootstrap.user}
        currency={currency}
        rates={rates}
        commissionRate={bootstrap.settings.commissionRate}
        directBuyItem={directBuyItem}
        onClearDirectBuy={() => setDirectBuyItem(null)}
        onClose={() => {
          setCartOpen(false);
          setDirectBuyItem(null);
        }}
        onRequireAuth={() => {
          setCartOpen(false);
          setAuthMode('login');
          setAuthModalOpen(true);
        }}
        onOrderCompleted={fetchBootstrap}
      />

      {legalModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white max-w-lg w-full rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[#0F1E2E]">
                {legalModal === 'privacy'
                  ? 'Politique de confidentialité — DILANE MARKET'
                  : 'Conditions générales d’utilisation — DILANE MARKET'}
              </h2>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed space-y-2.5 max-h-[60vh] overflow-y-auto">
              {legalModal === 'privacy' ? (
                <>
                  <p>
                    DILANE MARKET protège les données personnelles de ses acheteurs, vendeurs et transporteurs partenaires conformément aux législations applicables dans les pays desservis (Cameroun, zone CEMAC, UEMOA, Europe et international).
                  </p>
                  <p>
                    Les mots de passe sont chiffrés par hachage cryptographique salé côté serveur. Aucune donnée bancaire sensible ni aucun code PIN Mobile Money n’est jamais collecté ou stocké par la plateforme.
                  </p>
                  <p>
                    Les justificatifs professionnels soumis pour obtenir le badge VENDEUR VÉRIFIÉ sont strictement réservés au contrôle de conformité par les administrateurs habilités.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Toute commande passée sur DILANE MARKET affiche clairement le montant total, les frais de livraison estimés et la commission plateforme avant validation.
                  </p>
                  <p>
                    Une commande n’est confirmée au statut PAYÉ qu’après vérification serveur de la transaction auprès du prestataire agréé (MTN Mobile Money, Orange Money, Visa, Mastercard ou virement). Aucune capture d’écran ne vaut preuve de paiement.
                  </p>
                  <p>
                    Les estimations de fret et douane de la rubrique IMPORT CHINE sont fournies à titre indicatif et doivent être confirmées par un devis ferme avant expédition. En cas de litige, les acheteurs disposent d’un système de réclamation et de remboursement supervisé par l’administration.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
