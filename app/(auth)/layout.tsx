'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ImagePlaceholder } from '@/components/shared/image-ui';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const isLogin = pathname?.includes('/login');
  const showAuthTabs = pathname === '/login' || pathname === '/register';

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#ffffff] flex overflow-hidden">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px);  }
          50%       { transform: translateY(-8px); }
        }
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0);     }
        }
        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .animate-left  { animation: slide-in-left  0.6s ease both; }
        .animate-right { animation: slide-in-right 0.6s ease both; }
        .animate-up    { animation: fade-up        0.5s ease both; }
      `}</style>

      <div
        className={`
          flex-1 bg-[#f7f8f9]  flex flex-col items-center justify-center
          px-6 py-12 min-h-screen overflow-y-auto
          ${mounted ? 'animate-right' : 'opacity-0'}
        `}
      >
        <div className="flex flex-col items-center justify-center w-full max-w-md">
          <ImagePlaceholder label="Sneaker Store logo" aspect="8/2" className="w-2.75 mb-6" />
        </div>

        <div className="flex flex-col items-center justify-center w-full max-w-md border px-11.75 pb-10.75">
          {/* tab switcher */}
          <div className="w-full max-w-md mb-8">
            <div className={cn(' mb-7.5 ', showAuthTabs ? 'flex' : 'hidden')}>
              {(['Login', 'Register'] as const).map((label) => {
                const href = label === 'Login' ? '/login' : '/register';
                const active = label === 'Login' ? isLogin : !isLogin;
                return (
                  <Link
                    key={label}
                    href={href}
                    className={`
                    flex-1 text-center pt-7.5 pb-4.75  text-[18px] font-semibold transition-all duration-200

                    ${active ? 'border-b-2 border-b-black ' : 'text-[#7c818b] border-b-2 border-b-[#ecf0f4]'}
                  `}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
