
import React, { useEffect, useState, useCallback } from 'react';
import { Mic, Volume2, StopCircle, PlayCircle, Activity, RotateCcw } from 'lucide-react';

interface VoiceAssistantProps {
  textToRead: string;
  active: boolean;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ textToRead, active }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if ('speechSynthesis' in window) {
        setSupported(true);
    }
  }, []);

  const speak = useCallback(() => {
    if (!supported || !active || !textToRead) return;
    
    // Cancelar cualquier audio previo
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [textToRead, supported, active]);

  const stop = () => {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
  };

  const handleRepeat = () => {
      stop();
      setTimeout(() => speak(), 200); // Pequeño delay para asegurar limpieza
  };

  // AUDITORÍA 14: Debounce para evitar "locutor ansioso"
  useEffect(() => {
      if (active && textToRead) {
          // Si el usuario cambia de paso rápido, cancelamos el timer anterior.
          // Solo hablamos si el usuario se queda en el paso > 1000ms.
          const timer = setTimeout(() => {
             speak();
          }, 1000); 
          
          return () => {
              clearTimeout(timer);
              window.speechSynthesis.cancel(); // También callamos si cambia antes de terminar
              setIsSpeaking(false);
          };
      }
  }, [textToRead, active, speak]);

  // Limpieza al desmontar
  useEffect(() => {
      return () => {
          window.speechSynthesis.cancel();
      };
  }, []);

  if (!active || !supported) return null;

  return (
    <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[5001] animate-slide-up">
      <div className="flex items-center gap-2 bg-teal-800/90 backdrop-blur-md px-4 py-3 rounded-full shadow-2xl border border-white/10">
          <div className="relative">
             {isSpeaking && (
                 <span className="absolute -inset-1 rounded-full bg-orange-400 animate-ping opacity-75"></span>
             )}
             <div className="relative z-10 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                 <Activity className={`w-4 h-4 ${isSpeaking ? 'text-orange-400' : 'text-teal-200'}`} />
             </div>
          </div>
          
          <div className="flex flex-col mr-4 ml-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-teal-200">Voz</span>
              <span className="text-xs font-bold text-white leading-none">{isSpeaking ? 'Hablando...' : 'Listo'}</span>
          </div>

          <div className="flex gap-2">
              <button 
                onClick={handleRepeat}
                className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all active:scale-90"
                title="Repetir"
              >
                  <RotateCcw className="w-5 h-5" />
              </button>
              <button 
                onClick={isSpeaking ? stop : speak}
                className="p-2 bg-white text-teal-900 rounded-full hover:bg-orange-500 hover:text-white transition-all active:scale-90"
              >
                  {isSpeaking ? <StopCircle className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
              </button>
          </div>
      </div>
    </div>
  );
};
