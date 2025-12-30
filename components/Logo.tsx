
import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'default' | 'inverted';
  align?: 'left' | 'center' | 'right';
}

export const Logo: React.FC<LogoProps> = ({ className = "", variant = 'default', align = 'left' }) => {
  const baseColor = variant === 'inverted' ? 'text-white' : 'text-teal-900';
  // En el SVG, usamos text-color para el relleno principal.
  // El acento lo aplicaremos dinámicamente si es necesario, o mantenemos el logo monocromo/bicolor según diseño.
  const justify = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';

  return (
    <div className={`flex items-center gap-3 ${justify} ${className} select-none group`}>
      <div className="relative transition-transform duration-500 group-hover:rotate-6">
        {/* AUDITORÍA 22: Integración de SVG Vectorial Personalizado */}
        <svg 
            viewBox="0 0 256 256" 
            xmlns="http://www.w3.org/2000/svg" 
            className={`w-10 h-10 ${variant === 'inverted' ? 'fill-white' : 'fill-orange-500'}`} // El logo toma el color del tema
            preserveAspectRatio="xMidYMid meet"
        >
            <path d="M 64 128 C 64 163.346 92.654 192 128 192 L 128 256 C 57.308 256 0 198.692 0 128 Z M 192 128 C 192 163.346 220.654 192 256 192 L 256 256 C 185.308 256 128 198.692 128 128 Z M 64 0 C 64 35.346 92.654 64 128 64 L 128 128 C 57.308 128 0 70.692 0 0 Z M 192 0 C 192 35.346 220.654 64 256 64 L 256 128 C 185.308 128 128 70.692 128 0 Z" />
        </svg>
      </div>
      <span className={`font-black text-3xl tracking-tighter leading-none ${baseColor}`}>
        Fresco<span className={variant === 'inverted' ? 'text-orange-300' : 'text-orange-500'}>.</span>
      </span>
    </div>
  );
};
