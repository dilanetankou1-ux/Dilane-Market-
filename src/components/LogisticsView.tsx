import React, { useEffect, useState } from 'react';
import { Truck, Search, MapPin, CheckCircle2, Plus } from 'lucide-react';
import type { Order, ShipmentEvent, User } from '../types/marketplace';
import { apiRequest } from '../lib/api';

interface LogisticsViewProps {
  user: User | null;
}

export const LogisticsView: React.FC<LogisticsViewProps> = ({ user }) => {
  const [trackingQuery, setTrackingQuery] = useState('TRK-DM-884120CM');
  const [tracked, setTracked] = useState<{ shipment: Order; events: ShipmentEvent[] } | null>(null);
  const [trackError, setTrackError] = useState('');

  const [carrierShipments, setCarrierShipments] = useState<Order[]>([]);
  const [eventLocations, setEventLocations] = useState<Record<number, string>>({});
  const [eventLabels, setEventLabels] = useState<Record<number, string>>({});
  const [eventStatuses, setEventStatuses] = useState<Record<number, string>>({});
  const [carrierNotice, setCarrierNotice] = useState('');

  const isCarrierOrAdmin = user && ['carrier', 'admin', 'super_admin'].includes(user.role);

  const handleTrack = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setTrackError('');
    try {
      const res = await apiRequest<{ shipment: Order; events: ShipmentEvent[] }>(
        `/api/logistics/track/${encodeURIComponent(trackingQuery.trim())}`
      );
      setTracked(res);
    } catch (err: any) {
      setTracked(null);
      setTrackError(err.message);
    }
  };

  const loadCarrierShipments = async () => {
    if (!isCarrierOrAdmin) return;
    const res = await apiRequest<{ shipments: Order[] }>('/api/logistics/shipments');
    setCarrierShipments(res.shipments || []);
  };

  useEffect(() => {
    handleTrack();
  }, []);

  useEffect(() => {
    loadCarrierShipments().catch(() => {});
  }, [user]);

  const handleAddEvent = async (orderId: number) => {
    setCarrierNotice('');
    await apiRequest(`/api/logistics/shipments/${orderId}/events`, {
      method: 'POST',
      body: {
        location: eventLocations[orderId] || 'Hub logistique Douala',
        statusLabel: eventLabels[orderId] || 'Colis arrivé au point de transit',
        description: 'Mise à jour enregistrée par le transporteur partenaire.',
        orderStatus: eventStatuses[orderId] || 'in_transit',
      },
    });
    setCarrierNotice('Étape logistique enregistrée et notification envoyée à l’acheteur.');
    await loadCarrierShipments();
    if (tracked && tracked.shipment.id === orderId) {
      await handleTrack();
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 space-y-10">
      <div className="space-y-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0F1E2E]">
          Livraison & Suivi Logistique International
        </h1>
        <p className="text-sm text-slate-600">
          Suivez en temps réel vos colis locaux, aériens et maritimes grâce à votre numéro de suivi ou numéro de commande.
        </p>
      </div>

      {/* Public Tracker */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
        <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={trackingQuery}
              onChange={(e) => setTrackingQuery(e.target.value)}
              placeholder="Entrez un numéro de suivi (ex. TRK-DM-884120CM ou DM-2026-10041)"
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 text-sm font-semibold bg-[#0F1E2E] text-white rounded-xl hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            Suivre le colis
          </button>
        </form>

        {trackError && <p className="text-sm text-rose-700 font-medium">{trackError}</p>}

        {tracked && (
          <div className="space-y-5 pt-4 border-t border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">Numéro de suivi</div>
                <div className="font-mono font-bold text-amber-700">{tracked.shipment.tracking_number}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Transporteur</div>
                <div className="font-semibold text-[#0F1E2E]">{tracked.shipment.carrier_name}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Destination & Mode</div>
                <div className="font-semibold text-[#0F1E2E]">
                  {tracked.shipment.shipping_city}, {tracked.shipment.country_code} ({tracked.shipment.shipping_mode})
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Statut actuel</div>
                <div className="font-semibold text-emerald-700 uppercase">{tracked.shipment.order_status}</div>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-700">Historique des déplacements</div>
              {tracked.events.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[#0F1E2E]">
                      {ev.status_label}{' '}
                      <span className="font-normal text-slate-500 text-xs">
                        · <MapPin className="w-3 h-3 inline" /> {ev.location} · {ev.created_at}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{ev.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Partner Carrier Workspace */}
      {isCarrierOrAdmin && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-600" />
            <h2 className="font-display text-xl font-bold text-[#0F1E2E]">
              Espace Transporteur Partenaire ({carrierShipments.length} expéditions)
            </h2>
          </div>

          {carrierNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
              {carrierNotice}
            </div>
          )}

          <div className="space-y-3">
            {carrierShipments.map((s) => (
              <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <div>
                    <span className="font-mono font-bold text-[#0F1E2E]">{s.tracking_number}</span>
                    <span className="text-slate-500 text-xs ml-2">
                      ({s.order_number}) · Destinataire : {s.buyer_name} — {s.shipping_city}, {s.country_code}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-amber-700 uppercase">{s.order_status}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-slate-100">
                  <input
                    type="text"
                    placeholder="Ville / Port / Hub (ex. Port de Douala)"
                    value={eventLocations[s.id] || ''}
                    onChange={(e) => setEventLocations({ ...eventLocations, [s.id]: e.target.value })}
                    className="sm:col-span-4 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Étape (ex. Dédouanement terminé)"
                    value={eventLabels[s.id] || ''}
                    onChange={(e) => setEventLabels({ ...eventLabels, [s.id]: e.target.value })}
                    className="sm:col-span-4 px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                  <select
                    value={eventStatuses[s.id] || 'in_transit'}
                    onChange={(e) => setEventStatuses({ ...eventStatuses, [s.id]: e.target.value })}
                    className="sm:col-span-2 px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="preparing">Préparation</option>
                    <option value="shipped">Expédié</option>
                    <option value="in_transit">En transit</option>
                    <option value="delivered">Livré</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => handleAddEvent(s.id)}
                    className="sm:col-span-2 py-2 px-3 text-xs font-semibold bg-[#0F1E2E] text-white rounded-lg inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Scanner</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
