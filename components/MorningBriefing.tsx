
import React from 'react';
import { PantryItem, MealSlot, Recipe } from '../types';
import { AlertOctagon, ArrowRight, X, Clock, Zap, ChefHat, Calendar } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';

interface MorningBriefingProps {
  pantry: PantryItem[];
  userName: string;
  dailyPlan: { slot: MealSlot, recipe?: Recipe }[]; // Nuevo prop
  onClose: () => void;
  onCookNow: (itemName: string) => void;
}

export const MorningBriefing: React.FC<MorningBriefingProps> = ({ pantry, userName, dailyPlan, onClose, onCookNow }) => {
  const criticalItems = pantry.filter(item => {
      if (!item.expires_at) return false;
      const days = differenceInDays(new Date(item.expires_at), new Date());
      return days <= 2; // Muy críticos: Hoy, mañana o pasado.
  }).sort((a, b) => new Date(a.expires_at!).getTime() - new Date(b.expires_at!).getTime());

  // Buscar si hay almuerzo o cena planificados hoy
  const lunch = dailyPlan.find(p => p.slot.type === 'lunch');
  const dinner = dailyPlan.find(p => p.slot.type === 'dinner');

  if (criticalItems.length === 0 && !lunch && !dinner) return null;

  return (
    <div className="fixed inset-0 z-[9000] bg-teal-900/90 backdrop-blur-3xl flex items-center justify-center p-6 animate-fade-in">
        <div className="w-full max-w-md bg-white rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
            <button onClick={onClose} className="absolute top-8 right-8 p-2 bg-gray-50 rounded-full hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
            
            <div className="mb-8">
                <h2 className="text-3xl font-black text-gray-900 mb-2">Buenos días, {userName.split(' ')[0]}</h2>
                <p className="text-gray-500 font-medium">Aquí tienes tu resumen para hoy.</p>
            </div>

            {/* SECCIÓN 1: EL MENÚ DE HOY */}
            {(lunch || dinner) && (
                <div className="mb-8 space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-teal-600 flex items-center gap-2 mb-2">
                        <Calendar className="w-3 h-3" /> Menú de Hoy
                    </h4>
                    {lunch && (
                        <div className="flex items-center gap-4 p-4 bg-teal-50 rounded-2xl border border-teal-100">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm">🥘</div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-teal-400">Almuerzo</p>
                                <p className="font-bold text-teal-900 leading-tight">{lunch.recipe?.title || 'Receta planificada'}</p>
                            </div>
                        </div>
                    )}
                    {dinner && (
                        <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm">🌙</div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Cena</p>
                                <p className="font-bold text-indigo-900 leading-tight">{dinner.recipe?.title || 'Receta planificada'}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* SECCIÓN 2: CADUCIDAD (Solo si hay) */}
            {criticalItems.length > 0 && (
                <div className="space-y-3 mb-8">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-2 mb-2">
                        <AlertOctagon className="w-3 h-3" /> Prioridad Consumo
                    </h4>
                    {criticalItems.slice(0, 2).map(item => {
                        const days = differenceInDays(new Date(item.expires_at!), new Date());
                        return (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-2xl border border-red-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                    <span className="font-bold text-gray-800 capitalize text-sm">{item.name}</span>
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-red-500 bg-white px-2 py-1 rounded-lg">
                                    {days <= 0 ? 'HOY' : `${days}d`}
                                </span>
                            </div>
                        );
                    })}
                    {criticalItems.length > 0 && (
                        <button 
                            onClick={() => {
                                onCookNow(criticalItems[0].name);
                                onClose();
                            }}
                            className="w-full mt-2 py-3 bg-red-100 text-red-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-200 transition-all flex items-center justify-center gap-2"
                        >
                            <Zap className="w-4 h-4" /> Cocinar con {criticalItems[0].name}
                        </button>
                    )}
                </div>
            )}
            
            <button onClick={onClose} className="w-full py-4 bg-teal-900 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl hover:bg-teal-800 transition-all active:scale-95">
                ¡A por el día!
            </button>
        </div>
    </div>
  );
};
