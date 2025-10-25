'use client';

import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100">
          <div className="rounded-lg bg-white p-8 shadow-xl">
            <h2 className="mb-4 text-3xl font-bold text-red-600">
              ¡Algo salió mal!
            </h2>
            <p className="mb-6 text-gray-600">
              {error.message || 'Ha ocurrido un error inesperado'}
            </p>
            <div className="flex gap-4">
              <button
                onClick={reset}
                className="rounded-lg bg-blue-500 px-6 py-2 text-white transition-colors hover:bg-blue-600"
              >
                Intentar de nuevo
              </button>
              <Link
                href="/"
                className="rounded-lg bg-amber-500 px-6 py-2 text-white transition-colors hover:bg-amber-600"
              >
                Volver al Inicio
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
