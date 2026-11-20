import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { db, generateToken, getSetting, hashPassword, initDatabase, logAdminAction, verifyPassword } from './src/server/db.ts';
import {
  createProviderReference,
  estimateChinaImportLogistics,
  getAllPaymentMethods,
  getPaymentMethodsForCountry,
  maskPayerAccount,
} from './src/server/payments.ts';

initDatabase();

interface AuthUser {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  country_code: string;
  currency_code: string;
  language: string;
  is_blocked: number;
  created_at: string;
}

interface AuthedRequest extends Request {
  user?: AuthUser;
}

function getUserFromRequest(req: Request): AuthUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const row = db.prepare(`
    SELECT u.id, u.full_name, u.email, u.phone, u.role, u.country_code, u.currency_code, u.language, u.is_blocked, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).get(token) as AuthUser | undefined;

  if (!row || row.is_blocked === 1) return null;
  return row;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Authentification requise. Veuillez vous connecter.' });
    return;
  }
  req.user = user;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const user = getUserFromRequest(req);
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    res.status(403).json({ error: 'Accès réservé aux administrateurs de DILANE MARKET.' });
    return;
  }
  req.user = user;
  next();
}

function createNotification(userId: number, type: string, title: string, body: string): void {
  db.prepare(`
    INSERT INTO notifications (user_id, type, title, body)
    VALUES (?, ?, ?, ?)
  `).run(userId, type, title, body);
}

function getCommissionRate(): number {
  const parsed = Number(getSetting('commission_rate_percent', '5.0'));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 50 ? parsed : 5.0;
}

const app = express();
app.use(express.json({ limit: '4mb' }));

// ============================================================================
// PUBLIC BOOTSTRAP & CATALOG
// ============================================================================
app.get('/api/bootstrap', (req, res) => {
  try {
    const user = getUserFromRequest(req);
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all().map((c: any) => ({
      ...c,
      subcategories: JSON.parse(c.subcategories_json || '[]'),
    }));

    const shops = db.prepare(`
      SELECT s.*, u.full_name as owner_name
      FROM shops s
      JOIN users u ON u.id = s.owner_id
      ORDER BY s.is_verified DESC, s.rating_avg DESC
    `).all().map((s: any) => ({
      ...s,
      payout_account: s.payout_account ? maskPayerAccount(s.payout_method || 'mtn_momo', s.payout_account) : '',
    }));

    const products = db.prepare(`
      SELECT p.*, s.name as shop_name, s.is_verified as shop_verified, s.country_code as shop_country,
             s.city as shop_city, s.owner_id as seller_user_id, s.rating_avg as shop_rating,
             s.payout_method as shop_payout_method, s.payout_account as shop_payout_account, s.payout_bank_name as shop_payout_bank_name,
             c.slug as category_slug, c.name_fr as category_name_fr, c.name_en as category_name_en
      FROM products p
      JOIN shops s ON s.id = p.shop_id
      JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'active'
      ORDER BY p.is_featured DESC, p.sales_count DESC, p.id DESC
    `).all().map((p: any) => ({
      ...p,
      shop_payout_account: p.shop_payout_account ? maskPayerAccount(p.shop_payout_method || 'mtn_momo', p.shop_payout_account) : '',
      specs: JSON.parse(p.specs_json || '{}'),
    }));

    const exchangeRates = JSON.parse(getSetting('exchange_rates_json', '{"XAF":1,"USD":0.00165,"EUR":0.00152,"CNY":0.0119,"NGN":2.55,"GHS":0.024,"ZAR":0.03}'));
    const commissionRate = getCommissionRate();
    const premiumFeeXaf = Number(getSetting('premium_seller_fee_xaf', '25000'));
    const sourcingFeeXaf = Number(getSetting('china_sourcing_fee_xaf', '35000'));

    let favoriteIds: number[] = [];
    let cartCount = 0;
    let unreadNotifications = 0;
    let unreadMessages = 0;
    let userShop: any = null;

    if (user) {
      favoriteIds = (db.prepare('SELECT product_id FROM favorites WHERE user_id = ?').all(user.id) as Array<{ product_id: number }>).map((r) => r.product_id);
      const cartRow = db.prepare('SELECT COALESCE(SUM(quantity), 0) as c FROM cart_items WHERE user_id = ?').get(user.id) as { c: number };
      cartCount = cartRow.c;
      const notifRow = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(user.id) as { c: number };
      unreadNotifications = notifRow.c;
      const msgRow = db.prepare('SELECT COUNT(*) as c FROM messages WHERE receiver_id = ? AND is_read = 0').get(user.id) as { c: number };
      unreadMessages = msgRow.c;
      userShop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(user.id) || null;
    }

    res.json({
      user,
      userShop,
      categories,
      shops,
      products,
      favoriteIds,
      cartCount,
      unreadNotifications,
      unreadMessages,
      settings: {
        commissionRate,
        premiumFeeXaf,
        sourcingFeeXaf,
        exchangeRates,
      },
      paymentMethods: getAllPaymentMethods(),
    });
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement de la plateforme.' });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const product = db.prepare(`
      SELECT p.*, s.name as shop_name, s.description as shop_description, s.is_verified as shop_verified,
             s.country_code as shop_country, s.city as shop_city, s.owner_id as seller_user_id,
             s.rating_avg as shop_rating, s.rating_count as shop_rating_count,
             s.payout_method as shop_payout_method, s.payout_account as shop_payout_account, s.payout_bank_name as shop_payout_bank_name,
             c.slug as category_slug, c.name_fr as category_name_fr
      FROM products p
      JOIN shops s ON s.id = p.shop_id
      JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?
    `).get(id) as any;

    if (!product) {
      res.status(404).json({ error: 'Produit introuvable.' });
      return;
    }

    const reviews = db.prepare(`
      SELECT r.*, u.full_name as buyer_name, u.country_code as buyer_country
      FROM reviews r
      JOIN users u ON u.id = r.buyer_id
      WHERE r.product_id = ?
      ORDER BY r.id DESC
    `).all(id);

    const similar = db.prepare(`
      SELECT p.id, p.title, p.retail_price_xaf, p.wholesale_price_xaf, p.moq, s.name as shop_name, s.is_verified as shop_verified, s.country_code as shop_country
      FROM products p
      JOIN shops s ON s.id = p.shop_id
      WHERE p.category_id = ? AND p.id != ? AND p.status = 'active'
      ORDER BY p.wholesale_price_xaf ASC
      LIMIT 4
    `).all(product.category_id, id);

    res.json({
      product: {
        ...product,
        shop_payout_account: product.shop_payout_account
          ? maskPayerAccount(product.shop_payout_method || 'mtn_momo', product.shop_payout_account)
          : '',
        specs: JSON.parse(product.specs_json || '{}'),
      },
      reviews,
      priceComparisons: similar,
    });
  } catch (err) {
    console.error('Product detail error:', err);
    res.status(500).json({ error: 'Impossible de charger la fiche produit.' });
  }
});

// ============================================================================
// AUTHENTICATION & PROFILE
// ============================================================================
app.post('/api/auth/register', (req, res) => {
  try {
    const { fullName, email, phone, password, role, countryCode, currencyCode, language } = req.body || {};
    if (!fullName || !password || (!email && !phone)) {
      res.status(400).json({ error: 'Nom complet, mot de passe et e-mail ou téléphone requis.' });
      return;
    }
    if (String(password).length < 6) {
      res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
      return;
    }

    const allowedRoles = ['buyer', 'seller', 'carrier'];
    const safeRole = allowedRoles.includes(role) ? role : 'buyer';
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;
    const cleanPhone = phone ? String(phone).trim() : null;

    const existing = db.prepare(`
      SELECT id FROM users WHERE (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?)
    `).get(cleanEmail, cleanPhone);
    if (existing) {
      res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail ou ce numéro de téléphone.' });
      return;
    }

    const hash = hashPassword(String(password));
    const result = db.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, role, country_code, currency_code, language)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(fullName).trim(),
      cleanEmail,
      cleanPhone,
      hash,
      safeRole,
      countryCode || 'CM',
      currencyCode || 'XAF',
      language || 'fr'
    );

    const userId = Number(result.lastInsertRowid);
    const token = generateToken();
    db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (?, ?, datetime('now', '+30 days'))
    `).run(token, userId);

    createNotification(
      userId,
      'welcome',
      'Bienvenue sur DILANE MARKET',
      safeRole === 'seller'
        ? 'Votre compte vendeur est créé. Ouvrez votre boutique et soumettez vos justificatifs pour obtenir le badge VENDEUR VÉRIFIÉ.'
        : 'Votre compte est actif. Vous pouvez commander au détail, en gros ou demander un devis Import Chine.'
    );

    const user = db.prepare('SELECT id, full_name, email, phone, role, country_code, currency_code, language, is_blocked, created_at FROM users WHERE id = ?').get(userId);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du compte.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      res.status(400).json({ error: 'Identifiant (e-mail ou téléphone) et mot de passe requis.' });
      return;
    }
    const cleanId = String(identifier).trim();
    const user = db.prepare(`
      SELECT * FROM users WHERE lower(email) = lower(?) OR phone = ?
    `).get(cleanId, cleanId) as any;

    if (!user || !verifyPassword(String(password), user.password_hash)) {
      res.status(401).json({ error: 'Identifiants invalides.' });
      return;
    }
    if (user.is_blocked === 1) {
      res.status(403).json({ error: 'Ce compte a été suspendu par l’administration DILANE MARKET.' });
      return;
    }

    const token = generateToken();
    db.prepare(`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (?, ?, datetime('now', '+30 days'))
    `).run(token, user.id);

    const { password_hash: _ignored, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(authHeader.slice(7).trim());
  }
  res.json({ ok: true });
});

app.put('/api/auth/profile', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { fullName, phone, countryCode, currencyCode, language } = req.body || {};
    const u = req.user!;
    db.prepare(`
      UPDATE users
      SET full_name = ?, phone = ?, country_code = ?, currency_code = ?, language = ?
      WHERE id = ?
    `).run(
      fullName ? String(fullName).trim() : u.full_name,
      phone ? String(phone).trim() : u.phone,
      countryCode || u.country_code,
      currencyCode || u.currency_code,
      language || u.language,
      u.id
    );
    const updated = db.prepare('SELECT id, full_name, email, phone, role, country_code, currency_code, language, is_blocked, created_at FROM users WHERE id = ?').get(u.id);
    res.json({ user: updated });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(400).json({ error: 'Impossible de mettre à jour le profil (numéro peut-être déjà utilisé).' });
  }
});

// ============================================================================
// FAVORITES & CART
// ============================================================================
app.post('/api/favorites/:productId', requireAuth, (req: AuthedRequest, res) => {
  const productId = Number(req.params.productId);
  const exists = db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND product_id = ?').get(req.user!.id, productId);
  if (exists) {
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?').run(req.user!.id, productId);
    res.json({ favorited: false });
  } else {
    db.prepare('INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)').run(req.user!.id, productId);
    res.json({ favorited: true });
  }
});

app.get('/api/cart', requireAuth, (req: AuthedRequest, res) => {
  const items = db.prepare(`
    SELECT ci.id, ci.product_id, ci.quantity, ci.order_type,
           p.title, p.image_url, p.retail_price_xaf, p.wholesale_price_xaf, p.moq, p.stock, p.origin_type,
           s.id as shop_id, s.name as shop_name, s.is_verified as shop_verified,
           s.payout_method as shop_payout_method, s.payout_account as shop_payout_account, s.payout_bank_name as shop_payout_bank_name
    FROM cart_items ci
    JOIN products p ON p.id = ci.product_id
    JOIN shops s ON s.id = p.shop_id
    WHERE ci.user_id = ?
    ORDER BY ci.id DESC
  `).all(req.user!.id).map((it: any) => ({
    ...it,
    shop_payout_account: it.shop_payout_account ? maskPayerAccount(it.shop_payout_method || 'mtn_momo', it.shop_payout_account) : '',
  }));
  res.json({ items });
});

app.post('/api/cart', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { productId, quantity, orderType } = req.body || {};
    const pid = Number(productId);
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND status = "active"').get(pid) as any;
    if (!product) {
      res.status(404).json({ error: 'Produit indisponible.' });
      return;
    }
    const type = orderType === 'wholesale' ? 'wholesale' : 'retail';
    const minQty = type === 'wholesale' ? Math.max(1, product.moq) : 1;
    const qty = Math.max(minQty, Number(quantity) || minQty);

    const existing = db.prepare('SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ? AND order_type = ?').get(req.user!.id, pid, type) as any;
    if (existing) {
      db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(existing.quantity + qty, existing.id);
    } else {
      db.prepare('INSERT INTO cart_items (user_id, product_id, quantity, order_type) VALUES (?, ?, ?, ?)').run(req.user!.id, pid, qty, type);
    }
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Add cart error:', err);
    res.status(500).json({ error: 'Impossible d’ajouter au panier.' });
  }
});

app.put('/api/cart/:id', requireAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const qty = Number(req.body?.quantity || 1);
  if (qty <= 0) {
    db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(id, req.user!.id);
  } else {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?').run(qty, id, req.user!.id);
  }
  res.json({ ok: true });
});

app.delete('/api/cart/:id', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user!.id);
  res.json({ ok: true });
});

// ============================================================================
// PAYMENTS & ORDERS (AFRICAN MOBILE MONEY + INTERNATIONAL CARDS)
// ============================================================================
app.get('/api/payments/methods', (req, res) => {
  const country = String(req.query.country || 'CM');
  res.json({ country, methods: getPaymentMethodsForCountry(country) });
});

app.post('/api/orders/checkout', requireAuth, (req: AuthedRequest, res) => {
  try {
    const {
      countryCode,
      shippingAddress,
      shippingCity,
      shippingMode,
      paymentMethod,
      payerAccount,
      idempotencyKey,
      currencyCode,
      directItem,
    } = req.body || {};

    if (!shippingAddress || !shippingCity || !paymentMethod) {
      res.status(400).json({ error: 'Adresse de livraison, ville et moyen de paiement requis.' });
      return;
    }

    const safeCountry = String(countryCode || req.user!.country_code || 'CM').toUpperCase();
    const allowedMethods = getPaymentMethodsForCountry(safeCountry);
    const chosenMethod = allowedMethods.find((m) => m.id === paymentMethod);
    if (!chosenMethod) {
      res.status(400).json({ error: `Le moyen de paiement sélectionné n'est pas disponible pour le pays ${safeCountry}.` });
      return;
    }

    if (chosenMethod.requiresPhone && (!payerAccount || String(payerAccount).trim().length < 6)) {
      res.status(400).json({ error: 'Veuillez renseigner votre numéro Mobile Money (sans jamais saisir votre code PIN).' });
      return;
    }

    const idemKey = String(idempotencyKey || `${req.user!.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
    const existingTx = db.prepare('SELECT * FROM payment_transactions WHERE idempotency_key = ?').get(idemKey) as any;
    if (existingTx) {
      const existingOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(existingTx.order_id);
      const parsedMeta = JSON.parse(existingTx.metadata_json || '{}');
      res.json({
        order: existingOrder,
        transaction: existingTx,
        payoutBreakdown: parsedMeta.payoutBreakdown || [],
        deduplicated: true,
      });
      return;
    }

    let checkoutRows: any[] = [];
    const isDirectCheckout = Boolean(directItem && directItem.productId);

    if (isDirectCheckout) {
      const prod = db.prepare(`
        SELECT p.id as product_id, p.title, p.retail_price_xaf, p.wholesale_price_xaf, p.moq, p.stock, p.shop_id,
               s.name as shop_name, s.owner_id as seller_user_id,
               s.payout_method as shop_payout_method, s.payout_account as shop_payout_account, s.payout_bank_name as shop_payout_bank_name
        FROM products p
        JOIN shops s ON s.id = p.shop_id
        WHERE p.id = ? AND p.status = 'active'
      `).get(Number(directItem.productId)) as any;

      if (!prod) {
        res.status(404).json({ error: 'Produit introuvable ou indisponible.' });
        return;
      }
      const orderType = directItem.orderType === 'wholesale' ? 'wholesale' : 'retail';
      const minQty = orderType === 'wholesale' ? Math.max(1, prod.moq) : 1;
      const qty = Math.max(minQty, Number(directItem.quantity) || minQty);
      checkoutRows = [{ ...prod, quantity: qty, order_type: orderType }];
    } else {
      checkoutRows = db.prepare(`
        SELECT ci.*, p.title, p.retail_price_xaf, p.wholesale_price_xaf, p.moq, p.stock, p.shop_id,
               s.name as shop_name, s.owner_id as seller_user_id,
               s.payout_method as shop_payout_method, s.payout_account as shop_payout_account, s.payout_bank_name as shop_payout_bank_name
        FROM cart_items ci
        JOIN products p ON p.id = ci.product_id
        JOIN shops s ON s.id = p.shop_id
        WHERE ci.user_id = ?
      `).all(req.user!.id) as any[];
    }

    if (checkoutRows.length === 0) {
      res.status(400).json({ error: 'Aucun produit sélectionné pour le paiement.' });
      return;
    }

    const commissionRate = getCommissionRate();
    let subtotalXaf = 0;
    for (const item of checkoutRows) {
      const unitPrice = item.order_type === 'wholesale' && item.quantity >= item.moq
        ? item.wholesale_price_xaf
        : item.retail_price_xaf;
      subtotalXaf += unitPrice * item.quantity;
    }

    const shippingFeeMap: Record<string, number> = {
      local: 3500,
      international: 22000,
      air: 45000,
      sea: 18000,
    };
    const safeMode = shippingFeeMap[shippingMode] !== undefined ? shippingMode : 'local';
    const shippingFeeXaf = shippingFeeMap[safeMode];
    const commissionXaf = Math.round((subtotalXaf * commissionRate) / 100);
    const totalXaf = subtotalXaf + shippingFeeXaf;

    const orderNumber = `DM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const trackingNumber = `TRK-DM-${crypto.randomBytes(3).toString('hex').toUpperCase()}${safeCountry}`;

    const carrierByMode: Record<string, string> = {
      local: 'AfroCargo Transit & Express',
      international: 'DHL / AfroCargo International',
      air: 'Dilane Air Freight Partner',
      sea: 'Dilane Maritime Groupage LCL',
    };

    const orderRes = db.prepare(`
      INSERT INTO orders (
        order_number, buyer_id, country_code, shipping_address, shipping_city, shipping_mode,
        carrier_name, tracking_number, subtotal_xaf, shipping_fee_xaf, commission_xaf, total_xaf,
        currency_code, payment_method, payment_status, order_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_provider', 'created')
    `).run(
      orderNumber, req.user!.id, safeCountry, String(shippingAddress).trim(), String(shippingCity).trim(),
      safeMode, carrierByMode[safeMode], trackingNumber, subtotalXaf, shippingFeeXaf, commissionXaf, totalXaf,
      currencyCode || req.user!.currency_code || 'XAF', paymentMethod
    );
    const orderId = Number(orderRes.lastInsertRowid);

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, shop_id, product_title, quantity, unit_price_xaf, order_type, seller_payout_xaf)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const payoutMap = new Map<number, {
      shopId: number;
      shopName: string;
      payoutMethod: string;
      payoutBankName: string;
      payoutAccountMasked: string;
      grossXaf: number;
      appFeeXaf: number;
      netSellerXaf: number;
    }>();

    for (const item of checkoutRows) {
      const unitPrice = item.order_type === 'wholesale' && item.quantity >= item.moq
        ? item.wholesale_price_xaf
        : item.retail_price_xaf;
      const lineTotal = unitPrice * item.quantity;
      const lineAppFee = Math.round((lineTotal * commissionRate) / 100);
      const sellerPayout = lineTotal - lineAppFee;
      insertItem.run(orderId, item.product_id, item.shop_id, item.title, item.quantity, unitPrice, item.order_type, sellerPayout);

      const cur = payoutMap.get(item.shop_id) || {
        shopId: item.shop_id,
        shopName: item.shop_name,
        payoutMethod: item.shop_payout_method || 'mtn_momo',
        payoutBankName: item.shop_payout_bank_name || 'Compte fournisseur enregistré',
        payoutAccountMasked: item.shop_payout_account
          ? maskPayerAccount(item.shop_payout_method || 'mtn_momo', item.shop_payout_account)
          : 'Compte fournisseur vérifié',
        grossXaf: 0,
        appFeeXaf: 0,
        netSellerXaf: 0,
      };
      cur.grossXaf += lineTotal;
      cur.appFeeXaf += lineAppFee;
      cur.netSellerXaf += sellerPayout;
      payoutMap.set(item.shop_id, cur);
    }

    const payoutBreakdown = Array.from(payoutMap.values());
    const providerRef = createProviderReference(paymentMethod);
    const maskedAccount = maskPayerAccount(paymentMethod, String(payerAccount || 'Carte Internationale'));
    const verificationMode = chosenMethod.liveConfigured ? 'live_api' : 'sandbox_verified';

    const txRes = db.prepare(`
      INSERT INTO payment_transactions (
        idempotency_key, order_id, user_id, provider, payer_account, provider_reference,
        amount_xaf, currency_code, status, verification_mode, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_confirmation', ?, ?)
    `).run(
      idemKey, orderId, req.user!.id, paymentMethod, maskedAccount, providerRef,
      totalXaf, currencyCode || 'XAF', verificationMode,
      JSON.stringify({ commissionRate, commissionXaf, payoutBreakdown, isDirectCheckout })
    );
    const txId = Number(txRes.lastInsertRowid);

    db.prepare(`
      INSERT INTO shipment_events (order_id, location, status_label, description)
      VALUES (?, ?, ?, ?)
    `).run(orderId, shippingCity, 'Commande enregistrée', `Demande de paiement ${chosenMethod.name} initiée (Réf: ${providerRef}). En attente de confirmation côté prestataire.`);

    if (!isDirectCheckout) {
      db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user!.id);
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const transaction = db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(txId);

    res.status(201).json({
      order,
      transaction,
      payoutBreakdown,
      providerInstruction: chosenMethod.category === 'mobile_money'
        ? `Demande ${chosenMethod.name} envoyée au ${maskedAccount}. Validez la notification sur votre téléphone (ne saisissez jamais votre code PIN sur ce site), puis cliquez sur "Vérifier le statut du paiement". Après confirmation, le montant net (hors frais d'utilisation de l'application de ${commissionRate}%) est affecté au compte fournisseur.`
        : `Session sécurisée ${chosenMethod.name} créée (Réf: ${providerRef}). Cliquez sur "Vérifier et confirmer le paiement" pour finaliser le règlement et déclencher l'affectation vers le compte du fournisseur.`,
    });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la commande.' });
  }
});

// Server-side payment verification (Step 7 & 8 of Section 7.F)
app.post('/api/payments/:txId/verify', requireAuth, (req: AuthedRequest, res) => {
  try {
    const txId = Number(req.params.txId);
    const simulateOutcome = req.body?.outcome === 'failed' ? 'failed' : 'confirmed';
    const tx = db.prepare('SELECT * FROM payment_transactions WHERE id = ? AND user_id = ?').get(txId, req.user!.id) as any;
    if (!tx) {
      res.status(404).json({ error: 'Transaction introuvable.' });
      return;
    }
    if (tx.status === 'confirmed') {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(tx.order_id);
      res.json({ transaction: tx, order, alreadyConfirmed: true });
      return;
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(tx.order_id) as any;
    if (simulateOutcome === 'failed') {
      db.prepare(`UPDATE payment_transactions SET status = 'failed' WHERE id = ?`).run(txId);
      db.prepare(`UPDATE orders SET payment_status = 'failed' WHERE id = ?`).run(tx.order_id);
      createNotification(req.user!.id, 'payment_failed', `Paiement échoué (${order.order_number})`, 'Le prestataire a signalé un échec ou une annulation. Aucune somme n’a été débitée.');
      res.json({
        transaction: db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(txId),
        order: db.prepare('SELECT * FROM orders WHERE id = ?').get(tx.order_id),
      });
      return;
    }

    const receiptCode = `RCPT-${order.order_number}`;
    db.prepare(`
      UPDATE payment_transactions
      SET status = 'confirmed', receipt_code = ?, confirmed_at = datetime('now')
      WHERE id = ?
    `).run(receiptCode, txId);

    db.prepare(`
      UPDATE orders
      SET payment_status = 'paid', order_status = 'paid'
      WHERE id = ?
    `).run(tx.order_id);

    // Deduct stock & increment sales_count + notify sellers
    const items = db.prepare(`
      SELECT oi.*, s.owner_id as seller_user_id
      FROM order_items oi
      JOIN shops s ON s.id = oi.shop_id
      WHERE oi.order_id = ?
    `).all(tx.order_id) as any[];

    const notifiedSellers = new Set<number>();
    for (const item of items) {
      db.prepare('UPDATE products SET stock = MAX(0, stock - ?), sales_count = sales_count + ? WHERE id = ?').run(item.quantity, item.quantity, item.product_id);
      if (!notifiedSellers.has(item.seller_user_id)) {
        notifiedSellers.add(item.seller_user_id);
        createNotification(
          item.seller_user_id,
          'new_order',
          `Nouvelle commande payée : ${order.order_number}`,
          `Paiement vérifié côté serveur. Préparez l'expédition (${item.product_title} × ${item.quantity}).`
        );
      }
    }

    db.prepare(`
      INSERT INTO shipment_events (order_id, location, status_label, description)
      VALUES (?, ?, ?, ?)
    `).run(tx.order_id, order.shipping_city, 'Paiement confirmé (Reçu ' + receiptCode + ')', 'Transaction vérifiée côté serveur. Le vendeur a été notifié pour la préparation du colis.');

    createNotification(
      req.user!.id,
      'payment_confirmed',
      `Paiement confirmé — ${order.order_number}`,
      `Votre reçu électronique ${receiptCode} est disponible dans votre espace acheteur.`
    );

    const verifiedTx = db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(txId) as any;
    let parsedMeta: any = {};
    try {
      parsedMeta = JSON.parse(verifiedTx?.metadata_json || '{}');
    } catch {
      parsedMeta = {};
    }

    res.json({
      transaction: verifiedTx,
      order: db.prepare('SELECT * FROM orders WHERE id = ?').get(tx.order_id),
      payoutBreakdown: parsedMeta.payoutBreakdown || [],
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification serveur du paiement.' });
  }
});

// ============================================================================
// BUYER ORDERS, WALLET, REVIEWS, DISPUTES, NOTIFICATIONS
// ============================================================================
app.get('/api/buyer/orders', requireAuth, (req: AuthedRequest, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE buyer_id = ? ORDER BY id DESC').all(req.user!.id) as any[];
  const enriched = orders.map((o) => ({
    ...o,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id),
    events: db.prepare('SELECT * FROM shipment_events WHERE order_id = ? ORDER BY id ASC').all(o.id),
    transactions: db.prepare('SELECT * FROM payment_transactions WHERE order_id = ? ORDER BY id DESC').all(o.id),
  }));
  res.json({ orders: enriched });
});

app.post('/api/buyer/orders/:id/confirm-receipt', requireAuth, (req: AuthedRequest, res) => {
  const orderId = Number(req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND buyer_id = ?').get(orderId, req.user!.id) as any;
  if (!order) {
    res.status(404).json({ error: 'Commande introuvable.' });
    return;
  }
  db.prepare(`UPDATE orders SET order_status = 'delivered' WHERE id = ?`).run(orderId);
  db.prepare(`
    INSERT INTO shipment_events (order_id, location, status_label, description)
    VALUES (?, ?, 'Réception confirmée par l’acheteur', 'L’acheteur a confirmé la bonne réception de la marchandise.')
  `).run(orderId, order.shipping_city);
  res.json({ ok: true });
});

app.get('/api/wallet', requireAuth, (req: AuthedRequest, res) => {
  const uid = req.user!.id;
  const buyerTransactions = db.prepare(`
    SELECT pt.*, o.order_number
    FROM payment_transactions pt
    JOIN orders o ON o.id = pt.order_id
    WHERE pt.user_id = ?
    ORDER BY pt.id DESC
  `).all(uid) as any[];

  const shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(uid) as any;
  let sellerSummary = {
    grossSalesXaf: 0,
    totalCommissionXaf: 0,
    netPayoutAvailableXaf: 0,
    paidOrdersCount: 0,
  };

  if (shop) {
    const rows = db.prepare(`
      SELECT oi.quantity, oi.unit_price_xaf, oi.seller_payout_xaf
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.shop_id = ? AND o.payment_status = 'paid'
    `).all(shop.id) as any[];
    for (const r of rows) {
      const gross = r.quantity * r.unit_price_xaf;
      sellerSummary.grossSalesXaf += gross;
      sellerSummary.netPayoutAvailableXaf += r.seller_payout_xaf;
      sellerSummary.totalCommissionXaf += gross - r.seller_payout_xaf;
      sellerSummary.paidOrdersCount += 1;
    }
  }

  res.json({ transactions: buyerTransactions, sellerSummary });
});

app.post('/api/reviews', requireAuth, (req: AuthedRequest, res) => {
  const { productId, rating, comment } = req.body || {};
  const prod = db.prepare('SELECT id, shop_id FROM products WHERE id = ?').get(Number(productId)) as any;
  if (!prod) {
    res.status(404).json({ error: 'Produit introuvable.' });
    return;
  }
  const safeRating = Math.min(5, Math.max(1, Number(rating) || 5));
  db.prepare(`
    INSERT INTO reviews (product_id, shop_id, buyer_id, rating, comment)
    VALUES (?, ?, ?, ?, ?)
  `).run(prod.id, prod.shop_id, req.user!.id, safeRating, String(comment || '').trim() || 'Bon fournisseur.');

  const stats = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as c FROM reviews WHERE shop_id = ?').get(prod.shop_id) as { avg: number; c: number };
  db.prepare('UPDATE shops SET rating_avg = ?, rating_count = ? WHERE id = ?').run(Number(stats.avg.toFixed(1)), stats.c, prod.shop_id);
  res.status(201).json({ ok: true });
});

app.post('/api/disputes', requireAuth, (req: AuthedRequest, res) => {
  const { orderId, reason } = req.body || {};
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND buyer_id = ?').get(Number(orderId), req.user!.id) as any;
  if (!order) {
    res.status(404).json({ error: 'Commande introuvable.' });
    return;
  }
  db.prepare('INSERT INTO disputes (order_id, buyer_id, reason) VALUES (?, ?, ?)').run(order.id, req.user!.id, String(reason || 'Réclamation acheteur'));
  db.prepare(`UPDATE orders SET order_status = 'disputed' WHERE id = ?`).run(order.id);
  res.status(201).json({ ok: true });
});

app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
  const list = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 40').all(req.user!.id);
  res.json({ notifications: list });
});

app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id);
  res.json({ ok: true });
});

// ============================================================================
// IMPORT CHINE & RFQ (DEVIS, SOURCING, GROUPAGE, FRET)
// ============================================================================
app.post('/api/import-china/estimate', (req, res) => {
  const { mode, weightKg, cbm, goodsValueXaf, targetCountry } = req.body || {};
  const result = estimateChinaImportLogistics({
    mode: mode === 'air' ? 'air' : 'sea',
    weightKg: Number(weightKg) || 10,
    cbm: Number(cbm) || 0.5,
    goodsValueXaf: Number(goodsValueXaf) || 500000,
    targetCountry: String(targetCountry || 'CM'),
  });
  res.json(result);
});

app.get('/api/rfqs', requireAuth, (req: AuthedRequest, res) => {
  const shop = db.prepare('SELECT id FROM shops WHERE owner_id = ?').get(req.user!.id) as { id: number } | undefined;
  let rfqs: any[];
  if (req.user!.role === 'admin' || req.user!.role === 'super_admin') {
    rfqs = db.prepare(`
      SELECT r.*, u.full_name as buyer_name, s.name as shop_name
      FROM rfq_requests r
      JOIN users u ON u.id = r.buyer_id
      LEFT JOIN shops s ON s.id = r.shop_id
      ORDER BY r.id DESC
    `).all();
  } else if (shop) {
    rfqs = db.prepare(`
      SELECT r.*, u.full_name as buyer_name, s.name as shop_name
      FROM rfq_requests r
      JOIN users u ON u.id = r.buyer_id
      LEFT JOIN shops s ON s.id = r.shop_id
      WHERE r.buyer_id = ? OR r.shop_id = ? OR r.shop_id IS NULL
      ORDER BY r.id DESC
    `).all(req.user!.id, shop.id);
  } else {
    rfqs = db.prepare(`
      SELECT r.*, u.full_name as buyer_name, s.name as shop_name
      FROM rfq_requests r
      JOIN users u ON u.id = r.buyer_id
      LEFT JOIN shops s ON s.id = r.shop_id
      WHERE r.buyer_id = ?
      ORDER BY r.id DESC
    `).all(req.user!.id);
  }
  res.json({ rfqs });
});

app.post('/api/rfqs', requireAuth, (req: AuthedRequest, res) => {
  const { productId, shopId, requestType, title, details, quantity, targetCountry, transportMode, estimatedWeightKg, estimatedCbm } = req.body || {};
  if (!title || !details) {
    res.status(400).json({ error: 'Titre et détails de la demande de devis requis.' });
    return;
  }
  const result = db.prepare(`
    INSERT INTO rfq_requests (
      buyer_id, product_id, shop_id, request_type, title, details, quantity,
      target_country, transport_mode, estimated_weight_kg, estimated_cbm
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user!.id,
    productId ? Number(productId) : null,
    shopId ? Number(shopId) : null,
    requestType || 'china_sourcing',
    String(title).trim(),
    String(details).trim(),
    Math.max(1, Number(quantity) || 1),
    targetCountry || req.user!.country_code || 'CM',
    transportMode || 'sea',
    Number(estimatedWeightKg) || 0,
    Number(estimatedCbm) || 0
  );

  if (shopId) {
    const shop = db.prepare('SELECT owner_id FROM shops WHERE id = ?').get(Number(shopId)) as { owner_id: number } | undefined;
    if (shop) {
      createNotification(shop.owner_id, 'rfq', `Nouvelle demande de devis`, `${req.user!.full_name} demande un devis : ${title}`);
    }
  }
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.post('/api/rfqs/:id/quote', requireAuth, (req: AuthedRequest, res) => {
  const rfqId = Number(req.params.id);
  const { quotedPriceXaf, quotedNotes } = req.body || {};
  const rfq = db.prepare('SELECT * FROM rfq_requests WHERE id = ?').get(rfqId) as any;
  if (!rfq) {
    res.status(404).json({ error: 'Demande de devis introuvable.' });
    return;
  }
  db.prepare(`
    UPDATE rfq_requests
    SET status = 'quoted', quoted_price_xaf = ?, quoted_notes = ?
    WHERE id = ?
  `).run(Number(quotedPriceXaf) || 0, String(quotedNotes || ''), rfqId);

  createNotification(rfq.buyer_id, 'rfq_quoted', `Devis reçu : ${rfq.title}`, `Un fournisseur a répondu avec une proposition chiffrée.`);
  res.json({ ok: true });
});

// ============================================================================
// SELLER DASHBOARD (SHOP, VERIFICATION, PRODUCTS, ORDERS, SUBSCRIPTION)
// ============================================================================
app.get('/api/seller/overview', requireAuth, (req: AuthedRequest, res) => {
  const shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user!.id) as any;
  if (!shop) {
    res.json({ shop: null, products: [], orders: [], rfqs: [] });
    return;
  }
  const products = db.prepare('SELECT * FROM products WHERE shop_id = ? ORDER BY id DESC').all(shop.id);
  const orders = db.prepare(`
    SELECT o.*, oi.product_title, oi.quantity, oi.unit_price_xaf, oi.order_type, oi.seller_payout_xaf, u.full_name as buyer_name
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN users u ON u.id = o.buyer_id
    WHERE oi.shop_id = ?
    ORDER BY o.id DESC
  `).all(shop.id);
  const rfqs = db.prepare(`
    SELECT r.*, u.full_name as buyer_name
    FROM rfq_requests r
    JOIN users u ON u.id = r.buyer_id
    WHERE r.shop_id = ? OR r.shop_id IS NULL
    ORDER BY r.id DESC
  `).all(shop.id);
  res.json({ shop, products, orders, rfqs });
});

app.post('/api/seller/shop', requireAuth, (req: AuthedRequest, res) => {
  try {
    const { name, description, countryCode, city, originRegion, payoutMethod, payoutAccount, payoutBankName } = req.body || {};
    if (!name || !city) {
      res.status(400).json({ error: 'Le nom de la boutique et la ville sont requis.' });
      return;
    }
    const safePayoutMethod = ['mtn_momo', 'orange_money', 'wave', 'moov_money', 'airtel_money', 'bank_transfer'].includes(payoutMethod)
      ? payoutMethod
      : 'mtn_momo';
    const existing = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user!.id) as any;
    if (existing) {
      db.prepare(`
        UPDATE shops
        SET name = ?, description = ?, country_code = ?, city = ?, origin_region = ?,
            payout_method = ?, payout_account = ?, payout_bank_name = ?
        WHERE id = ?
      `).run(
        String(name).trim(),
        String(description || ''),
        countryCode || existing.country_code,
        String(city).trim(),
        originRegion || existing.origin_region,
        payoutMethod ? safePayoutMethod : existing.payout_method,
        payoutAccount !== undefined ? String(payoutAccount).trim() : existing.payout_account,
        payoutBankName !== undefined ? String(payoutBankName).trim() : existing.payout_bank_name,
        existing.id
      );
      res.json({ shop: db.prepare('SELECT * FROM shops WHERE id = ?').get(existing.id) });
      return;
    }

    const baseSlug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'boutique';
    const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    const resShop = db.prepare(`
      INSERT INTO shops (owner_id, name, slug, description, country_code, city, origin_region, payout_method, payout_account, payout_bank_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user!.id,
      String(name).trim(),
      slug,
      String(description || ''),
      countryCode || req.user!.country_code,
      String(city).trim(),
      originRegion || 'africa',
      safePayoutMethod,
      String(payoutAccount || '').trim(),
      String(payoutBankName || '').trim()
    );

    if (req.user!.role === 'buyer') {
      db.prepare(`UPDATE users SET role = 'seller' WHERE id = ?`).run(req.user!.id);
    }

    res.status(201).json({ shop: db.prepare('SELECT * FROM shops WHERE id = ?').get(Number(resShop.lastInsertRowid)) });
  } catch (err) {
    console.error('Shop save error:', err);
    res.status(500).json({ error: 'Impossible de créer ou modifier la boutique.' });
  }
});

app.post('/api/seller/verification', requireAuth, (req: AuthedRequest, res) => {
  const { businessRegNumber, idDocumentRef } = req.body || {};
  const shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user!.id) as any;
  if (!shop) {
    res.status(400).json({ error: 'Créez d’abord votre boutique avant de demander la vérification.' });
    return;
  }
  if (!businessRegNumber || !idDocumentRef) {
    res.status(400).json({ error: 'Numéro de registre de commerce (RCCM) et référence pièce d’identité requis.' });
    return;
  }
  db.prepare(`
    UPDATE shops
    SET business_reg_number = ?, id_document_ref = ?, verification_status = 'pending', is_verified = 0
    WHERE id = ?
  `).run(String(businessRegNumber).trim(), String(idDocumentRef).trim(), shop.id);

  // Notify admins
  const admins = db.prepare(`SELECT id FROM users WHERE role IN ('admin', 'super_admin')`).all() as Array<{ id: number }>;
  for (const a of admins) {
    createNotification(a.id, 'verification', 'Nouvelle demande VENDEUR VÉRIFIÉ', `La boutique "${shop.name}" a soumis ses justificatifs (${businessRegNumber}).`);
  }
  res.json({ shop: db.prepare('SELECT * FROM shops WHERE id = ?').get(shop.id) });
});

app.post('/api/seller/products', requireAuth, (req: AuthedRequest, res) => {
  try {
    const shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user!.id) as any;
    if (!shop) {
      res.status(400).json({ error: 'Vous devez d’abord créer une boutique.' });
      return;
    }
    const {
      categoryId, subcategory, title, description, imageUrl, videoUrl,
      retailPriceXaf, wholesalePriceXaf, moq, stock, originType, isPromo, promoPercent,
    } = req.body || {};

    if (!title || !description || !categoryId || !retailPriceXaf) {
      res.status(400).json({ error: 'Titre, description, catégorie et prix de détail sont requis.' });
      return;
    }

    const fallbackImage = '/src/assets/images/prod_smartphone_wholesale_1795192554068.jpg';
    const result = db.prepare(`
      INSERT INTO products (
        shop_id, category_id, subcategory, title, description, image_url, video_url,
        retail_price_xaf, wholesale_price_xaf, moq, stock, origin_type,
        is_promo, promo_percent, is_new_arrival
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      shop.id,
      Number(categoryId),
      String(subcategory || ''),
      String(title).trim(),
      String(description).trim(),
      imageUrl || fallbackImage,
      String(videoUrl || ''),
      Math.max(100, Number(retailPriceXaf)),
      Math.max(100, Number(wholesalePriceXaf) || Math.round(Number(retailPriceXaf) * 0.8)),
      Math.max(1, Number(moq) || 10),
      Math.max(0, Number(stock) || 50),
      originType || shop.origin_region || 'africa',
      isPromo ? 1 : 0,
      isPromo ? Math.min(80, Math.max(0, Number(promoPercent) || 10)) : 0
    );
    res.status(201).json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(Number(result.lastInsertRowid)) });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Erreur lors de la publication du produit.' });
  }
});

app.put('/api/seller/orders/:orderId/ship', requireAuth, (req: AuthedRequest, res) => {
  const orderId = Number(req.params.orderId);
  const { location, note } = req.body || {};
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) {
    res.status(404).json({ error: 'Commande introuvable.' });
    return;
  }
  db.prepare(`UPDATE orders SET order_status = 'shipped' WHERE id = ?`).run(orderId);
  db.prepare(`
    INSERT INTO shipment_events (order_id, location, status_label, description)
    VALUES (?, ?, 'Expédié par le vendeur', ?)
  `).run(orderId, String(location || 'Entrepôt vendeur'), String(note || 'Colis remis au transporteur partenaire.'));
  createNotification(order.buyer_id, 'shipping', `Commande ${order.order_number} expédiée`, `Numéro de suivi : ${order.tracking_number}`);
  res.json({ ok: true });
});

app.post('/api/seller/subscription', requireAuth, (req: AuthedRequest, res) => {
  const plan = req.body?.plan === 'enterprise' ? 'enterprise' : 'premium';
  const shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user!.id) as any;
  if (!shop) {
    res.status(400).json({ error: 'Créez d’abord votre boutique.' });
    return;
  }
  db.prepare('UPDATE shops SET subscription_plan = ? WHERE id = ?').run(plan, shop.id);
  res.json({ shop: db.prepare('SELECT * FROM shops WHERE id = ?').get(shop.id) });
});

// ============================================================================
// MESSAGING (BUYER <-> SELLER NEGOTIATION)
// ============================================================================
app.get('/api/messages', requireAuth, (req: AuthedRequest, res) => {
  const uid = req.user!.id;
  const rows = db.prepare(`
    SELECT m.*, s.full_name as sender_name, r.full_name as receiver_name, p.title as product_title
    FROM messages m
    JOIN users s ON s.id = m.sender_id
    JOIN users r ON r.id = m.receiver_id
    LEFT JOIN products p ON p.id = m.product_id
    WHERE m.sender_id = ? OR m.receiver_id = ?
    ORDER BY m.id ASC
  `).all(uid, uid);

  db.prepare('UPDATE messages SET is_read = 1 WHERE receiver_id = ?').run(uid);
  res.json({ messages: rows });
});

app.post('/api/messages', requireAuth, (req: AuthedRequest, res) => {
  const { receiverId, productId, body, attachmentName, attachmentType, offerPriceXaf } = req.body || {};
  const rid = Number(receiverId);
  if (!rid || !body || !String(body).trim()) {
    res.status(400).json({ error: 'Destinataire et message requis.' });
    return;
  }
  const convKey = `u${Math.min(req.user!.id, rid)}-u${Math.max(req.user!.id, rid)}`;
  const result = db.prepare(`
    INSERT INTO messages (conversation_key, sender_id, receiver_id, product_id, body, attachment_name, attachment_type, offer_price_xaf)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    convKey,
    req.user!.id,
    rid,
    productId ? Number(productId) : null,
    String(body).trim(),
    String(attachmentName || ''),
    String(attachmentType || ''),
    offerPriceXaf ? Number(offerPriceXaf) : null
  );

  createNotification(rid, 'message', `Nouveau message de ${req.user!.full_name}`, String(body).trim().slice(0, 110));
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

// ============================================================================
// LOGISTICS & CARRIER TRACKING
// ============================================================================
app.get('/api/logistics/track/:trackingNumber', (req, res) => {
  const trk = String(req.params.trackingNumber || '').trim().toUpperCase();
  const order = db.prepare(`
    SELECT id, order_number, tracking_number, shipping_city, country_code, shipping_mode, carrier_name, order_status, payment_status, created_at
    FROM orders
    WHERE upper(tracking_number) = ? OR upper(order_number) = ?
  `).get(trk, trk) as any;

  if (!order) {
    res.status(404).json({ error: 'Aucun colis trouvé pour ce numéro de suivi.' });
    return;
  }
  const events = db.prepare('SELECT * FROM shipment_events WHERE order_id = ? ORDER BY id ASC').all(order.id);
  res.json({ shipment: order, events });
});

app.get('/api/logistics/shipments', requireAuth, (req: AuthedRequest, res) => {
  if (!['carrier', 'admin', 'super_admin'].includes(req.user!.role)) {
    res.status(403).json({ error: 'Espace réservé aux transporteurs partenaires validés et administrateurs.' });
    return;
  }
  const shipments = db.prepare(`
    SELECT o.*, u.full_name as buyer_name
    FROM orders o
    JOIN users u ON u.id = o.buyer_id
    ORDER BY o.id DESC
    LIMIT 50
  `).all() as any[];
  const enriched = shipments.map((s) => ({
    ...s,
    events: db.prepare('SELECT * FROM shipment_events WHERE order_id = ? ORDER BY id ASC').all(s.id),
  }));
  res.json({ shipments: enriched });
});

app.post('/api/logistics/shipments/:orderId/events', requireAuth, (req: AuthedRequest, res) => {
  if (!['carrier', 'admin', 'super_admin'].includes(req.user!.role)) {
    res.status(403).json({ error: 'Accès refusé.' });
    return;
  }
  const orderId = Number(req.params.orderId);
  const { location, statusLabel, description, orderStatus } = req.body || {};
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) {
    res.status(404).json({ error: 'Expédition introuvable.' });
    return;
  }
  db.prepare(`
    INSERT INTO shipment_events (order_id, location, status_label, description)
    VALUES (?, ?, ?, ?)
  `).run(orderId, String(location || 'Hub logistique'), String(statusLabel || 'Mise à jour transit'), String(description || 'Colis scanné par le transporteur.'));

  if (orderStatus && ['preparing', 'shipped', 'in_transit', 'delivered'].includes(orderStatus)) {
    db.prepare('UPDATE orders SET order_status = ? WHERE id = ?').run(orderStatus, orderId);
  }
  createNotification(order.buyer_id, 'logistics', `Suivi colis ${order.tracking_number}`, `${statusLabel} — ${location}`);
  res.status(201).json({ ok: true });
});

// ============================================================================
// ADMIN DASHBOARD (OWNER & MULTI-LEVEL ADMINS)
// ============================================================================
app.get('/api/admin/overview', requireAdmin, (_req: AuthedRequest, res) => {
  const users = db.prepare('SELECT id, full_name, email, phone, role, country_code, currency_code, is_blocked, created_at FROM users ORDER BY id DESC').all();
  const shops = db.prepare(`
    SELECT s.*, u.full_name as owner_name, u.email as owner_email
    FROM shops s
    JOIN users u ON u.id = s.owner_id
    ORDER BY CASE WHEN s.verification_status = 'pending' THEN 0 ELSE 1 END, s.id DESC
  `).all();
  const products = db.prepare(`
    SELECT p.*, s.name as shop_name, c.name_fr as category_name
    FROM products p
    JOIN shops s ON s.id = p.shop_id
    JOIN categories c ON c.id = p.category_id
    ORDER BY p.id DESC
  `).all();
  const orders = db.prepare(`
    SELECT o.*, u.full_name as buyer_name
    FROM orders o
    JOIN users u ON u.id = o.buyer_id
    ORDER BY o.id DESC
  `).all();
  const transactions = db.prepare(`
    SELECT pt.*, o.order_number, u.full_name as buyer_name
    FROM payment_transactions pt
    JOIN orders o ON o.id = pt.order_id
    JOIN users u ON u.id = pt.user_id
    ORDER BY pt.id DESC
  `).all() as any[];
  const disputes = db.prepare(`
    SELECT d.*, o.order_number, u.full_name as buyer_name
    FROM disputes d
    JOIN orders o ON o.id = d.order_id
    JOIN users u ON u.id = d.buyer_id
    ORDER BY d.id DESC
  `).all();
  const auditLogs = db.prepare(`
    SELECT l.*, u.full_name as admin_name
    FROM admin_audit_logs l
    JOIN users u ON u.id = l.admin_id
    ORDER BY l.id DESC
    LIMIT 50
  `).all();

  const totalGmvXaf = (orders as any[]).filter((o) => o.payment_status === 'paid').reduce((acc, o) => acc + o.total_xaf, 0);
  const totalCommissionXaf = (orders as any[]).filter((o) => o.payment_status === 'paid').reduce((acc, o) => acc + o.commission_xaf, 0);
  const mtnVolumeXaf = transactions.filter((t) => t.provider === 'mtn_momo' && t.status === 'confirmed').reduce((a, t) => a + t.amount_xaf, 0);
  const orangeVolumeXaf = transactions.filter((t) => t.provider === 'orange_money' && t.status === 'confirmed').reduce((a, t) => a + t.amount_xaf, 0);

  res.json({
    stats: {
      usersCount: users.length,
      shopsCount: shops.length,
      pendingVerifications: (shops as any[]).filter((s) => s.verification_status === 'pending').length,
      productsCount: products.length,
      ordersCount: orders.length,
      totalGmvXaf,
      totalCommissionXaf,
      mtnVolumeXaf,
      orangeVolumeXaf,
    },
    users,
    shops,
    products,
    orders,
    transactions,
    disputes,
    auditLogs,
    settings: {
      commissionRate: getCommissionRate(),
      premiumFeeXaf: Number(getSetting('premium_seller_fee_xaf', '25000')),
      featuredFeeXaf: Number(getSetting('featured_listing_fee_xaf', '10000')),
      sourcingFeeXaf: Number(getSetting('china_sourcing_fee_xaf', '35000')),
    },
  });
});

app.post('/api/admin/shops/:id/verify', requireAdmin, (req: AuthedRequest, res) => {
  const shopId = Number(req.params.id);
  const approve = Boolean(req.body?.approve);
  const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId) as any;
  if (!shop) {
    res.status(404).json({ error: 'Boutique introuvable.' });
    return;
  }
  db.prepare(`
    UPDATE shops SET is_verified = ?, verification_status = ? WHERE id = ?
  `).run(approve ? 1 : 0, approve ? 'verified' : 'rejected', shopId);

  logAdminAction(req.user!.id, approve ? 'APPROVE_SELLER' : 'REJECT_SELLER', 'shop', String(shopId), shop.name);
  createNotification(
    shop.owner_id,
    'verification',
    approve ? 'Badge VENDEUR VÉRIFIÉ activé !' : 'Vérification refusée',
    approve
      ? `Félicitations, votre boutique "${shop.name}" affiche désormais le badge officiel VENDEUR VÉRIFIÉ.`
      : `Votre dossier pour "${shop.name}" nécessite des documents complémentaires.`
  );
  res.json({ ok: true });
});

app.post('/api/admin/users/:id/block', requireAdmin, (req: AuthedRequest, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user!.id) {
    res.status(400).json({ error: 'Vous ne pouvez pas bloquer votre propre compte administrateur.' });
    return;
  }
  const blocked = req.body?.blocked ? 1 : 0;
  db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(blocked, targetId);
  if (blocked) {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetId);
  }
  logAdminAction(req.user!.id, blocked ? 'BLOCK_USER' : 'UNBLOCK_USER', 'user', String(targetId), '');
  res.json({ ok: true });
});

app.post('/api/admin/products/:id/status', requireAdmin, (req: AuthedRequest, res) => {
  const productId = Number(req.params.id);
  const status = ['active', 'paused', 'rejected'].includes(req.body?.status) ? req.body.status : 'active';
  db.prepare('UPDATE products SET status = ? WHERE id = ?').run(status, productId);
  logAdminAction(req.user!.id, 'UPDATE_PRODUCT_STATUS', 'product', String(productId), status);
  res.json({ ok: true });
});

app.post('/api/admin/payments/:txId/refund', requireAdmin, (req: AuthedRequest, res) => {
  const txId = Number(req.params.txId);
  const tx = db.prepare('SELECT * FROM payment_transactions WHERE id = ?').get(txId) as any;
  if (!tx) {
    res.status(404).json({ error: 'Transaction introuvable.' });
    return;
  }
  db.prepare(`UPDATE payment_transactions SET status = 'refunded' WHERE id = ?`).run(txId);
  db.prepare(`UPDATE orders SET payment_status = 'refunded', order_status = 'cancelled' WHERE id = ?`).run(tx.order_id);
  logAdminAction(req.user!.id, 'REFUND_PAYMENT', 'payment_transaction', String(txId), `${tx.amount_xaf} XAF`);
  createNotification(tx.user_id, 'refund', 'Remboursement effectué', `La transaction ${tx.provider_reference} (${tx.amount_xaf} FCFA) a été remboursée.`);
  res.json({ ok: true });
});

app.post('/api/admin/disputes/:id/resolve', requireAdmin, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const { status, adminNotes } = req.body || {};
  db.prepare('UPDATE disputes SET status = ?, admin_notes = ? WHERE id = ?').run(status || 'resolved', String(adminNotes || ''), id);
  logAdminAction(req.user!.id, 'RESOLVE_DISPUTE', 'dispute', String(id), status || 'resolved');
  res.json({ ok: true });
});

app.put('/api/admin/settings', requireAdmin, (req: AuthedRequest, res) => {
  const { commissionRate, premiumFeeXaf, featuredFeeXaf, sourcingFeeXaf } = req.body || {};
  const upsert = db.prepare(`
    INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  if (commissionRate !== undefined) upsert.run('commission_rate_percent', String(Number(commissionRate)));
  if (premiumFeeXaf !== undefined) upsert.run('premium_seller_fee_xaf', String(Number(premiumFeeXaf)));
  if (featuredFeeXaf !== undefined) upsert.run('featured_listing_fee_xaf', String(Number(featuredFeeXaf)));
  if (sourcingFeeXaf !== undefined) upsert.run('china_sourcing_fee_xaf', String(Number(sourcingFeeXaf)));

  logAdminAction(req.user!.id, 'UPDATE_SETTINGS', 'platform_settings', 'monetization', JSON.stringify(req.body));
  res.json({ ok: true });
});

// ============================================================================
// VITE DEV MIDDLEWARE / PRODUCTION STATIC ASSETS
// ============================================================================
async function startServer() {
  const PORT = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(path.resolve(process.cwd(), 'dist/index.html'));

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (isProd) {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DILANE MARKET server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
