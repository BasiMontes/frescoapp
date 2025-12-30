
import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, Recipe, PantryItem, MealSlot } from '../types';
import { ChefHat, Sparkles, ArrowRight, PiggyBank, Package, RefreshCw, TrendingUp, AlertTriangle, Zap, Clock, Smile, WifiOff, Sunrise, Sun, Moon, Timer, Apple, Minus, CloudCog, FlaskConical } from 'lucide-react';
import { generateRecipesAI } from '../services/geminiService';
import { SPANISH_PRICES } from '../constants';
import { differenceInDays, getHours, format } from 'date-fns';
import { MorningBriefing } from './MorningBriefing';

interface DashboardProps {
  user: UserProfile;
  pantry: PantryItem[];
  mealPlan?: MealSlot[]; 
  recipes?: Recipe[]; 
  onNavigate: (tab: string) => void;
  onQuickRecipe: (ingredientName: string) => void; 
  onResetApp: () => void;
  onQuickConsume?: (id: string) => void;
  isOnline?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, pantry, mealPlan = [], recipes = [], onNavigate, onQuickRecipe, onResetApp, onQuickConsume, isOnline = true }) => {
  const [showBriefing, setShowBriefing] = useState(false);

  useEffect(() => {
      const hour = getHours(new Date());
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const lastBriefingDate = localStorage.getItem('fresco_briefing_seen_date');
      
      const criticalCount = pantry.filter(i => i.expires_at && differenceInDays(new Date(i.expires_at), new Date()) <= 2).length;
      const today = format(new Date(), 'yyyy-MM-dd');
      const hasPlanToday = mealPlan.some(slot => slot.date === today);

      if (hour >= 5 && hour < 12 && lastBriefingDate !== todayStr && (criticalCount > 0 || hasPlanToday)) {
          const timer = setTimeout(() => setShowBriefing(true), 1500);
          return () => clearTimeout(timer);
      }
  }, [pantry, mealPlan]);

  const handleCloseBriefing = () => {
      setShowBriefing(false);
      localStorage.setItem('fresco_briefing_seen_date', format(new Date(), 'yyyy-MM-dd'));
  };

  const dailyPlanDetails = useMemo(() => {
      const today = format(new Date(), 'yyyy-MM-dd');
      return mealPlan
          .filter(slot => slot.date === today)
          .map(slot => ({
              slot,
              recipe: recipes.find(r => r.id === slot.recipeId)
          }));
  }, [mealPlan, recipes]);

  const snackItems = useMemo(() => {
      return pantry.filter(item => {
          const isSnackCategory = ['fruits', 'dairy', 'other'].includes(item.category);
          const isQuantity = item.quantity >= 1;
          return isSnackCategory && isQuantity;
      }).sort((a, b) => b.quantity - a.quantity).slice(0, 5); 
  }, [pantry]);

  const timeGreeting = useMemo(() => {
      const h = getHours(new Date());
      if (h < 12) return { text: "Buenos días", icon: Sunrise };
      if (h < 20) return { text: "Buenas tardes", icon: Sun };
      return { text: "Buenas noches", icon: Moon };
  }, []);

  return (
    <div className="p-4 md:p-10 space-y-10 pb-32 max-w-6xl mx-auto animate-fade-in relative">
      
      {showBriefing && (
          <MorningBriefing 
            pantry={pantry} 
            userName={user.name} 
            dailyPlan={dailyPlanDetails} 
            onClose={handleCloseBriefing} 
            onCookNow={(item) => {
                handleCloseBriefing();
                onQuickRecipe(item);
            }} 
          />
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-6">
          <div className="w-12 h-12 rounded-full bg-teal-900 flex items-center justify-center text-white font-black">{user.name[0]}</div>
          <div>
            <div className="flex items-center gap-2 text-teal-600 font-bold text-[10px] uppercase tracking-widest mb-1">
                <timeGreeting.icon className="w-3 h-3" /> {timeGreeting.text}
            </div>
            <div className="flex items-center gap-3">
                <h1 className="text-4xl font-black text-teal-900 leading-none">{user.name.split(' ')[0]}</h1>
                <span className="bg-orange-500 text-white text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest flex items-center gap-1 shadow-sm animate-pulse-slow cursor-help" title="Versión de prueba">
                    <FlaskConical className="w-3 h-3" /> Beta
                </span>
            </div>
          </div>
        </div>
        
        {isOnline ? (
            <div className="flex items-center gap-2 bg-teal-50 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-teal-600 border border-teal-100 shadow-sm">
                <CloudCog className="w-4 h-4" /> Nube Activa
            </div>
        ) : (
            <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-400 border border-gray-200">
                <WifiOff className="w-4 h-4" /> Offline
            </div>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm border-b-4 border-b-teal-600">
              <PiggyBank className="w-8 h-8 text-teal-600 mb-4" />
              <div className="text-4xl font-black text-gray-900">{user.total_savings.toFixed(1)}€</div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ahorro Acumulado</div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm border-b-4 border-b-orange-500">
              <Timer className="w-8 h-8 text-orange-500 mb-4" />
              <div className="text-4xl font-black text-gray-900">{user.time_saved_mins || 0}m</div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tiempo Recuperado</div>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm border-b-4 border-b-purple-600">
              <ChefHat className="w-8 h-8 text-purple-600 mb-4" />
              <div className="text-4xl font-black text-gray-900">{user.meals_cooked}</div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Platos Saludables</div>
          </div>
      </div>

      {snackItems.length > 0 && onQuickConsume && (
          <section>
              <div className="flex items-center gap-3 mb-4 px-2">
                  <Apple className="w-5 h-5 text-red-400" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-400">Picoteo Rápido (-1)</h3>
              </div>
              <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                  {snackItems.map(item => (
                      <button 
                        key={item.id}
                        onClick={() => onQuickConsume(item.id)}
                        className="bg-white p-4 pr-6 rounded-[2rem] border border-gray-100 flex items-center gap-4 hover:shadow-lg hover:border-orange-200 transition-all group flex-shrink-0"
                      >
                          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-xl shadow-sm group-hover:bg-orange-50 group-hover:scale-110 transition-transform">
                              {item.category === 'fruits' ? '🍎' : item.category === 'dairy' ? '🥛' : '🥨'}
                          </div>
                          <div className="text-left">
                              <div className="font-black text-gray-900 truncate max-w-[100px]">{item.name}</div>
                              <div className="text-[10px] font-bold text-gray-400 group-hover:text-orange-500">Quedan {item.quantity}</div>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Minus className="w-4 h-4" />
                          </div>
                      </button>
                  ))}
              </div>
          </section>
      )}

      <section className="bg-teal-900 rounded-[4rem] p-12 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-6">
                  <div className="bg-orange-500 p-3 rounded-2xl shadow-xl">
                      <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-3xl font-black">Planificador Inteligente</h3>
              </div>
              <p className="text-teal-100/60 text-lg mb-10 font-medium">¿Hoy cocinas para toda la semana? Usa Batch Cooking para optimizar tu tiempo.</p>
              
              <div className="flex gap-4">
                  <button onClick={() => onNavigate('planner')} className="px-8 py-5 bg-orange-500 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-orange-600 active:scale-95 transition-all">
                    Planificar Semana <ArrowRight className="w-4 h-4" />
                  </button>
                  <button onClick={() => onNavigate('shopping')} className="px-8 py-5 bg-white/10 border border-white/20 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all">
                    Lista de Compra
                  </button>
              </div>
            </div>
        </div>
      </section>
    </div>
  );
};
