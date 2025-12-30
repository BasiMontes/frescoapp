
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PantryItem } from '../types';
import { Package, Plus, Trash2, Calendar, X, Save, AlertTriangle, Clock, Minus, Camera, Sparkles, Pencil, CheckCircle2, AlertOctagon, WifiOff, Search, ChevronDown, ChevronUp, Wand2, RotateCcw, Utensils, ArrowRight, Skull, Zap } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { TicketScanner } from './TicketScanner';
import { PREDICTIVE_CATEGORY_RULES, SPANISH_PRICES } from '../constants';

interface PantryProps {
  items: PantryItem[];
  highlightId?: string | null; 
  onRemove: (id: string) => void;
  onAdd: (item: PantryItem) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onAddMany: (items: PantryItem[]) => void;
  onEdit: (item: PantryItem) => void;
  onWaste?: (item: PantryItem, value: number) => void;
  onCook?: (itemName: string) => void; // FIX 2: Nuevo prop para acción rápida
  isOnline?: boolean;
}

const CATEGORIES_OPTIONS = [
    { id: 'vegetables', label: 'Verdulería', emoji: '🥦' },
    { id: 'fruits', label: 'Frutería', emoji: '🍎' },
    { id: 'dairy', label: 'Lácteos/Huevos', emoji: '🧀' },
    { id: 'meat', label: 'Carnicería', emoji: '🥩' },
    { id: 'fish', label: 'Pescadería', emoji: '🐟' },
    { id: 'grains', label: 'Cereales/Pan', emoji: '🥖' },
    { id: 'pantry', label: 'Despensa Gral.', emoji: '🥫' },
    { id: 'spices', label: 'Especias', emoji: '🧂' },
    { id: 'other', label: 'Otros', emoji: '🛍️' },
];

export const Pantry: React.FC<PantryProps> = ({ items, highlightId, onRemove, onAdd, onUpdateQuantity, onAddMany, onEdit, onWaste, onCook, isOnline = true }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [itemToEdit, setItemToEdit] = useState<PantryItem | null>(null);
  
  const [quickAdjustItem, setQuickAdjustItem] = useState<PantryItem | null>(null);
  const [quickValue, setQuickValue] = useState(0);

  const [wasteItem, setWasteItem] = useState<PantryItem | null>(null);

  const [activeFilter, setActiveFilter] = useState<'all' | 'expired' | 'critical' | 'fresh'>('all');

  const [newItem, setNewItem] = useState({ 
    name: '', 
    quantity: 1, 
    unit: 'unidades', 
    category: 'pantry',
    daysToExpire: 7
  });
  
  const [manualOverride, setManualOverride] = useState({ category: false, unit: false });

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const quantityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      const initial: Record<string, boolean> = {};
      CATEGORIES_OPTIONS.forEach(c => initial[c.id] = true);
      setExpandedCategories(initial);
  }, []);

  useEffect(() => {
      if (highlightId && itemRefs.current[highlightId]) {
          const item = items.find(i => i.id === highlightId);
          if(item) {
              setExpandedCategories(prev => ({...prev, [item.category]: true}));
              setTimeout(() => {
                  itemRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 300);
          }
      }
  }, [highlightId, items]);

  useEffect(() => {
      if (!newItem.name) return;
      const lowerName = newItem.name.toLowerCase();
      const matchKey = Object.keys(PREDICTIVE_CATEGORY_RULES).find(key => lowerName.includes(key));
      
      if (matchKey) {
          const rule = PREDICTIVE_CATEGORY_RULES[matchKey];
          setNewItem(prev => ({
              ...prev,
              category: manualOverride.category ? prev.category : rule.category,
              unit: manualOverride.unit ? prev.unit : rule.unit
          }));
      }
  }, [newItem.name, manualOverride]);

  const handleManualAdd = (e?: React.FormEvent) => {
    if(e) e.preventDefault();
    if (!newItem.name.trim()) return;
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + newItem.daysToExpire);

    onAdd({
      id: `manual-${Date.now()}`,
      name: newItem.name.trim(),
      quantity: newItem.quantity,
      unit: newItem.unit,
      category: newItem.category,
      added_at: new Date().toISOString(),
      expires_at: expiryDate.toISOString()
    });
    setNewItem({ name: '', quantity: 1, unit: 'unidades', category: 'pantry', daysToExpire: 7 });
    setManualOverride({ category: false, unit: false });
    setShowAddModal(false);
  };

  const initDelete = (item: PantryItem) => {
      setWasteItem(item);
  };

  const confirmDelete = (type: 'consumed' | 'wasted' | 'mistake') => {
      if (!wasteItem) return;

      if (type === 'wasted') {
          const price = SPANISH_PRICES[wasteItem.name.toLowerCase()] || SPANISH_PRICES['default'];
          const multiplier = (wasteItem.unit === 'g' || wasteItem.unit === 'ml') ? 0.001 : 1;
          const lostValue = wasteItem.quantity * multiplier * price;
          
          if (onWaste) onWaste(wasteItem, lostValue);
      }

      onRemove(wasteItem.id);
      setWasteItem(null);
      setQuickAdjustItem(null); 
  };

  const handleEditSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(itemToEdit) {
          onEdit(itemToEdit);
          setItemToEdit(null);
      }
  };

  const handleQuickAdjustConfirm = () => {
      if (quickAdjustItem) {
          const newItem = { ...quickAdjustItem, quantity: quickValue };
          if (newItem.quantity <= 0) {
              initDelete(quickAdjustItem); 
          } else {
              onEdit(newItem);
              setQuickAdjustItem(null);
          }
      }
  };

  const getExpiryStatus = (item: PantryItem) => {
    if (!item.expires_at) return null;
    const days = differenceInDays(new Date(item.expires_at), new Date());
    if (isPast(new Date(item.expires_at)) && days < 0) return { type: 'expired', label: 'Caducado', color: 'text-red-600 bg-red-50' };
    if (days <= 2) return { type: 'critical', label: `Caduca en ${days === 0 ? 'hoy' : days + 'd'}`, color: 'text-orange-600 bg-orange-50' };
    return { type: 'fresh', label: 'Fresco', color: 'text-green-600 bg-green-50' };
  };

  const getSmartStep = (unit: string) => {
      const u = unit.toLowerCase().trim();
      if (u === 'g' || u === 'ml') return 50; 
      if (u === 'kg' || u === 'l') return 0.25;
      if (u === 'unidades' || u === 'uds' || u === 'ud') return 1;
      return 1;
  };

  const pantryStats = useMemo(() => {
      let expired = 0;
      let critical = 0;
      let fresh = 0;

      items.forEach(item => {
          const status = getExpiryStatus(item);
          if (status?.type === 'expired') expired++;
          else if (status?.type === 'critical') critical++;
          else fresh++;
      });
      return { expired, critical, fresh };
  }, [items]);

  const filteredItems = useMemo(() => {
      let result = items;
      if (activeFilter !== 'all') {
          result = result.filter(item => {
              const status = getExpiryStatus(item);
              return status?.type === activeFilter;
          });
      }
      if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          result = result.filter(item => item.name.toLowerCase().includes(lower));
      }
      return result;
  }, [items, activeFilter, searchTerm]);

  const toggleCategory = (cat: string) => {
      setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const categoriesPresent = Array.from(new Set(filteredItems.map(i => i.category)));

  const renderHighlightedText = (text: string, highlight: string) => {
      if (!highlight) return text;
      const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
      return parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() 
              ? <span key={i} className="bg-orange-200 text-orange-900 px-0.5 rounded">{part}</span> 
              : part
      );
  };

  return (
    <div className="p-4 md:p-10 safe-pt animate-fade-in relative">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex justify-between items-center">
            <div>
            <h1 className="text-4xl font-black text-teal-900 leading-none mb-1">Stock Actual</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Gestión de activos alimentarios</p>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={() => { if(isOnline) setShowScanner(true); }}
                    disabled={!isOnline}
                    className={`text-white px-5 py-4 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-xl transition-all ${isOnline ? 'bg-orange-500 hover:bg-orange-600 active:scale-95' : 'bg-gray-400 opacity-50 cursor-not-allowed'}`}
                >
                    {isOnline ? <><Camera className="w-4 h-4" /> Escáner</> : <><WifiOff className="w-4 h-4" /> Offline</>}
                </button>
                <button 
                    onClick={() => setShowAddModal(true)} 
                    className="w-14 h-14 bg-teal-900 text-white rounded-2xl flex items-center justify-center shadow-xl hover:bg-teal-800 active:scale-90 transition-all"
                >
                    <Plus className="w-6 h-6" />
                </button>
            </div>
        </div>

        {items.length > 0 && (
            <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5 group-focus-within:text-teal-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder="Buscar en despensa..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-16 pr-6 py-4 bg-white border border-gray-100 rounded-[2rem] font-bold text-gray-700 shadow-sm focus:outline-none focus:border-teal-500 focus:shadow-lg transition-all"
                />
            </div>
        )}
      </div>

      {items.length > 0 && (
          <div className="flex gap-3 overflow-x-auto no-scrollbar mb-8 pb-2">
              <button 
                onClick={() => setActiveFilter(activeFilter === 'expired' ? 'all' : 'expired')}
                className={`flex items-center gap-3 px-6 py-4 rounded-[2rem] border transition-all ${
                    activeFilter === 'expired' ? 'bg-red-500 text-white border-red-500 shadow-xl' : 'bg-white border-gray-100 text-gray-500 hover:border-red-200'
                }`}
              >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeFilter === 'expired' ? 'bg-white/20' : 'bg-red-50'}`}>
                      <AlertOctagon className={`w-4 h-4 ${activeFilter === 'expired' ? 'text-white' : 'text-red-500'}`} />
                  </div>
                  <div className="text-left">
                      <div className="text-xl font-black leading-none">{pantryStats.expired}</div>
                      <div className="text-[8px] font-bold uppercase tracking-widest opacity-70">Caducados</div>
                  </div>
              </button>

              <button 
                onClick={() => setActiveFilter(activeFilter === 'critical' ? 'all' : 'critical')}
                className={`flex items-center gap-3 px-6 py-4 rounded-[2rem] border transition-all ${
                    activeFilter === 'critical' ? 'bg-orange-500 text-white border-orange-500 shadow-xl' : 'bg-white border-gray-100 text-gray-500 hover:border-orange-200'
                }`}
              >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeFilter === 'critical' ? 'bg-white/20' : 'bg-orange-50'}`}>
                      <AlertTriangle className={`w-4 h-4 ${activeFilter === 'critical' ? 'text-white' : 'text-orange-500'}`} />
                  </div>
                  <div className="text-left">
                      <div className="text-xl font-black leading-none">{pantryStats.critical}</div>
                      <div className="text-[8px] font-bold uppercase tracking-widest opacity-70">Críticos</div>
                  </div>
              </button>

              <button 
                onClick={() => setActiveFilter(activeFilter === 'fresh' ? 'all' : 'fresh')}
                className={`flex items-center gap-3 px-6 py-4 rounded-[2rem] border transition-all ${
                    activeFilter === 'fresh' ? 'bg-teal-600 text-white border-teal-600 shadow-xl' : 'bg-white border-gray-100 text-gray-500 hover:border-teal-200'
                }`}
              >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeFilter === 'fresh' ? 'bg-white/20' : 'bg-teal-50'}`}>
                      <CheckCircle2 className={`w-4 h-4 ${activeFilter === 'fresh' ? 'text-white' : 'text-teal-600'}`} />
                  </div>
                  <div className="text-left">
                      <div className="text-xl font-black leading-none">{pantryStats.fresh}</div>
                      <div className="text-[8px] font-bold uppercase tracking-widest opacity-70">Frescos</div>
                  </div>
              </button>
          </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center px-12">
          <div className="w-32 h-32 bg-gray-50 rounded-[3rem] flex items-center justify-center mb-8">
            <Package className="w-16 h-16 text-gray-200" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-3">Tu nevera está vacía</h2>
          <p className="text-gray-400 font-medium max-w-sm mx-auto leading-relaxed">
            Escanea tu ticket de compra para que Fresco empiece a gestionar tus ahorros automáticamente.
          </p>
          <button 
            onClick={() => { if(isOnline) setShowScanner(true); }}
            disabled={!isOnline}
            className={`mt-8 px-10 py-5 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl active:scale-95 transition-all ${isOnline ? 'bg-teal-900' : 'bg-gray-400 cursor-not-allowed'}`}
          >
            {isOnline ? 'Escanear mi primer ticket' : 'Modo Offline: Usar Botón +'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {categoriesPresent.sort().map(cat => (
            <div key={cat} className="animate-fade-in bg-white border border-gray-100 rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <button 
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between p-6 bg-white hover:bg-gray-50 transition-colors"
              >
                  <h3 className="uppercase text-[11px] font-black text-teal-900 tracking-[0.3em] flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${expandedCategories[cat] ? 'bg-orange-500' : 'bg-gray-300'}`} /> 
                      {CATEGORIES_OPTIONS.find(c => c.id === cat)?.label || cat}
                  </h3>
                  {expandedCategories[cat] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {expandedCategories[cat] && (
                  <div className="p-6 pt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-gray-50">
                    {filteredItems.filter(i => i.category === cat).map(item => {
                      const status = getExpiryStatus(item);
                      const step = getSmartStep(item.unit);
                      const isHighlighted = highlightId === item.id;

                      return (
                        <div 
                            key={item.id} 
                            ref={(el) => { if (el) itemRefs.current[item.id] = el; }}
                            className={`bg-gray-50 p-6 rounded-[2rem] border flex flex-col justify-between group relative overflow-hidden transition-all duration-300 ${
                                isHighlighted 
                                ? 'ring-4 ring-orange-400 scale-105 shadow-2xl z-10 bg-orange-50 border-orange-200' 
                                : 'border-gray-100 hover:border-teal-400 hover:shadow-xl hover:bg-white'
                            }`}
                        >
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex gap-1 items-center w-full">
                                {status && status.type !== 'fresh' ? (
                                    <div className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase flex items-center gap-1 shadow-sm ${status.color}`}>
                                        <AlertTriangle className="w-3 h-3" /> {status.label}
                                    </div>
                                ) : (
                                    <div className="px-3 py-1.5 rounded-full text-[8px] font-black uppercase flex items-center gap-1 bg-white text-gray-300 border border-gray-100">
                                        Fresco
                                    </div>
                                )}
                                <div className="flex-1" />
                                
                                {/* FIX 2: Botón de Cocinar Ahora (Rayo) */}
                                {onCook && (
                                    <button 
                                        onClick={() => onCook(item.name)} 
                                        className="p-2 text-orange-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all mr-1"
                                        title="Cocinar con esto"
                                    >
                                        <Zap className="w-4 h-4" />
                                    </button>
                                )}

                                <button 
                                    onClick={() => setItemToEdit(item)} 
                                    className="p-2 text-gray-300 hover:text-teal-600 transition-colors"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => initDelete(item)} 
                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                          </div>
                          
                          <div>
                            <div className="font-black text-gray-900 capitalize text-lg mb-4 truncate">
                                {renderHighlightedText(item.name as string, searchTerm as string)}
                            </div>
                            <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-gray-100 group-hover:border-teal-100 transition-colors shadow-sm">
                                <button 
                                    onClick={() => onUpdateQuantity(item.id, -step)}
                                    className="w-10 h-10 flex items-center justify-center text-teal-900 hover:bg-gray-50 rounded-xl transition-all active:scale-75"
                                >
                                    <Minus className="w-5 h-5" />
                                </button>
                                
                                <button
                                    onClick={() => {
                                        setQuickAdjustItem(item);
                                        setQuickValue(item.quantity);
                                    }}
                                    className="flex-1 text-center"
                                >
                                    <span className="text-xs font-black text-teal-900 tabular-nums border-b-2 border-dashed border-teal-200 hover:border-orange-400 hover:text-orange-500 transition-colors">
                                        {Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(2)} <span className="opacity-40">{item.unit}</span>
                                    </span>
                                </button>

                                <button 
                                    onClick={() => onUpdateQuantity(item.id, step)}
                                    className="w-10 h-10 flex items-center justify-center text-teal-900 hover:bg-gray-50 rounded-xl transition-all active:scale-75"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="mt-5 flex items-center gap-2 text-[9px] text-gray-300 font-black uppercase tracking-widest">
                                <Clock className="w-3.5 h-3.5" />
                                {format(new Date(item.added_at), 'd MMM')}
                            </div>
                          </div>
                          {status && status.type !== 'fresh' && <div className="absolute bottom-0 left-0 h-1 bg-orange-500 w-full animate-pulse" />}
                        </div>
                      );
                    })}
                  </div>
              )}
            </div>
          ))}
        </div>
      )}

      {wasteItem && (
          <div className="fixed inset-0 z-[1200] bg-teal-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in" onClick={() => setWasteItem(null)}>
              <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                  <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Trash2 className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-2xl font-black text-gray-900 mb-2">¿Ya no está?</h3>
                      <p className="text-gray-500 font-medium text-sm leading-relaxed">
                          Ayúdanos a calcular tu ahorro real. ¿Por qué eliminas <span className="text-teal-900 font-black">"{wasteItem.name}"</span>?
                      </p>
                  </div>

                  <div className="space-y-3">
                      <button onClick={() => confirmDelete('consumed')} className="w-full p-4 rounded-2xl bg-green-50 border border-green-100 hover:bg-green-100 flex items-center gap-4 transition-all group">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-green-600 shadow-sm group-hover:scale-110 transition-transform"><Utensils className="w-5 h-5" /></div>
                          <div className="text-left">
                              <div className="font-black text-teal-900 text-sm">Me lo comí</div>
                              <div className="text-[10px] font-bold text-green-600 uppercase tracking-widest">¡Que aproveche!</div>
                          </div>
                      </button>

                      <button onClick={() => confirmDelete('wasted')} className="w-full p-4 rounded-2xl bg-red-50 border border-red-100 hover:bg-red-100 flex items-center gap-4 transition-all group">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-red-500 shadow-sm group-hover:scale-110 transition-transform"><Skull className="w-5 h-5" /></div>
                          <div className="text-left">
                              <div className="font-black text-teal-900 text-sm">Se echó a perder</div>
                              <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Descontar Ahorro</div>
                          </div>
                      </button>

                      <button onClick={() => confirmDelete('mistake')} className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-gray-100 flex items-center gap-4 transition-all group">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-gray-400 shadow-sm group-hover:scale-110 transition-transform"><RotateCcw className="w-5 h-5" /></div>
                          <div className="text-left">
                              <div className="font-black text-teal-900 text-sm">Error / Corrección</div>
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sin impacto</div>
                          </div>
                      </button>
                  </div>
              </div>
          </div>
      )}

      {quickAdjustItem && (
          <div className="fixed inset-0 z-[1100] bg-teal-900/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in" onClick={() => setQuickAdjustItem(null)}>
              <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                  <div className="text-center mb-8">
                      <h3 className="text-2xl font-black text-gray-900 capitalize mb-1">{quickAdjustItem.name}</h3>
                      <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Ajuste Rápido de Stock</p>
                  </div>
                  
                  <div className="flex items-center justify-center gap-4 mb-8">
                      <button onClick={() => setQuickValue(Math.max(0, quickValue - getSmartStep(quickAdjustItem.unit)))} className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-xl font-bold hover:bg-gray-200"><Minus /></button>
                      <div className="text-4xl font-black text-teal-900 w-32 text-center">
                          {quickValue.toFixed(quickAdjustItem.unit === 'g' || quickAdjustItem.unit === 'ml' ? 0 : 2)}
                          <span className="text-lg text-gray-400 ml-1">{quickAdjustItem.unit}</span>
                      </div>
                      <button onClick={() => setQuickValue(quickValue + getSmartStep(quickAdjustItem.unit))} className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-xl font-bold hover:bg-gray-200"><Plus /></button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-8">
                      <button onClick={() => setQuickValue(quickAdjustItem.quantity * 0.5)} className="py-3 bg-orange-50 text-orange-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-100 transition-colors">Gasté la mitad</button>
                      <button onClick={() => setQuickValue(0)} className="py-3 bg-red-50 text-red-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-colors">Se acabó (0)</button>
                  </div>

                  <button onClick={handleQuickAdjustConfirm} className="w-full py-5 bg-teal-900 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all">
                      Confirmar
                  </button>
              </div>
          </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[1000] bg-teal-900/60 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[3.5rem] p-10 shadow-2xl animate-slide-up overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-3xl font-black text-teal-900">Añadir Stock</h3>
              <button onClick={() => setShowAddModal(false)} className="p-3 bg-gray-50 rounded-2xl text-gray-400"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleManualAdd} className="space-y-8">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Nombre</label>
                <div className="relative">
                    <input 
                      type="text" 
                      autoFocus
                      required
                      value={newItem.name}
                      onChange={e => setNewItem({...newItem, name: e.target.value})}
                      onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                              e.preventDefault();
                              quantityInputRef.current?.focus();
                          }
                      }}
                      className="w-full p-5 pl-12 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-teal-500 focus:outline-none font-black text-lg transition-all"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                        <Wand2 className={`w-5 h-5 ${newItem.name ? 'text-orange-400 animate-pulse' : 'text-gray-300'}`} />
                    </div>
                </div>
                {newItem.name && (
                    <div className="text-[9px] font-bold text-orange-400 uppercase tracking-widest mt-2 ml-2">Autodetectando categoría...</div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Categoría</label>
                <div className="grid grid-cols-3 gap-2">
                    {CATEGORIES_OPTIONS.map(cat => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                                setNewItem({...newItem, category: cat.id});
                                setManualOverride(p => ({...p, category: true}));
                            }}
                            className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                                newItem.category === cat.id 
                                    ? 'bg-orange-50 border-orange-500 text-orange-700' 
                                    : 'bg-white border-gray-100 text-gray-400 hover:border-teal-200'
                            }`}
                        >
                            <span className="text-xl">{cat.emoji}</span>
                            <span className="text-[9px] font-black uppercase tracking-tighter">{cat.label}</span>
                        </button>
                    ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Cantidad</label>
                  <input 
                    type="number" 
                    step="0.1"
                    required
                    ref={quantityInputRef}
                    value={newItem.quantity}
                    onChange={e => setNewItem({...newItem, quantity: parseFloat(e.target.value)})}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleManualAdd(e);
                    }}
                    className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-teal-500 focus:outline-none font-black text-lg transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Unidad</label>
                  <select 
                    value={newItem.unit}
                    onChange={e => {
                        setNewItem({...newItem, unit: e.target.value});
                        setManualOverride(p => ({...p, unit: true}));
                    }}
                    className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-teal-500 focus:outline-none font-black text-lg appearance-none transition-all"
                  >
                    <option value="unidades">Uds</option>
                    <option value="g">Gramos</option>
                    <option value="kg">Kilos</option>
                    <option value="ml">Mililitros</option>
                    <option value="l">Litros</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-6 bg-teal-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-4 hover:bg-teal-800 transition-all active:scale-95">
                <Save className="w-5 h-5" /> Registrar Producto
              </button>
            </form>
          </div>
        </div>
      )}

      {itemToEdit && (
        <div className="fixed inset-0 z-[1000] bg-teal-900/60 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-[3.5rem] p-10 shadow-2xl animate-slide-up overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-3xl font-black text-teal-900">Editar Stock</h3>
              <button onClick={() => setItemToEdit(null)} className="p-3 bg-gray-50 rounded-2xl text-gray-400"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-8">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Nombre</label>
                <input 
                  type="text" 
                  required
                  value={itemToEdit.name}
                  onChange={e => setItemToEdit({...itemToEdit, name: e.target.value})}
                  className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-teal-500 focus:outline-none font-black text-lg transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Fecha de Caducidad</label>
                <input 
                  type="date" 
                  value={itemToEdit.expires_at ? itemToEdit.expires_at.split('T')[0] : ''}
                  onChange={e => setItemToEdit({...itemToEdit, expires_at: new Date(e.target.value).toISOString()})}
                  className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-teal-500 focus:outline-none font-black text-lg transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Cantidad</label>
                  <input 
                    type="number" 
                    step="0.1"
                    required
                    value={itemToEdit.quantity}
                    onChange={e => setItemToEdit({...itemToEdit, quantity: parseFloat(e.target.value)})}
                    className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-teal-500 focus:outline-none font-black text-lg transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Unidad</label>
                  <select 
                    value={itemToEdit.unit}
                    onChange={e => setItemToEdit({...itemToEdit, unit: e.target.value})}
                    className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-teal-500 focus:outline-none font-black text-lg appearance-none transition-all"
                  >
                    <option value="unidades">Uds</option>
                    <option value="g">Gramos</option>
                    <option value="kg">Kilos</option>
                    <option value="ml">Mililitros</option>
                    <option value="l">Litros</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-6 bg-teal-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-4 hover:bg-teal-800 transition-all active:scale-95">
                <Save className="w-5 h-5" /> Guardar Cambios
              </button>
            </form>
          </div>
        </div>
      )}

      {showScanner && (
        <TicketScanner 
          onClose={() => setShowScanner(false)} 
          onAddItems={onAddMany} 
        />
      )}
    </div>
  );
};
