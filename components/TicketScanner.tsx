
import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, Loader2, Upload, Sparkles, Plus, Trash2, AlertCircle, CheckCircle2, RefreshCw, CalendarDays } from 'lucide-react';
import { extractItemsFromTicket } from '../services/geminiService';
import { PantryItem } from '../types';
import { EXPIRY_DAYS_BY_CATEGORY } from '../constants';

interface TicketScannerProps {
  onClose: () => void;
  onAddItems: (items: PantryItem[]) => void;
}

const CATEGORY_MAP: Record<string, string> = {
    'verduras': 'vegetables', 'hortalizas': 'vegetables', 'vegetales': 'vegetables', 'greens': 'vegetables',
    'frutas': 'fruits', 'fruta': 'fruits', 'citricos': 'fruits',
    'lacteos': 'dairy', 'leche': 'dairy', 'quesos': 'dairy', 'huevos': 'dairy', 'yogures': 'dairy',
    'carne': 'meat', 'pollo': 'meat', 'aves': 'meat', 'embutidos': 'meat', 'cerdo': 'meat', 'vacuno': 'meat',
    'pescado': 'fish', 'marisco': 'fish', 'congelados': 'fish',
    'cereales': 'grains', 'pan': 'grains', 'pasta': 'grains', 'arroz': 'grains', 'bolleria': 'grains', 'harinas': 'grains',
    'despensa': 'pantry', 'conservas': 'pantry', 'salsas': 'pantry', 'aceites': 'pantry', 'legumbres': 'pantry',
    'especias': 'spices', 'condimentos': 'spices', 'sal': 'spices',
    'bebidas': 'other', 'limpieza': 'other', 'hogar': 'other', 'higiene': 'other', 'otros': 'other'
};

const CATEGORIES_OPTIONS = [
    { id: 'vegetables', label: 'Verduras', emoji: '🥦' },
    { id: 'fruits', label: 'Frutas', emoji: '🍎' },
    { id: 'dairy', label: 'Lácteos', emoji: '🧀' },
    { id: 'meat', label: 'Carne', emoji: '🥩' },
    { id: 'fish', label: 'Pescado', emoji: '🐟' },
    { id: 'grains', label: 'Cereales', emoji: '🥖' },
    { id: 'pantry', label: 'Despensa', emoji: '🥫' },
    { id: 'spices', label: 'Especias', emoji: '🧂' },
    { id: 'other', label: 'Otros', emoji: '🛍️' },
];

const sanitizeCategory = (rawCategory: string): string => {
    const lower = rawCategory.toLowerCase().trim();
    if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
    const found = Object.keys(CATEGORY_MAP).find(key => lower.includes(key));
    return found ? CATEGORY_MAP[found] : 'pantry'; 
};

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;
        img.onload = () => {
            URL.revokeObjectURL(url); 
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const MAX_SIZE = 1024;
            let width = img.width;
            let height = img.height;
            if (width > height && width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
            }
            canvas.width = width;
            canvas.height = height;
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            } else {
                reject(new Error("Canvas context failed"));
            }
        };
        img.onerror = reject;
    });
};

export const TicketScanner: React.FC<TicketScannerProps> = ({ onClose, onAddItems }) => {
  const [step, setStep] = useState<'capture' | 'processing' | 'review' | 'error'>('capture');
  const [detectedItems, setDetectedItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      window.history.pushState({ modal: 'ticket-scanner' }, '', window.location.href);
      const handlePopState = (event: PopStateEvent) => { onClose(); };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, [onClose]);

  const handleManualClose = () => {
      if (window.history.state?.modal === 'ticket-scanner') window.history.back();
      else onClose();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setStep('processing');
      setLoading(true);
      try {
          const compressedBase64 = await compressImage(file);
          processTicket(compressedBase64);
      } catch (err) {
          console.error("Compression error", err);
          setStep('error');
          setLoading(false);
      }
    }
  };

  const processTicket = async (base64: string) => {
    const base64Data = base64.split(',')[1];
    try {
        const items = await extractItemsFromTicket(base64Data);
        if (items && items.length > 0) {
            const sanitized = items.map((item: any) => ({
                ...item,
                category: sanitizeCategory(item.category || ''),
                // Default expiry logic: based on category but mutable
                daysToExpire: EXPIRY_DAYS_BY_CATEGORY[sanitizeCategory(item.category || '')] || 14
            }));
            setDetectedItems(sanitized);
            setStep('review');
        } else {
            setStep('error');
        }
    } catch (e) {
        setStep('error');
    } finally {
        setLoading(false);
    }
  };

  const handleSave = () => {
    const itemsToSave: PantryItem[] = detectedItems.map((item, i) => {
      const days = item.daysToExpire || EXPIRY_DAYS_BY_CATEGORY[item.category] || 30;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);

      return {
        id: `ticket-${Date.now()}-${i}`,
        name: item.name || 'Producto desconocido',
        quantity: item.quantity || 1,
        unit: item.unit || 'unidad',
        category: item.category || 'other',
        added_at: new Date().toISOString(),
        expires_at: expiryDate.toISOString()
      };
    });
    onAddItems(itemsToSave);
    handleManualClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-teal-900/95 backdrop-blur-2xl flex flex-col animate-fade-in overflow-y-auto">
      <div className="p-6 flex justify-between items-center text-white border-b border-white/10 sticky top-0 z-50 bg-teal-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Sparkles className="w-6 h-6" />
            </div>
            <div>
                <h3 className="text-xl font-black">Fresco Vision</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-teal-400">Traducción de tickets</p>
            </div>
        </div>
        <button onClick={handleManualClose} className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all"><X className="w-6 h-6" /></button>
      </div>

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
        {step === 'capture' && (
          <div className="h-full flex flex-col items-center justify-center space-y-8 animate-slide-up">
            <div className="w-full aspect-[3/4] rounded-[3.5rem] border-4 border-dashed border-white/20 flex flex-col items-center justify-center p-12 text-center group hover:border-orange-500/50 transition-all cursor-pointer bg-white/5"
                 onClick={() => fileInputRef.current?.click()}>
                <div className="w-24 h-24 bg-white/10 rounded-[2rem] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-xl">
                    <Camera className="w-10 h-10 text-teal-200" />
                </div>
                <h4 className="text-white text-3xl font-black mb-3">Sube tu ticket</h4>
                <p className="text-teal-200/60 font-medium text-lg leading-relaxed">Nuestra IA traducirá los códigos de supermercado a productos reales automáticamente.</p>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            </div>
            <div className="flex flex-col gap-4 w-full">
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-6 bg-orange-500 text-white rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <Upload className="w-6 h-6" /> Seleccionar Ticket
                </button>
                <p className="text-[10px] font-black uppercase text-center text-teal-300 tracking-[0.2em] opacity-40">Admite Mercadona, Carrefour, Lidl y más</p>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="h-full flex flex-col items-center justify-center space-y-8">
            <div className="relative">
                <div className="w-40 h-40 border-8 border-teal-500/10 border-t-orange-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-12 h-12 text-orange-400 animate-pulse" />
                </div>
            </div>
            <div className="text-center space-y-2">
                <h4 className="text-white text-3xl font-black">Optimizando...</h4>
                <p className="text-teal-200/60 font-medium text-lg">Comprimiendo imagen y analizando...</p>
            </div>
          </div>
        )}

        {step === 'error' && (
             <div className="h-full flex flex-col items-center justify-center space-y-8 animate-slide-up text-center">
                <div className="w-32 h-32 bg-red-500/20 rounded-[3rem] flex items-center justify-center mb-4">
                    <AlertCircle className="w-16 h-16 text-red-400" />
                </div>
                <h4 className="text-white text-3xl font-black">No entendí el ticket</h4>
                <p className="text-teal-200/60 font-medium text-lg max-w-sm">La imagen estaba borrosa o no detectamos productos legibles. Intenta con mejor luz.</p>
                <button 
                    onClick={() => setStep('capture')}
                    className="w-full py-6 bg-white text-teal-900 rounded-[2rem] font-black text-lg shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <RefreshCw className="w-6 h-6" /> Intentar de nuevo
                </button>
             </div>
        )}

        {step === 'review' && (
          <div className="space-y-6 animate-slide-up pb-48">
            <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-[2.5rem] flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white flex-shrink-0">
                    <AlertCircle className="w-6 h-6" />
                </div>
                <p className="text-orange-200 text-xs font-bold leading-relaxed">
                    Hemos traducido los nombres crípticos. Toca la categoría para corregir.
                </p>
            </div>

            <div className="bg-white/10 rounded-[3rem] p-8 border border-white/5 space-y-4">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-white font-black uppercase text-xs tracking-widest opacity-40">Items encontrados ({detectedItems.length})</h4>
                    <button 
                        onClick={() => setDetectedItems([{ name: 'Nuevo producto', quantity: 1, unit: 'unidad', category: 'pantry', daysToExpire: 7 }, ...detectedItems])}
                        className="bg-white/10 text-white p-2 rounded-xl"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="space-y-4">
                    {detectedItems.map((item, i) => (
                        <div key={i} className="p-6 rounded-[2rem] flex flex-col gap-4 transition-all border-2 bg-white border-transparent">
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <input 
                                        className="bg-transparent font-black text-xl w-full focus:outline-none text-gray-900" 
                                        value={item.name} 
                                        onChange={(e) => {
                                            const newItems = [...detectedItems];
                                            newItems[i].name = e.target.value;
                                            setDetectedItems(newItems);
                                        }}
                                    />
                                    {/* FIX 2: Selector nativo de Categoría Estilizado */}
                                    <div className="relative mt-2 inline-block">
                                        <select 
                                            value={item.category}
                                            onChange={(e) => {
                                                const newItems = [...detectedItems];
                                                newItems[i].category = e.target.value;
                                                newItems[i].daysToExpire = EXPIRY_DAYS_BY_CATEGORY[e.target.value] || 14;
                                                setDetectedItems(newItems);
                                            }}
                                            className="appearance-none bg-teal-50 text-teal-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg pr-8 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer w-full"
                                        >
                                            {CATEGORIES_OPTIONS.map(opt => (
                                                <option key={opt.id} value={opt.id}>{opt.emoji} {opt.label}</option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-teal-700">
                                            <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setDetectedItems(detectedItems.filter((_, idx) => idx !== i))}
                                    className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <div className="flex gap-2">
                                <div className="flex-1 bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase text-gray-400">Cant</span>
                                    <input 
                                        type="number" 
                                        step="0.1"
                                        className="bg-transparent text-right font-black text-gray-900 w-16 focus:outline-none"
                                        value={item.quantity}
                                        onChange={(e) => {
                                            const newItems = [...detectedItems];
                                            newItems[i].quantity = parseFloat(e.target.value);
                                            setDetectedItems(newItems);
                                        }}
                                    />
                                </div>
                                <div className="flex-1 bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase text-gray-400">Uni</span>
                                    <input 
                                        className="bg-transparent text-right font-black text-gray-900 w-16 focus:outline-none"
                                        value={item.unit}
                                        onChange={(e) => {
                                            const newItems = [...detectedItems];
                                            newItems[i].unit = e.target.value;
                                            setDetectedItems(newItems);
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="bg-orange-50 rounded-2xl p-4 flex items-center justify-between border border-orange-100">
                                <div className="flex items-center gap-2 text-orange-600">
                                    <CalendarDays className="w-4 h-4" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Caduca en</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <input 
                                        type="number" 
                                        min="1"
                                        className="bg-transparent text-right font-black text-orange-900 w-12 focus:outline-none"
                                        value={item.daysToExpire}
                                        onChange={(e) => {
                                            const newItems = [...detectedItems];
                                            newItems[i].daysToExpire = parseInt(e.target.value) || 1;
                                            setDetectedItems(newItems);
                                        }}
                                    />
                                    <span className="text-xs font-bold text-orange-400">días</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="fixed bottom-10 left-6 right-6 max-w-2xl mx-auto flex gap-4">
                <button 
                    onClick={() => setStep('capture')}
                    className="flex-1 py-6 bg-white/10 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest active:scale-95 transition-all border border-white/10"
                >
                    Repetir
                </button>
                <button 
                    onClick={handleSave}
                    className="flex-[2] py-6 bg-orange-500 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <Check className="w-6 h-6 stroke-[3px]" /> Guardar
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
