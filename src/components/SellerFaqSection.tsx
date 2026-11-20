import React, { useState } from 'react';
import {
  ChevronDown,
  HelpCircle,
  PackagePlus,
  Boxes,
  ShieldCheck,
  Wallet,
  ArrowRight,
} from 'lucide-react';

type FaqTopic = 'all' | 'products' | 'stock' | 'verification' | 'operations';

interface FaqItem {
  id: string;
  topic: Exclude<FaqTopic, 'all'>;
  topicLabel: string;
  question: string;
  summary: string;
  steps: string[];
  tip?: string;
  actionLabel?: string;
  actionTab?: 'products' | 'orders' | 'rfqs' | 'shop' | 'wallet';
}

interface SellerFaqSectionProps {
  hasShop: boolean;
  commissionRate: number;
  onNavigateTab?: (tab: 'products' | 'orders' | 'rfqs' | 'shop' | 'wallet') => void;
}

export const SellerFaqSection: React.FC<SellerFaqSectionProps> = ({
  hasShop,
  commissionRate,
  onNavigateTab,
}) => {
  const [selectedTopic, setSelectedTopic] = useState<FaqTopic>('all');
  const [openIds, setOpenIds] = useState<string[]>(['add-product-guide', 'verified-badge-guide']);

  const faqItems: FaqItem[] = [
    {
      id: 'add-product-guide',
      topic: 'products',
      topicLabel: 'Ajout de produits',
      question: 'Comment ajouter un produit et bien configurer mes prix gros et détail ?',
      summary:
        'Chaque fiche produit sur DILANE MARKET permet de vendre simultanément à l’unité (détail) et en quantité professionnelle (gros avec MOQ).',
      steps: [
        'Ouvrez l’onglet « Produits » de votre Espace Vendeur puis remplissez le formulaire « Publier un produit ».',
        'Choisissez la catégorie principale parmi les 14 secteurs disponibles et précisez une sous-catégorie claire pour faciliter la recherche des acheteurs.',
        'Renseignez votre Prix détail (FCFA) pour les commandes unitaires et votre Prix gros (FCFA) accompagné de la Quantité minimale de commande (MOQ).',
        'Sélectionnez un visuel net (et ajoutez un lien vidéo de démonstration si disponible) puis rédigez une description complète : spécifications, garantie et délai d’expédition.',
        'Activez l’option « Promotion » si vous souhaitez afficher une remise temporaire dans le catalogue et les promotions du jour.',
      ],
      tip: 'Les fiches comportant un écart de prix gros attractif dès 5 à 20 unités reçoivent nettement plus de demandes de devis B2B.',
      actionLabel: hasShop ? 'Ouvrir le formulaire d’ajout de produit' : undefined,
      actionTab: 'products',
    },
    {
      id: 'product-media-quality',
      topic: 'products',
      topicLabel: 'Ajout de produits',
      question: 'Quelles informations indispensables inclure dans la description d’un produit ?',
      summary:
        'Une fiche précise réduit les retours, évite les litiges et accélère les négociations avec les acheteurs internationaux.',
      steps: [
        'Indiquez l’origine exacte du stock (Stock Afrique ou Import direct Chine) ainsi que votre ville d’expédition.',
        'Précisez les caractéristiques techniques clés (tension 220V, dimensions, poids, matières, tailles disponibles ou normes CE/RoHS).',
        'Mentionnez clairement les conditions d’emballage export ou local et la présence d’une garantie ou de pièces de rechange.',
      ],
      actionLabel: hasShop ? 'Voir mes produits publiés' : undefined,
      actionTab: 'products',
    },
    {
      id: 'stock-management-guide',
      topic: 'stock',
      topicLabel: 'Gestion des stocks',
      question: 'Comment fonctionne la gestion des stocks lors des ventes au détail et en gros ?',
      summary:
        'Votre inventaire est synchronisé automatiquement avec la base de données dès qu’un paiement est confirmé côté serveur.',
      steps: [
        'Définissez votre « Stock disponible » réel au moment de la publication afin d’éviter toute commande impossible à honorer.',
        'Lorsqu’un acheteur règle sa commande (MTN Mobile Money, Orange Money, Visa ou Mastercard), le serveur déduit automatiquement la quantité achetée de votre stock et incrémente votre compteur de ventes.',
        'Si un paiement échoue ou reste en attente, le stock n’est pas amputé définitivement tant que la transaction n’est pas vérifiée.',
        'Pour les ventes en gros (MOQ), assurez-vous que votre stock reste supérieur ou égal à votre quantité minimale de commande afin que le tarif gros reste commandable.',
      ],
      tip: 'Contrôlez régulièrement la colonne « Stock » dans le tableau « Produits de ma boutique » et anticipez votre réapprovisionnement avant d’atteindre le seuil de votre MOQ.',
      actionLabel: hasShop ? 'Consulter mes niveaux de stock' : undefined,
      actionTab: 'products',
    },
    {
      id: 'stock-bulk-rfq',
      topic: 'stock',
      topicLabel: 'Gestion des stocks',
      question: 'Comment gérer une commande très importante qui dépasse mon stock immédiat ?',
      summary:
        'Utilisez les demandes de devis (RFQ) et la messagerie intégrée pour planifier la production ou le réapprovisionnement avant paiement.',
      steps: [
        'Consultez l’onglet « Devis » pour répondre aux acheteurs demandant de gros volumes ou un groupage maritime/aérien.',
        'Indiquez dans votre proposition chiffrée le prix total négocié ainsi que le délai réel de préparation ou de fabrication.',
        'Confirmez les modalités de livraison dans la messagerie avant de demander à l’acheteur de finaliser son règlement.',
      ],
      actionLabel: hasShop ? 'Accéder aux demandes de devis' : undefined,
      actionTab: 'rfqs',
    },
    {
      id: 'verified-badge-guide',
      topic: 'verification',
      topicLabel: 'Badge VENDEUR VÉRIFIÉ',
      question: 'Quelle est la procédure complète pour obtenir le badge VENDEUR VÉRIFIÉ ?',
      summary:
        'Le badge officiel VENDEUR VÉRIFIÉ certifie l’existence légale de votre entreprise et renforce immédiatement la confiance des acheteurs africains et internationaux.',
      steps: [
        'Étape 1 — Créez et complétez votre boutique virtuelle dans l’onglet « Boutique & Vérif » (nom commercial, pays, ville, zone d’expédition et présentation).',
        'Étape 2 — Préparez votre numéro de registre de commerce (RCCM ou licence commerciale officielle) ainsi que la référence de la pièce d’identité du dirigeant (CNI ou passeport).',
        'Étape 3 — Remplissez le formulaire « Vérification officielle (VENDEUR VÉRIFIÉ) » et cliquez sur « Soumettre pour vérification ».',
        'Étape 4 — Votre dossier passe au statut « En attente de validation admin ». L’équipe d’administration DILANE MARKET contrôle la cohérence de vos justificatifs.',
        'Étape 5 — Dès validation effective par l’administrateur, vous recevez une notification et le badge VENDEUR VÉRIFIÉ s’affiche automatiquement sur votre boutique et toutes vos fiches produits.',
      ],
      tip: 'Par mesure de sécurité contre les faux fournisseurs, le badge VENDEUR VÉRIFIÉ n’est jamais activé automatiquement à l’inscription : il exige toujours une validation administrative.',
      actionLabel: 'Soumettre ou suivre ma vérification',
      actionTab: 'shop',
    },
    {
      id: 'verified-badge-rejection',
      topic: 'verification',
      topicLabel: 'Badge VENDEUR VÉRIFIÉ',
      question: 'Que faire si ma demande de vérification est refusée ou reste en attente ?',
      summary:
        'Un refus signifie généralement qu’une référence de document est incomplète ou ne correspond pas au nom de la boutique.',
      steps: [
        'Vérifiez l’exactitude de votre numéro RCCM / licence commerciale et de votre référence CNI ou passeport dans l’onglet « Boutique & Vérif ».',
        'Assurez-vous que la ville et le pays déclarés correspondent bien à l’établissement enregistré.',
        'Corrigez les informations puis soumettez à nouveau le formulaire : une nouvelle alerte est aussitôt envoyée à l’administration.',
      ],
      actionLabel: 'Vérifier mes informations boutique',
      actionTab: 'shop',
    },
    {
      id: 'commissions-payouts',
      topic: 'operations',
      topicLabel: 'Commandes & Paiements',
      question: 'Comment sont calculées les commissions et quand suis-je payé ?',
      summary:
        `DILANE MARKET applique une commission transparente de ${commissionRate}% sur les ventes payées, visible en temps réel dans votre portefeuille vendeur.`,
      steps: [
        'Dès qu’un acheteur paie via MTN Mobile Money, Orange Money, Visa ou Mastercard et que le serveur confirme la transaction, la commande passe au statut PAYÉ et vous êtes notifié.',
        'Expédiez le colis depuis l’onglet « Commandes » en cliquant sur « Expédier » afin de déclencher le suivi logistique de l’acheteur.',
        'Consultez votre chiffre d’affaires brut, les commissions prélevées et votre solde net éligible dans l’onglet « Finances ».',
        'Ne livrez jamais une commande sur simple présentation d’une capture d’écran : fiez-vous uniquement au statut PAYÉ confirmé dans votre espace vendeur.',
      ],
      actionLabel: hasShop ? 'Consulter mon portefeuille finances' : undefined,
      actionTab: 'wallet',
    },
  ];

  const filteredItems =
    selectedTopic === 'all'
      ? faqItems
      : faqItems.filter((item) => item.topic === selectedTopic);

  const toggleItem = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <section
      aria-labelledby="seller-faq-heading"
      className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6"
    >
      {/* Header & Topic Filters */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
            <HelpCircle className="w-4 h-4" />
            <span>Centre d’aide vendeur DILANE MARKET</span>
          </div>
          <h2
            id="seller-faq-heading"
            className="font-display text-xl sm:text-2xl font-bold text-[#0F1E2E]"
          >
            Questions fréquentes pour les vendeurs
          </h2>
          <p className="text-sm text-slate-600 max-w-2xl">
            Guides pratiques pour publier vos produits gros et détail, maîtriser vos stocks et obtenir votre badge officiel VENDEUR VÉRIFIÉ.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto max-w-full">
          {[
            { id: 'all', label: 'Tous les guides' },
            { id: 'products', label: 'Ajout de produits' },
            { id: 'stock', label: 'Gestion des stocks' },
            { id: 'verification', label: 'VENDEUR VÉRIFIÉ' },
            { id: 'operations', label: 'Paiements' },
          ].map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => setSelectedTopic(topic.id as FaqTopic)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap cursor-pointer transition-colors ${
                selectedTopic === topic.id
                  ? 'bg-white text-[#0F1E2E] shadow-xs'
                  : 'text-slate-600 hover:text-[#0F1E2E]'
              }`}
            >
              {topic.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3 Quick-Start Pillar Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => {
            setSelectedTopic('products');
            setOpenIds(['add-product-guide', 'product-media-quality']);
          }}
          className="text-left p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer space-y-1.5"
        >
          <PackagePlus className="w-5 h-5 text-amber-600" />
          <div className="font-display text-sm font-bold text-[#0F1E2E]">
            01. Ajout de produits
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Catégories, prix détail & gros (MOQ), visuels studio et promotions.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedTopic('stock');
            setOpenIds(['stock-management-guide', 'stock-bulk-rfq']);
          }}
          className="text-left p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer space-y-1.5"
        >
          <Boxes className="w-5 h-5 text-amber-600" />
          <div className="font-display text-sm font-bold text-[#0F1E2E]">
            02. Gestion des stocks
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Déduction automatique après paiement vérifié et gestion des gros volumes.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedTopic('verification');
            setOpenIds(['verified-badge-guide', 'verified-badge-rejection']);
          }}
          className="text-left p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer space-y-1.5"
        >
          <ShieldCheck className="w-5 h-5 text-emerald-700" />
          <div className="font-display text-sm font-bold text-[#0F1E2E]">
            03. Badge VENDEUR VÉRIFIÉ
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Dossier RCCM + identité et validation officielle par l’administration.
          </p>
        </button>
      </div>

      {/* Accordion Guides */}
      <div className="divide-y divide-slate-200 border-t border-slate-200">
        {filteredItems.map((item) => {
          const isOpen = openIds.includes(item.id);
          return (
            <div key={item.id} className="py-4">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggleItem(item.id)}
                className="w-full flex items-start justify-between gap-4 text-left cursor-pointer group"
              >
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 font-medium">
                    {item.topicLabel}
                  </div>
                  <h3 className="font-display text-base font-semibold text-[#0F1E2E] group-hover:text-amber-700 transition-colors">
                    {item.question}
                  </h3>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-slate-500 shrink-0 mt-1 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-[#0F1E2E]' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="pt-3 pl-0 sm:pl-1 space-y-3">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {item.summary}
                  </p>

                  <ol className="space-y-2 text-sm text-slate-700">
                    {item.steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                        <span className="font-mono text-xs font-semibold text-amber-700 tabular-nums mt-0.5 shrink-0">
                          {String(idx + 1).padStart(2, '0')}.
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>

                  {item.tip && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed flex items-start gap-2">
                      <Wallet className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-[#0F1E2E]">Conseil vendeur :</strong> {item.tip}
                      </span>
                    </div>
                  )}

                  {item.actionLabel && item.actionTab && onNavigateTab && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onNavigateTab(item.actionTab!)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F1E2E] hover:text-amber-700 transition-colors cursor-pointer"
                      >
                        <span>{item.actionLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
