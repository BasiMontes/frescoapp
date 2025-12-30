
import React, { useState, useMemo } from 'react';
import { MealSlot, Recipe, MealCategory, PantryItem, UserProfile, ShoppingItem } from '../types';
import { Plus, Trash2, Calendar, Wand2, X, Eye, Trash, ChefHat, Check, AlertCircle, Sparkles, Loader2, ArrowLeft, ArrowRight, PackageCheck, Clock, Users, Share2, Users2, CheckCircle2, WifiOff, ShoppingCart, ChevronLeft, ChevronRight, Move, AlertOctagon, Utensils, Repeat, TriangleAlert, CheckSquare, Square } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, addWeeks, subWeeks, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateWeeklyPlanAI } from '../services/geminiService';
import { RecipeDetail } from './RecipeDetail';

interface PlannerProps {
  user: UserProfile;
  plan: MealSlot[];
  recipes: Recipe[];
  pantry: PantryItem[];
  onUpdateSlot: (date: string, type: MealCategory, recipeId: string | undefined) => void;
  onAIPlanGenerated: (plan: MealSlot[], recipes: Recipe[]) => void;
  onClear: () => void;
  onCookFinish?: (usedIngredients: { name: string, quantity: number }[], recipeId?: string) => void;
  onAddToPlan?: (recipe: Recipe, servings?: number) => void;
  onAddToShoppingList?: (items: ShoppingItem[]) => void;
  isOnline?: boolean;
}

// IDs especiales para slots sin receta
const SLOT_LEFTOVERS = 'SPECIAL_LEFTOVERS';
const SLOT_EAT_OUT = 'SPECIAL_EAT_OUT';

export const Planner: React.FC<PlannerProps> = ({ user, plan, recipes, pantry, onUpdateSlot, onAIPlanGenerated, onClear, onCookFinish, onAddToPlan, onAddToShoppingList, isOnline = true }) => {
  const [showPicker, setShowPicker] = useState<{ date: string, type: MealCategory } | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  // FIX 1: Estado para el Modal de Planificación
  const [showPlanWizard, setShowPlanWizard] = useState(false);
  const [wizardDays, setWizardDays] = useState<string[]>([]);
  const [wizardTypes, setWizardTypes] = useState<MealCategory[]>(['lunch', 'dinner']);

  const [showSocial, setShowSocial] = useState(false);
  const [moveSource, setMoveSource] = useState<{ date: string, type: MealCategory, recipeId: string } | null>(null);
  
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const days = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(currentWeekStart, i)), [currentWeekStart]);

  // FIX 1: Inicializar días del wizard al abrir (por defecto días restantes de la semana)
  const openPlanWizard = () => {
      const today = new Date();
      const remainingDays = days.filter(d => !isBefore(d, today) || isSameDay(d, today))
                               .map(d => format(d, 'yyyy-MM-dd'));
      setWizardDays(remainingDays.length > 0 ? remainingDays : days.map(d => format(d, 'yyyy-MM-dd')));
      setShowPlanWizard(true);
  };

  const toggleWizardDay = (dateStr: string) => {
      setWizardDays(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]);
  };

  const toggleWizardType = (type: MealCategory) => {
      setWizardTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const executeAIPlan = async () => {
    if(!isOnline) return;
    if(wizardDays.length === 0 || wizardTypes.length === 0) {
        alert("Selecciona al menos un día y un tipo de comida.");
        return;
    }

    setIsGenerating(true);
    setShowPlanWizard(false); // Cerramos el modal pero mostramos loader en el botón principal o overlay
    try {
        const result = await generateWeeklyPlanAI(user, pantry, plan, wizardDays, wizardTypes);
        if (result.plan && result.plan.length > 0) {
            // Combinar plan existente con nuevo
            const newPlan = [...plan.filter(p => !result.plan.some(np => np.date === p.date && np.type === p.type)), ...result.plan];
            onAIPlanGenerated(newPlan, result.newRecipes);
        }
    } catch (e) {
        alert("IA ocupada o error de conexión.");
    } finally {
        setIsGenerating(false);
    }
  };

  const getSlot = (date: Date, type: MealCategory) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return plan.find(p => p.date === dateStr && p.type === type);
  };

  const isWeekEmpty = useMemo(() => {
      return !days.some(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          return plan.some(p => p.date === dateStr);
      });
  }, [days, plan]);

  const getRecipe = (id?: string) => recipes.find(r => r.id === id);

  const handleSlotClick = (date: string, type: MealCategory, existingRecipeId?: string, isZombie?: boolean) => {
      if (moveSource) {
          if (moveSource.date === date && moveSource.type === type) {
              setMoveSource(null);
              return;
          }
          
          onUpdateSlot(moveSource.date, moveSource.type, undefined);
          
          if (existingRecipeId && !isZombie) {
              onUpdateSlot(moveSource.date, moveSource.type, existingRecipeId);
          }
          
          onUpdateSlot(date, type, moveSource.recipeId);
          setMoveSource(null);
          return;
      }

      if (existingRecipeId === SLOT_LEFTOVERS || existingRecipeId === SLOT_EAT_OUT) {
          const label = existingRecipeId === SLOT_LEFTOVERS ? 'Sobras / Tupper' : 'Comer Fuera';
          if(confirm(`¿Quitar "${label}" de este hueco?`)) {
              onUpdateSlot(date, type, undefined);
          }
          return;
      }

      if (isZombie) {
          if(confirm("Esta receta ya no existe. ¿Eliminar del plan?")) {
              onUpdateSlot(date, type, undefined);
          }
          return;
      }

      if (existingRecipeId) {
          const r = getRecipe(existingRecipeId);
          if (r) setSelectedRecipe(r);
      } else {
          setShowPicker({ date, type });
      }
  };

  const handleStartMove = (e: React.MouseEvent, date: string, type: MealCategory, recipeId: string) => {
      e.stopPropagation();
      setMoveSource({ date, type, recipeId });
  };

  const getRecipeAvailability = (recipe: Recipe) => {
      const normalize = (s: string) => s.toLowerCase().trim().replace(/s$/, '').replace(/es$/, '');
      const totalIngredients = recipe.ingredients.length;
      let availableCount = 0;

      recipe.ingredients.forEach(ing => {
          const normIng = normalize(ing.name);
          const inPantry = pantry.find(p => {
              const normP = normalize(p.name);
              return normP === normIng || normP.includes(normIng) || normIng.includes(normP);
          });
          if (inPantry && inPantry.quantity > 0) availableCount++;
      });

      return { available: availableCount, total: totalIngredients, percentage: totalIngredients > 0 ? availableCount / totalIngredients : 0 };
  };

  const sortedRecipesForPicker = useMemo(() => {
      if (!showPicker) return { available: [], shopping: [] };
      
      const available: Recipe[] = [];
      const shopping: Recipe[] = [];

      recipes.filter(r => r.meal_category === showPicker.type).forEach(r => {
          const status = getRecipeAvailability(r);
          if (status.percentage >= 0.8) available.push(r);
          else shopping.push(r);
      });

      return { available, shopping };
  }, [recipes, showPicker, pantry]);

  return (
    <div className="p-4 md:p-10 safe-pt animate-fade-in pb-48">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 px-4">
        <div>
          <h1 className="text-5xl font-black text-teal-900 tracking-tight leading-none mb-2">Mi Menú</h1>
          <div className="flex items-center gap-4 mt-2">
              <button onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-all"><ChevronLeft className="w-5 h-5 text-gray-500" /></button>
              <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest min-w-[140px] text-center">
                  Semana {format(currentWeekStart, 'd MMM', { locale: es })}
              </p>
              <button onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition-all"><ChevronRight className="w-5 h-5 text-gray-500" /></button>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           {moveSource && (
               <div className="flex-1 bg-orange-500 text-white px-6 py-5 rounded-[2rem] flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest shadow-2xl animate-pulse">
                   <Move className="w-5 h-5" /> Selecciona destino
               </div>
           )}
           {!moveSource && (
               <>
                <button 
                    onClick={() => setShowSocial(true)}
                    className="flex-1 md:flex-none bg-white text-teal-900 px-6 py-5 rounded-[2rem] flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest border border-gray-100 shadow-sm active:scale-95 transition-all hover:bg-teal-50"
                >
                    <Users2 className="w-5 h-5" /> Social
                </button>
                {/* FIX 1: Abrir Wizard en lugar de Magic directo */}
                <button 
                    onClick={openPlanWizard} 
                    disabled={isGenerating || !isOnline}
                    className="flex-[2] md:flex-none bg-teal-900 text-white px-8 py-5 rounded-[2rem] flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 disabled:opacity-50 transition-all hover:bg-teal-800 disabled:bg-gray-400"
                >
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : isOnline ? <Wand2 className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                    {isOnline ? 'Planificar Semana' : 'Offline'}
                </button>
               </>
           )}
        </div>
      </header>

      {/* FIX 1: Modal Wizard de Planificación */}
      {showPlanWizard && (
          <div className="fixed inset-0 z-[5000] bg-teal-900/95 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
              <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-10 shadow-2xl relative">
                  <button onClick={() => setShowPlanWizard(false)} className="absolute top-8 right-8 p-2 bg-gray-50 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
                  
                  <div className="mb-8">
                      <div className="w-16 h-16 bg-orange-100 rounded-[2rem] flex items-center justify-center mb-6">
                          <Wand2 className="w-8 h-8 text-orange-500" />
                      </div>
                      <h3 className="text-3xl font-black text-teal-900 mb-2">Diseña tu Semana</h3>
                      <p className="text-gray-500 font-medium">Selecciona qué días quieres que la IA cocine por ti.</p>
                  </div>

                  <div className="space-y-6 mb-10">
                      <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-3">Días a planificar</label>
                          <div className="grid grid-cols-4 gap-2">
                              {days.map(day => {
                                  const dStr = format(day, 'yyyy-MM-dd');
                                  const isSelected = wizardDays.includes(dStr);
                                  return (
                                      <button 
                                        key={dStr}
                                        onClick={() => toggleWizardDay(dStr)}
                                        className={`py-3 rounded-xl text-xs font-bold transition-all border-2 ${
                                            isSelected 
                                            ? 'bg-teal-900 text-white border-teal-900' 
                                            : 'bg-white text-gray-500 border-gray-100 hover:border-teal-200'
                                        }`}
                                      >
                                          {format(day, 'EEE', { locale: es }).toUpperCase()}
                                      </button>
                                  );
                              })}
                          </div>
                      </div>

                      <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block mb-3">Tipos de comida</label>
                          <div className="flex gap-3">
                              {(['breakfast', 'lunch', 'dinner'] as MealCategory[]).map(type => (
                                  <button
                                    key={type}
                                    onClick={() => toggleWizardType(type)}
                                    className={`flex-1 py-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${
                                        wizardTypes.includes(type)
                                        ? 'bg-orange-50 border-orange-500 text-orange-700'
                                        : 'bg-white border-gray-100 text-gray-400 hover:border-orange-200'
                                    }`}
                                  >
                                      <span className="text-xl">{type === 'breakfast' ? '🍳' : type === 'lunch' ? '🥘' : '🌙'}</span>
                                      <span className="text-[10px] font-black uppercase">{type === 'breakfast' ? 'Desayuno' : type === 'lunch' ? 'Comida' : 'Cena'}</span>
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>

                  <button 
                    onClick={executeAIPlan}
                    disabled={wizardDays.length === 0 || wizardTypes.length === 0}
                    className="w-full py-6 bg-teal-900 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-teal-800 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                      <Sparkles className="w-5 h-5 text-orange-400" /> Generar Menú Inteligente
                  </button>
              </div>
          </div>
      )}

      {/* Hero Empty State para semana vacía */}
      {isWeekEmpty && !isGenerating ? (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in text-center">
              <div className="w-48 h-48 bg-white rounded-[3rem] border border-gray-100 shadow-sm flex items-center justify-center mb-10 relative overflow-hidden group hover:scale-105 transition-transform duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-transparent opacity-50" />
                  <Calendar className="w-20 h-20 text-teal-200 group-hover:text-teal-500 transition-colors" />
                  <div className="absolute bottom-6 right-6 bg-orange-500 text-white rounded-full p-3 shadow-lg animate-bounce-subtle">
                      <Sparkles className="w-6 h-6" />
                  </div>
              </div>
              <h3 className="text-4xl font-black text-teal-900 mb-4 tracking-tight">Semana en blanco</h3>
              <p className="text-gray-400 text-lg max-w-md mx-auto leading-relaxed font-medium mb-12">
                  No dejes tu alimentación al azar. Un buen plan te ahorra tiempo y evita tirar comida.
              </p>
              
              <div className="flex flex-col md:flex-row gap-6 w-full max-w-xl px-6">
                  <button 
                    onClick={openPlanWizard}
                    disabled={isGenerating || !isOnline}
                    className="flex-[2] py-6 bg-teal-900 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-teal-800 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                      <Wand2 className="w-5 h-5 text-orange-400" /> Crear Plan Automático
                  </button>
                  <button 
                    onClick={() => handleSlotClick(format(new Date(), 'yyyy-MM-dd'), 'lunch')}
                    className="flex-1 py-6 bg-white border border-gray-200 text-teal-900 rounded-[2rem] font-black text-sm uppercase tracking-widest hover:bg-gray-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                      <Plus className="w-5 h-5" /> Manual
                  </button>
              </div>
          </div>
      ) : (
      <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-8 pb-12 -mx-4 px-8 scroll-smooth">
        {days.map((day) => {
          const isToday = isSameDay(day, new Date());
          const dateStr = format(day, 'yyyy-MM-dd');
          
          return (
          <div key={day.toString()} className="snap-center min-w-[320px] flex flex-col gap-6">
            <div className={`p-8 rounded-[3rem] text-center transition-all border-2 ${isToday ? 'bg-teal-900 text-white border-teal-900 shadow-2xl scale-105' : 'bg-white text-gray-900 shadow-sm border-gray-100'}`}>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 mb-1">{format(day, 'EEEE', { locale: es })}</div>
              <div className="text-3xl font-black tracking-tighter">{format(day, 'd MMMM', { locale: es })}</div>
            </div>
            {(['breakfast', 'lunch', 'dinner'] as MealCategory[]).map((type) => {
                const slot = getSlot(day, type);
                
                let recipe = null;
                let isZombie = false;
                let isSpecial = false;
                let specialType = '';
                let missingIngredientsAlert = false; // FIX 2: Alerta de Stock

                if (slot?.recipeId) {
                    if (slot.recipeId === SLOT_LEFTOVERS) {
                        isSpecial = true;
                        specialType = 'leftovers';
                    } else if (slot.recipeId === SLOT_EAT_OUT) {
                        isSpecial = true;
                        specialType = 'eatout';
                    } else {
                        recipe = getRecipe(slot.recipeId);
                        if (!recipe) isZombie = true;
                        else {
                            // FIX 2: Comprobar disponibilidad al renderizar
                            const availability = getRecipeAvailability(recipe);
                            // Si falta algún ingrediente (no 100%), mostrar alerta
                            if (availability.percentage < 1) missingIngredientsAlert = true;
                        }
                    }
                }

                const isCooked = slot?.isCooked;
                const isMovingSource = moveSource?.date === dateStr && moveSource?.type === type;
                const isMovingTarget = moveSource && !isMovingSource;

                return (
                    <div 
                        key={type} 
                        onClick={() => handleSlotClick(dateStr, type, slot?.recipeId, isZombie)}
                        className={`relative p-8 rounded-[3.5rem] border-2 h-64 flex flex-col justify-between transition-all active:scale-[0.98] cursor-pointer group shadow-sm overflow-hidden ${
                            isMovingSource ? 'bg-orange-50 border-orange-500 scale-95 opacity-50 ring-4 ring-orange-200' :
                            isMovingTarget ? 'bg-orange-50 border-dashed border-orange-300 hover:bg-orange-100 hover:scale-105' :
                            isZombie ? 'bg-red-50 border-red-200' :
                            isSpecial ? 'bg-gray-50 border-gray-200' :
                            recipe ? (isCooked ? 'bg-green-50/50 border-green-200' : 'bg-white border-transparent hover:border-teal-500 hover:shadow-2xl') : 'bg-gray-50/50 border-dashed border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                        {isCooked && !isSpecial && (
                            <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
                                <div className="bg-green-500 text-white px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 transform rotate-[-5deg] border-2 border-white">
                                    <CheckCircle2 className="w-4 h-4" /> Completado
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-gray-400 tracking-widest relative z-0">
                            <span>{type === 'breakfast' ? '🍳 Desayuno' : type === 'lunch' ? '🥘 Almuerzo' : '🌙 Cena'}</span>
                            {/* FIX 2: Icono de Alerta de Stock */}
                            {!isCooked && missingIngredientsAlert && (
                                <div className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-1 rounded-full animate-pulse">
                                    <TriangleAlert className="w-3 h-3" /> <span className="text-[8px]">Faltan Ingr.</span>
                                </div>
                            )}
                        </div>
                        
                        {isSpecial ? (
                            <div className="flex-1 flex flex-col justify-center items-center gap-3 opacity-60">
                                {specialType === 'leftovers' ? <Repeat className="w-10 h-10 text-teal-600" /> : <Utensils className="w-10 h-10 text-orange-500" />}
                                <span className="font-black text-sm uppercase tracking-widest text-gray-600">
                                    {specialType === 'leftovers' ? 'Sobras / Tupper' : 'Comer Fuera'}
                                </span>
                            </div>
                        ) : isZombie ? (
                            <div className="flex-1 flex flex-col justify-center items-center gap-2 text-red-400 animate-pulse">
                                <AlertOctagon className="w-8 h-8" />
                                <span className="font-black text-xs uppercase tracking-widest">Receta Eliminada</span>
                            </div>
                        ) : recipe ? (
                            <div className="flex-1 flex flex-col justify-center gap-4 relative z-0">
                                <div className={`font-black text-gray-900 text-xl line-clamp-2 leading-tight transition-colors ${!isCooked && 'group-hover:text-teal-700'}`}>{recipe.title}</div>
                                <div className="flex items-center justify-between">
                                    <img src={recipe.image_url} className="w-16 h-16 rounded-[1.5rem] object-cover shadow-lg border-2 border-white" />
                                    {!isCooked && (
                                        <div className="flex gap-2">
                                            <button onClick={(e) => handleStartMove(e, dateStr, type, recipe.id)} className="p-3 bg-gray-100 text-gray-500 rounded-2xl hover:bg-orange-500 hover:text-white transition-all"><Move className="w-4 h-4" /></button>
                                            <button onClick={(e) => { e.stopPropagation(); onUpdateSlot(dateStr, type, undefined); }} className="p-3 bg-red-50 text-red-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-teal-600/20 gap-3 relative z-0">
                                {isMovingTarget ? (
                                    <Move className="w-12 h-12 stroke-[3px] animate-bounce text-orange-400" />
                                ) : (
                                    <Plus className="w-12 h-12 stroke-[3px] group-hover:scale-110 group-hover:text-teal-600/40 transition-all" />
                                )}
                                <span className="text-[10px] font-black uppercase tracking-[0.3em]">{isMovingTarget ? 'Mover Aquí' : 'Planificar'}</span>
                            </div>
                        )}
                    </div>
                );
            })}
          </div>
        )})}
      </div>
      )}

      {showSocial && (
        <div className="fixed inset-0 z-[4000] bg-teal-900/98 backdrop-blur-3xl p-8 animate-fade-in flex flex-col items-center justify-center text-white">
            <button onClick={() => setShowSocial(false)} className="absolute top-10 right-10 p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X /></button>
            <div className="max-w-2xl w-full space-y-12">
                <div className="text-center">
                    <div className="w-24 h-24 bg-orange-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl animate-bounce-subtle">
                        <Share2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-5xl font-black mb-4">Comunidad Fresco</h2>
                    <p className="text-teal-300 font-medium text-lg opacity-60">Copia el plan de otros o comparte tu éxito.</p>
                </div>
            </div>
        </div>
      )}

      {showPicker && (
        <div className="fixed inset-0 z-[1000] bg-teal-900/95 backdrop-blur-3xl animate-fade-in flex flex-col pt-safe">
            <div className="p-10 flex justify-between items-center bg-transparent text-white">
                <div>
                    <h3 className="text-4xl font-black leading-none mb-2">Elegir Receta</h3>
                    <p className="text-teal-300 font-bold uppercase text-[10px] tracking-widest">
                        {showPicker.type === 'breakfast' ? 'Desayuno' : showPicker.type === 'lunch' ? 'Comida' : 'Cena'} • {showPicker.date}
                    </p>
                </div>
                <button onClick={() => setShowPicker(null)} className="p-4 bg-white/10 rounded-[1.5rem] hover:bg-white/20 transition-all"><X className="w-8 h-8" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-8 pb-48 no-scrollbar">
                
                {/* Opciones Rápidas */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <button 
                        onClick={() => { onUpdateSlot(showPicker.date, showPicker.type, SLOT_LEFTOVERS); setShowPicker(null); }}
                        className="bg-white/10 border border-white/10 hover:bg-white/20 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all group"
                    >
                        <Repeat className="w-8 h-8 text-teal-300 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-black uppercase tracking-widest text-white">Sobras / Tupper</span>
                    </button>
                    <button 
                        onClick={() => { onUpdateSlot(showPicker.date, showPicker.type, SLOT_EAT_OUT); setShowPicker(null); }}
                        className="bg-white/10 border border-white/10 hover:bg-white/20 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 transition-all group"
                    >
                        <Utensils className="w-8 h-8 text-orange-400 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-black uppercase tracking-widest text-white">Comer Fuera</span>
                    </button>
                </div>

                {/* Sección Disponible */}
                {sortedRecipesForPicker.available.length > 0 && (
                    <div>
                        <div className="flex items-center gap-3 mb-6 px-2">
                            <div className="w-2 h-6 bg-green-500 rounded-full" />
                            <h4 className="text-white font-black uppercase text-xs tracking-widest">¡Listo para cocinar! (Tienes ingredientes)</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {sortedRecipesForPicker.available.map(recipe => (
                                <RecipePickerCard key={recipe.id} recipe={recipe} available={true} onClick={() => { onUpdateSlot(showPicker.date, showPicker.type, recipe.id); setShowPicker(null); }} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Sección Compras */}
                {sortedRecipesForPicker.shopping.length > 0 && (
                    <div>
                        <div className="flex items-center gap-3 mb-6 px-2">
                            <div className="w-2 h-6 bg-orange-500 rounded-full" />
                            <h4 className="text-white font-black uppercase text-xs tracking-widest">Requiere ir al Súper</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {sortedRecipesForPicker.shopping.map(recipe => (
                                <RecipePickerCard key={recipe.id} recipe={recipe} available={false} onClick={() => { onUpdateSlot(showPicker.date, showPicker.type, recipe.id); setShowPicker(null); }} />
                            ))}
                        </div>
                    </div>
                )}
                
                {sortedRecipesForPicker.available.length === 0 && sortedRecipesForPicker.shopping.length === 0 && (
                    <div className="text-center text-white/50 py-20">
                        No hay recetas para esta categoría. ¡Usa la IA!
                    </div>
                )}
            </div>
        </div>
      )}
      
      {selectedRecipe && (
        <RecipeDetail 
            recipe={selectedRecipe} 
            pantry={pantry}
            userProfile={user} 
            onClose={() => setSelectedRecipe(null)} 
            onAddToPlan={(servings) => { onAddToPlan?.(selectedRecipe, servings); setSelectedRecipe(null); }}
            onCookFinish={(used) => onCookFinish?.(used, selectedRecipe.id)} // FIX: Pasar recipe.id explícitamente
            onAddToShoppingList={(items) => { onAddToShoppingList?.(items); setSelectedRecipe(null); }}
        />
      )}
    </div>
  );
};

const RecipePickerCard: React.FC<{ recipe: Recipe, available: boolean, onClick: () => void }> = ({ recipe, available, onClick }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-6 p-4 rounded-[2.5rem] group transition-all text-left shadow-xl border-2 ${available ? 'bg-white hover:bg-green-50 border-transparent' : 'bg-white/10 hover:bg-white/20 border-white/5 text-white'}`}>
        <img src={recipe.image_url} className={`w-24 h-24 rounded-[1.5rem] object-cover shadow-lg border-4 ${available ? 'border-green-100' : 'border-white/10'}`} />
        <div className="flex-1 min-w-0">
            <div className={`font-black text-xl mb-2 truncate ${available ? 'text-gray-900' : 'text-white'}`}>{recipe.title}</div>
            <div className="flex gap-3">
                <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase ${available ? 'bg-green-100 text-green-700' : 'bg-white/20 text-white'}`}>
                    {recipe.prep_time} min
                </span>
                {recipe.calories && (
                    <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase ${available ? 'bg-gray-100 text-gray-500' : 'bg-white/20 text-white'}`}>
                        {recipe.calories} kcal
                    </span>
                )}
            </div>
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${available ? 'bg-green-500 text-white shadow-lg' : 'bg-white/10 text-white/50'}`}>
            {available ? <Check className="w-6 h-6" /> : <ShoppingCart className="w-5 h-5" />}
        </div>
    </button>
);
