import React, { useEffect, useState } from 'react';
import {
  Ship,
  Plane,
  Search,
  FileText,
  AlertCircle,
  CheckCircle2,
  Calculator,
} from 'lucide-react';
import type { CurrencyCode, LanguageCode, Product, RfqRequest, User } from '../types/marketplace';
import { apiRequest } from '../lib/api';
import { formatMoney, PRIORITY_COUNTRIES } from '../lib/i18n';
import { ProductCard } from './ProductCard';

interface ImportChinaViewProps {
  products: Product[];
  user: User | null;
  currency: CurrencyCode;
  rates: Record<string, number>;
  sourcingFeeXaf: number;
  lang: LanguageCode;
  favoriteIds: number[];
  onToggleFavorite: (id: number) => void;
  onSelectProduct: (p: Product) => void;
  onQuickAdd: (p: Product, type: 'retail' | 'wholesale') => void;
  onBuyNow: (p: Product, type: 'retail' | 'wholesale') => void;
  onRequireAuth: () => void;
}

export const ImportChinaView: React.FC<ImportChinaViewProps> = ({
  products,
  user,
  currency,
  rates,
  sourcingFeeXaf,
  lang,
  favoriteIds,
  onToggleFavorite,
  onSelectProduct,
  onQuickAdd,
  onBuyNow,
  onRequireAuth,
}) => {
  const chinaProducts = products.filter((p) => p.origin_type === 'china');

  // Freight & Customs Indicative Estimator
  const [mode, setMode] = useState<'sea' | 'air'>('sea');
  const [weightKg, setWeightKg] = useState(120);
  const [cbm, setCbm] = useState(1.2);
  const [goodsValueXaf, setGoodsValueXaf] = useState(1500000);
  const [targetCountry, setTargetCountry] = useState(user?.country_code || 'CM');
  const [estimate, setEstimate] = useState<any>(null);

  // RFQ / Sourcing / Groupage Request Form
  const [requestType, setRequestType] = useState<'china_sourcing' | 'freight_quote' | 'groupage'>('china_sourcing');
  const [rfqTitle, setRfqTitle] = useState('');
  const [rfqQty, setRfqQty] = useState(50);
  const [rfqDetails, setRfqDetails] = useState('');
  const [rfqFeedback, setRfqFeedback] = useState('');
  const [myRfqs, setMyRfqs] = useState<RfqRequest[]>([]);

  const loadRfqs = () => {
    if (!user) return;
    apiRequest<{ rfqs: RfqRequest[] }>('/api/rfqs')
      .then((res) => setMyRfqs(res.rfqs || []))
      .catch(() => setMyRfqs([]));
  };

  useEffect(() => {
    loadRfqs();
  }, [user]);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/api/import-china/estimate', {
      method: 'POST',
      body: { mode, weightKg, cbm, goodsValueXaf, targetCountry },
    });
    setEstimate(res);
  };

  const handleSubmitRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onRequireAuth();
      return;
    }
    setRfqFeedback('');
    try {
      await apiRequest('/api/rfqs', {
        method: 'POST',
        body: {
          requestType,
          title: rfqTitle,
          details: rfqDetails,
          quantity: rfqQty,
          targetCountry,
          transportMode: mode,
          estimatedWeightKg: weightKg,
          estimatedCbm: cbm,
        },
      });
      setRfqTitle('');
      setRfqDetails('');
      setRfqFeedback('Demande enregistrée. Les fournisseurs vérifiés et transitaires partenaires vous transmettront un devis ferme.');
      loadRfqs();
    } catch (err: any) {
      setRfqFeedback(err.message);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 space-y-12">
      {/* Editorial Import China Header */}
      <section className="bg-[#0F1E2E] text-white rounded-2xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-4">
          <div className="text-xs font-medium text-amber-400">
            Shenzhen · Guangzhou · Yiwu · Foshan → Afrique & Europe
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight text-balance">
            IMPORT CHINE — Achetez directement aux usines et regroupez vos expéditions.
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            Trouvez des fabricants chinois vérifiés, comparez les tarifs FOB, demandez une recherche de produit sur mesure ou un groupage maritime/aérien jusqu’à votre pays.
          </p>
        </div>
        <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-xl p-5 space-y-3 text-sm">
          <div className="font-semibold text-white">Services Import Chine disponibles</div>
          <ul className="space-y-2 text-slate-300 text-xs">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Catalogues directs fabricants chinois vérifiés</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Groupage multi-commandes (maritime LCL & fret aérien)</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Sourcing usine sur demande (frais de recherche transparents :{' '}
                <span className="font-mono text-white font-semibold">
                  {formatMoney(sourcingFeeXaf, currency, rates)}
                </span>
                )
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* Estimator + RFQ Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Indicative Logistics & Customs Estimator */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-5 h-5 text-amber-600" />
            <h2 className="font-display text-xl font-bold text-[#0F1E2E]">
              Estimateur indicatif transport & douane
            </h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Obtenez une fourchette indicative pour le transport maritime ou aérien. Les tarifs réels, délais exacts et droits de douane dépendent toujours du code SH, du volume final et du transitaire agréé.
          </p>

          <form onSubmit={handleCalculate} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setMode('sea')}
                className={`py-2.5 px-3 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'sea' ? 'bg-white text-[#0F1E2E] shadow-xs' : 'text-slate-600'
                }`}
              >
                <Ship className="w-4 h-4" />
                <span>Transport maritime</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('air')}
                className={`py-2.5 px-3 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer ${
                  mode === 'air' ? 'bg-white text-[#0F1E2E] shadow-xs' : 'text-slate-600'
                }`}
              >
                <Plane className="w-4 h-4" />
                <span>Transport aérien</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Pays de réception</label>
                <select
                  value={targetCountry}
                  onChange={(e) => setTargetCountry(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {PRIORITY_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Valeur marchandise (FCFA)</label>
                <input
                  type="number"
                  min={10000}
                  value={goodsValueXaf}
                  onChange={(e) => setGoodsValueXaf(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Poids estimé (kg)</label>
                <input
                  type="number"
                  min={1}
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Volume estimé (m³ / CBM)</label>
                <input
                  type="number"
                  step="0.1"
                  min={0.1}
                  value={cbm}
                  onChange={(e) => setCbm(Number(e.target.value) || 0.1)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 text-sm font-semibold bg-[#0F1E2E] text-white rounded-xl hover:bg-slate-800 cursor-pointer"
            >
              Calculer la fourchette indicative
            </button>
          </form>

          {estimate && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0F1E2E]">Niveau de fiabilité</span>
                <span className="font-semibold text-amber-800">{estimate.reliabilityLevel}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <div className="text-xs text-slate-500">Fret indicatif ({estimate.mode === 'sea' ? 'Maritime' : 'Aérien'})</div>
                  <div className="font-mono text-sm font-bold text-[#0F1E2E] tabular-nums">
                    {formatMoney(estimate.freightMinXaf, currency, rates)} – {formatMoney(estimate.freightMaxXaf, currency, rates)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Douane indicative (selon code SH)</div>
                  <div className="font-mono text-sm font-bold text-[#0F1E2E] tabular-nums">
                    {formatMoney(estimate.customsMinXaf, currency, rates)} – {formatMoney(estimate.customsMaxXaf, currency, rates)}
                  </div>
                </div>
              </div>
              <div className="text-xs text-slate-600">
                <strong>Délai indicatif :</strong> {estimate.transitDaysRange}
              </div>
              <ul className="space-y-1 text-[11px] text-slate-600 pt-2 border-t border-slate-200">
                {estimate.conditions.map((cond: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>{cond}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sourcing / Groupage / Freight Quote Form */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-amber-600" />
            <h2 className="font-display text-xl font-bold text-[#0F1E2E]">
              Demander un devis officiel (Sourcing, Groupage, Fret)
            </h2>
          </div>

          <form onSubmit={handleSubmitRfq} className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'china_sourcing', label: 'Recherche produit' },
                { id: 'groupage', label: 'Groupage commandes' },
                { id: 'freight_quote', label: 'Devis transport' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRequestType(opt.id as any)}
                  className={`py-2 px-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                    requestType === opt.id
                      ? 'bg-[#0F1E2E] text-white border-[#0F1E2E]'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Objet de votre demande</label>
              <input
                type="text"
                required
                value={rfqTitle}
                onChange={(e) => setRfqTitle(e.target.value)}
                placeholder="Ex. Sourcing 200 panneaux solaires 450W + groupage vers Douala"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Quantité estimée</label>
                <input
                  type="number"
                  min={1}
                  value={rfqQty}
                  onChange={(e) => setRfqQty(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Transport souhaité</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'sea' | 'air')}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="sea">Maritime (LCL / Conteneur)</option>
                  <option value="air">Fret aérien</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Cahier des charges & précisions</label>
              <textarea
                rows={4}
                required
                value={rfqDetails}
                onChange={(e) => setRfqDetails(e.target.value)}
                placeholder="Spécifications, budget cible, ville de livraison, regroupement de plusieurs fournisseurs..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 text-sm font-semibold bg-amber-600 text-white rounded-xl hover:bg-amber-700 cursor-pointer"
            >
              Envoyer la demande de devis Import Chine
            </button>

            {rfqFeedback && (
              <p className="text-xs text-emerald-700 font-medium">{rfqFeedback}</p>
            )}
          </form>
        </div>
      </section>

      {/* Active RFQs */}
      {user && myRfqs.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-bold text-[#0F1E2E]">
            Mes demandes de devis & cotations reçues ({myRfqs.length})
          </h2>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-medium">Demande</th>
                    <th className="py-3 px-4 font-medium">Type</th>
                    <th className="py-3 px-4 font-medium">Qté</th>
                    <th className="py-3 px-4 font-medium">Transport</th>
                    <th className="py-3 px-4 font-medium">Statut</th>
                    <th className="py-3 px-4 font-medium text-right">Cotation fournisseur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myRfqs.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#0F1E2E]">{r.title}</div>
                        <div className="text-xs text-slate-500 line-clamp-1">{r.quoted_notes || r.details}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{r.request_type}</td>
                      <td className="py-3 px-4 font-mono tabular-nums">{r.quantity}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{r.transport_mode === 'air' ? 'Aérien' : 'Maritime'}</td>
                      <td className="py-3 px-4 text-xs font-semibold">
                        {r.status === 'quoted' ? (
                          <span className="text-emerald-700">Devis reçu</span>
                        ) : (
                          <span className="text-amber-700">En attente</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                        {r.quoted_price_xaf ? formatMoney(r.quoted_price_xaf, currency, rates) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* China Factory Catalog */}
      <section className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#0F1E2E]">
              Catalogue direct fabricants chinois ({chinaProducts.length})
            </h2>
            <p className="text-sm text-slate-600">
              Commandez directement au prix usine ou demandez un groupage logistique.
            </p>
          </div>
        </div>

        {chinaProducts.length === 0 ? (
          <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <Search className="w-4 h-4" />
            <span>Aucun produit chinois actif pour le moment.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {chinaProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                currency={currency}
                rates={rates}
                lang={lang}
                isFavorite={favoriteIds.includes(p.id)}
                onToggleFavorite={onToggleFavorite}
                onSelect={onSelectProduct}
                onQuickAdd={onQuickAdd}
                onBuyNow={onBuyNow}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
