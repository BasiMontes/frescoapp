
import React, { useState, useEffect } from 'react';
import { UserProfile, DietPreference, CuisineType } from '../types';
import { ArrowRight, Check, Sparkles } from 'lucide-react';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

const DIETS: { id: DietPreference; label: string; emoji: string }[] = [
  { id: 'vegetarian', label: 'Vegetariano', emoji: '🥦' },
  { id: 'vegan', label: 'Vegano', emoji: '🌱' },
  { id: 'gluten_free', label: 'Sin Gluten', emoji: '🌾' },
  { id: 'lactose_free', label: 'Sin Lactosa', emoji: '🥛' },
  { id: 'keto', label: 'Keto', emoji: '🥩' },
  { id: 'paleo', label: 'Paleo', emoji: '🦴' },
  { id: 'none', label: 'Sin restricciones', emoji: '🍽️' },
];

const CUISINES: { id: CuisineType; label: string; emoji: string }[] = [
  { id: 'mediterranean', label: 'Mediterránea', emoji: '🫒' },
  { id: 'italian', label: 'Italiana', emoji: '🍝' },
  { id: 'mexican', label: 'Mexicana', emoji: '🌮' },
  { id: 'asian', label: 'Asiática', emoji: '🥢' },
  { id: 'spanish', label: 'Española', emoji: '🥘' },
  { id: 'healthy', label: 'Saludable', emoji: '🥗' },
];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    name: 'Usuario',
    dietary_preferences: [],
    favorite_cuisines: [],
    cooking_experience: 'intermediate',
    household_size: 1,
  });

  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    if (step === 1) setIsValid((profile.dietary_preferences?.length || 0) > 0);
    else if (step === 2) setIsValid((profile.favorite_cuisines?.length || 0) > 0);
    else setIsValid(true);
  }, [step, profile]);

  const toggleDiet = (item: DietPreference) => {
    let newList = [...(profile.dietary_preferences || [])];
    
    // Lógica Excluyente
    if (item === 'none') {
        newList = ['none']; 
    } else {
        newList = newList.filter(i => i !== 'none');
        if (item === 'vegan') newList = newList.filter(i => i !== 'vegetarian');
        if (item === 'vegetarian' && newList.includes('vegan')) newList = newList.filter(i => i !== 'vegan');
        
        if (newList.includes(item)) {
            newList = newList.filter(i => i !== item);
        } else {
            newList.push(item);
        }
    }
    setProfile(p => ({ ...p, dietary_preferences: newList as DietPreference[] }));
  };

  const toggleCuisine = (item: CuisineType) => {
    let newList = [...(profile.favorite_cuisines || [])];
    if (newList.includes(item)) {
      newList = newList.filter(i => i !== item);
    } else {
      newList.push(item);
    }
    setProfile(p => ({ ...p, favorite_cuisines: newList as CuisineType[] }));
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else onComplete({ ...profile, onboarding_completed: true, total_savings: 0, meals_cooked: 0, history_savings: [] } as UserProfile);
  };

  return (
    <div className="min-h-screen bg-teal-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl p-8">
        <div className="w-full bg-gray-100 h-3 rounded-full mb-10 overflow-hidden">
          <div className="bg-teal-600 h-full transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }} />
        </div>

        <div className="min-h-[400px]">
            {step === 1 && (
                <div className="animate-fade-in">
                    <h2 className="text-4xl font-black text-teal-900 mb-3">Tu Dieta</h2>
                    <p className="text-gray-500 mb-8">Selecciona tus preferencias.</p>
                    <div className="grid grid-cols-2 gap-4">
                        {DIETS.map((diet) => (
                            <button
                                key={diet.id}
                                onClick={() => toggleDiet(diet.id)}
                                className={`p-5 rounded-2xl border-2 text-left flex items-center space-x-3 transition-all ${
                                    profile.dietary_preferences?.includes(diet.id)
                                    ? 'border-teal-600 bg-teal-50 text-teal-900'
                                    : 'border-gray-200 bg-white'
                                }`}
                            >
                                <span className="text-2xl">{diet.emoji}</span>
                                <span className="font-bold">{diet.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            {step === 2 && (
                <div className="animate-fade-in">
                    <h2 className="text-4xl font-black text-teal-900 mb-3">Tus Gustos</h2>
                    <p className="text-gray-500 mb-8">¿Qué tipo de cocina te inspira más?</p>
                    <div className="grid grid-cols-2 gap-4">
                        {CUISINES.map((cuisine) => (
                            <button
                                key={cuisine.id}
                                onClick={() => toggleCuisine(cuisine.id)}
                                className={`p-5 rounded-2xl border-2 text-left flex flex-col items-center justify-center gap-2 transition-all ${
                                    profile.favorite_cuisines?.includes(cuisine.id)
                                    ? 'border-orange-500 bg-orange-50 text-orange-900 shadow-lg scale-105'
                                    : 'border-gray-200 bg-white hover:border-orange-200'
                                }`}
                            >
                                <span className="text-4xl">{cuisine.emoji}</span>
                                <span className="font-bold text-sm">{cuisine.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="animate-fade-in">
                    <h2 className="text-4xl font-black text-teal-900 mb-3">Raciones</h2>
                    <div className="flex items-center justify-center gap-10 mt-12">
                        <button onClick={() => setProfile(p => ({ ...p, household_size: Math.max(1, (p.household_size || 1) - 1) }))} className="w-20 h-20 rounded-full border-2 border-gray-200 text-3xl font-black hover:bg-gray-50">-</button>
                        <span className="text-6xl font-black text-teal-900">{profile.household_size}</span>
                        <button onClick={() => setProfile(p => ({ ...p, household_size: (p.household_size || 1) + 1 }))} className="w-20 h-20 rounded-full border-2 border-gray-200 text-3xl font-black hover:bg-gray-50">+</button>
                    </div>
                    <p className="text-center text-gray-400 mt-6 font-bold uppercase tracking-widest text-xs">Personas en casa</p>
                    
                    <div className="bg-orange-50 p-6 rounded-2xl mt-12 border border-orange-100">
                        <p className="text-orange-800 text-sm font-medium text-center leading-relaxed">
                            Al finalizar, nuestra IA generará un menú inicial basado en tus gustos para que no empieces con la app vacía.
                        </p>
                    </div>
                </div>
            )}
        </div>

        <button
          onClick={handleNext}
          disabled={!isValid && step < 3}
          className={`w-full mt-10 py-6 rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition-all ${
            isValid || step === 3 ? 'bg-teal-900 text-white shadow-xl hover:bg-teal-800 active:scale-95' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {step === 3 ? <><Sparkles className="w-6 h-6 text-orange-400 animate-pulse" /> Diseñar mi Menú</> : <>Continuar <ArrowRight /></>}
        </button>
      </div>
    </div>
  );
};
