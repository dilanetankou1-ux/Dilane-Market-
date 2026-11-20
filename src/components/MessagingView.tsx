import React, { useEffect, useMemo, useState } from 'react';
import { Send, Paperclip, MessageSquare, Tag } from 'lucide-react';
import type { ChatMessage, CurrencyCode, Product, User } from '../types/marketplace';
import { apiRequest } from '../lib/api';
import { formatMoney } from '../lib/i18n';

interface MessagingViewProps {
  user: User | null;
  currency: CurrencyCode;
  rates: Record<string, number>;
  draftTarget: { receiverId: number; receiverName: string; product?: Product } | null;
  onRequireAuth: () => void;
  onMessagesLoaded: () => void;
}

export const MessagingView: React.FC<MessagingViewProps> = ({
  user,
  currency,
  rates,
  draftTarget,
  onRequireAuth,
  onMessagesLoaded,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activePeerId, setActivePeerId] = useState<number | null>(draftTarget?.receiverId || null);
  const [body, setBody] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentType, setAttachmentType] = useState<'image' | 'document' | 'video'>('document');
  const [sending, setSending] = useState(false);

  const loadMessages = async () => {
    if (!user) return;
    const res = await apiRequest<{ messages: ChatMessage[] }>('/api/messages');
    setMessages(res.messages || []);
    onMessagesLoaded();
  };

  useEffect(() => {
    if (draftTarget) {
      setActivePeerId(draftTarget.receiverId);
    }
  }, [draftTarget]);

  useEffect(() => {
    loadMessages().catch(() => {});
  }, [user]);

  const conversations = useMemo(() => {
    if (!user) return [];
    const map = new Map<number, { peerId: number; peerName: string; lastMessage: string; lastAt: string }>();
    for (const m of messages) {
      const peerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      const peerName = m.sender_id === user.id ? m.receiver_name : m.sender_name;
      map.set(peerId, { peerId, peerName, lastMessage: m.body, lastAt: m.created_at });
    }
    if (draftTarget && !map.has(draftTarget.receiverId)) {
      map.set(draftTarget.receiverId, {
        peerId: draftTarget.receiverId,
        peerName: draftTarget.receiverName,
        lastMessage: draftTarget.product ? `Sujet : ${draftTarget.product.title}` : 'Nouvelle conversation',
        lastAt: 'Maintenant',
      });
    }
    return Array.from(map.values());
  }, [messages, user, draftTarget]);

  useEffect(() => {
    if (!activePeerId && conversations.length > 0) {
      setActivePeerId(conversations[0].peerId);
    }
  }, [conversations, activePeerId]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <MessageSquare className="w-10 h-10 text-amber-600 mx-auto" />
        <h1 className="font-display text-2xl font-bold text-[#0F1E2E]">Messagerie Acheteurs & Fournisseurs</h1>
        <p className="text-sm text-slate-600">
          Connectez-vous pour négocier les prix de gros, envoyer des photos ou documents et demander des devis directement aux vendeurs.
        </p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="px-6 py-3 text-sm font-semibold bg-[#0F1E2E] text-white rounded-xl cursor-pointer"
        >
          Se connecter
        </button>
      </div>
    );
  }

  const activeThread = messages.filter(
    (m) =>
      (m.sender_id === user.id && m.receiver_id === activePeerId) ||
      (m.sender_id === activePeerId && m.receiver_id === user.id)
  );
  const activePeer = conversations.find((c) => c.peerId === activePeerId);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePeerId || !body.trim()) return;
    setSending(true);
    try {
      await apiRequest('/api/messages', {
        method: 'POST',
        body: {
          receiverId: activePeerId,
          productId: draftTarget?.product?.id || null,
          body: body.trim(),
          offerPriceXaf: offerPrice ? Number(offerPrice) : null,
          attachmentName: attachmentName.trim(),
          attachmentType: attachmentName.trim() ? attachmentType : '',
        },
      });
      setBody('');
      setOfferPrice('');
      setAttachmentName('');
      await loadMessages();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[#0F1E2E]">Messagerie commerciale</h1>
        <p className="text-sm text-slate-600">
          Conversations privées, négociations de prix et pièces jointes entre acheteurs et vendeurs.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[540px]">
        {/* Left Conversations List */}
        <aside className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200 divide-y divide-slate-100">
          <div className="p-4 text-xs font-semibold text-slate-500">
            Conversations ({conversations.length})
          </div>
          {conversations.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              Ouvrez une fiche produit et cliquez sur « Négocier / Message » pour démarrer une discussion avec un fournisseur.
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.peerId}
                type="button"
                onClick={() => setActivePeerId(conv.peerId)}
                className={`w-full text-left p-4 transition-colors cursor-pointer ${
                  activePeerId === conv.peerId ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <div className="font-semibold text-sm text-[#0F1E2E]">{conv.peerName}</div>
                <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{conv.lastMessage}</div>
              </button>
            ))
          )}
        </aside>

        {/* Right Thread */}
        <div className="md:col-span-8 flex flex-col">
          {activePeer ? (
            <>
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-display font-bold text-[#0F1E2E]">{activePeer.peerName}</div>
                  {draftTarget?.product && draftTarget.receiverId === activePeer.peerId && (
                    <div className="text-xs text-amber-700">Produit : {draftTarget.product.title}</div>
                  )}
                </div>
              </div>

              <div className="flex-1 p-5 space-y-3 overflow-y-auto max-h-[380px] bg-slate-50/50">
                {activeThread.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">
                    Démarrez votre négociation commerciale ci-dessous.
                  </p>
                ) : (
                  activeThread.map((m) => {
                    const isMine = m.sender_id === user.id;
                    return (
                      <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm space-y-1.5 ${
                            isMine
                              ? 'bg-[#0F1E2E] text-white'
                              : 'bg-white border border-slate-200 text-[#0F1E2E]'
                          }`}
                        >
                          {m.product_title && (
                            <div className={`text-[11px] ${isMine ? 'text-amber-300' : 'text-amber-700'} font-medium`}>
                              Réf. {m.product_title}
                            </div>
                          )}
                          <p className="leading-relaxed">{m.body}</p>
                          {m.offer_price_xaf ? (
                            <div
                              className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold pt-1 ${
                                isMine ? 'text-amber-300' : 'text-emerald-700'
                              }`}
                            >
                              <Tag className="w-3.5 h-3.5" />
                              <span>Prix proposé : {formatMoney(m.offer_price_xaf, currency, rates)}</span>
                            </div>
                          ) : null}
                          {m.attachment_name && (
                            <div className="inline-flex items-center gap-1.5 text-xs opacity-85 pt-1">
                              <Paperclip className="w-3.5 h-3.5" />
                              <span>{m.attachment_name} ({m.attachment_type})</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleSend} className="p-4 border-t border-slate-200 bg-white space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="number"
                    placeholder="Offre prix gros (FCFA, optionnel)"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Nom fichier joint (photo, PDF...)"
                    value={attachmentName}
                    onChange={(e) => setAttachmentName(e.target.value)}
                    className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                  <select
                    value={attachmentType}
                    onChange={(e) => setAttachmentType(e.target.value as any)}
                    className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="document">Document / Devis PDF</option>
                    <option value="image">Photo produit</option>
                    <option value="video">Vidéo inspection</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Écrivez votre message ou proposition de prix..."
                    className="flex-1 px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-amber-600"
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 inline-flex items-center gap-1.5 text-sm font-semibold cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Envoyer</span>
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500 p-8">
              Sélectionnez une conversation à gauche.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
