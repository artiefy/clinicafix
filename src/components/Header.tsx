'use client';
import React from 'react';

import { usePathname } from 'next/navigation';

import { useUser } from '@clerk/nextjs';

import HeaderUserMenu from '@/components/HeaderUserMenu';

export default function Header() {
    const pathname = usePathname() ?? '';
    const { isSignedIn, isLoaded } = useUser();

    // Esperar a que Clerk cargue la sesión
    if (!isLoaded) return null;

    // Mostrar header únicamente en la ruta raíz (dashboard) y cuando el usuario esté autenticado
    if (!isSignedIn) return null;
    if (!pathname || pathname !== '/') return null;

    return (
        <header
            className="w-full text-white py-4 px-8 flex items-center justify-between shadow"
            style={{ background: 'linear-gradient(90deg, var(--main-1), var(--main-2))' }}
        >
            <h1 className="text-2xl font-bold">SYO - Gestión Inteligente de Egresos</h1>
            <div className="flex items-center space-x-3">
                <HeaderUserMenu />
            </div>
        </header>
    );
}
