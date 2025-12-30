
import React, { useState, useEffect } from 'react';
import { BatchSession, Recipe } from '../types';
import { ChefHat, Clock, CheckCircle2, ChevronRight, Play, ArrowLeft, Timer, Sparkles, Flame, Info, CheckSquare, Square } from 'lucide-react';

interface BatchCookingProps {
  session: BatchSession;
  recipes: Recipe[];
  onClose: () => void;
  onFinish: (timeSaved: number, completedRecipeIds: string[]) => void;
}

export const BatchCooking: React.FC<BatchCookingProps> = ({ session, recipes, onClose, onFinish }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [mode, setMode] = useState<'cooking' | 'review'>('cooking');
  // Por defecto todas marcadas como completadas
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  useEffect(() => {
      setCompletedIds(recipes.map(r => r.id));
  }, [recipes]);

  const step = session.steps[currentStep];
  const progress = ((currentStep + 1) / session.steps.length) * 100;

  const handleNext = () => {
    if (currentStep < session.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setMode('review');
    }
  };

  const toggleRecipe = (id: string) => {
      setCompletedIds(prev => 
          prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
      );
  };

  const handleFinishSession = () => {
      // Calcular tiempo ahorrado basado solo en lo completado
      // (Estimación: Suma de prep_time de las completadas - duración de sesión * (proporción completada))
      const completedRecipes = recipes.filter(r => completedIds.includes(r.id));
      const totalPrepSaved = completedRecipes.reduce((acc, r) => acc + r.prep_time, 0);
      
      // Si completaste 0 recetas, tiempo ahorrado es 0. 
      // Si completaste algo, asumimos que la sesión fue útil.
      const ratio = recipes.length > 0 ? completedRecipes.length / recipes.length : 0;
      const adjustedSessionDuration = session.total_duration * ratio;
      
      const timeSaved = Math.max(0, totalPrepSaved - adjustedSessionDuration);
      
      onFinish(timeSaved > 0 ? Math.round(timeSaved) : 0, completedIds);
  };

  if (mode === 'review') {
      return (
        <div className="fixed inset-0 z-[6000] bg-teal-900 text-white flex flex-col animate-fade-in safe-pt safe-pb overflow-y-auto">
            <div className="p-8 max-w-lg mx-auto w-full flex flex-col h-full">
                <div className="text-center mb-8 mt-10">
                    <div className="w-20 h-20 bg-green-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl animate-bounce-subtle">
                        <CheckCircle2 className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-3xl font-black">Sesión Finalizada</h2>
                    <p className="text-teal-200/60 font-medium mt-2">Confirma qué platos has logrado terminar para actualizar tu stock.</p>
                </div>

                <div className="flex-1 space-y-4 mb-8">
                    {recipes.map(recipe => {
                        const isSelected = completedIds.includes(recipe.id);
                        return (
                            <div 
                                key={recipe.id}
                                onClick={() => toggleRecipe(recipe.id)}
                                className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                                    isSelected 
                                    ? 'bg-white/10 border-green-500 shadow-lg' 
                                    : 'bg-transparent border-white/10 opacity-50'
                                }`}
                            >
                                <div className="flex items-center gap-4">
                                    <img src={recipe.image_url} className="w-12 h-12 rounded-xl object-cover bg-gray-800" />
                                    <span className="font-bold text-lg truncate max-w-[180px]">{recipe.title}</span>
                                </div>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-green-500 text-white' : 'bg-white/10 text-white/20'}`}>
                                    {isSelected ? <CheckCircle2 className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <button 
                    onClick={handleFinishSession}
                    disabled={completedIds.length === 0}
                    className="w-full py-6 bg-white text-teal-900 rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {completedIds.length === 0 ? 'Nada completado' : `Guardar (${completedIds.length}) Platos`}
                </button>
                <button onClick={onClose} className="mt-4 text-teal-400 font-bold text-sm uppercase tracking-widest hover:text-white">
                    Volver atrás
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[6000] bg-teal-900 text-white flex flex-col animate-fade-in safe-pt safe-pb">
      <header className="p-8 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="bg-orange-500 p-3 rounded-2xl shadow-lg">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-black text-xl leading-none">Smart Batch Cooking</h3>
            <p className="text-teal-400 text-[10px] font-black uppercase tracking-widest mt-1">Sesión de {session.total_duration} min</p>
          </div>
        </div>
        <button onClick={onClose} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><ArrowLeft className="w-6 h-6" /></button>
      </header>

      <div className="flex-1 p-8 flex flex-col items-center justify-center max-w-4xl mx-auto w-full text-center">
        <div className="mb-12 flex gap-4 overflow-x-auto no-scrollbar w-full justify-center">
            {step.recipes_affected.map(title => (
                <span key={title} className="bg-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10 whitespace-nowrap">
                    🍳 {title}
                </span>
            ))}
        </div>

        <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center mb-10 border border-white/10">
            {step.type === 'prep' ? <ChefHat className="w-10 h-10 text-orange-400" /> : <Flame className="w-10 h-10 text-orange-400" />}
        </div>

        <h2 className="text-3xl md:text-5xl font-black mb-10 leading-tight">
          {step.instruction}
        </h2>

        <div className="flex items-center gap-6 bg-black/20 p-6 rounded-[2.5rem] border border-white/5">
            <div className="flex flex-col items-start">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-400 mb-1">Duración</span>
                <div className="flex items-center gap-2 text-3xl font-black">
                    <Timer className="w-6 h-6 text-orange-400" />
                    {step.duration_mins}m
                </div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-400">Objetivo</p>
                <p className="font-bold text-sm">Multitasking Eficiente</p>
            </div>
        </div>
      </div>

      <div className="p-8 bg-teal-800/50 backdrop-blur-xl border-t border-white/10">
        <div className="w-full bg-white/10 h-2 rounded-full mb-8">
            <div className="bg-orange-500 h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        
        <div className="flex justify-between items-center">
            <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">Progreso de Sesión</p>
                <p className="font-black text-xl">Paso {currentStep + 1} de {session.steps.length}</p>
            </div>
            <button 
                onClick={handleNext}
                className="bg-orange-500 text-white px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-orange-600 active:scale-95 transition-all flex items-center gap-3"
            >
                {currentStep === session.steps.length - 1 ? 'Finalizar Sesión' : 'Siguiente Paso'}
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
      </div>
    </div>
  );
};
