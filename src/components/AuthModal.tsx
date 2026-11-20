import React, { useState } from 'react';
import { X, ShieldCheck, KeyRound } from 'lucide-react';
import { apiRequest, setAuthToken } from '../lib/api';
import { PRIORITY_COUNTRIES } from '../lib/i18n';
import type { User } from '../types/marketplace';
import { BrandLogo } from './BrandLogo';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'buyer' | 'seller' | 'carrier'>('buyer');
  const [countryCode, setCountryCode] = useState('CM');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: { identifier, password },
      });
      setAuthToken(res.token);
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const chosenCountry = PRIORITY_COUNTRIES.find((c) => c.code === countryCode);
      const res = await apiRequest<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: {
          fullName,
          email: email || undefined,
          phone: phone || undefined,
          password,
          role,
          countryCode,
          currencyCode: chosenCountry?.defaultCurrency || 'XAF',
        },
      });
      setAuthToken(res.token);
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillPreset = (id: string, pwd: string) => {
    setMode('login');
    setIdentifier(id);
    setPassword(pwd);
    setError('');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Authentification DILANE MARKET"
    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <BrandLogo />
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`py-2 text-sm font-semibold rounded-md cursor-pointer ${
                mode === 'login' ? 'bg-white text-[#0F1E2E] shadow-xs' : 'text-slate-600'
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`py-2 text-sm font-semibold rounded-md cursor-pointer ${
                mode === 'register' ? 'bg-white text-[#0F1E2E] shadow-xs' : 'text-slate-600'
              }`}
            >
              Créer un compte
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium">
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Adresse e-mail ou numéro de téléphone
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ex. dilanetankou1@gmail.com ou +237690112233"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-amber-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-amber-600"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-sm font-semibold bg-[#0F1E2E] text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Vérification...' : 'Se connecter'}
              </button>

              {/* Quick Access Presets for Testing All Roles */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                  <span>Accès rapides préconfigurés (base SQL active)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fillPreset('dilanetankou1@gmail.com', 'DilaneAdmin2026!')}
                    className="px-2.5 py-2 text-xs text-left border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="font-semibold text-[#0F1E2E]">Admin Principal</div>
                    <div className="text-[11px] text-slate-500 truncate">dilanetankou1@gmail.com</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillPreset('vendeur@camtech-cm.com', 'Vendeur2026!')}
                    className="px-2.5 py-2 text-xs text-left border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="font-semibold text-[#0F1E2E]">Vendeur Vérifié</div>
                    <div className="text-[11px] text-slate-500 truncate">CamTech Douala</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillPreset('acheteur@dilanemarket.com', 'Acheteur2026!')}
                    className="px-2.5 py-2 text-xs text-left border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="font-semibold text-[#0F1E2E]">Compte Acheteur</div>
                    <div className="text-[11px] text-slate-500 truncate">Samuel Ndongo</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillPreset('ops@afrocargo-transit.com', 'Logistique2026!')}
                    className="px-2.5 py-2 text-xs text-left border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="font-semibold text-[#0F1E2E]">Transporteur</div>
                    <div className="text-[11px] text-slate-500 truncate">AfroCargo Transit</div>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Type de compte</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'buyer', label: 'Acheteur' },
                    { id: 'seller', label: 'Vendeur' },
                    { id: 'carrier', label: 'Transporteur' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRole(r.id as 'buyer' | 'seller' | 'carrier')}
                      className={`py-2 text-xs font-semibold rounded-lg border cursor-pointer ${
                        role === r.id
                          ? 'bg-[#0F1E2E] text-white border-[#0F1E2E]'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nom complet / Entreprise</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex. Jean-Paul Kamga"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    required={!email}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+237 6XX XXX XXX"
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Pays</label>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white"
                  >
                    {PRIORITY_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Adresse e-mail</label>
                <input
                  type="email"
                  required={!phone}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@entreprise.com"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mot de passe (min. 6 caractères)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-sm font-semibold bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Création en cours...' : 'Créer mon compte gratuitement'}
              </button>

              <p className="flex items-start gap-2 text-[11px] text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Vos données sont chiffrées et protégées. DILANE MARKET ne vous demandera jamais votre code PIN Mobile Money.
                </span>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
