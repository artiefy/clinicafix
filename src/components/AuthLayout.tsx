'use client';
import { useEffect, useState } from 'react';

import Image from 'next/image';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex h-screen w-full">
      {/* Left: panel with the login form (visible on all sizes; on lg it occupies left half) */}
      <div className="relative flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md">{children}</div>
      </div>

      {/* Right: imagen lateral — centrada, más grande y con padding vertical simétrico */}
      <div className="relative hidden md:flex md:w-1/2 items-center justify-center py-12 px-8">
        <div className="w-full max-w-[520px] flex items-center justify-center">
          <Image
            src="/DIME_lado_derecho.png"
            alt="Clínica DIME - lateral"
            width={520}
            height={520}
            priority
            quality={100}
            style={{ objectFit: 'contain', maxWidth: '100%', height: 'auto' }}
          />
        </div>
      </div>
    </div>
  );
}
