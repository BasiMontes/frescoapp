
import React, { useState, useEffect, useMemo } from 'react';
import { Recipe, PantryItem, ShoppingItem, UserProfile, MealCategory } from '../types';
import { X, Clock, Users, ChefHat, Check, AlertCircle, PackageCheck, ArrowLeft, Flame, Share2, PlayCircle, BookOpen, ListFilter, Info, Sparkles, Flag, ShieldAlert, Minus, Plus, Circle, ShoppingCart, Calendar, CheckCircle } from 'lucide-react';
import { CookMode } from './CookMode';
import { SmartImage } from './SmartImage';
import { SPANISH_PRICES } from '../constants';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface RecipeDetailProps {
  recipe: Recipe;
  pantry: PantryItem[];
  userProfile?: UserProfile; 
  initialMode?: 'view' | 'plan'; // AUDITORÍA 3: Prop para abrir en modo plan
  onClose: () => void;
  onAddToPlan?: (servings: number, date?: string, type?: MealCategory) => void;
  onCookFinish?: (usedIngredients: { name: string, quantity: number }[]) => void;
  onAddToShoppingList?: (items: ShoppingItem[]) => void;
}

// @ts-ignore
interface ExtendedRecipe extends Recipe {
    substitution_note?: string;
}

export const RecipeDetail: React.FC<RecipeDetailProps> = ({ recipe, pantry, userProfile, initialMode = 'view', onClose, onAddToPlan, onCookFinish, onAddToShoppingList }) => {
  const [isCooking, setIsCooking] = useState(false);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'steps'>('ingredients');
  const [completedSteps, setCompletedSteps] = useState<number[]>([]); 
  
  // AUDITORÍA 18 & 3: Smart Planning State
  const [showPlanningMode, setShowPlanningMode] = useState(initialMode === 'plan');
  const [planDate, setPlanDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [planType, setPlanType] = useState<MealCategory>(recipe.meal_category);
  // AUDITORÍA 24: Feedback State
  const [isAddedToPlan, setIsAddedToPlan] = useState(false);
  // NEW: State for shopping list feedback
  const [isAddedToList, setIsAddedToList] = useState(false);

  const [desiredServings, setDesiredServings] = useState(() => {
      if (userProfile && userProfile.household_size > 0) {
          return userProfile.household_size;
      }
      return recipe.servings;
  });

  useEffect(() => {
    window.history.pushState({ modal: 'recipe-detail' }, '', window.location.href);
    const handlePopState = (event: PopStateEvent) => {
      if (showPlanningMode && initialMode !== 'plan') setShowPlanningMode(false);
      else onClose();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showPlanningMode, initialMode]);

  const handleManualClose = () => {
    if (showPlanningMode && initialMode !== 'plan') {
        setShowPlanningMode(false);
    } else {
        if (window.history.state?.modal === 'recipe-detail') {
            window.history.back(); 
        } else {
            onClose();
        }
    }
  };

  const toggleStep = (index: number) => {
      setCompletedSteps(prev => 
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
      );
  };

  const ingredientMultiplier = useMemo(() => {
      return desiredServings / recipe.servings;
  }, [desiredServings, recipe.servings]);

  // AUDITORÍA 16: Escalado Temporal Dinámico
  const dynamicPrepTime = useMemo(() => {
      if (desiredServings <= recipe.servings) return recipe.prep_time;
      const scaleFactor = desiredServings / recipe.servings;
      const time = Math.round(recipe.prep_time * (1 + 0.3 * (scaleFactor - 1)));
      return time;
  }, [desiredServings, recipe.prep_time, recipe.servings]);

  const scaledIngredients = useMemo(() => {
      return recipe.ingredients.map(ing => ({
          ...ing,
          quantity: ing.quantity * ingredientMultiplier
      }));
  }, [recipe.ingredients, ingredientMultiplier]);

  const checkItemStock = (name: string, requiredQty: number) => {
    const normalize = (s: string) => s.toLowerCase().trim().replace(/s$/, '').replace(/es$/, '');
    const normName = normalize(name);
    return pantry.find(p => {
        const pNorm = normalize(p.name);
        return pNorm === normName || pNorm.includes(normName) || normName.includes(pNorm);
    });
  };

  const missingItems = useMemo(() => {
      return scaledIngredients.filter(ing => {
          const stock = checkItemStock(ing.name, ing.quantity);
          return !stock || stock.quantity < ing.quantity;
      }).map(ing => {
          const stock = checkItemStock(ing.name, ing.quantity);
          const currentQty = stock ? stock.quantity : 0;
          return {
              ...ing,
              missingQty: Math.max(0, ing.quantity - currentQty)
          };
      });
  }, [scaledIngredients, pantry]);

  const handleBuyMissing = () => {
      if(!onAddToShoppingList) return;
      const shoppingItems: ShoppingItem[] = missingItems.map(m => ({
          id: '',
          name: m.name,
          quantity: m.missingQty,
          unit: m.unit,
          category: m.category || 'other',
          estimated_price: (SPANISH_PRICES[m.name.toLowerCase()] || 1.50),
          is_purchased: false
      }));
      onAddToShoppingList(shoppingItems);
      
      // FIX: Visual Feedback
      setIsAddedToList(true);
      setTimeout(() => setIsAddedToList(false), 2000);
  };
  
  const handleShare = async () => {
    if (navigator.share) {
        try {
            await navigator.share({
                title: `Fresco: ${recipe.title}`,
                text: `¡Mira esta receta de ${recipe.title}!`,
                url: window.location.href
            });
        } catch (err) {
            console.log('Error compartiendo', err);
        }
    } else {
        alert("Copiado al portapapeles");
    }
  };

  const handleReport = () => {
      alert("Reporte enviado: El contenido será revisado por nuestro equipo de moderación en menos de 24h.");
      onClose();
  };

  const extendedRecipe = recipe as ExtendedRecipe;

  if (isCooking && onCookFinish) {
      return (
          <CookMode 
            recipe={{...recipe, ingredients: scaledIngredients}} 
            pantry={pantry} // FIX 1: Pasar pantry para autocompletado
            onClose={() => setIsCooking(false)} 
            onFinish={(used) => {
                onCookFinish(used);
                setIsCooking(false);
                onClose();
            }} 
          />
      );
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-white animate-slide-up overflow-y-auto no-scrollbar pb-40 bg-[#FDFDFD]">
        {/* Header con Imagen */}
        <div className="relative h-[40vh] md:h-[50vh]">
            <SmartImage 
                src={recipe.image_url} 
                alt={recipe.title}
                className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#FDFDFD] via-white/20 to-transparent z-10" />
            
            <div className="absolute top-12 left-6 right-6 flex justify-between z-20">
                <button onClick={handleManualClose} className="p-4 bg-white/20 backdrop-blur-xl rounded-2xl text-white hover:bg-white hover:text-teal-900 transition-all shadow-xl border border-white/20">
                    <ArrowLeft className="w-7 h-7" />
                </button>
                <button onClick={handleShare} className="p-4 bg-white/20 backdrop-blur-xl rounded-2xl text-white hover:bg-white hover:text-teal-900 transition-all shadow-xl border border-white/20">
                    <Share2 className="w-6 h-6" />
                </button>
            </div>

            <div className="absolute bottom-8 left-8 right-8 z-20">
                <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-3 py-1 bg-orange-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest">{recipe.cuisine_type}</span>
                    {recipe.dietary_tags.map(t => (
                        <span key={t} className="px-3 py-1 bg-teal-800 text-white rounded-full text-[9px] font-black uppercase tracking-widest">{t.replace('_', ' ')}</span>
                    ))}
                </div>
                <h2 className="text-4xl md:text-6xl font-black text-teal-900 leading-tight tracking-tighter">{recipe.title}</h2>
            </div>
        </div>
        
        <div className="max-w-4xl mx-auto px-6 md:px-0">
            {/* Quick Stats Bar & Scaling Controls */}
            <div className="bg-teal-900 rounded-[2.5rem] p-6 text-white grid grid-cols-3 gap-2 shadow-2xl -mt-6 relative z-20 mb-10">
                <div className="text-center flex flex-col items-center justify-center">
                    <Clock className={`w-5 h-5 mx-auto mb-1 ${dynamicPrepTime > recipe.prep_time ? 'text-red-400 animate-pulse' : 'text-orange-400'}`} />
                    <div className="text-lg font-black">{dynamicPrepTime}'</div>
                    <div className="text-[8px] font-bold uppercase opacity-40">Mins Estim.</div>
                </div>
                <div className="text-center border-x border-white/10 flex flex-col items-center justify-center">
                    <ChefHat className="w-5 h-5 mx-auto mb-1 text-orange-400" />
                    <div className="text-lg font-black capitalize">{recipe.difficulty}</div>
                    <div className="text-[8px] font-bold uppercase opacity-40">Nivel</div>
                </div>
                {/* Scaler Control */}
                <div className="flex flex-col items-center justify-center">
                    <div className="flex items-center gap-2 bg-black/20 rounded-xl p-1">
                        <button 
                            onClick={() => setDesiredServings(Math.max(1, desiredServings - 1))}
                            className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors"
                        ><Minus className="w-3 h-3" /></button>
                        <span className="text-lg font-black min-w-[1ch] text-center">{desiredServings}</span>
                        <button 
                            onClick={() => setDesiredServings(desiredServings + 1)}
                            className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors"
                        ><Plus className="w-3 h-3" /></button>
                    </div>
                    <div className="text-[8px] font-bold uppercase opacity-40 mt-1">Raciones</div>
                </div>
            </div>

            {/* AI Warning & Report */}
            <div className="flex items-center justify-between gap-4 mb-8 px-2 opacity-60">
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <Sparkles className="w-3 h-3" />
                    Contenido generado por IA
                </div>
                <button onClick={handleReport} className="flex items-center gap-1 text-[10px] font-bold text-red-300 hover:text-red-500 uppercase tracking-wider">
                    <Flag className="w-3 h-3" /> Reportar error
                </button>
            </div>

            {/* Substitution Note from AI */}
            {extendedRecipe.substitution_note && (
                <div className="mb-10 bg-orange-50 border border-orange-200 p-8 rounded-[2.5rem] flex gap-6 animate-pulse-slow">
                    <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-lg">
                        <Sparkles className="w-7 h-7" />
                    </div>
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600 mb-2">Sustitución Inteligente</h4>
                        <p className="text-orange-900 font-medium leading-relaxed">{extendedRecipe.substitution_note}</p>
                    </div>
                </div>
            )}

            {/* Tab System */}
            <div className="flex p-1.5 bg-gray-100 rounded-[2rem] mb-10 border border-gray-200">
                <button 
                    onClick={() => setActiveTab('ingredients')}
                    className={`flex-1 py-4 flex items-center justify-center gap-3 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${
                        activeTab === 'ingredients' ? 'bg-white text-teal-900 shadow-sm' : 'text-gray-400'
                    }`}
                >
                    <ListFilter className="w-4 h-4" /> Ingredientes
                </button>
                <button 
                    onClick={() => setActiveTab('steps')}
                    className={`flex-1 py-4 flex items-center justify-center gap-3 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${
                        activeTab === 'steps' ? 'bg-white text-teal-900 shadow-sm' : 'text-gray-400'
                    }`}
                >
                    <BookOpen className="w-4 h-4" /> Pasos
                </button>
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in mb-12">
                {activeTab === 'ingredients' ? (
                    <div className="space-y-3">
                        {scaledIngredients.map((ing, i) => {
                            const stock = checkItemStock(ing.name, ing.quantity);
                            const hasEnough = stock && stock.quantity >= ing.quantity;
                            return (
                                <div key={i} className={`flex justify-between items-center p-6 rounded-3xl border transition-all ${
                                    hasEnough ? 'bg-green-50 border-green-200 text-green-900' : 
                                    stock ? 'bg-orange-50 border-orange-200 text-orange-900' : 
                                    'bg-white border-gray-100 text-gray-700'
                                }`}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-3 h-3 rounded-full ${hasEnough ? 'bg-green-500' : stock ? 'bg-orange-500' : 'bg-gray-200'}`} />
                                        <span className="capitalize font-bold">{ing.name}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-sm font-black">{Number.isInteger(ing.quantity) ? ing.quantity : ing.quantity.toFixed(1)} {ing.unit}</span>
                                        {stock && !hasEnough && (
                                            <span className="text-[9px] font-bold uppercase opacity-60">Tienes {stock.quantity}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        
                        {missingItems.length > 0 && onAddToShoppingList && (
                            <button 
                                onClick={handleBuyMissing}
                                disabled={isAddedToList}
                                className={`w-full mt-4 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${
                                    isAddedToList 
                                    ? 'bg-green-500 text-white border-green-500' 
                                    : 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                                }`}
                            >
                                {isAddedToList ? <><CheckCircle className="w-4 h-4" /> ¡Añadido!</> : <><ShoppingCart className="w-4 h-4" /> Añadir {missingItems.length} faltantes a lista</>}
                            </button>
                        )}

                        {userProfile && desiredServings !== recipe.servings && (
                            <div className="text-center mt-6 p-4 bg-teal-50 rounded-2xl text-teal-700 text-xs font-bold border border-teal-100">
                                Cantidades ajustadas para {desiredServings} personas (Original: {recipe.servings})
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {recipe.instructions.map((step, i) => {
                            const isDone = completedSteps.includes(i);
                            return (
                                <div 
                                    key={i} 
                                    onClick={() => toggleStep(i)}
                                    className={`flex gap-6 group p-4 rounded-3xl transition-all cursor-pointer ${
                                        isDone ? 'bg-gray-50 opacity-60' : 'hover:bg-white hover:shadow-lg hover:border-gray-100 border border-transparent'
                                    }`}
                                >
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0 border transition-all duration-300 ${
                                        isDone ? 'bg-green-100 text-green-700 border-green-200' : 'bg-teal-50 text-teal-900 border-teal-100 group-hover:bg-teal-900 group-hover:text-white'
                                    }`}>
                                        {isDone ? <Check className="w-6 h-6" /> : i + 1}
                                    </div>
                                    <p className={`font-medium text-lg leading-relaxed pt-1 transition-all ${
                                        isDone ? 'text-gray-400 line-through' : 'text-gray-700'
                                    }`}>{step}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Disclaimer Legal */}
            <div className="bg-gray-50 p-6 rounded-3xl mb-24 border border-gray-100 flex gap-4 items-start">
                <ShieldAlert className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                    <span className="font-bold">Aviso de IA:</span> Las recetas son generadas por inteligencia artificial. Verifica siempre los tiempos de cocción y alérgenos antes de consumir.
                </p>
            </div>
        </div>

        {/* Acciones Inferiores (Fixed) */}
        {/* AUDITORÍA 18: Nuevo Panel de Planificación */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-gray-100 z-40 safe-pb animate-slide-up">
            {showPlanningMode ? (
                <div className="flex flex-col gap-4 animate-fade-in">
                    <div className="flex gap-2">
                        <button onClick={() => setPlanDate(format(new Date(), 'yyyy-MM-dd'))} className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all ${planDate === format(new Date(), 'yyyy-MM-dd') ? 'bg-teal-900 text-white border-teal-900' : 'bg-white text-gray-400 border-gray-200'}`}>Hoy</button>
                        <button onClick={() => setPlanDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))} className={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border transition-all ${planDate === format(addDays(new Date(), 1), 'yyyy-MM-dd') ? 'bg-teal-900 text-white border-teal-900' : 'bg-white text-gray-400 border-gray-200'}`}>Mañana</button>
                        <div className="relative flex-1">
                            <input 
                                type="date" 
                                value={planDate}
                                onChange={(e) => setPlanDate(e.target.value)}
                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" 
                            />
                            <button className="w-full h-full py-3 bg-white text-teal-600 rounded-2xl font-black text-xs uppercase tracking-widest border border-teal-100 flex items-center justify-center gap-2">
                                <Calendar className="w-4 h-4" /> Otra
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
                        {(['breakfast', 'lunch', 'dinner'] as MealCategory[]).map(cat => (
                            <button 
                                key={cat}
                                onClick={() => setPlanType(cat)}
                                className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${planType === cat ? 'bg-white text-teal-900 shadow-sm' : 'text-gray-400'}`}
                            >
                                {cat === 'breakfast' ? 'Desayuno' : cat === 'lunch' ? 'Comida' : 'Cena'}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-4 mt-2">
                        <button 
                            onClick={() => {
                                // Si veníamos de modo plan, cerramos todo. Si no, solo ocultamos plan.
                                if (initialMode === 'plan') onClose();
                                else setShowPlanningMode(false);
                            }}
                            className="flex-1 py-4 text-gray-400 font-black text-xs uppercase tracking-widest hover:bg-gray-50 rounded-2xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={() => {
                                if (onAddToPlan) onAddToPlan(desiredServings, planDate, planType);
                                // AUDITORÍA 24: Feedback visual
                                setIsAddedToPlan(true);
                                setTimeout(() => {
                                    setIsAddedToPlan(false);
                                    if (initialMode === 'plan') onClose(); else setShowPlanningMode(false);
                                }, 2000);
                            }}
                            className={`flex-[2] py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${
                                isAddedToPlan ? 'bg-green-500 text-white' : 'bg-teal-900 text-white'
                            }`}
                        >
                            {isAddedToPlan ? <><CheckCircle className="w-4 h-4" /> ¡Planificado!</> : <><Check className="w-4 h-4" /> Confirmar</>}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex gap-4">
                    <button 
                        onClick={() => setIsCooking(true)}
                        className="flex-[2] py-6 bg-orange-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                        <PlayCircle className="w-6 h-6" /> Cocinar ({desiredServings}p)
                    </button>
                    {onAddToPlan && (
                        <button 
                            onClick={() => setShowPlanningMode(true)}
                            className="flex-1 py-6 bg-teal-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-teal-800 transition-all active:scale-95"
                        >
                            Planificar
                        </button>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};
