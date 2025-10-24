'use client';

import React, { useState } from 'react';

import Image from 'next/image';

import * as Clerk from '@clerk/elements/common';
import * as SignIn from '@clerk/elements/sign-in';

import AuthLayout from '@/components/AuthLayout';

const errorMessages = {
  form_identifier_not_found: 'No existe una cuenta con este correo electrónico',
  form_password_incorrect: 'La contraseña es incorrecta',
  form_identifier_missing: 'El correo electrónico es obligatorio',
  form_password_missing: 'La contraseña es obligatoria',
  form_password_length: 'La contraseña debe tener al menos 8 caracteres',
  form_identifier_invalid: 'Por favor ingrese un correo electrónico válido',
  network_error: 'Error de conexión. Por favor intente nuevamente',
} as const;

export default function SignInPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    email: '',
    password: '',
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleValidation = (field: string, value: string) => {
    const errors = { ...validationErrors };

    if (field === 'email') {
      if (!value) {
        errors.email = 'El correo electrónico es obligatorio';
      } else if (!validateEmail(value)) {
        errors.email = 'Por favor ingrese un correo electrónico válido';
      } else {
        errors.email = '';
      }
    }

    if (field === 'password') {
      if (!value) {
        errors.password = 'La contraseña es obligatoria';
      } else if (value.length < 8) {
        errors.password = 'La contraseña debe tener al menos 8 caracteres';
      } else {
        errors.password = '';
      }
    }

    setValidationErrors(errors);
  };

  return (
    <AuthLayout>
      <div className="grid w-full flex-grow items-center px-4 sm:justify-center">
        <SignIn.Root>
          {/* Header con padding vertical simétrico para espacio igual arriba/abajo */}
          <SignIn.Step name="start" className="w-full space-y-8 sm:w-96">
            <header className="text-center py-6">
              {/* Logo DIME arriba del formulario (aumentado y centrado) */}
              <div className="mx-auto mb-4 h-28 w-48 relative">
                {/* Si el nombre real del archivo contiene un espacio use la ruta codificada */}
                <Image
                  src="/DIME_arriba_el%20_login.png"
                  alt="Clínica DIME - logo"
                  fill
                  priority
                  sizes="(max-width: 192px) 100vw, 192px"
                  style={{ objectFit: 'contain' }}
                  quality={100}
                />
              </div>

              <h2 className="mt-4 text-xl font-extrabold tracking-tight text-neutral-950">
                Iniciar Sesión
              </h2>
            </header>

            {/* Mensaje de error global */}
            <Clerk.GlobalError className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-500">
              {({ message }) =>
                errorMessages[message as keyof typeof errorMessages] || message
              }
            </Clerk.GlobalError>

            <div className="space-y-6">
              <Clerk.Field name="identifier">
                <Clerk.Input
                  type="email"
                  required
                  placeholder="Correo electrónico"
                  className="w-full border-b-2 border-black bg-transparent px-0 py-2 font-bold text-white placeholder:text-black/30 focus:border-indigo-500 focus:ring-0 focus:outline-none"
                  autoComplete="email"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    handleValidation('email', e.target.value);
                  }}
                />
                <div className="mt-1 min-h-[20px] text-xs font-medium">
                  <Clerk.FieldError className="text-red-500">
                    {() => validationErrors.email}
                  </Clerk.FieldError>
                </div>
              </Clerk.Field>

              <Clerk.Field name="password" className="relative">
                <div className="relative">
                  <Clerk.Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Contraseña"
                    className="w-full border-b-2 border-black bg-transparent px-0 py-2 pr-10 font-bold text-white placeholder:text-black/30 focus:border-indigo-500 focus:ring-0 focus:outline-none"
                    autoComplete="current-password"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      handleValidation('password', e.target.value);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-700 hover:text-white"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="mt-1 min-h-[20px] text-xs font-medium">
                  <Clerk.FieldError className="text-red-500">
                    {() => validationErrors.password}
                  </Clerk.FieldError>
                </div>
              </Clerk.Field>

              <SignIn.Action
                submit
                className="relative flex h-10 w-full items-center justify-center rounded-lg bg-[var(--main-1)] px-4 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#064f4c] active:bg-[#043f3d] focus-visible:outline-offset-2 focus-visible:outline-[#064f4c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Clerk.Loading>
                  {(isLoading) => (
                    <div className="flex items-center gap-2">
                      {isLoading ? (
                        <svg
                          className="h-5 w-5 animate-spin"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : (
                        'Ingresar'
                      )}
                    </div>
                  )}
                </Clerk.Loading>
              </SignIn.Action>
            </div>
          </SignIn.Step>
        </SignIn.Root>
      </div>
    </AuthLayout>
  );
}
