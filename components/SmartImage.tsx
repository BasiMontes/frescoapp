
import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

export const SmartImage: React.FC<SmartImageProps> = ({ src, alt, className, fallbackSrc, ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) setHasError(true);
  };

  if (hasError) {
      return (
          <div className={`bg-gray-100 flex flex-col items-center justify-center text-gray-300 ${className}`}>
              <ImageOff className="w-8 h-8 mb-2" />
              <span className="text-[9px] font-black uppercase tracking-widest">Sin Imagen</span>
          </div>
      );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Placeholder con efecto shimmer mientras carga */}
      {!isLoaded && (
        <div className="absolute inset-0 skeleton-bg z-10" />
      )}
      
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-all duration-700 ${
            isLoaded ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-105 blur-lg'
        }`}
        onLoad={() => setIsLoaded(true)}
        onError={handleError}
        {...props}
      />
    </div>
  );
};
