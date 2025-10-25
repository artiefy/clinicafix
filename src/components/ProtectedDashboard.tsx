'use client';
import React, { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { SignInButton, useUser } from '@clerk/nextjs';

export default function ProtectedDashboard({ children }: { children: React.ReactNode }) {
    const { isSignedIn, user, isLoaded } = useUser();
    const router = useRouter();

    // cuando carga y no hay sesión, redirigir al sign-in
    useEffect(() => {
        if (!isLoaded) return;
        if (!isSignedIn) {
            router.push('/sign-in');
        }
    }, [isLoaded, isSignedIn, router]);

    // mientras cargamos datos de user, no renderizamos nada
    if (!isLoaded) return null;

    // si no está autenticado, mostramos un fallback con botón (en caso de que router push no haya ocurrido aún)
    if (!isSignedIn) {
        return (
            <div className="bg-white/5 rounded-xl p-6 text-center text-white">
                <p className="mb-4">Debes iniciar sesión para ver el gestor de camas y pacientes.</p>
                <SignInButton>
                    <button className="px-4 py-2 rounded bg-emerald-600 text-white">Iniciar sesión</button>
                </SignInButton>
            </div>
        );
    }

    const name = user?.fullName ?? user?.firstName ?? user?.username ?? 'Usuario';

    return (
        <div className="space-y-4">
            <div className="w-full flex items-center justify-between">
                <h2 className="text-2xl font-semibold -mt-6">Bienvenido, {name}</h2>
            </div>
            {children}
        </div>
    );
}
