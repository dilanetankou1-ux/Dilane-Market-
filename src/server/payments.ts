import crypto from 'node:crypto';

export interface PaymentMethodDef {
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

export function getAllPaymentMethods(): PaymentMethodDef[] {
  const mtnLive = Boolean(process.env.MTN_MOMO_API_USER && process.env.MTN_MOMO_API_KEY && process.env.MTN_MOMO_SUBSCRIPTION_KEY);
  const orangeLive = Boolean(process.env.ORANGE_MONEY_CLIENT_ID && process.env.ORANGE_MONEY_CLIENT_SECRET);
  const cardLive = Boolean(process.env.CARD_GATEWAY_SECRET_KEY);

  return [
    {
      id: 'mtn_momo',
      name: 'MTN Mobile Money',
      category: 'mobile_money',
      requiresPhone: true,
      currencies: ['XAF', 'NGN', 'GHS', 'USD'],
      countries: ['CM', 'CG', 'CI', 'NG', 'GH'],
      description: 'Confirmation directe sur votre téléphone MTN (aucun code PIN saisi sur le site).',
      integrationReady: true,
      liveConfigured: mtnLive,
    },
    {
      id: 'orange_money',
      name: 'Orange Money',
      category: 'mobile_money',
      requiresPhone: true,
      currencies: ['XAF', 'USD', 'EUR'],
      countries: ['CM', 'CI', 'SN', 'CF'],
      description: 'Validation sécurisée via demande Orange Money sur votre mobile.',
      integrationReady: true,
      liveConfigured: orangeLive,
    },
    {
      id: 'wave',
      name: 'Wave Mobile Money',
      category: 'mobile_money',
      requiresPhone: true,
      currencies: ['XAF'],
      countries: ['SN', 'CI'],
      description: 'Paiement instantané Wave (Sénégal & Côte d’Ivoire).',
      integrationReady: true,
      liveConfigured: false,
    },
    {
      id: 'moov_money',
      name: 'Moov Money',
      category: 'mobile_money',
      requiresPhone: true,
      currencies: ['XAF'],
      countries: ['CI', 'GA', 'TD'],
      description: 'Paiement mobile Moov Money sécurisé.',
      integrationReady: true,
      liveConfigured: false,
    },
    {
      id: 'airtel_money',
      name: 'Airtel Money',
      category: 'mobile_money',
      requiresPhone: true,
      currencies: ['XAF', 'GHS'],
      countries: ['GA', 'CG', 'TD', 'GH'],
      description: 'Paiement mobile Airtel Money avec confirmation USSD.',
      integrationReady: true,
      liveConfigured: false,
    },
    {
      id: 'mpesa',
      name: 'M-Pesa',
      category: 'mobile_money',
      requiresPhone: true,
      currencies: ['USD'],
      countries: ['KE', 'TZ', 'GLOBAL'],
      description: 'Paiement mobile M-Pesa (Afrique de l’Est).',
      integrationReady: true,
      liveConfigured: false,
    },
    {
      id: 'visa',
      name: 'Visa',
      category: 'card',
      requiresPhone: false,
      currencies: ['XAF', 'USD', 'EUR', 'CNY', 'NGN', 'GHS', 'ZAR'],
      countries: ['CM', 'CF', 'TD', 'GA', 'CG', 'CI', 'SN', 'NG', 'GH', 'ZA', 'CN', 'FR', 'US', 'GLOBAL'],
      description: 'Carte internationale Visa (3D-Secure, paiements en FCFA, USD, EUR, CNY).',
      integrationReady: true,
      liveConfigured: cardLive,
    },
    {
      id: 'mastercard',
      name: 'Mastercard',
      category: 'card',
      requiresPhone: false,
      currencies: ['XAF', 'USD', 'EUR', 'CNY', 'NGN', 'GHS', 'ZAR'],
      countries: ['CM', 'CF', 'TD', 'GA', 'CG', 'CI', 'SN', 'NG', 'GH', 'ZA', 'CN', 'FR', 'US', 'GLOBAL'],
      description: 'Carte internationale Mastercard (3D-Secure).',
      integrationReady: true,
      liveConfigured: cardLive,
    },
    {
      id: 'bank_transfer',
      name: 'Virement bancaire international',
      category: 'bank',
      requiresPhone: false,
      currencies: ['XAF', 'USD', 'EUR', 'CNY', 'ZAR'],
      countries: ['CM', 'CI', 'SN', 'NG', 'ZA', 'CN', 'FR', 'US', 'GLOBAL'],
      description: 'Idéal pour les commandes en gros et l’importation B2B depuis la Chine.',
      integrationReady: true,
      liveConfigured: false,
    },
  ];
}

export function getPaymentMethodsForCountry(countryCode: string): PaymentMethodDef[] {
  const code = (countryCode || 'CM').toUpperCase();
  const all = getAllPaymentMethods();
  const matched = all.filter((m) => m.countries.includes(code));
  if (matched.length > 0) return matched;
  return all.filter((m) => m.countries.includes('GLOBAL'));
}

export function maskPayerAccount(provider: string, rawAccount: string): string {
  const clean = rawAccount.trim();
  if (!clean) return 'Non renseigné';
  if (provider === 'visa' || provider === 'mastercard') {
    const last4 = clean.replace(/\D/g, '').slice(-4) || '4242';
    return `•••• •••• •••• ${last4}`;
  }
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 4)}****${clean.slice(-2)}`;
}

export function createProviderReference(provider: string): string {
  const prefixMap: Record<string, string> = {
    mtn_momo: 'MOMO',
    orange_money: 'OM',
    wave: 'WAVE',
    moov_money: 'MOOV',
    airtel_money: 'AIRTEL',
    mpesa: 'MPESA',
    visa: 'VISA',
    mastercard: 'MC',
    bank_transfer: 'SWIFT',
  };
  const prefix = prefixMap[provider] || 'PAY';
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${Date.now().toString().slice(-6)}-${rand}`;
}

export interface FreightEstimateInput {
  mode: 'air' | 'sea';
  weightKg: number;
  cbm: number;
  goodsValueXaf: number;
  targetCountry: string;
}

export function estimateChinaImportLogistics(input: FreightEstimateInput) {
  const weight = Math.max(1, Number(input.weightKg) || 1);
  const cbm = Math.max(0.05, Number(input.cbm) || 0.1);
  const value = Math.max(0, Number(input.goodsValueXaf) || 0);

  if (input.mode === 'air') {
    const freightMinXaf = Math.round(weight * 8500);
    const freightMaxXaf = Math.round(weight * 12500);
    const customsMinXaf = Math.round(value * 0.15);
    const customsMaxXaf = Math.round(value * 0.30);
    return {
      mode: 'air',
      freightMinXaf,
      freightMaxXaf,
      customsMinXaf,
      customsMaxXaf,
      transitDaysRange: '7 à 15 jours ouvrés (indicatif)',
      reliabilityLevel: 'Estimation indicative (Moyenne)',
      conditions: [
        'Basé sur un poids taxable standard (le poids volumétrique L×l×H/5000 peut s’appliquer).',
        'Exclut les marchandises dangereuses, batteries lithium isolées ou liquides soumis à restriction IATA.',
        'Les droits de douane dépendent du code SH exact et du tarif douanier en vigueur dans le pays de destination.',
        'Demandez un devis officiel ci-dessous pour obtenir un tarif ferme auprès d’un transitaire agréé.',
      ],
    };
  }

  const billableCbm = Math.max(0.2, cbm);
  const freightMinXaf = Math.round(billableCbm * 175000);
  const freightMaxXaf = Math.round(billableCbm * 265000);
  const customsMinXaf = Math.round(value * 0.18);
  const customsMaxXaf = Math.round(value * 0.35);
  return {
    mode: 'sea',
    freightMinXaf,
    freightMaxXaf,
    customsMinXaf,
    customsMaxXaf,
    transitDaysRange: '35 à 55 jours (indicatif port-à-port)',
    reliabilityLevel: 'Estimation indicative (Variable selon port & saison)',
    conditions: [
      'Calcul indicatif en groupage maritime (LCL) au mètre cube depuis Guangzhou/Shenzhen/Yiwu.',
      'Les frais portuaires locaux, dépotage, manutention et dédouanement varient selon le port (Douala, Kribi, Abidjan, Dakar, Pointe-Noire, Lagos).',
      'Les droits et taxes douaniers réels sont liquidés uniquement par les autorités douanières sur présentation de la facture commerciale.',
      'Soumettez une demande de devis transport pour obtenir une cotation vérifiée.',
    ],
  };
}
