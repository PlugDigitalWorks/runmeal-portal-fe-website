'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { User as UserIcon, LogOut } from 'lucide-react';
import { RUNMEAL_LOGO } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/auth.service';
import { User } from '@/types/auth';
import { Address } from '@/types/address';
import { MapPin } from 'lucide-react';
import { CartDrawer } from '@/components/ui/CartDrawer';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

interface HeaderProps {
  user: User | null;
  addresses?: Address[];
  onAddressSelect?: (id: string) => void;
  searchComponent?: React.ReactNode;
}

export function Header({ user, addresses = [], onAddressSelect, searchComponent }: HeaderProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const activeAddressId = addresses.find(a => a.isActive)?.id || '';

  const handleLogout = async () => {
    await authService.logout();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Image
            src={RUNMEAL_LOGO}
            alt="Runmeal"
            width={120}
            height={32}
            className="h-8 w-auto"
            priority
          />
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-end">
          
          {/* Search Component - Always visible on desktop if provided, or could be conditional */}
          {searchComponent && (
             <div className="flex-1 max-w-xl mx-4 hidden md:block">
                 {searchComponent}
             </div>
          )}

          {user ? (
            <>
               {/* Address Selector - Hide if search is focused? Or keep both? Keeping both for now but distinct positions */}
               <div className="hidden md:flex items-center gap-2 max-w-[200px] lg:max-w-[300px]">
                   <div className="text-orange-500 bg-orange-50 p-2 rounded-full">
                       <MapPin className="h-4 w-4" />
                   </div>
                   <select 
                       className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer font-medium text-zinc-700 truncate w-full outline-none"
                       value={activeAddressId}
                       onChange={(e) => onAddressSelect?.(e.target.value)}
                       title={t('header.selectAddress')}
                   >
                       {addresses.map(addr => (
                           <option key={addr.id} value={addr.id}>
                               {addr.street} {addr.buildingNumber} ({addr.district})
                           </option>
                       ))}
                   </select>
               </div>

               <div className="h-6 w-px bg-zinc-200 mx-2 hidden sm:block"></div>

               <CartDrawer />

              <Button variant="ghost" size="sm" onClick={() => router.push('/profile')}>
                <UserIcon className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{user.firstName}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">{t('header.logout')}</span>
              </Button>
              <LanguageSwitcher />
            </>
          ) : (
            <>
               <Link href="/login">
                <Button variant="ghost" size="sm">
                  {t('header.signIn')}
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="rounded-full px-6">
                  {t('header.signUp')}
                </Button>
              </Link>
              <LanguageSwitcher />
            </>
          )}
        </div>
      </div>
      
      {/* Mobile Address Selector */}
      {user && addresses.length > 0 && (
          <div className="md:hidden border-t border-zinc-100 bg-white/95 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
               <MapPin className="h-4 w-4 text-orange-500 shrink-0" />
               <select 
                   className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer font-medium text-zinc-700 truncate w-full outline-none"
                   value={activeAddressId}
                   onChange={(e) => onAddressSelect?.(e.target.value)}
                   aria-label={t('header.selectAddress')}
               >
                   {addresses.map(addr => (
                       <option key={addr.id} value={addr.id}>
                           {addr.street} {addr.buildingNumber}, {addr.district}
                       </option>
                   ))}
               </select>
          </div>
      )}
    </header>
  );
}
