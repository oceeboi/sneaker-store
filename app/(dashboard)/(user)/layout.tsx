'use client';
import { User_Dashboard_Nav } from '@/components/navigation';
import { HeaderBox } from '@/components/shared';

export default function ({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative pb-16 pt-10 sm:pt-12 lg:pb-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-linear-to-b from-black/3 to-transparent" />
      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <HeaderBox />
        <section className="mt-8 grid items-start gap-6 lg:mt-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[19.5rem_minmax(0,1fr)]">
          <User_Dashboard_Nav />
          {/* <div className="min-w-0 rounded-2xl border border-black/10 bg-white/90 p-4 shadow-[0_20px_55px_-40px_rgba(0,0,0,0.85)] backdrop-blur-sm sm:p-6 lg:p-8"> */}
          {children}
          {/* </div> */}
        </section>
      </div>
    </section>
  );
}
