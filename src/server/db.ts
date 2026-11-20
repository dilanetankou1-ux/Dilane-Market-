import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'dilane_market.sqlite');
export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, expected] = parts;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'buyer',
      country_code TEXT NOT NULL DEFAULT 'CM',
      currency_code TEXT NOT NULL DEFAULT 'XAF',
      language TEXT NOT NULL DEFAULT 'fr',
      is_blocked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      country_code TEXT NOT NULL DEFAULT 'CM',
      city TEXT NOT NULL DEFAULT '',
      origin_region TEXT NOT NULL DEFAULT 'africa',
      logo_url TEXT NOT NULL DEFAULT '',
      is_verified INTEGER NOT NULL DEFAULT 0,
      verification_status TEXT NOT NULL DEFAULT 'unsubmitted',
      business_reg_number TEXT NOT NULL DEFAULT '',
      id_document_ref TEXT NOT NULL DEFAULT '',
      subscription_plan TEXT NOT NULL DEFAULT 'standard',
      payout_method TEXT NOT NULL DEFAULT 'mtn_momo',
      payout_account TEXT NOT NULL DEFAULT '',
      payout_bank_name TEXT NOT NULL DEFAULT '',
      rating_avg REAL NOT NULL DEFAULT 4.8,
      rating_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_fr TEXT NOT NULL,
      name_en TEXT NOT NULL,
      name_zh TEXT NOT NULL,
      name_es TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      subcategories_json TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      subcategory TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      video_url TEXT NOT NULL DEFAULT '',
      retail_price_xaf INTEGER NOT NULL,
      wholesale_price_xaf INTEGER NOT NULL,
      moq INTEGER NOT NULL DEFAULT 10,
      stock INTEGER NOT NULL DEFAULT 100,
      origin_type TEXT NOT NULL DEFAULT 'africa',
      is_promo INTEGER NOT NULL DEFAULT 0,
      promo_percent INTEGER NOT NULL DEFAULT 0,
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_new_arrival INTEGER NOT NULL DEFAULT 0,
      sales_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      specs_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1,
      order_type TEXT NOT NULL DEFAULT 'retail',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, product_id, order_type)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      buyer_id INTEGER NOT NULL REFERENCES users(id),
      country_code TEXT NOT NULL DEFAULT 'CM',
      shipping_address TEXT NOT NULL,
      shipping_city TEXT NOT NULL,
      shipping_mode TEXT NOT NULL DEFAULT 'local',
      carrier_name TEXT NOT NULL DEFAULT 'Dilane Express Logistics',
      tracking_number TEXT NOT NULL UNIQUE,
      subtotal_xaf INTEGER NOT NULL,
      shipping_fee_xaf INTEGER NOT NULL,
      commission_xaf INTEGER NOT NULL,
      total_xaf INTEGER NOT NULL,
      currency_code TEXT NOT NULL DEFAULT 'XAF',
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      order_status TEXT NOT NULL DEFAULT 'created',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      shop_id INTEGER NOT NULL REFERENCES shops(id),
      product_title TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price_xaf INTEGER NOT NULL,
      order_type TEXT NOT NULL DEFAULT 'retail',
      seller_payout_xaf INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT NOT NULL UNIQUE,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      provider TEXT NOT NULL,
      payer_account TEXT NOT NULL,
      provider_reference TEXT NOT NULL,
      amount_xaf INTEGER NOT NULL,
      currency_code TEXT NOT NULL DEFAULT 'XAF',
      status TEXT NOT NULL DEFAULT 'initiated',
      verification_mode TEXT NOT NULL DEFAULT 'sandbox_verified',
      receipt_code TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS shipment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      location TEXT NOT NULL,
      status_label TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rfq_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_id INTEGER NOT NULL REFERENCES users(id),
      product_id INTEGER REFERENCES products(id),
      shop_id INTEGER REFERENCES shops(id),
      request_type TEXT NOT NULL DEFAULT 'product_quote',
      title TEXT NOT NULL,
      details TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      target_country TEXT NOT NULL DEFAULT 'CM',
      transport_mode TEXT NOT NULL DEFAULT 'sea',
      estimated_weight_kg REAL NOT NULL DEFAULT 0,
      estimated_cbm REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      quoted_price_xaf INTEGER,
      quoted_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_key TEXT NOT NULL,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      receiver_id INTEGER NOT NULL REFERENCES users(id),
      product_id INTEGER REFERENCES products(id),
      body TEXT NOT NULL,
      attachment_name TEXT NOT NULL DEFAULT '',
      attachment_type TEXT NOT NULL DEFAULT '',
      offer_price_xaf INTEGER,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      buyer_id INTEGER NOT NULL REFERENCES users(id),
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      buyer_id INTEGER NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      admin_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
    CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_key);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `);

  // Backward-compatible migration for existing SQLite databases
  const shopCols = (db.prepare('PRAGMA table_info(shops)').all() as Array<{ name: string }>).map((c) => c.name);
  if (!shopCols.includes('payout_method')) {
    db.exec(`ALTER TABLE shops ADD COLUMN payout_method TEXT NOT NULL DEFAULT 'mtn_momo'`);
  }
  if (!shopCols.includes('payout_account')) {
    db.exec(`ALTER TABLE shops ADD COLUMN payout_account TEXT NOT NULL DEFAULT ''`);
  }
  if (!shopCols.includes('payout_bank_name')) {
    db.exec(`ALTER TABLE shops ADD COLUMN payout_bank_name TEXT NOT NULL DEFAULT ''`);
  }

  seedInitialData();

  // Populate payout destinations on seeded shops if not yet set
  db.prepare(`UPDATE shops SET payout_method = 'mtn_momo', payout_account = '+237657454012', payout_bank_name = 'MTN Mobile Money Cameroun' WHERE slug = 'camtech-distribution' AND payout_account = ''`).run();
  db.prepare(`UPDATE shops SET payout_method = 'bank_transfer', payout_account = 'CN62-BKCH-0044-9988-8821', payout_bank_name = 'Bank of China Shenzhen (SWIFT)' WHERE slug = 'shenzhen-linghang-factory' AND payout_account = ''`).run();
  db.prepare(`UPDATE shops SET payout_method = 'orange_money', payout_account = '+2250708123456', payout_bank_name = 'Orange Money Côte d’Ivoire' WHERE slug = 'ivoire-botanique-mode' AND payout_account = ''`).run();
  db.prepare(`UPDATE shops SET payout_method = 'wave', payout_account = '+221771234567', payout_bank_name = 'Wave Pro Sénégal' WHERE slug = 'dakar-solar-pro' AND payout_account = ''`).run();
}

function seedInitialData(): void {
  const existingCategories = db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number };
  if (existingCategories.c === 0) {
    const categoriesSeed: Array<[string, string, string, string, string, string, string[], number]> = [
      ['telephones-accessoires', 'Téléphones et accessoires', 'Phones & Accessories', '手机与配件', 'Teléfonos y accesorios', 'الهواتف والملحقات', ['Smartphones', 'Chargeurs rapides', 'Écouteurs & Audio', 'Coques & Protections', 'Pièces détachées mobiles'], 1],
      ['ordinateurs-informatique', 'Ordinateurs et informatique', 'Computers & IT', '电脑与办公设备', 'Computadoras e informática', 'الحواسيب والمعلوماتية', ['PC Portables', 'Serveurs & Réseaux', 'Imprimantes', 'Stockage SSD', 'Accessoires bureau'], 2],
      ['electronique', 'Électronique', 'Electronics', '消费电子', 'Electrónica', 'الإلكترونيات', ['Énergie solaire & Onduleurs', 'Téléviseurs LED', 'Sonorisation Pro', 'Caméras de sécurité', 'Domotique'], 3],
      ['vetements-chaussures', 'Vêtements et chaussures', 'Apparel & Footwear', '服装与鞋履', 'Ropa y calzado', 'الملابس والأحذية', ['Sneakers & Chaussures', 'Prêt-à-porter homme', 'Mode femme', 'Textiles en gros', 'Tenues professionnelles'], 4],
      ['beaute-cosmetiques', 'Beauté et cosmétiques', 'Beauty & Cosmetics', '美妆与个护', 'Belleza y cosméticos', 'الجمال ومستحضرات التجميل', ['Soins visage', 'Beurre de karité & Huiles', 'Parfums', 'Coiffure & Mèches', 'Équipement salon'], 5],
      ['materiaux-construction', 'Matériaux de construction', 'Construction Materials', '建筑材料', 'Materiales de construcción', 'مواد البناء', ['Carrelage & Céramique', 'Acier & Quincaillerie', 'Peintures industrielles', 'Plomberie', 'Éclairage chantier'], 6],
      ['machines-industrielles', 'Machines et équipements industriels', 'Industrial Machinery', '机械与工业设备', 'Maquinaria industrial', 'الآلات والمعدات الصناعية', ['Machines agroalimentaires', 'Moteurs électriques', 'Groupes électrogènes', 'Presses & Usinage', 'Conditionnement'], 7],
      ['agriculture', 'Agriculture', 'Agriculture', '农业与农机', 'Agricultura', 'الزراعة', ['Motoculteurs & Irrigation', 'Broyeurs & Moulins', 'Semences & Intrants', 'Outillage agricole', 'Séchoirs solaires'], 8],
      ['automobile-pieces', 'Automobile et pièces détachées', 'Auto & Spare Parts', '汽车与零配件', 'Automóviles y repuestos', 'السيارات وقطع الغيار', ['Pneus & Jantes', 'Batteries auto', 'Pièces moteur', 'Motos & Tricycles', 'Accessoires cabine'], 9],
      ['meubles-decoration', 'Meubles et décoration', 'Furniture & Decor', '家具与装饰', 'Muebles y decoración', 'الأثاث والديكور', ['Mobilier de bureau', 'Salons modernes', 'Luminaires', 'Rangement', 'Décoration intérieure'], 10],
      ['maison-cuisine', 'Maison et cuisine', 'Home & Kitchen', '家居与厨房', 'Hogar y cocina', 'المنزل والمطبخ', ['Électroménager', 'Ustensiles inox', 'Linge de maison', 'Climatisation', 'Purificateurs d’eau'], 11],
      ['emballages-fournitures', 'Emballages et fournitures commerciales', 'Packaging & Commercial Supplies', '包装与商业耗材', 'Embalajes y suministros', 'التغليف والمستلزمات التجارية', ['Cartons export', 'Sachets & Flacons', 'Étiquettes personnalisées', 'Balances commerciales', 'Terminaux POS'], 12],
      ['produits-alimentaires', 'Produits alimentaires autorisés', 'Authorized Food Products', '合规食品与农产品', 'Productos alimentarios', 'المنتجات الغذائية المعتمدة', ['Cacao & Café africain', 'Huiles végétales', 'Riz & Céréales gros', 'Épices conditionnées', 'Boissons emballées'], 13],
      ['equipements-professionnels', 'Équipements professionnels', 'Professional Equipment', '专业设备', 'Equipos profesionales', 'المعدات المهنية', ['Restauration & Hôtellerie', 'Médical non réglementé', 'Bureautique', 'Sécurité EPI', 'Outillage atelier'], 14],
    ];

    const insertCat = db.prepare(`
      INSERT INTO categories (slug, name_fr, name_en, name_zh, name_es, name_ar, subcategories_json, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of categoriesSeed) {
      insertCat.run(c[0], c[1], c[2], c[3], c[4], c[5], JSON.stringify(c[6]), c[7]);
    }
  }

  const existingSettings = db.prepare('SELECT COUNT(*) as c FROM platform_settings').get() as { c: number };
  if (existingSettings.c === 0) {
    const defaults: Array<[string, string]> = [
      ['commission_rate_percent', '5.0'],
      ['premium_seller_fee_xaf', '25000'],
      ['featured_listing_fee_xaf', '10000'],
      ['china_sourcing_fee_xaf', '35000'],
      ['exchange_rates_json', JSON.stringify({ XAF: 1, USD: 0.00165, EUR: 0.00152, CNY: 0.0119, NGN: 2.55, GHS: 0.024, ZAR: 0.030 })],
      ['enabled_countries_json', JSON.stringify(['CM', 'CF', 'TD', 'GA', 'CG', 'CI', 'SN', 'NG', 'GH', 'ZA', 'CN', 'FR', 'US'])],
    ];
    const insertSet = db.prepare('INSERT INTO platform_settings (key, value) VALUES (?, ?)');
    for (const [k, v] of defaults) {
      insertSet.run(k, v);
    }
  }

  const existingUsers = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (existingUsers.c === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (full_name, email, phone, password_hash, role, country_code, currency_code, language)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const ownerPass = hashPassword('DilaneAdmin2026!');
    const sellerPass = hashPassword('Vendeur2026!');
    const buyerPass = hashPassword('Acheteur2026!');
    const carrierPass = hashPassword('Logistique2026!');

    // 1. Owner / Super Admin
    const ownerRes = insertUser.run('Dilane Tankou (Fondateur)', 'dilanetankou1@gmail.com', '+237678321595', ownerPass, 'super_admin', 'CM', 'XAF', 'fr');
    const ownerId = Number(ownerRes.lastInsertRowid);

    // 2. Verified Cameroon Seller
    const sellerCmRes = insertUser.run('CamTech Distribution Douala', 'vendeur@camtech-cm.com', '+237657454012', sellerPass, 'seller', 'CM', 'XAF', 'fr');
    const sellerCmId = Number(sellerCmRes.lastInsertRowid);

    // 3. Verified China Manufacturer
    const sellerCnRes = insertUser.run('Shenzhen LingHang Industrial Ltd.', 'export@linghang-cn.com', '+8613800138000', sellerPass, 'seller', 'CN', 'USD', 'zh');
    const sellerCnId = Number(sellerCnRes.lastInsertRowid);

    // 4. Verified West Africa Cosmetics & Agro Seller
    const sellerCiRes = insertUser.run('Ivoire Botanique & Négoce', 'contact@ivoirebotanique.ci', '+2250708123456', sellerPass, 'seller', 'CI', 'XAF', 'fr');
    const sellerCiId = Number(sellerCiRes.lastInsertRowid);

    // 5. Pending Seller (for admin verification testing!)
    const sellerPendingRes = insertUser.run('Dakar Solar & Équipements', 'info@dakarsolar.sn', '+221771234567', sellerPass, 'seller', 'SN', 'XAF', 'fr');
    const sellerPendingId = Number(sellerPendingRes.lastInsertRowid);

    // 6. Demo Buyer
    const buyerRes = insertUser.run('Samuel Ndongo', 'acheteur@dilanemarket.com', '+237690112233', buyerPass, 'buyer', 'CM', 'XAF', 'fr');
    const buyerId = Number(buyerRes.lastInsertRowid);

    // 7. Partner Logistics Carrier
    insertUser.run('AfroCargo Transit & Express', 'ops@afrocargo-transit.com', '+237677009988', carrierPass, 'carrier', 'CM', 'XAF', 'fr');

    // Shops
    const insertShop = db.prepare(`
      INSERT INTO shops (owner_id, name, slug, description, country_code, city, origin_region, is_verified, verification_status, business_reg_number, id_document_ref, subscription_plan, rating_avg, rating_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const shopCm = Number(insertShop.run(
      sellerCmId,
      'CamTech Distribution',
      'camtech-distribution',
      'Grossiste agréé en smartphones, informatique et solutions solaires basé à Akwa, Douala. Livraison rapide Cameroun, Tchad, RCA, Gabon et Congo.',
      'CM',
      'Douala',
      'africa',
      1,
      'verified',
      'RC/DLA/2023/B/4892',
      'CNI-CM-992841',
      'premium',
      4.9,
      48
    ).lastInsertRowid);

    const shopCn = Number(insertShop.run(
      sellerCnId,
      'Shenzhen LingHang Factory',
      'shenzhen-linghang-factory',
      'Fabricant direct à Shenzhen et Guangzhou : machines industrielles, électronique en gros, conditionnement et groupage maritime/aérien vers l’Afrique.',
      'CN',
      'Shenzhen',
      'china',
      1,
      'verified',
      'CN-USCC-91440300MA5D',
      'EXPORT-LIC-SZ-8821',
      'enterprise',
      4.8,
      112
    ).lastInsertRowid);

    const shopCi = Number(insertShop.run(
      sellerCiId,
      'Ivoire Botanique & Mode',
      'ivoire-botanique-mode',
      'Production et distribution en gros de cosmétiques naturels africains, prêt-à-porter et chaussures premium à Abidjan.',
      'CI',
      'Abidjan',
      'africa',
      1,
      'verified',
      'CI-ABJ-2024-B-1204',
      'ID-CI-441029',
      'premium',
      4.7,
      34
    ).lastInsertRowid);

    const shopSnPending = Number(insertShop.run(
      sellerPendingId,
      'Dakar Solar Pro',
      'dakar-solar-pro',
      'Fournisseur d’équipements photovoltaïques et matériaux de construction professionnels pour l’Afrique de l’Ouest.',
      'SN',
      'Dakar',
      'africa',
      0,
      'pending',
      'SN-DKR-2025-B-7741',
      'PASSPORT-SN-5519',
      'standard',
      4.6,
      9
    ).lastInsertRowid);

    // Map category slugs to IDs
    const catRows = db.prepare('SELECT id, slug FROM categories').all() as Array<{ id: number; slug: string }>;
    const catMap = new Map(catRows.map((r) => [r.slug, r.id]));

    const IMG_PHONE = '/src/assets/images/prod_smartphone_wholesale_1795192554068.jpg';
    const IMG_SOLAR = '/src/assets/images/prod_solar_industrial_1795192552667.jpg';
    const IMG_FASHION = '/src/assets/images/prod_fashion_textile_1795192554075.jpg';
    const IMG_MACHINE = '/src/assets/images/prod_china_import_machinery_1795192553290.jpg';
    const IMG_BEAUTY = '/src/assets/images/prod_beauty_cosmetics_1795192553127.jpg';

    const insertProd = db.prepare(`
      INSERT INTO products (
        shop_id, category_id, subcategory, title, description, image_url,
        retail_price_xaf, wholesale_price_xaf, moq, stock, origin_type,
        is_promo, promo_percent, is_featured, is_new_arrival, sales_count, specs_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const p1 = Number(insertProd.run(
      shopCm, catMap.get('telephones-accessoires')!, 'Smartphones',
      'Pack Smartphone 5G Pro 256Go + Chargeur GaN 65W & Écouteurs',
      'Appareils neufs scellés double SIM compatibles réseaux MTN, Orange et internationaux. Garantie 12 mois avec service après-vente à Douala et Yaoundé. Prix dégressif pour revendeurs dès 10 unités.',
      IMG_PHONE, 185000, 148000, 10, 240, 'africa', 1, 12, 1, 1, 86,
      JSON.stringify({ Stockage: '256 Go', Réseau: '5G / 4G LTE Dual SIM', Batterie: '5000 mAh', Garantie: '12 mois' })
    ).lastInsertRowid);

    const p2 = Number(insertProd.run(
      shopCn, catMap.get('machines-industrielles')!, 'Conditionnement',
      'Machine de mise sous vide industrielle Inox DZ-400 + Moteur 1.5kW',
      'Fabrication directe usine Shenzhen. Idéale pour le conditionnement alimentaire (cacao, café, poisson, céréales) et emballages commerciaux. Certifiée CE, tension 220V/50Hz adaptée aux réseaux africains. Expédition groupage maritime ou fret aérien.',
      IMG_MACHINE, 495000, 390000, 3, 65, 'china', 1, 15, 1, 0, 54,
      JSON.stringify({ Puissance: '1500W / 220V', Matériau: 'Acier inoxydable 304', Poids: '68 kg', Origine: 'Shenzhen, Chine' })
    ).lastInsertRowid);

    const p3 = Number(insertProd.run(
      shopCm, catMap.get('electronique')!, 'Énergie solaire & Onduleurs',
      'Station Solaire Hybride 1500Wh Lithium + Panneau Pliable 200W & Onduleur',
      'Solution complète anti-délestage pour boutiques, bureaux et maisons. Batterie LiFePO4 longue durée (3000 cycles), prises 220V universelles et ports USB-C PD 100W. Stock disponible immédiatement en Afrique centrale.',
      IMG_SOLAR, 340000, 275000, 5, 110, 'africa', 0, 0, 1, 1, 71,
      JSON.stringify({ Capacité: '1500 Wh LiFePO4', Sortie: '220V Pur Sinus 1800W', Panneau: '200W Monocristallin', Stock: 'Douala, Cameroun' })
    ).lastInsertRowid);

    insertProd.run(
      shopCi, catMap.get('vetements-chaussures')!, 'Sneakers & Chaussures',
      'Lot Boutique Sneakers Cuir Minimalistes + Veste Denim & Polo Coton',
      'Collection urbaine haut de gamme conçue pour les boutiques de prêt-à-porter. Finitions soignées, tailles assorties 39–45 et S–XXL. Expédition rapide dans toute la zone UEMOA et CEMAC.',
      IMG_FASHION, 42000, 28500, 20, 480, 'africa', 1, 18, 1, 1, 129,
      JSON.stringify({ Matière: 'Cuir véritable & Coton 240g', Tailles: 'Assortiment complet', Origine: 'Abidjan, Côte d’Ivoire' })
    );

    insertProd.run(
      shopCi, catMap.get('beaute-cosmetiques')!, 'Soins visage',
      'Gamme Cosmétique Botanique Ambre — Sérum, Crème Karité & Huile Pure',
      'Formules naturelles enrichies au beurre de karité raffiné et extraits botaniques. Flacons verre ambré prêts pour la revente en pharmacie, institut ou marque blanche (OEM dès 50 kits).',
      IMG_BEAUTY, 24500, 15500, 30, 620, 'africa', 0, 0, 1, 1, 93,
      JSON.stringify({ Contenance: 'Kit 4 pièces', Certification: 'Tests dermatologiques', Personnalisation: 'Logo client dès 50 lots' })
    );

    insertProd.run(
      shopCn, catMap.get('telephones-accessoires')!, 'Chargeurs rapides',
      'Lot Gros Chargeurs USB-C 65W GaN + Écouteurs ANC Sans Fil (Export Usine)',
      'Production directe Shenzhen avec emballage retail premium. Protection contre les surtensions adaptée aux réseaux électriques africains. Commande minimale 50 unités avec tarif usine FOB Guangzhou.',
      IMG_PHONE, 19500, 11200, 50, 1500, 'china', 1, 20, 0, 1, 215,
      JSON.stringify({ Norme: 'CE / RoHS', Connectique: 'Type-C + USB-A', Emballage: 'Carton export 100 pcs', Origine: 'Guangzhou, Chine' })
    );

    insertProd.run(
      shopCn, catMap.get('ordinateurs-informatique')!, 'PC Portables',
      'Ultrabook Pro 14" Aluminium Core i7 / 16Go RAM / 512Go SSD (Import Direct)',
      'Ordinateurs professionnels légers pour entreprises, écoles et revendeurs informatiques. Clavier AZERTY français disponible sur commande directe usine.',
      IMG_PHONE, 460000, 365000, 5, 90, 'china', 0, 0, 0, 1, 41,
      JSON.stringify({ Processeur: 'Intel Core i7 13e Gén', Mémoire: '16 Go DDR5 / 512 Go NVMe', Clavier: 'AZERTY FR rétroéclairé' })
    );

    insertProd.run(
      shopCn, catMap.get('agriculture')!, 'Broyeurs & Moulins',
      'Moulin Polyvalent Inox & Moteur Industriel pour Maïs, Manioc et Cacao',
      'Conçu pour les coopératives agricoles et unités de transformation locales. Rendement jusqu’à 350 kg/heure, pièces de rechange incluses dans le colis.',
      IMG_MACHINE, 380000, 295000, 2, 45, 'china', 0, 0, 0, 0, 38,
      JSON.stringify({ Capacité: '350 kg/h', Alimentation: '220V / 380V', Origine: 'Foshan, Chine' })
    );

    insertProd.run(
      shopSnPending, catMap.get('materiaux-construction')!, 'Éclairage chantier',
      'Kit Éclairage Solaire LED Industriel & Onduleur Chantier 2000W',
      'Équipement robuste IP66 étanche pour chantiers BTP, entrepôts et zones rurales sans raccordement électrique.',
      IMG_SOLAR, 165000, 128000, 10, 140, 'africa', 1, 10, 0, 1, 19,
      JSON.stringify({ Étanchéité: 'IP66', Autonomie: '14 heures', Origine: 'Dakar, Sénégal' })
    );

    insertProd.run(
      shopCn, catMap.get('emballages-fournitures')!, 'Sachets & Flacons',
      'Lot Flacons Cosmétiques Verre Ambré & Pots Couvercle Bambou (1000 pcs)',
      'Fournitures d’emballage professionnelles pour marques africaines de cosmétiques, huiles essentielles et produits alimentaires autorisés.',
      IMG_BEAUTY, 145000, 108000, 5, 300, 'china', 0, 0, 0, 0, 62,
      JSON.stringify({ Quantité: 'Lot de 200 unités', Matériau: 'Verre ambré UV + Bois', Origine: 'Yiwu, Chine' })
    );

    // Seed 1 completed order + payment + shipment history for realistic Buyer/Seller/Admin views
    const insertOrder = db.prepare(`
      INSERT INTO orders (
        order_number, buyer_id, country_code, shipping_address, shipping_city, shipping_mode,
        carrier_name, tracking_number, subtotal_xaf, shipping_fee_xaf, commission_xaf, total_xaf,
        currency_code, payment_method, payment_status, order_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const ord1 = Number(insertOrder.run(
      'DM-2026-10041', buyerId, 'CM', 'Boulevard de la Liberté, Akwa', 'Douala', 'local',
      'AfroCargo Transit & Express', 'TRK-DM-884120CM', 340000, 5000, 17000, 345000,
      'XAF', 'mtn_momo', 'paid', 'in_transit'
    ).lastInsertRowid);

    db.prepare(`
      INSERT INTO order_items (order_id, product_id, shop_id, product_title, quantity, unit_price_xaf, order_type, seller_payout_xaf)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ord1, p3, shopCm, 'Station Solaire Hybride 1500Wh Lithium + Panneau Pliable 200W & Onduleur', 1, 340000, 'retail', 323000);

    db.prepare(`
      INSERT INTO payment_transactions (
        idempotency_key, order_id, user_id, provider, payer_account, provider_reference,
        amount_xaf, currency_code, status, verification_mode, receipt_code, confirmed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run('seed-tx-10041', ord1, buyerId, 'mtn_momo', '+23767****33', 'MOMO-CM-90284712', 345000, 'XAF', 'confirmed', 'sandbox_verified', 'RCPT-DM-10041');

    const insertEvent = db.prepare(`
      INSERT INTO shipment_events (order_id, location, status_label, description)
      VALUES (?, ?, ?, ?)
    `);
    insertEvent.run(ord1, 'Douala — Entrepôt Akwa', 'Commande confirmée', 'Paiement MTN Mobile Money vérifié côté serveur et commande transmise au vendeur.');
    insertEvent.run(ord1, 'Douala — Hub AfroCargo', 'En cours d’acheminement', 'Colis contrôlé, scellé et remis au livreur partenaire.');

    // Seed an Import China RFQ
    db.prepare(`
      INSERT INTO rfq_requests (
        buyer_id, product_id, shop_id, request_type, title, details, quantity,
        target_country, transport_mode, estimated_weight_kg, estimated_cbm, status, quoted_price_xaf, quoted_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      buyerId, p2, shopCn, 'freight_quote',
      'Importation 5 machines sous vide Inox vers Douala',
      'Besoin d’un devis complet FOB Shenzhen + groupage maritime jusqu’au port de Douala avec emballage caisse bois.',
      5, 'CM', 'sea', 340, 1.8, 'quoted', 2180000,
      'Tarif usine 390 000 FCFA/unité + estimation groupage maritime LCL 230 000 FCFA (hors droits de douane CEMAC à confirmer selon code SH).'
    );

    // Seed reviews
    db.prepare(`
      INSERT INTO reviews (product_id, shop_id, buyer_id, rating, comment)
      VALUES (?, ?, ?, ?, ?)
    `).run(p1, shopCm, buyerId, 5, 'Livraison rapide à Douala, smartphones scellés d’origine et facture conforme.');
    db.prepare(`
      INSERT INTO reviews (product_id, shop_id, buyer_id, rating, comment)
      VALUES (?, ?, ?, ?, ?)
    `).run(p2, shopCn, buyerId, 5, 'Communication claire avec l’usine à Shenzhen, vidéo de test envoyée avant expédition.');

    // Seed initial messages
    db.prepare(`
      INSERT INTO messages (conversation_key, sender_id, receiver_id, product_id, body, offer_price_xaf)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(`u${Math.min(buyerId, sellerCnId)}-u${Math.max(buyerId, sellerCnId)}`, buyerId, sellerCnId, p2, 'Bonjour, quel est votre meilleur prix gros pour 5 machines DZ-400 livrées au port de Douala ?', 375000);
    db.prepare(`
      INSERT INTO messages (conversation_key, sender_id, receiver_id, product_id, body)
      VALUES (?, ?, ?, ?, ?)
    `).run(`u${Math.min(buyerId, sellerCnId)}-u${Math.max(buyerId, sellerCnId)}`, sellerCnId, buyerId, p2, 'Bonjour ! Pour 5 unités nous pouvons proposer 380 000 FCFA l’unité FOB Shenzhen avec pièces de rechange offertes.');

    // Welcome notification for owner & buyer
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, body)
      VALUES (?, ?, ?, ?)
    `).run(ownerId, 'admin', 'Bienvenue sur votre espace Propriétaire DILANE MARKET', '1 boutique (Dakar Solar Pro) est en attente de validation pour le badge VENDEUR VÉRIFIÉ.');
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, body)
      VALUES (?, ?, ?, ?)
    `).run(buyerId, 'order', 'Colis DM-2026-10041 en transit', 'Votre commande est en cours d’acheminement via AfroCargo Transit & Express.');
  }
}

export function getSetting(key: string, fallback: string): string {
  const row = db.prepare('SELECT value FROM platform_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : fallback;
}

export function logAdminAction(adminId: number, action: string, targetType: string, targetId: string, details: string): void {
  db.prepare(`
    INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(adminId, action, targetType, targetId, details);
}
