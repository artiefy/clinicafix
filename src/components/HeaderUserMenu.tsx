'use client';
import React from 'react';

import { SignedIn, UserButton } from '@clerk/nextjs';

export default function HeaderUserMenu() {
  return (
    <div className="flex items-center">
      <SignedIn>
        {/* showName muestra el nombre junto al avatar; ajuste visual con clases tailwind si hace falta */}
        <UserButton showName userProfileMode="modal" />
      </SignedIn>
    </div>
  );
}
