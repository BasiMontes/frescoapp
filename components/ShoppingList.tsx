
import React, { useMemo, useState, useEffect } from 'react';
import { MealSlot, Recipe, ShoppingItem, PantryItem, UserProfile } from '../types';
import { SPANISH_PRICES, SUPERMARKETS, EXPIRY_DAYS_BY_CATEGORY, PREDICTIVE_CATEGORY_RULES } from '../constants';
import { Share2, ShoppingCart, TrendingDown, ShoppingBag, Check, TrendingUp, AlertCircle, Store, Zap, Trophy, ChevronRight, X, Info, Plus, ArrowDown, Sparkles, Minus, ListChecks, CheckSquare, ExternalLink, RefreshCw, Pen, DollarSign, EyeOff, Eye, PartyPopper } from 'lucide-react';
import confetti from 'canvas-confetti';
import { normalizeUnit, convertBack, subtractIngredient, cleanName } from '../services/unitService';

interface ShoppingListProps {
  plan: MealSlot[];
  recipes: Recipe[];
  pantry: PantryItem[];
  user: UserProfile; 
  dbItems: ShoppingItem[]; // NUEVO: Items reales de la DB (extras + ingredientes añadidos)
  onAddShoppingItem: (items: ShoppingItem[]) => void;
  onUpdateShoppingItem: (item: ShoppingItem) => void;
  onRemoveShoppingItem: (id: string) => void;
  onFinishShopping: (items: PantryItem[]) => void;
  onOpenRecipe: (recipeTitle: string) => void;
  onSyncServings: () => void; 
}

interface TraceableShoppingItem extends ShoppingItem {
    sourceRecipes: string[];
    store?: string;
    internalValue?: number;
    internalType?: 'mass' | 'volume' | 'count';
}

const UNIT_EQUIVALENCES: Record<string, { weight: number, unit: string }> = {
  "tomate": { weight: 150, unit: "g" }, "cebolla": { weight: 130, unit: "g" },
  "ajo": { weight: 10, unit: "g" }, "huevo": { weight: 60, unit: "g" },
  "pimiento": { weight: 180, unit: "g" }, "zanahoria": { weight: 90, unit: "g" },
  "patata": { weight: 200, unit: "g" }, "aguacate": { weight: 220, unit: "g" },
  "limon": { weight: 100, unit: "g" }, "manzana": { weight: 180, unit: "g" },
  "platano": { weight: 130, unit: "g" }, "pepino": { weight: 250, unit: "g" },
  "calabacin": { weight: 300, unit: "g" }
};

const CATEGORY_LABELS: Record<string, { label: string, emoji: string, color: string }> = {
    "vegetables": { label: "Verdulería", emoji: "🥦", color: "bg-green-100 text-green-700" },
    "fruits": { label: "Frutería", emoji: "🍎", color: "bg-red-100 text-red-700" },
    "dairy": { label: "Lácteos y Huevos", emoji: "🧀", color: "bg-yellow-100 text-yellow-700" },
    "meat": { label: "Carnicería", emoji: "🥩", color: "bg-rose-100 text-rose-700" },
    "fish": { label: "Pescadería", emoji: "🐟", color: "bg-blue-100 text-blue-700" },
    "grains": { label: "Cereales y Pan", emoji: "🥖", color: "bg-orange-100 text-orange-700" },
    "spices": { label: "Especias", emoji: "🧂", color: "bg-gray-100 text-gray-700" },
    "pantry": { label: "Despensa", emoji: "🥫", color: "bg-slate-100 text-slate-700" },
    "other": { label: "Varios", emoji: "🛍️", color: "bg-purple-100 text-purple-700" }
};

export const ShoppingList: React.FC<ShoppingListProps> = ({ plan, recipes, pantry, user, dbItems, onAddShoppingItem, onUpdateShoppingItem, onRemoveShoppingItem, onFinishShopping, onOpenRecipe, onSyncServings }) => {
  // PERSISTENCIA UI (No Crítica)
  const [adjustments, setAdjustments] = useState<Record<string, number>>(() => {
      try { return JSON.parse(localStorage.getItem('fresco_shopping_adjustments') || '{}'); } catch { return {}; }
  });
  
  const [customPrices, setCustomPrices] = useState<Record<string, number>>(() => {
      try { return JSON.parse(localStorage.getItem('fresco_custom_prices') || '{}'); } catch { return {}; }
  });
  
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastSessionStats, setLastSessionStats] = useState({ count: 0, savings: 0 });

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [hidePurchased, setHidePurchased] = useState(false);
  
  const [newExtra, setNewExtra] = useState('');

  const [reviewItemsList, setReviewItemsList] = useState<TraceableShoppingItem[]>([]);
  const [expandedInfoId, setExpandedInfoId] = useState<string | null>(null);

  const hasServingsMismatch = useMemo(() => {
      return plan.some(slot => slot.servings !== user.household_size);
  }, [plan, user.household_size]);

  useEffect(() => { localStorage.setItem('fresco_shopping_adjustments', JSON.stringify(adjustments)); }, [adjustments]);
  useEffect(() => { localStorage.setItem('fresco_custom_prices', JSON.stringify(customPrices)); }, [customPrices]);

  const addExtraItem = (e: React.FormEvent | React.MouseEvent, instantlyPurchased = false) => {
      e.preventDefault();
      if (!newExtra.trim()) return;
      
      const lowerName = newExtra.toLowerCase();
      const matchKey = Object.keys(PREDICTIVE_CATEGORY_RULES).find(key => lowerName.includes(key));
      const rule = matchKey ? PREDICTIVE_CATEGORY_RULES[matchKey] : { category: 'other', unit: 'unidad' };

      const newItem: ShoppingItem = {
          id: `extra-${Date.now()}`,
          name: newExtra.trim(),
          quantity: 1,
          unit: rule.unit,
          category: rule.category,
          estimated_price: 2.0, 
          is_purchased: instantlyPurchased // Se guarda en DB ya comprado si es instant
      };
      
      onAddShoppingItem([newItem]);
      
      if (instantlyPurchased && navigator.vibrate) navigator.vibrate(50);
      setNewExtra('');
  };

  const handleAdjust = (itemId: string, delta: number, currentQty: number) => {
      setAdjustments(prev => {
          const currentAdj = prev[itemId] || 0;
          if (currentQty + currentAdj + delta <= 0) return prev;
          return { ...prev, [itemId]: currentAdj + delta };
      });
  };
  
  const handlePriceUpdate = (itemName: string, newPrice: number) => {
      setCustomPrices(prev => ({ ...prev, [itemName]: newPrice }));
      setEditingPriceId(null);
  };

  const checkAllCategory = (items: TraceableShoppingItem[]) => {
      const allChecked = items.every(i => i.is_purchased);
      items.forEach(i => {
          if (i.id.includes('calc')) {
              // Si es calculado, al marcarlo lo convertimos en real comprado
              const newItem: ShoppingItem = {
                  id: `convert-${Date.now()}-${Math.random()}`,
                  name: i.name,
                  quantity: i.quantity,
                  unit: i.unit,
                  category: i.category,
                  estimated_price: i.estimated_price,
                  is_purchased: !allChecked
              };
              onAddShoppingItem([newItem]);
          } else {
              onUpdateShoppingItem({ ...i, is_purchased: !allChecked });
          }
      });
      if (!allChecked && navigator.vibrate) navigator.vibrate(20);
  };

  const shoppingData = useMemo(() => {
    const itemsMap: Record<string, TraceableShoppingItem> = {};
    // FIX 3: Usar cleanName para matching
    const normalizeName = (str: string) => cleanName(str);

    // 1. RECOPILAR NECESIDADES DEL PLAN (Calculadas al vuelo)
    plan.forEach(slot => {
      const recipe = recipes.find(r => r.id === slot.recipeId);
      if (!recipe) return;

      recipe.ingredients.forEach(ing => {
        const key = normalizeName(ing.name);
        const qtyNeeded = (ing.quantity / (recipe.servings || 1)) * (slot.servings || 1);
        let normalized = normalizeUnit(qtyNeeded, ing.unit);

        if (normalized.type === 'count' && UNIT_EQUIVALENCES[key]) {
            normalized = {
                value: qtyNeeded * UNIT_EQUIVALENCES[key].weight,
                type: 'mass'
            };
        }

        if (itemsMap[key]) {
            if (itemsMap[key].internalType === normalized.type) {
                itemsMap[key].internalValue = (itemsMap[key].internalValue || 0) + normalized.value;
            }
            if(!itemsMap[key].sourceRecipes.includes(recipe.title)) {
                itemsMap[key].sourceRecipes.push(recipe.title);
            }
        } else {
            itemsMap[key] = { 
                id: `calc-${key}`, // ID Temporal
                name: ing.name, 
                quantity: 0,
                unit: '',
                category: ing.category || 'pantry', 
                estimated_price: 0, 
                is_purchased: false,
                sourceRecipes: [recipe.title],
                internalValue: normalized.value,
                internalType: normalized.type
            };
        }
      });
    });

    const activeStore = SUPERMARKETS.find(s => s.id === selectedStoreId) || null;

    // 2. DESCONTAR DESPENSA (Solo para items calculados)
    let finalItemsList: TraceableShoppingItem[] = Object.values(itemsMap).map(item => {
      const normalizedName = normalizeName(item.name);
      
      // FIX 3: Smart Matching en Pantry
      const inPantry = pantry.find(p => {
          const pNorm = normalizeName(p.name);
          return pNorm === normalizedName || pNorm.includes(normalizedName) || normalizedName.includes(pNorm);
      });
      
      let remainingValue = item.internalValue || 0;

      if (inPantry && remainingValue > 0) {
        let pantryVal = normalizeUnit(inPantry.quantity, inPantry.unit);
        
        if (pantryVal.type === item.internalType) {
            remainingValue = Math.max(0, remainingValue - pantryVal.value);
        } else if (pantryVal.type === 'mass' && item.internalType === 'count' && UNIT_EQUIVALENCES[normalizedName]) {
             const pantryCount = pantryVal.value / UNIT_EQUIVALENCES[normalizedName].weight;
             remainingValue = Math.max(0, remainingValue - pantryCount);
        } else if (pantryVal.type === 'count' && item.internalType === 'mass' && UNIT_EQUIVALENCES[normalizedName]) {
             const pantryMass = pantryVal.value * UNIT_EQUIVALENCES[normalizedName].weight;
             remainingValue = Math.max(0, remainingValue - pantryMass);
        }
      }

      const display = convertBack(remainingValue, item.internalType || 'count');
      const adjustment = adjustments[item.id] || 0;
      const finalQty = Math.max(0, display.quantity + adjustment);

      const basePrice = customPrices[item.name] || SPANISH_PRICES[item.id] || SPANISH_PRICES[normalizedName] || SPANISH_PRICES['default'];
      const priceMultiplier = (display.unit === 'g' || display.unit === 'ml') ? 0.001 : 1;
      
      const itemCost = finalQty * priceMultiplier * basePrice;

      return { 
        ...item, 
        quantity: finalQty, 
        unit: display.unit,
        estimated_price: activeStore ? itemCost * activeStore.multiplier : itemCost,
        store: activeStore?.name || 'Cualquiera'
      };
    }).filter(item => item.quantity > 0.01);

    // 3. FUSIÓN DE ITEMS DB (Extras + Añadidos Manualmente)
    const dbExtrasFormatted: TraceableShoppingItem[] = dbItems.map(dbItem => ({
        ...dbItem,
        sourceRecipes: ['Manual / Extra'],
        internalValue: 0,
        internalType: 'count' // Fallback
    }));

    // Fusionar: Si un DB item tiene el mismo nombre que uno calculado, sumamos cantidades
    dbExtrasFormatted.forEach(extra => {
        const extraKey = normalizeName(extra.name);
        const existingIdx = finalItemsList.findIndex(i => normalizeName(i.name) === extraKey);
        
        if (existingIdx >= 0) {
            // Ya existe calculado. Sumamos lo de DB.
            const existing = finalItemsList[existingIdx];
            finalItemsList[existingIdx] = extra;
            finalItemsList[existingIdx].sourceRecipes.push(...existing.sourceRecipes);
        } else {
            finalItemsList.push(extra);
        }
    });

    // Recalcular precios finales
    finalItemsList.forEach(item => {
        const basePrice = customPrices[item.name] || SPANISH_PRICES[item.name.toLowerCase()] || SPANISH_PRICES['default'];
        const mult = (item.unit === 'g' || item.unit === 'ml') ? 0.001 : 1;
        item.estimated_price = item.quantity * mult * basePrice * (activeStore ? activeStore.multiplier : 1);
    });

    const totalEstimated = finalItemsList.reduce((acc, curr) => acc + curr.estimated_price, 0);

    const storeComparisons = SUPERMARKETS.map(shop => {
        const total = finalItemsList.reduce((acc, item) => {
            const base = item.estimated_price / (activeStore ? activeStore.multiplier : 1);
            return acc + (base * shop.multiplier);
        }, 0);
        return { ...shop, total };
    }).sort((a, b) => a.total - b.total);

    const cheapest = storeComparisons[0];
    const expensive = storeComparisons[storeComparisons.length - 1];
    const maxSavings = expensive.total - cheapest.total;

    return { itemsList: finalItemsList, totalEstimated, storeComparisons, cheapest, maxSavings };
  }, [plan, recipes, pantry, selectedStoreId, dbItems, adjustments, customPrices]);

  const groupedItems = useMemo(() => {
      const groups: Record<string, TraceableShoppingItem[]> = {};
      shoppingData.itemsList.forEach((item: any) => {
          if (hidePurchased && item.is_purchased) return;
          const cat = item.category || 'other';
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(item);
      });
      return groups;
  }, [shoppingData.itemsList, hidePurchased]);

  const handleNativeShare = async () => {
    const text = shoppingData.itemsList
        .map(i => `- ${i.quantity.toFixed(1)} ${i.unit} ${i.name} ${i.is_purchased ? '[✓]' : '[ ]'}`)
        .join('\n');
    
    if (navigator.share) {
        try { await navigator.share({ title: 'Lista de Compra Fresco', text: `Mi lista:\n\n${text}` }); } 
        catch (err) { console.log('User aborted share'); }
    } else {
        alert("Lista copiada al portapapeles");
    }
  };

  const progress = useMemo(() => {
    if (shoppingData.itemsList.length === 0) return 0;
    const purchasedCount = shoppingData.itemsList.filter(item => item.is_purchased).length;
    return Math.round((purchasedCount / shoppingData.itemsList.length) * 100);
  }, [shoppingData.itemsList]);

  const handleFinishClick = () => {
      const itemsToReview = shoppingData.itemsList.filter(i => i.is_purchased);
      setReviewItemsList(itemsToReview.map(i => ({...i})));
      setShowReceipt(true);
  };

  const updateReviewItem = (id: string, field: 'quantity' | 'unit', value: any) => {
      setReviewItemsList(prev => prev.map(item => {
          if (item.id === id) {
              return { ...item, [field]: value };
          }
          return item;
      }));
  };

  const removeReviewItem = (id: string) => {
      setReviewItemsList(prev => prev.filter(item => item.id !== id));
  };

  const confirmFinishShopping = () => {
      const itemsToAddToPantry = reviewItemsList.map(item => {
          const days = EXPIRY_DAYS_BY_CATEGORY[item.category] || 14;
          return {
              id: `shop-${Date.now()}-${Math.random()}`,
              name: item.name,
              quantity: parseFloat(item.quantity as any), 
              unit: item.unit,
              category: item.category,
              added_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
          };
      });
      
      onFinishShopping(itemsToAddToPantry);
      
      setLastSessionStats({
          count: reviewItemsList.length,
          savings: shoppingData.maxSavings > 0 ? shoppingData.maxSavings : 0
      });

      // Limpieza: Borrar items comprados de la DB
      reviewItemsList.forEach(i => {
          if (!i.id.includes('calc')) {
              onRemoveShoppingItem(i.id);
          }
      });
      
      setShowReceipt(false);
      setShowCelebration(true);
      confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
  };

  const toggleItemCheck = (item: TraceableShoppingItem) => {
      if (navigator.vibrate) navigator.vibrate(15);
      
      if (item.id.startsWith('calc')) {
          // Si es calculado y lo marcamos, lo "materializamos" en la DB como comprado
          const newItem: ShoppingItem = {
              id: `real-${Date.now()}-${Math.random()}`,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              category: item.category,
              estimated_price: item.estimated_price,
              is_purchased: true // Marcado
          };
          onAddShoppingItem([newItem]);
      } else {
          // Si ya es real, actualizamos su estado
          onUpdateShoppingItem({ ...item, is_purchased: !item.is_purchased });
      }
  };

  return (
    <div className="p-4 md:p-10 max-w-5xl mx-auto pb-48 safe-pt animate-fade-in">
      {/* Header Panel ... (Sin cambios) ... */}
      <div className="bg-teal-900 rounded-[3.5rem] p-12 text-white shadow-2xl mb-12 relative overflow-hidden">
        <div className="relative z-10">
            <h1 className="text-5xl font-black mb-4">Lista de Compra</h1>
            {hasServingsMismatch && (
                <div className="bg-orange-500/90 backdrop-blur-md p-4 rounded-2xl mb-6 flex items-center justify-between border border-orange-400/50 shadow-xl animate-pulse-slow">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-6 h-6 text-white" />
                        <div>
                            <p className="font-bold text-xs uppercase tracking-widest text-orange-100">Discrepancia</p>
                            <p className="font-bold text-sm text-white">El plan tiene raciones antiguas.</p>
                        </div>
                    </div>
                    <button onClick={onSyncServings} className="bg-white text-orange-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                        <RefreshCw className="w-3 h-3" /> Actualizar a {user.household_size}p
                    </button>
                </div>
            )}
            <div className="flex flex-wrap gap-4 mb-10">
                <div className="bg-white/10 px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
                    <TrendingUp className="text-orange-400 w-5 h-5" />
                    <span className="text-2xl font-black">{shoppingData.totalEstimated.toFixed(2)}€</span>
                </div>
                {selectedStoreId && (
                    <div className="bg-orange-500/20 px-6 py-3 rounded-2xl border border-orange-500/30 flex items-center gap-2 text-orange-100 font-black text-xs uppercase tracking-widest">
                        <Store className="w-4 h-4" /> {SUPERMARKETS.find(s => s.id === selectedStoreId)?.name}
                    </div>
                )}
            </div>
            <div className="bg-white/10 rounded-full h-4 w-full mb-3 p-1">
                <div className="bg-orange-500 h-full rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-teal-300">
                <span>{progress}% Comprado</span>
                <button onClick={() => setShowComparison(true)} className="flex items-center gap-2 hover:text-white transition-all group">
                    <TrendingDown className="w-4 h-4 group-hover:scale-110 transition-transform" /> Comparar Supermercados
                </button>
            </div>
        </div>
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-orange-500 rounded-full blur-[150px] opacity-10" />
      </div>

      {/* Input de Extras */}
      <div className="mb-8 flex flex-col md:flex-row gap-4">
          <form onSubmit={addExtraItem} className="relative group flex-1">
            <input 
                type="text" 
                value={newExtra}
                onChange={(e) => setNewExtra(e.target.value)}
                placeholder="Añadir extras (ej. Chocolate)..."
                className="w-full p-6 pl-8 pr-32 bg-white border-2 border-gray-100 rounded-[2.5rem] focus:outline-none focus:border-teal-500 font-bold text-gray-700 placeholder-gray-300 shadow-sm transition-all focus:shadow-xl"
            />
            <div className="absolute right-3 top-3 bottom-3 flex gap-2">
                <button 
                    type="submit"
                    disabled={!newExtra}
                    className="w-14 bg-gray-100 text-gray-400 rounded-[2rem] flex items-center justify-center hover:bg-teal-100 hover:text-teal-700 transition-all disabled:opacity-30"
                    title="Añadir a lista (Planificado)"
                >
                    <Plus className="w-6 h-6" />
                </button>
                <button 
                    type="button"
                    disabled={!newExtra}
                    onClick={(e) => addExtraItem(e, true)}
                    className="w-14 bg-teal-900 text-white rounded-[2rem] flex items-center justify-center disabled:opacity-50 transition-all hover:scale-105 active:scale-95 shadow-md"
                    title="¡Lo tengo en la mano! (Impulsivo)"
                >
                    <Zap className="w-5 h-5 text-orange-400" />
                </button>
            </div>
          </form>
          
          <button 
            onClick={() => setHidePurchased(!hidePurchased)}
            className={`px-6 py-4 rounded-[2.5rem] flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all border-2 ${
                hidePurchased ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
            }`}
          >
              {hidePurchased ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              <span className="hidden md:inline">{hidePurchased ? 'Mostrar Todo' : 'Ocultar Hechos'}</span>
          </button>
      </div>

      {/* Renderizado de Lista */}
      {shoppingData.itemsList.length === 0 ? (
          <div className="bg-white p-12 rounded-[3.5rem] border border-gray-100 text-center space-y-4">
              <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto text-gray-300">
                  <ShoppingBag size={40} />
              </div>
              <h3 className="text-2xl font-black text-teal-900">Tu lista está vacía</h3>
              <p className="text-gray-400 font-medium">Planifica recetas o añade items manualmente arriba.</p>
          </div>
      ) : (
        <div className="space-y-8 pb-32">
            {Object.keys(groupedItems).length === 0 && hidePurchased ? (
                <div className="text-center py-20 bg-white rounded-[3rem] border border-gray-100">
                    <p className="text-gray-400 font-bold uppercase tracking-widest">Todo está comprado</p>
                    <button onClick={() => setHidePurchased(false)} className="text-teal-600 font-bold mt-2 text-sm">Ver completados</button>
                </div>
            ) : Object.keys(groupedItems).sort().map(catKey => {
                const info = CATEGORY_LABELS[catKey] || CATEGORY_LABELS['other'];
                const allChecked = groupedItems[catKey].every(i => i.is_purchased);
                
                return (
                    <div key={catKey} className="space-y-3">
                        <div className="flex items-center justify-between px-2">
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl w-fit ${info.color} bg-opacity-10`}>
                                <span className="text-lg">{info.emoji}</span>
                                <span className="text-xs font-black uppercase tracking-widest">{info.label}</span>
                            </div>
                            <button 
                                onClick={() => checkAllCategory(groupedItems[catKey])}
                                className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 px-3 py-1 rounded-lg transition-all ${
                                    allChecked ? 'bg-teal-50 text-teal-600' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                }`}
                            >
                                <CheckSquare className="w-3 h-3" />
                                {allChecked ? 'Desmarcar' : 'Todo'}
                            </button>
                        </div>
                        
                        {groupedItems[catKey].map(item => (
                            <div 
                                key={item.id} 
                                className={`w-full p-4 md:p-6 rounded-[2rem] border-2 flex flex-col transition-all group select-none ${
                                    item.is_purchased ? 'bg-gray-50 border-transparent opacity-60' : 'bg-white border-gray-100 hover:border-teal-200 shadow-sm'
                                }`}
                                onClick={() => toggleItemCheck(item)}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-4 md:gap-6 flex-1 cursor-pointer overflow-hidden">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${item.is_purchased ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-300 group-hover:bg-teal-50 group-hover:text-teal-500'}`}>
                                            {item.is_purchased ? <Check className="w-5 h-5 stroke-[4px]" /> : <div className="w-4 h-4 border-2 border-gray-300 rounded-md" />}
                                        </div>
                                        <div className="text-left flex-1 min-w-0">
                                            <div className={`font-black text-lg md:text-xl text-gray-900 capitalize leading-none mb-1 truncate ${item.is_purchased ? 'line-through text-gray-400' : ''}`}>{item.name}</div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-teal-600 uppercase tracking-widest">{item.quantity.toFixed(item.unit === 'g' || item.unit === 'ml' ? 0 : 2)} {item.unit}</span>
                                                {!item.id.includes('calc') && (
                                                    <span className="bg-orange-100 text-orange-600 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Extra</span>
                                                )}
                                                {item.id.includes('calc') && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setExpandedInfoId(expandedInfoId === item.id ? null : item.id); }}
                                                        className="p-1 text-gray-300 hover:text-teal-500 transition-colors"
                                                    >
                                                        <Info className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 md:gap-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                        {!item.is_purchased && (
                                            <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 mr-2">
                                                <button 
                                                    onClick={() => {
                                                        const step = (item.unit === 'kg' || item.unit === 'l') ? -0.25 : (item.unit === 'g' || item.unit === 'ml' ? -100 : -1);
                                                        handleAdjust(item.id, step, item.quantity);
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-white hover:text-teal-600 rounded-lg transition-all"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        const step = (item.unit === 'kg' || item.unit === 'l') ? 0.25 : (item.unit === 'g' || item.unit === 'ml' ? 100 : 1);
                                                        handleAdjust(item.id, step, item.quantity);
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-white hover:text-teal-600 rounded-lg transition-all"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                        <div className="relative">
                                            {editingPriceId === item.id ? (
                                                <input 
                                                    autoFocus
                                                    type="number"
                                                    step="0.01"
                                                    className="w-20 bg-white border border-teal-500 rounded-lg px-2 py-1 text-right font-black text-lg focus:outline-none shadow-lg"
                                                    defaultValue={(item.estimated_price / (item.quantity * ((item.unit === 'g' || item.unit === 'ml') ? 0.001 : 1))).toFixed(2)}
                                                    onBlur={(e) => handlePriceUpdate(item.name, parseFloat(e.target.value))}
                                                    onKeyDown={(e) => e.key === 'Enter' && handlePriceUpdate(item.name, parseFloat(e.currentTarget.value))}
                                                />
                                            ) : (
                                                <button 
                                                    onClick={() => setEditingPriceId(item.id)}
                                                    className={`text-lg md:text-xl font-black ${item.is_purchased ? 'text-gray-300' : 'text-gray-900'} hover:text-teal-600 transition-colors flex items-center gap-1`}
                                                >
                                                    {item.estimated_price.toFixed(2)}€
                                                    {customPrices[item.name] && <span className="w-2 h-2 bg-orange-500 rounded-full" title="Precio personalizado" />}
                                                </button>
                                            )}
                                        </div>
                                        {!item.id.includes('calc') && !item.is_purchased && (
                                            <button onClick={(e) => { e.stopPropagation(); onRemoveShoppingItem(item.id); }} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {expandedInfoId === item.id && (
                                    <div className="mt-4 pt-3 border-t border-dashed border-gray-100 animate-slide-up text-xs text-gray-500 flex flex-col gap-1 pl-14">
                                        <span className="font-bold uppercase tracking-widest text-[9px] text-teal-600">Necesario para:</span>
                                        {item.sourceRecipes.map((source, idx) => (
                                            <button key={idx} onClick={(e) => { e.stopPropagation(); onOpenRecipe(source); }} className="flex items-center gap-2 group hover:text-orange-500 transition-colors text-left">
                                                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full group-hover:bg-orange-500" />
                                                <span className="underline decoration-gray-300 underline-offset-2 group-hover:decoration-orange-300">{source}</span>
                                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                );
            })}
        </div>
      )}
      
       {/* Botones Flotantes y Receipt Modal se mantienen igual */}
       <div className="fixed bottom-24 left-6 right-6 flex gap-4 z-50 animate-slide-up">
          <button 
            onClick={handleFinishClick}
            disabled={shoppingData.itemsList.length === 0}
            className="flex-1 bg-teal-900 text-white py-7 rounded-[2.5rem] font-black shadow-2xl flex items-center justify-center gap-4 hover:bg-teal-800 transition-all active:scale-95 border-4 border-white/10 disabled:opacity-50"
          >
              <ShoppingBag className="w-6 h-6" /> Terminar Compra
          </button>
          <button onClick={handleNativeShare} className="w-24 bg-orange-500 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl active:scale-95 transition-all hover:bg-orange-600">
            <Share2 className="w-8 h-8" />
          </button>
      </div>
      
      {showReceipt && (
          <div className="fixed inset-0 z-[5000] bg-teal-900 flex flex-col items-center justify-center p-6 animate-fade-in text-white">
              <div className="bg-white w-full max-w-sm h-full max-h-[80vh] rounded-[2rem] p-0 shadow-2xl overflow-hidden text-gray-900 relative flex flex-col">
                  <div className="absolute top-0 left-0 right-0 h-4 bg-teal-900 z-10" style={{clipPath: 'polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)'}}></div>
                  
                  <div className="p-8 pt-12 flex flex-col items-center flex-1 overflow-hidden">
                      <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white mb-4 shadow-xl flex-shrink-0">
                          <Check className="w-8 h-8 stroke-[4px]" />
                      </div>
                      <h2 className="text-2xl font-black text-center mb-1">Revisión Final</h2>
                      <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mb-6">Confirma y ajusta antes de guardar</p>
                      
                      <div className="w-full flex-1 overflow-y-auto mb-6 pr-2 space-y-2">
                          {reviewItemsList.map((item) => (
                              <div key={item.id} className="flex justify-between items-center p-2 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white transition-all">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <button onClick={() => removeReviewItem(item.id)} className="text-red-300 hover:text-red-500 p-1"><X className="w-4 h-4" /></button>
                                      <span className="font-bold text-sm capitalize truncate text-gray-900">{item.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-100">
                                      <input 
                                        type="number"
                                        step="0.1"
                                        className="w-14 text-right font-black text-xs text-teal-900 focus:outline-none"
                                        value={item.quantity}
                                        onChange={(e) => updateReviewItem(item.id, 'quantity', e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <input 
                                        type="text"
                                        className="w-12 font-bold text-[10px] text-gray-400 uppercase focus:outline-none text-center"
                                        value={item.unit}
                                        onChange={(e) => updateReviewItem(item.id, 'unit', e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                  </div>
                              </div>
                          ))}
                      </div>

                      <button onClick={confirmFinishShopping} className="w-full py-5 bg-teal-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-teal-800 transition-all active:scale-95 flex-shrink-0">
                          Guardar {reviewItemsList.length} items <ChevronRight className="w-4 h-4" />
                      </button>
                      <button onClick={() => setShowReceipt(false)} className="mt-4 text-xs font-bold text-gray-400 hover:text-gray-600">Cancelar y volver</button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-teal-900 z-10" style={{clipPath: 'polygon(0% 100%, 5% 0%, 10% 100%, 15% 0%, 20% 100%, 25% 0%, 30% 100%, 35% 0%, 40% 100%, 45% 0%, 50% 100%, 55% 0%, 60% 100%, 65% 0%, 70% 100%, 75% 0%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%)'}}></div>
              </div>
          </div>
      )}

      {showCelebration && (
          <div className="fixed inset-0 z-[6000] bg-teal-900 flex flex-col items-center justify-center p-6 animate-fade-in text-white">
              <div className="text-center">
                  <div className="relative mb-8 inline-block">
                      <div className="w-32 h-32 bg-orange-500 rounded-full flex items-center justify-center shadow-2xl animate-bounce">
                          <PartyPopper className="w-16 h-16 text-white" />
                      </div>
                      <div className="absolute -top-4 -right-4 bg-white text-orange-600 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg rotate-12">
                          ¡Smart Saver!
                      </div>
                  </div>
                  
                  <h2 className="text-5xl font-black mb-4">¡Misión Cumplida!</h2>
                  <p className="text-teal-200 text-lg mb-12 max-w-sm mx-auto">
                      Has reabastecido <span className="font-black text-white">{lastSessionStats.count} productos</span>. Tu despensa está lista para la semana.
                  </p>

                  <div className="bg-white/10 rounded-[2.5rem] p-8 max-w-xs mx-auto mb-12 border border-white/10 backdrop-blur-md">
                      <p className="text-[10px] font-black uppercase tracking-widest text-teal-300 mb-2">Ahorro Potencial</p>
                      <div className="text-5xl font-black mb-2">{lastSessionStats.savings.toFixed(2)}€</div>
                      <p className="text-xs font-bold opacity-60">vs Supermercado más caro</p>
                  </div>

                  <button 
                    onClick={() => setShowCelebration(false)} 
                    className="px-12 py-5 bg-white text-teal-900 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all"
                  >
                      Volver a la cocina
                  </button>
              </div>
          </div>
      )}

      {showComparison && (
        <div className="fixed inset-0 z-[4000] bg-teal-900/98 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-white animate-fade-in overflow-y-auto no-scrollbar">
            <button onClick={() => setShowComparison(false)} className="absolute top-10 right-10 p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all z-10"><X className="w-8 h-8" /></button>
            <div className="w-full max-w-2xl flex flex-col items-center">
                <div className="text-center mb-12">
                    <div className="w-20 h-20 bg-orange-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl animate-bounce-subtle"><Trophy className="w-10 h-10 text-white" /></div>
                    <h2 className="text-5xl font-black mb-2 tracking-tight">Comparar Precios</h2>
                    <p className="text-teal-300 font-medium text-lg opacity-60">Optimizamos tu bolsillo analizando el mercado real.</p>
                </div>
                <div className="w-full space-y-4 mb-10">
                    {shoppingData.storeComparisons.map((shop, idx) => (
                        <div key={shop.id} onClick={() => { setSelectedStoreId(shop.id); setShowComparison(false); }} className={`p-8 rounded-[3rem] border-2 flex justify-between items-center group cursor-pointer transition-all hover:scale-[1.02] ${idx === 0 ? 'bg-white text-teal-900 border-white shadow-2xl' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                            <div className="flex items-center gap-6">
                                <div className={`w-16 h-16 rounded-2xl ${shop.color} flex items-center justify-center text-3xl shadow-xl`}>{shop.id === 'mercadona' ? '🛒' : shop.id === 'carrefour' ? '🛍️' : '🚛'}</div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className={`font-black text-2xl leading-none ${idx === 0 ? 'text-teal-900' : 'text-white'}`}>{shop.name}</div>
                                        {idx === 0 && <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">Recomendado</span>}
                                    </div>
                                    <div className="text-[10px] font-bold opacity-50 uppercase tracking-widest mt-1">Multiplicador x{shop.multiplier}</div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className={`text-4xl font-black ${idx === 0 ? 'text-teal-900' : 'text-white'}`}>{shop.total.toFixed(2)}€</div>
                                <div className="text-[10px] font-black opacity-40 uppercase tracking-widest">Total estimado</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
