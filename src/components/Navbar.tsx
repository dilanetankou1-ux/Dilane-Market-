import React from 'react';
import {
  ShoppingBag,
  User as UserIcon,
  MessageSquare,
  Store,
  Globe2,
  ShieldCheck,
  Package,
  LayoutGrid,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import type { LanguageCode, User } from '../types/marketplace';
import { t } from '../lib/i18n';

export type ActiveTab =
  | 'home'
  | 'import_china'
  | 'seller'
  | 'messages'
  | 'logistics'
  | 'account'
  | 'admin';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  user: User | null;
  cartCount: number;
  unreadMessages: number;
  unreadNotifications: number;
  lang: LanguageCode;
  onOpenCart: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  user,
  cartCount,
  unreadMessages,
  unreadNotifications,
  lang,
  onOpenCart,
  onOpenAuth,
}) => {
  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');

  const navItems: Array<{ id: ActiveTab; label: string; count?: number }> = [
    { id: 'home', label: t(lang, 'navCatalog') },
    { id: 'import_china', label: t(lang, 'navChina') },
    { id: 'seller', label: t(lang, 'navSell') },
    { id: 'messages', label: t(lang, 'navMessages'), count: unreadMessages },
    { id: 'logistics', label: t(lang, 'navLogistics') },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: t(lang, 'navAdmin') });
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-600 rounded-md cursor-pointer"
            aria-label="DILANE MARKET Accueil"
          >
            <BrandLogo />
          </button>

          {/* Zone 2: Concise single-line navigation links */}
          <nav
            aria-label="Navigation principale"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`relative py-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'text-[#0F1E2E] font-semibold'
                      : 'text-slate-600 hover:text-[#0F1E2E]'
                  }`}
                >
                  {item.label}
                  {item.count && item.count > 0 ? (
                    <span className="ml-1.5 text-xs font-mono tabular-nums text-amber-700 font-semibold">
                      ({item.count})
                    </span>
                  ) : null}
                  {active && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-amber-600" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Cart & Account Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenCart}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#0F1E2E] hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              aria-label={t(lang, 'cart')}
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">{t(lang, 'cart')}</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-amber-700">
                {cartCount}
              </span>
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => onSelectTab('account')}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'account'
                    ? 'bg-amber-600 text-white'
                    : 'bg-[#0F1E2E] text-white hover:bg-slate-800'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span className="max-w-[120px] truncate">{user.full_name.split(' ')[0]}</span>
                {unreadNotifications > 0 && (
                  <span className="text-xs font-mono tabular-nums text-amber-300">
                    ({unreadNotifications})
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="px-4 py-2 text-sm font-semibold bg-[#0F1E2E] text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t(lang, 'login')}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Android-Optimized Bottom Bar (compact height <= 56px, >= 44px touch targets) */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex items-center justify-around h-14 px-1"
      >
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center justify-center min-w-[52px] min-h-[44px] text-[11px] font-medium ${
            activeTab === 'home' ? 'text-amber-700 font-semibold' : 'text-slate-500'
          }`}
        >
          <LayoutGrid className="w-4 h-4 mb-0.5" />
          <span className="truncate">{t(lang, 'navCatalog')}</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('import_china')}
          className={`flex flex-col items-center justify-center min-w-[52px] min-h-[44px] text-[11px] font-medium ${
            activeTab === 'import_china' ? 'text-amber-700 font-semibold' : 'text-slate-500'
          }`}
        >
          <Globe2 className="w-4 h-4 mb-0.5" />
          <span className="truncate">Chine</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('seller')}
          className={`flex flex-col items-center justify-center min-w-[52px] min-h-[44px] text-[11px] font-medium ${
            activeTab === 'seller' ? 'text-amber-700 font-semibold' : 'text-slate-500'
          }`}
        >
          <Store className="w-4 h-4 mb-0.5" />
          <span className="truncate">{t(lang, 'navSell')}</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('messages')}
          className={`flex flex-col items-center justify-center min-w-[52px] min-h-[44px] text-[11px] font-medium ${
            activeTab === 'messages' ? 'text-amber-700 font-semibold' : 'text-slate-500'
          }`}
        >
          <MessageSquare className="w-4 h-4 mb-0.5" />
          <span className="truncate">{t(lang, 'navMessages')}</span>
        </button>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => onSelectTab('admin')}
            className={`flex flex-col items-center justify-center min-w-[52px] min-h-[44px] text-[11px] font-medium ${
              activeTab === 'admin' ? 'text-amber-700 font-semibold' : 'text-slate-500'
            }`}
          >
            <ShieldCheck className="w-4 h-4 mb-0.5" />
            <span className="truncate">Admin</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSelectTab('logistics')}
            className={`flex flex-col items-center justify-center min-w-[52px] min-h-[44px] text-[11px] font-medium ${
              activeTab === 'logistics' ? 'text-amber-700 font-semibold' : 'text-slate-500'
            }`}
          >
            <Package className="w-4 h-4 mb-0.5" />
            <span className="truncate">{t(lang, 'navLogistics')}</span>
          </button>
        )}
      </nav>
    </>
  );
};
