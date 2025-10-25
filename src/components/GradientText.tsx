import React, { ReactNode } from 'react';

interface GradientTextProps {
  children: ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  showBorder?: boolean;
}

export default function GradientText({
  children,
  className = '',
  colors = ['#ffaa40', '#9c40ff', '#ffaa40'],
  animationSpeed = 8,
  showBorder = false
}: GradientTextProps) {
  const gradientStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(to right, ${colors.join(', ')})`,
    animationDuration: `${animationSpeed}s`,
    backgroundSize: '300% 100%',
  };

  return (
    <div
      className={`relative mx-auto flex max-w-fit flex-row items-center justify-center font-medium backdrop-blur transition-shadow duration-500 overflow-hidden cursor-pointer`}
    >
      {showBorder && (
        <div
          className="absolute inset-0 bg-cover z-0 pointer-events-none animate-gradient"
          style={{
            ...gradientStyle,
          }}
        >
          <div
            className="absolute inset-0 bg-black rounded-[1.25rem] z-[-1]"
            style={{
              width: 'calc(100% - 2px)',
              height: 'calc(100% - 2px)',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          />
        </div>
      )}

      {/* Pasamos className al elemento de texto para que utilidades como text-4xl se apliquen correctamente */}
      <div
        className={`inline-block relative z-2 bg-cover animate-gradient ${className}`}
        style={{
          ...gradientStyle,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          WebkitTextFillColor: 'transparent', // refuerzo para Safari / WebKit
        } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}
