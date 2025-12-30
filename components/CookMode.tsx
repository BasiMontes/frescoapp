
import React, { useState, useEffect, useRef } from 'react';
import { Recipe, Ingredient, PantryItem } from '../types';
import { X, ArrowRight, ArrowLeft, CheckCircle2, ChefHat, Flame, Clock, Timer, Play, Pause, Mic, Volume2, VolumeX, List, Minus, Plus, ChevronLeft, ChevronRight, XCircle, BellRing, Edit3, RefreshCw } from 'lucide-react';
import { VoiceAssistant } from './VoiceAssistant';

interface CookModeProps {
  recipe: Recipe;
  pantry?: PantryItem[]; // FIX: Inyectar inventario
  onClose: () => void;
  onFinish: (usedIngredients: { name: string, quantity: number, unit?: string }[]) => void;
}

// AUDITORÍA 19: Timer robusto basado en timestamp
interface ActiveTimerState {
    endTime: number; // Timestamp exacto de finalización
    totalDuration: number; // Duración original en segundos
    isRunning: boolean;
    label: string;
    pausedRemaining?: number; // Tiempo restante si se pausa
}

export const CookMode: React.FC<CookModeProps> = ({ recipe, pantry, onClose, onFinish }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [listening, setListening] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const [showReview, setShowReview] = useState(false);
  
  // GLOBAL TIMER STATE
  const [activeTimer, setActiveTimer] = useState<ActiveTimerState | null>(null);
  const [displayTime, setDisplayTime] = useState(0);
  
  // AUDITORÍA 20: ALARM STATE
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // SWIPE LOGIC VARS
  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);
  
  // Estado para la revisión final del consumo (FIX 1: Extended for editing)
  interface ReviewIngredient extends Ingredient {
      used: boolean;
      isEditing?: boolean;
  }
  const [finalIngredients, setFinalIngredients] = useState<ReviewIngredient[]>([]);

  // AUDITORÍA 17: Carga inicial de sesión
  useEffect(() => {
      const savedSession = sessionStorage.getItem('fresco_cook_state');
      let initialIngredients = recipe.ingredients.map(i => ({...i, used: true, isEditing: false}));

      if (savedSession) {
          try {
              const data = JSON.parse(savedSession);
              if (data.recipeId === recipe.id) {
                  setCurrentStep(data.step);
                  if (data.timer) setActiveTimer(data.timer);
              }
          } catch(e) {
              console.error("Error restoring session", e);
          }
      }
      setFinalIngredients(initialIngredients);
  }, [recipe.id, recipe.ingredients]);

  // Persistencia
  useEffect(() => {
      const stateToSave = { recipeId: recipe.id, step: currentStep, timer: activeTimer };
      sessionStorage.setItem('fresco_cook_state', JSON.stringify(stateToSave));
  }, [currentStep, activeTimer, recipe.id]);

  const clearSession = () => sessionStorage.removeItem('fresco_cook_state');

  // Audio Context Init
  useEffect(() => {
      if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      return () => {
          if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
      };
  }, []);

  // ... (Timer Logic and Alarm Logic unchanged) ...
  const playAlarmSound = () => {
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
  };

  useEffect(() => {
      let alarmInterval: number;
      if (isAlarmRinging) {
          playAlarmSound();
          alarmInterval = window.setInterval(playAlarmSound, 1000);
      }
      return () => { if (alarmInterval) clearInterval(alarmInterval); };
  }, [isAlarmRinging]);

  useEffect(() => {
      if (activeTimer && activeTimer.isRunning) {
          timerIntervalRef.current = window.setInterval(() => {
              const now = Date.now();
              const remaining = Math.max(0, Math.ceil((activeTimer.endTime - now) / 1000));
              setDisplayTime(remaining);
              if (remaining <= 0) {
                  setIsAlarmRinging(true);
                  if(navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
                  setActiveTimer(prev => prev ? { ...prev, isRunning: false, pausedRemaining: 0 } : null);
                  if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
              }
          }, 1000);
      } else if (activeTimer && !activeTimer.isRunning) {
          setDisplayTime(activeTimer.pausedRemaining || 0);
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      } else {
          setDisplayTime(0);
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      }
      return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [activeTimer]);

  // ... (Step Logic and Wake Lock unchanged) ...
  // Wake Lock
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          // @ts-ignore
          wakeLock = await navigator.wakeLock.request('screen');
          setWakeLockActive(true);
        }
      } catch (err) {}
    };
    requestWakeLock();
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => { if (wakeLock) wakeLock.release(); document.removeEventListener('visibilitychange', handleVisibilityChange); };
  }, []);

  const stepTime = React.useMemo(() => {
      const text = recipe.instructions[currentStep];
      const match = text.match(/(\d+)\s*(?:min|minutos|mins)/i);
      return match ? parseInt(match[1]) * 60 : null;
  }, [currentStep, recipe.instructions]);

  const handleNext = () => {
    if (currentStep < recipe.instructions.length - 1) setCurrentStep(currentStep + 1);
    else setShowReview(true);
  };
  const handlePrev = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); };

  // FIX 1: Enhanced confirmation logic with substitution support
  const confirmFinish = () => {
      clearSession();
      // Filter out unchecked ingredients
      const actualUsed = finalIngredients.filter(i => i.used).map(i => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit
      }));
      onFinish(actualUsed);
  };

  const updateFinalQty = (index: number, delta: number) => {
      setFinalIngredients(prev => {
          const newArr = [...prev];
          newArr[index].quantity = Math.max(0, newArr[index].quantity + delta);
          return newArr;
      });
  };

  const toggleUsage = (index: number) => {
      setFinalIngredients(prev => {
          const newArr = [...prev];
          newArr[index].used = !newArr[index].used;
          return newArr;
      });
  };

  const toggleEditName = (index: number) => {
      setFinalIngredients(prev => {
          const newArr = [...prev];
          newArr[index].isEditing = !newArr[index].isEditing;
          return newArr;
      });
  };

  const updateName = (index: number, newName: string) => {
      setFinalIngredients(prev => {
          const newArr = [...prev];
          newArr[index].name = newName;
          return newArr;
      });
  };

  // ... (Touch/Swipe Handlers & Speech Recognition unchanged) ...
  const onTouchStart = (e: React.TouchEvent) => { touchStartRef.current = e.targetTouches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => { touchEndRef.current = e.targetTouches[0].clientX; };
  const onTouchEnd = () => {
      if (!touchStartRef.current || !touchEndRef.current) return;
      const distance = touchStartRef.current - touchEndRef.current;
      if (distance > 50) handleNext();
      else if (distance < -50) handlePrev();
      touchStartRef.current = null; touchEndRef.current = null;
  };

  useEffect(() => {
      if (!voiceEnabled) return;
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.lang = 'es-ES';
      recognition.onstart = () => setListening(true);
      recognition.onend = () => setListening(false);
      recognition.onresult = (event: any) => {
          const last = event.results.length - 1;
          const command = event.results[last][0].transcript.trim().toLowerCase();
          if (command.includes('siguiente')) handleNext();
          else if (command.includes('atrás')) handlePrev();
      };
      recognition.start();
      return () => recognition.stop();
  }, [voiceEnabled, currentStep]);

  const startTimer = (seconds: number, label: string) => {
      const now = Date.now();
      setActiveTimer({ endTime: now + (seconds * 1000), totalDuration: seconds, isRunning: true, label });
      setDisplayTime(seconds);
  };
  
  const toggleTimer = () => {
      if (!activeTimer) return;
      if (activeTimer.isRunning) {
          const now = Date.now();
          const remaining = Math.max(0, Math.ceil((activeTimer.endTime - now) / 1000));
          setActiveTimer({ ...activeTimer, isRunning: false, pausedRemaining: remaining });
      } else {
          const now = Date.now();
          const remaining = activeTimer.pausedRemaining || activeTimer.totalDuration;
          setActiveTimer({ ...activeTimer, isRunning: true, endTime: now + (remaining * 1000) });
      }
  };

  const cancelTimer = () => { setActiveTimer(null); setIsAlarmRinging(false); };

  if (isAlarmRinging) {
      return (
          <div className="fixed inset-0 z-[6000] bg-red-600 flex flex-col items-center justify-center p-8 animate-pulse text-white">
              <div className="text-center space-y-12">
                  <BellRing className="w-48 h-48 mx-auto animate-bounce" />
                  <div>
                      <h1 className="text-6xl font-black mb-4">¡TIEMPO!</h1>
                      <p className="text-2xl font-bold uppercase tracking-widest opacity-80">{activeTimer?.label || 'Temporizador'} Finalizado</p>
                  </div>
                  <button onClick={cancelTimer} className="w-full py-10 bg-white text-red-600 rounded-[3rem] font-black text-3xl shadow-2xl active:scale-95 transition-all">DETENER AHORA</button>
              </div>
          </div>
      );
  }

  // FIX 1: UI para Revisión Final con Sustitución
  if (showReview) {
      return (
          <div className="fixed inset-0 z-[5000] bg-teal-900 flex flex-col items-center justify-center p-6 animate-fade-in text-white overflow-y-auto">
              {/* FIX 1: Datalist para autocompletado */}
              <datalist id="pantry-suggestions">
                  {pantry?.map(item => (
                      <option key={item.id} value={item.name} />
                  ))}
              </datalist>

              <div className="max-w-md w-full space-y-8 pb-20 pt-10">
                  <div className="text-center">
                      <div className="w-20 h-20 bg-green-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl animate-bounce-subtle">
                          <CheckCircle2 className="w-10 h-10 text-white" />
                      </div>
                      <h2 className="text-3xl font-black">¡Plato Terminado!</h2>
                      <p className="text-teal-200/60 font-medium mt-2 text-sm">Confirma lo que has gastado para actualizar tu stock.</p>
                  </div>

                  <div className="bg-white/10 rounded-[3rem] p-6 border border-white/5 space-y-3">
                      {finalIngredients.map((ing, i) => (
                          <div key={i} className={`p-4 rounded-2xl border transition-all ${ing.used ? 'bg-black/20 border-white/5' : 'bg-transparent border-white/5 opacity-50'}`}>
                              <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3 flex-1">
                                      <button 
                                        onClick={() => toggleUsage(i)} 
                                        className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 ${ing.used ? 'bg-green-500 border-green-500' : 'border-white/30'}`}
                                      >
                                          {ing.used && <CheckCircle2 className="w-4 h-4 text-white" />}
                                      </button>
                                      
                                      {ing.isEditing ? (
                                          <input 
                                            autoFocus
                                            list="pantry-suggestions" // FIX 1: Conexión con datalist
                                            className="bg-white/10 text-white font-bold px-2 py-1 rounded-lg w-full outline-none focus:ring-2 focus:ring-orange-500"
                                            value={ing.name}
                                            onChange={(e) => updateName(i, e.target.value)}
                                            onBlur={() => toggleEditName(i)}
                                            onKeyDown={(e) => e.key === 'Enter' && toggleEditName(i)}
                                          />
                                      ) : (
                                          <span className="font-bold text-lg capitalize truncate" onClick={() => toggleEditName(i)}>{ing.name}</span>
                                      )}
                                  </div>
                                  
                                  <button onClick={() => toggleEditName(i)} className="text-white/30 hover:text-white p-2">
                                      {ing.isEditing ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Edit3 className="w-4 h-4" />}
                                  </button>
                              </div>

                              {ing.used && (
                                  <div className="flex items-center justify-end gap-3 pl-10">
                                      <button onClick={() => updateFinalQty(i, -0.5)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20"><Minus className="w-4 h-4" /></button>
                                      <span className="font-mono font-black text-orange-400 w-16 text-center">{ing.quantity.toFixed(1)} <span className="text-[10px] text-white/50">{ing.unit}</span></span>
                                      <button onClick={() => updateFinalQty(i, 0.5)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20"><Plus className="w-4 h-4" /></button>
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>

                  <button onClick={confirmFinish} className="w-full py-6 bg-white text-teal-900 rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 transition-all">Confirmar y Guardar</button>
                  <button onClick={() => setShowReview(false)} className="w-full py-4 text-teal-300 font-bold text-sm uppercase tracking-widest hover:text-white">Volver a la receta</button>
              </div>
          </div>
      );
  }

  // Render principal
  return (
    <div 
        className="fixed inset-0 z-[5000] bg-teal-900 text-white flex flex-col animate-fade-in touch-manipulation"
        style={{ touchAction: 'none' }} 
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
    >
        <VoiceAssistant textToRead={recipe.instructions[currentStep]} active={voiceEnabled} />

        {activeTimer && (
            <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur-md rounded-full px-6 py-2 flex items-center gap-4 shadow-2xl border border-white/10 transition-all duration-500 animate-slide-up`}>
                <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black uppercase text-orange-400 tracking-widest">{activeTimer.label || 'Temporizador'}</span>
                    <span className={`font-mono font-black text-lg ${displayTime === 0 && activeTimer.isRunning === false ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                        {Math.floor(displayTime / 60)}:{(displayTime % 60).toString().padStart(2, '0')}
                    </span>
                </div>
                <div className="h-6 w-px bg-white/20" />
                <button onClick={toggleTimer} className="text-white hover:text-orange-400">{activeTimer.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
                <button onClick={cancelTimer} className="text-white hover:text-red-400"><XCircle className="w-4 h-4" /></button>
            </div>
        )}

        {/* ... (Ingredients Drawer and Header unchanged) ... */}
        {showIngredients && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end" onClick={() => setShowIngredients(false)}>
                <div className="w-3/4 max-w-sm h-full bg-white text-gray-900 p-8 flex flex-col shadow-2xl animate-slide-left" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="font-black text-2xl text-teal-900">Ingredientes</h3>
                        <button onClick={() => setShowIngredients(false)} className="p-2 bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
                        {recipe.ingredients.map((ing, i) => (
                            <div key={i} className="flex justify-between items-center border-b border-gray-100 pb-3">
                                <span className="font-bold text-gray-700 capitalize">{ing.name}</span>
                                <span className="font-black text-teal-600">{Number.isInteger(ing.quantity) ? ing.quantity : ing.quantity.toFixed(1)} {ing.unit}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        <header className="p-8 flex justify-between items-center border-b border-white/10 select-none">
            <div className="flex items-center gap-4">
                <ChefHat className="text-orange-500 w-8 h-8" />
                <div>
                    <h3 className="font-black text-xl leading-none truncate max-w-[200px]">{recipe.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-teal-400 text-[10px] font-black uppercase tracking-widest">Paso {currentStep + 1}/{recipe.instructions.length}</p>
                        {listening && <div className="flex items-center gap-1 text-[8px] font-black uppercase text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full animate-pulse"><Mic className="w-2 h-2" /> Oído</div>}
                    </div>
                </div>
            </div>
            <div className="flex gap-3">
                <button onClick={() => setShowIngredients(!showIngredients)} className="p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all active:scale-90 relative">
                    <List className="w-6 h-6" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full" />
                </button>
                <button onClick={() => setVoiceEnabled(!voiceEnabled)} className={`p-4 rounded-2xl transition-all active:scale-90 ${voiceEnabled ? 'bg-orange-500 text-white shadow-lg' : 'bg-white/10 text-gray-400'}`}>
                    {voiceEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </button>
                <button onClick={() => { if(confirm("¿Salir?")) { clearSession(); onClose(); } }} className="p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all active:scale-90"><X className="w-6 h-6" /></button>
            </div>
        </header>

        <div key={currentStep} className="flex-1 p-8 flex flex-col items-center justify-center max-w-4xl mx-auto w-full text-center relative animate-fade-in select-none">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-20 hidden md:block"><ChevronLeft className="w-16 h-16" /></div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-20 hidden md:block"><ChevronRight className="w-16 h-16" /></div>

            <div className="w-24 h-24 bg-orange-500 rounded-[2rem] flex items-center justify-center mb-10 shadow-2xl animate-pulse-subtle">
                <Flame className="w-10 h-10" />
            </div>
            <h4 className="text-2xl md:text-5xl font-black mb-10 leading-snug md:leading-tight">{recipe.instructions[currentStep]}</h4>
            
            <div className="mt-8 flex gap-4 opacity-60">
                <div className="bg-white/5 px-6 py-3 rounded-2xl border border-white/5 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-black">{recipe.prep_time} MIN</span>
                </div>
                {recipe.instructions[currentStep + 1] && (
                    <div className="hidden md:flex bg-white/5 px-6 py-3 rounded-2xl border border-white/5 items-center gap-2 max-w-[200px]">
                        <span className="text-[10px] font-bold truncate">Siguiente: {recipe.instructions[currentStep + 1]}</span>
                    </div>
                )}
            </div>

            {stepTime && (
                <div className="mt-8 animate-slide-up">
                    <button onClick={() => startTimer(stepTime, `Paso ${currentStep + 1}`)} className="bg-white/10 border border-white/10 rounded-[2.5rem] p-6 flex items-center gap-6 shadow-2xl hover:bg-white/20 transition-all group">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                             <div className="w-full h-full rounded-full border-4 border-white/10 group-hover:border-orange-500/50 transition-colors" />
                             <Timer className="w-6 h-6 absolute text-white" />
                        </div>
                        <div className="text-left">
                            <div className="font-mono text-3xl font-black tracking-widest leading-none mb-1">{Math.floor(stepTime / 60)}:{(stepTime % 60).toString().padStart(2, '0')}</div>
                            <div className="text-[10px] font-black uppercase text-teal-300 tracking-widest">Iniciar Timer Sugerido</div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Play className="w-5 h-5 fill-current" /></div>
                    </button>
                </div>
            )}
        </div>

        <div className="p-8 border-t border-white/10 bg-teal-900/50 backdrop-blur-lg pb-safe select-none">
            <div className="w-full bg-white/10 h-3 rounded-full mb-8 p-1 cursor-pointer flex gap-1">
                 {recipe.instructions.map((_, idx) => (
                    <div key={idx} className={`h-full rounded-full transition-all duration-300 flex-1 ${idx <= currentStep ? 'bg-orange-500' : 'bg-transparent'}`} />
                 ))}
            </div>
            <div className="flex gap-4 items-stretch h-24">
                {currentStep > 0 ? (
                    <button onClick={handlePrev} className="w-24 bg-white/10 text-white rounded-[2rem] font-black flex items-center justify-center hover:bg-white/20 transition-all active:scale-90"><ArrowLeft className="w-8 h-8" /></button>
                ) : <div className="w-24" />}
                <button onClick={handleNext} className="flex-1 bg-orange-500 text-white rounded-[2rem] font-black text-xl shadow-2xl flex items-center justify-center gap-4 hover:bg-orange-600 transition-all active:scale-[0.98]">
                    {currentStep === recipe.instructions.length - 1 ? <>¡He Terminado! <CheckCircle2 className="w-8 h-8 stroke-[3px]" /></> : <>Siguiente <ArrowRight className="w-8 h-8 stroke-[3px]" /></>}
                </button>
            </div>
        </div>
    </div>
  );
};
