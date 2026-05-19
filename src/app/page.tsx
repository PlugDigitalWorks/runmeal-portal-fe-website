'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';
import { branchService } from '@/services/branch.service';
import { Branch } from '@/types/branch';
import { MapPin, Building2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { user, addresses, isLoading: isContextLoading, tempAddress } = useUser();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  const activeAddress = addresses.find(a => a.isActive);

  useEffect(() => {
    if (isContextLoading) return;
    
    // Allow if user is logged in OR if we have a temporary address
    if (!user && !tempAddress) {
         return; 
    }

    // Logged in but no addresses AND no temp address?
    if (user && addresses.length === 0 && !tempAddress) {
        router.push('/profile?action=new');
        return;
    }

    // Active address OR Temp Address exists? Fetch branches
    if (activeAddress || tempAddress) {
        const fetchBranches = async () => {
            setIsLoadingBranches(true);
            try {
                // Prioritize temp address for browsing if no active address is strictly set, or just use temp if present
                // Use temp address coords if available, otherwise active address coords (if we had them in address object, but currently we rely on backend knowing active address for user)
                
                if (tempAddress) {
                    const data = await branchService.getNearbyBranches(tempAddress.location.latitude, tempAddress.location.longitude);
                     setBranches(data || []);
                } else if (activeAddress) {
                    // Normal flow
                     const data = await branchService.getNearbyBranches();
                     setBranches(data || []);
                }
            } catch (error) {
                console.error("Failed to fetch branches", error);
            } finally {
                setIsLoadingBranches(false);
            }
        };
        fetchBranches();
    }
  }, [user, addresses, activeAddress, isContextLoading, router, tempAddress]);


  if (isContextLoading) {
    return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-600"></div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <main className="flex-1 pb-20">
        {/* Hero Section */}
        <section className="relative h-[300px] md:h-[400px] w-full overflow-hidden bg-zinc-900">
           <div className="absolute inset-0 bg-linear-to-r from-zinc-800 to-zinc-800/10 z-10" />
           <Image 
              src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1600&q=80"
              alt="Food Hero"
              fill
              className="object-cover opacity-80"
              priority
           />
           
           <div className="relative z-20 container mx-auto px-4 h-full flex flex-col justify-center">
             <div className="max-w-xl space-y-4">
                 <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight">
                    Order from the Best <span className="text-orange-500">Restaurants</span>
                 </h1>
                 <p className="text-zinc-300 text-lg md:text-xl max-w-md">
                    Hungry? Order food from the best local restaurants. Delivered in minutes.
                 </p>
                 {(activeAddress || tempAddress) && (
                     <div className="flex items-center gap-2 text-orange-200 bg-black/30 w-fit px-4 py-2 rounded-lg backdrop-blur-sm">
                         <MapPin className="h-4 w-4" />
                         <span className="text-sm">
                             Delivering to: {tempAddress ? tempAddress.formattedAddress : activeAddress?.street} 
                             {activeAddress && !tempAddress && ' (Active)'}
                             {tempAddress && ' (Temporary)'}
                         </span>
                     </div>
                 )}
             </div>
           </div>
        </section>

        {/* Branches Section */}
        <section className="container mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-zinc-900 mb-6">Nearby Restaurants</h2>
            
            {isLoadingBranches ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1,2,3].map(i => (
                        <div key={i} className="h-64 bg-zinc-200 rounded-xl animate-pulse" />
                    ))}
                 </div>
            ) : branches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {branches.map(branch => (
                        <Link 
                            key={branch.id} 
                            href={`/branches/${branch.id}`}
                            className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-zinc-100 block"
                        >
                            <div className="h-40 bg-zinc-100 relative">
                                {branch.bannerUrls && branch.bannerUrls[0] ? (
                                    <Image
                                        src={branch.bannerUrls[0]}
                                        alt={branch.name}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
                                        <Building2 className="h-12 w-12 opacity-20" />
                                    </div>
                                )}
                            </div>
                            <div className="p-6">
                                <h3 className="text-lg font-bold text-zinc-900 mb-2">{branch.name}</h3>
                                <div className="space-y-2 text-sm text-zinc-600">
                                    <div className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span>{branch.addressText}</span>
                                    </div>
                                    {/* Phone removed as it is not in the response */}
                                    {branch.distanceM && (
                                        <div className="text-xs font-medium text-orange-600 mt-2">
                                            {branch.distanceM < 1000 
                                                ? `${Math.round(branch.distanceM)}m away` 
                                                : `${(branch.distanceM / 1000).toFixed(1)}km away`}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-zinc-300">
                    <div className="mx-auto w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                        <MapPin className="h-8 w-8 text-zinc-400" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-900">No restaurants found nearby</h3>
                    <p className="text-zinc-500 max-w-sm mx-auto mt-2">
                        We currently don&apos;t have any branches serving your location. Try changing your address.
                    </p>
                </div>
            )}
        </section>

      </main>
    </div>
  );
}
