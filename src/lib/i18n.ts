import type { Category, CurrencyCode, LanguageCode } from '../types/marketplace';

export interface CountryOption {
  code: string;
  name: string;
  defaultCurrency: CurrencyCode;
  region: string;
}

export const PRIORITY_COUNTRIES: CountryOption[] = [
  { code: 'CM', name: 'Cameroun', defaultCurrency: 'XAF', region: 'CEMAC' },
  { code: 'CF', name: 'République centrafricaine', defaultCurrency: 'XAF', region: 'CEMAC' },
  { code: 'TD', name: 'Tchad', defaultCurrency: 'XAF', region: 'CEMAC' },
  { code: 'GA', name: 'Gabon', defaultCurrency: 'XAF', region: 'CEMAC' },
  { code: 'CG', name: 'Congo', defaultCurrency: 'XAF', region: 'CEMAC' },
  { code: 'CI', name: 'Côte d’Ivoire', defaultCurrency: 'XAF', region: 'UEMOA' },
  { code: 'SN', name: 'Sénégal', defaultCurrency: 'XAF', region: 'UEMOA' },
  { code: 'NG', name: 'Nigeria', defaultCurrency: 'NGN', region: 'Afrique de l’Ouest' },
  { code: 'GH', name: 'Ghana', defaultCurrency: 'GHS', region: 'Afrique de l’Ouest' },
  { code: 'ZA', name: 'Afrique du Sud', defaultCurrency: 'ZAR', region: 'Afrique Australe' },
  { code: 'CN', name: 'Chine', defaultCurrency: 'CNY', region: 'Asie' },
  { code: 'FR', name: 'Europe / France', defaultCurrency: 'EUR', region: 'Europe' },
  { code: 'US', name: 'International / USA', defaultCurrency: 'USD', region: 'Monde' },
];

export const CURRENCIES: Array<{ code: CurrencyCode; label: string; symbol: string }> = [
  { code: 'XAF', label: 'FCFA (XAF)', symbol: 'FCFA' },
  { code: 'USD', label: 'Dollar US (USD)', symbol: '$' },
  { code: 'EUR', label: 'Euro (EUR)', symbol: '€' },
  { code: 'CNY', label: 'Yuan (CNY)', symbol: '¥' },
  { code: 'NGN', label: 'Naira (NGN)', symbol: '₦' },
  { code: 'GHS', label: 'Cedi (GHS)', symbol: 'GH₵' },
  { code: 'ZAR', label: 'Rand (ZAR)', symbol: 'R' },
];

export const LANGUAGES: Array<{ code: LanguageCode; label: string }> = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'es', label: 'Español' },
  { code: 'ar', label: 'العربية' },
];

export function formatMoney(
  amountXaf: number,
  currency: CurrencyCode,
  rates: Record<string, number>
): string {
  const rate = rates[currency] ?? 1;
  const converted = amountXaf * rate;
  if (currency === 'XAF') {
    return `${Math.round(converted).toLocaleString('fr-FR')} FCFA`;
  }
  const symbolMap: Record<CurrencyCode, string> = {
    XAF: 'FCFA',
    USD: '$',
    EUR: '€',
    CNY: '¥',
    NGN: '₦',
    GHS: 'GH₵',
    ZAR: 'R',
  };
  const formatted = converted.toLocaleString('fr-FR', {
    minimumFractionDigits: converted < 100 ? 2 : 0,
    maximumFractionDigits: converted < 100 ? 2 : 0,
  });
  return currency === 'EUR' ? `${formatted} €` : `${symbolMap[currency]}${formatted}`;
}

export function getCategoryName(category: Category, lang: LanguageCode): string {
  const map: Record<LanguageCode, string> = {
    fr: category.name_fr,
    en: category.name_en,
    zh: category.name_zh,
    es: category.name_es,
    ar: category.name_ar,
  };
  return map[lang] || category.name_fr;
}

export function getCountryName(code: string): string {
  return PRIORITY_COUNTRIES.find((c) => c.code === code)?.name || code;
}

const DICT: Record<LanguageCode, Record<string, string>> = {
  fr: {
    slogan: 'Le monde du commerce à portée de main.',
    navCatalog: 'Catalogue',
    navChina: 'Import Chine',
    navSell: 'Vendre',
    navMessages: 'Messages',
    navLogistics: 'Suivi',
    navAdmin: 'Admin',
    login: 'Connexion',
    register: 'Inscription',
    cart: 'Panier',
    account: 'Mon espace',
    searchPlaceholder: 'Rechercher un produit, un grossiste, un fournisseur chinois...',
    heroHeadline: 'Achetez, vendez et importez entre l’Afrique, la Chine et le monde.',
    heroSub: 'Commandes en gros et au détail, fournisseurs vérifiés, devis Import Chine et paiements sécurisés MTN Mobile Money, Orange Money, Visa et Mastercard.',
    ctaExplore: 'Explorer le catalogue',
    ctaBecomeSeller: 'Devenir vendeur',
    ctaImportChina: 'Import Chine',
    wholesaleLabel: 'Gros dès',
    retailLabel: 'Détail',
    verifiedVendor: 'VENDEUR VÉRIFIÉ',
    allCategories: 'Toutes les catégories',
    sectionPopular: 'Produits populaires & Meilleures ventes',
    sectionChina: 'Import direct de Chine',
    sectionAfrica: 'Stock disponible en Afrique',
    sectionPromos: 'Promotions du jour',
    sectionNew: 'Nouveaux arrivages',
    sectionSuppliers: 'Fournisseurs vérifiés recommandés',
    addToCart: 'Ajouter au panier',
    requestQuote: 'Demander un devis',
    contactSeller: 'Contacter le vendeur',
  },
  en: {
    slogan: 'The world of commerce at your fingertips.',
    navCatalog: 'Catalog',
    navChina: 'China Import',
    navSell: 'Sell',
    navMessages: 'Messages',
    navLogistics: 'Track',
    navAdmin: 'Admin',
    login: 'Sign in',
    register: 'Sign up',
    cart: 'Cart',
    account: 'My account',
    searchPlaceholder: 'Search products, wholesalers, China factories...',
    heroHeadline: 'Buy, sell, and import across Africa, China, and global markets.',
    heroSub: 'Wholesale and retail orders, verified suppliers, China import freight quotes, and secure payments with MTN Mobile Money, Orange Money, Visa, and Mastercard.',
    ctaExplore: 'Browse catalog',
    ctaBecomeSeller: 'Become a seller',
    ctaImportChina: 'China Import',
    wholesaleLabel: 'Wholesale from',
    retailLabel: 'Retail',
    verifiedVendor: 'VERIFIED SELLER',
    allCategories: 'All categories',
    sectionPopular: 'Popular & Best Sellers',
    sectionChina: 'Direct Import from China',
    sectionAfrica: 'In Stock in Africa',
    sectionPromos: 'Today’s Promotions',
    sectionNew: 'New Arrivals',
    sectionSuppliers: 'Recommended Verified Suppliers',
    addToCart: 'Add to cart',
    requestQuote: 'Request quote',
    contactSeller: 'Message seller',
  },
  zh: {
    slogan: '全球贸易，触手可及。',
    navCatalog: '商品目录',
    navChina: '中国直采',
    navSell: '卖家入驻',
    navMessages: '消息',
    navLogistics: '物流追踪',
    navAdmin: '管理后台',
    login: '登录',
    register: '注册',
    cart: '购物车',
    account: '个人中心',
    searchPlaceholder: '搜索商品、批发商或中国认证工厂...',
    heroHeadline: '连接非洲、中国与全球的批发与零售贸易平台。',
    heroSub: '支持批发与零售采购、认证供应商、中国海运空运询价及MTN/Orange移动支付与国际银行卡。',
    ctaExplore: '浏览商品',
    ctaBecomeSeller: '成为卖家',
    ctaImportChina: '中国直采',
    wholesaleLabel: '批发价起订',
    retailLabel: '零售价',
    verifiedVendor: '认证供应商',
    allCategories: '全部分类',
    sectionPopular: '热门与畅销商品',
    sectionChina: '中国工厂直发',
    sectionAfrica: '非洲本地现货',
    sectionPromos: '今日特惠',
    sectionNew: '新品上架',
    sectionSuppliers: '推荐认证供应商',
    addToCart: '加入购物车',
    requestQuote: '申请报价',
    contactSeller: '联系卖家',
  },
  es: {
    slogan: 'El mundo del comercio al alcance de tu mano.',
    navCatalog: 'Catálogo',
    navChina: 'Importar China',
    navSell: 'Vender',
    navMessages: 'Mensajes',
    navLogistics: 'Seguimiento',
    navAdmin: 'Admin',
    login: 'Entrar',
    register: 'Registro',
    cart: 'Carrito',
    account: 'Mi cuenta',
    searchPlaceholder: 'Buscar productos, mayoristas o fábricas en China...',
    heroHeadline: 'Compra, vende e importa entre África, China y el mundo.',
    heroSub: 'Pedidos al por mayor y menor, proveedores verificados, cotizaciones desde China y pagos seguros con MTN, Orange Money, Visa y Mastercard.',
    ctaExplore: 'Explorar catálogo',
    ctaBecomeSeller: 'Vender aquí',
    ctaImportChina: 'Importar China',
    wholesaleLabel: 'Mayorista desde',
    retailLabel: 'Minorista',
    verifiedVendor: 'VENDEDOR VERIFICADO',
    allCategories: 'Todas las categorías',
    sectionPopular: 'Productos populares y más vendidos',
    sectionChina: 'Importación directa de China',
    sectionAfrica: 'Stock disponible en África',
    sectionPromos: 'Promociones de hoy',
    sectionNew: 'Nuevos ingresos',
    sectionSuppliers: 'Proveedores verificados recomendados',
    addToCart: 'Añadir al carrito',
    requestQuote: 'Solicitar cotización',
    contactSeller: 'Contactar vendedor',
  },
  ar: {
    slogan: 'عالم التجارة في متناول يدك.',
    navCatalog: 'المنتجات',
    navChina: 'الاستيراد من الصين',
    navSell: 'ابدأ البيع',
    navMessages: 'الرسائل',
    navLogistics: 'تتبع الشحن',
    navAdmin: 'الإدارة',
    login: 'تسجيل الدخول',
    register: 'إنشاء حساب',
    cart: 'السلة',
    account: 'حسابي',
    searchPlaceholder: 'ابحث عن المنتجات، تجار الجملة، أو مصانع الصين...',
    heroHeadline: 'اشترِ، بِع، واستورد بين أفريقيا والصين والعالم.',
    heroSub: 'طلبات بالجملة والتجزئة، موردون موثقون، عروض استيراد من الصين، ودفع آمن عبر MTN وOrange Money وVisa وMastercard.',
    ctaExplore: 'تصفح المنتجات',
    ctaBecomeSeller: 'كن بائعاً',
    ctaImportChina: 'الاستيراد من الصين',
    wholesaleLabel: 'الجملة ابتداءً من',
    retailLabel: 'التجزئة',
    verifiedVendor: 'بائع موثق',
    allCategories: 'جميع الفئات',
    sectionPopular: 'المنتجات الأكثر مبيعاً',
    sectionChina: 'استيراد مباشر من الصين',
    sectionAfrica: 'متوفر في أفريقيا',
    sectionPromos: 'عروض اليوم',
    sectionNew: 'وصل حديثاً',
    sectionSuppliers: 'موردون موثقون موصى بهم',
    addToCart: 'أضف إلى السلة',
    requestQuote: 'طلب عرض سعر',
    contactSeller: 'مراسلة البائع',
  },
};

export function t(lang: LanguageCode, key: string): string {
  return DICT[lang]?.[key] || DICT.fr[key] || key;
}
