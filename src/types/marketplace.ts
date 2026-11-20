export type LanguageCode = 'fr' | 'en' | 'zh' | 'es' | 'ar';
export type CurrencyCode = 'XAF' | 'USD' | 'EUR' | 'CNY' | 'NGN' | 'GHS' | 'ZAR';

export interface User {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: 'buyer' | 'seller' | 'carrier' | 'admin' | 'super_admin';
  country_code: string;
  currency_code: CurrencyCode;
  language: LanguageCode;
  is_blocked: number;
  created_at: string;
}

export interface Shop {
  id: number;
  owner_id: number;
  owner_name?: string;
  owner_email?: string;
  name: string;
  slug: string;
  description: string;
  country_code: string;
  city: string;
  origin_region: 'africa' | 'china' | 'europe' | 'global';
  logo_url: string;
  is_verified: number;
  verification_status: 'unsubmitted' | 'pending' | 'verified' | 'rejected';
  business_reg_number: string;
  id_document_ref: string;
  subscription_plan: 'standard' | 'premium' | 'enterprise';
  payout_method?: string;
  payout_account?: string;
  payout_bank_name?: string;
  rating_avg: number;
  rating_count: number;
  created_at: string;
}

export interface Category {
  id: number;
  slug: string;
  name_fr: string;
  name_en: string;
  name_zh: string;
  name_es: string;
  name_ar: string;
  subcategories: string[];
  sort_order: number;
}

export interface Product {
  id: number;
  shop_id: number;
  category_id: number;
  subcategory: string;
  title: string;
  description: string;
  image_url: string;
  video_url: string;
  retail_price_xaf: number;
  wholesale_price_xaf: number;
  moq: number;
  stock: number;
  origin_type: 'africa' | 'china' | 'europe' | 'global';
  is_promo: number;
  promo_percent: number;
  is_featured: number;
  is_new_arrival: number;
  sales_count: number;
  status: 'active' | 'paused' | 'rejected';
  specs: Record<string, string>;
  created_at: string;
  shop_name: string;
  shop_description?: string;
  shop_verified: number;
  shop_country: string;
  shop_city: string;
  seller_user_id: number;
  shop_rating: number;
  shop_rating_count?: number;
  shop_payout_method?: string;
  shop_payout_account?: string;
  shop_payout_bank_name?: string;
  category_slug: string;
  category_name_fr: string;
  category_name_en?: string;
}

export interface PayoutBreakdownItem {
  shopId: number;
  shopName: string;
  payoutMethod: string;
  payoutBankName: string;
  payoutAccountMasked: string;
  grossXaf: number;
  appFeeXaf: number;
  netSellerXaf: number;
}

export interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  order_type: 'retail' | 'wholesale';
  title: string;
  image_url: string;
  retail_price_xaf: number;
  wholesale_price_xaf: number;
  moq: number;
  stock: number;
  origin_type: string;
  shop_id: number;
  shop_name: string;
  shop_verified: number;
  shop_payout_method?: string;
  shop_payout_account?: string;
  shop_payout_bank_name?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  category: 'mobile_money' | 'card' | 'bank';
  requiresPhone: boolean;
  currencies: string[];
  countries: string[];
  description: string;
  integrationReady: boolean;
  liveConfigured: boolean;
}

export interface PaymentTransaction {
  id: number;
  idempotency_key: string;
  order_id: number;
  order_number?: string;
  buyer_name?: string;
  user_id: number;
  provider: string;
  payer_account: string;
  provider_reference: string;
  amount_xaf: number;
  currency_code: string;
  status: 'initiated' | 'pending_confirmation' | 'confirmed' | 'failed' | 'refunded';
  verification_mode: string;
  receipt_code: string;
  created_at: string;
  confirmed_at: string | null;
}

export interface ShipmentEvent {
  id: number;
  order_id: number;
  location: string;
  status_label: string;
  description: string;
  created_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  shop_id: number;
  product_title: string;
  quantity: number;
  unit_price_xaf: number;
  order_type: 'retail' | 'wholesale';
  seller_payout_xaf: number;
}

export interface Order {
  id: number;
  order_number: string;
  buyer_id: number;
  buyer_name?: string;
  country_code: string;
  shipping_address: string;
  shipping_city: string;
  shipping_mode: string;
  carrier_name: string;
  tracking_number: string;
  subtotal_xaf: number;
  shipping_fee_xaf: number;
  commission_xaf: number;
  total_xaf: number;
  currency_code: string;
  payment_method: string;
  payment_status: string;
  order_status: string;
  created_at: string;
  items?: OrderItem[];
  events?: ShipmentEvent[];
  transactions?: PaymentTransaction[];
}

export interface RfqRequest {
  id: number;
  buyer_id: number;
  buyer_name?: string;
  product_id: number | null;
  shop_id: number | null;
  shop_name?: string | null;
  request_type: 'product_quote' | 'china_sourcing' | 'freight_quote' | 'groupage';
  title: string;
  details: string;
  quantity: number;
  target_country: string;
  transport_mode: 'sea' | 'air' | 'undecided';
  estimated_weight_kg: number;
  estimated_cbm: number;
  status: 'open' | 'quoted' | 'accepted' | 'closed';
  quoted_price_xaf: number | null;
  quoted_notes: string;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  conversation_key: string;
  sender_id: number;
  receiver_id: number;
  sender_name: string;
  receiver_name: string;
  product_id: number | null;
  product_title: string | null;
  body: string;
  attachment_name: string;
  attachment_type: string;
  offer_price_xaf: number | null;
  is_read: number;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  is_read: number;
  created_at: string;
}

export interface PlatformBootstrap {
  user: User | null;
  userShop: Shop | null;
  categories: Category[];
  shops: Shop[];
  products: Product[];
  favoriteIds: number[];
  cartCount: number;
  unreadNotifications: number;
  unreadMessages: number;
  settings: {
    commissionRate: number;
    premiumFeeXaf: number;
    sourcingFeeXaf: number;
    exchangeRates: Record<string, number>;
  };
  paymentMethods: PaymentMethod[];
}
