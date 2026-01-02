import { GoogleGenAI, Type } from "@google/genai";
import { Recipe, UserProfile, PantryItem, MealSlot, BatchSession } from "../types";

// HELPER: Lectura segura de entorno compatible con Vite y Node
const getEnv = (key: string) => {
  // 1. Intento Vite (Estándar Frontend)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  // 2. Intento Process (Estándar Node/Fallback)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

// Buscamos primero la versión VITE_ (segura para navegador) y luego la genérica
const API_KEY = getEnv('VITE_API_KEY') || getEnv('API_KEY');

// Instancia segura de la IA
// Si no hay clave, no explotamos la app entera, solo fallarán las llamadas IA
const ai = new GoogleGenAI({ apiKey: API_KEY || 'MISSING_KEY' });

const notifyError = (message: string) => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fresco-toast', { 
            detail: { type: 'error', message } 
        }));
    }
};

const cleanJson = (text: string): string => {
    let clean = text.trim();
    if (clean.startsWith('```json')) {
        clean = clean.replace(/^```json/, '').replace(/```$/, '');
    } else if (clean.startsWith('```')) {
        clean = clean.replace(/^```/, '').replace(/```$/, '');
    }
    return clean.trim();
};

const RECIPE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    meal_category: { type: Type.STRING },
    cuisine_type: { type: Type.STRING },
    difficulty: { type: Type.STRING },
    prep_time: { type: Type.INTEGER },
    calories: { type: Type.INTEGER },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unit: { type: Type.STRING },
          category: { type: Type.STRING }
        },
        required: ["name", "quantity", "unit"]
      }
    },
    instructions: { type: Type.ARRAY, items: { type: Type.STRING } }
  }
};

export const generateWeeklyPlanAI = async (
  user: UserProfile,
  pantry: PantryItem[],
  existingPlan: MealSlot[] = [],
  targetDates?: string[], 
  targetTypes?: string[]
): Promise<{ plan: MealSlot[], newRecipes: Recipe[] }> => {
  if (!API_KEY) { notifyError("Falta Configuración: API Key"); return { plan: [], newRecipes: [] }; }
  
  try {
    const pantryList = pantry.map(p => `${p.name} (${p.quantity} ${p.unit})`).join(", ");
    
    let dateInstruction = "";
    if (targetDates && targetDates.length > 0) {
        dateInstruction = `Genera un plan SOLO para los siguientes días: ${targetDates.join(", ")}.`;
    } else {
        dateInstruction = "Genera un plan para la próxima semana.";
    }

    let typeInstruction = "";
    if (targetTypes && targetTypes.length > 0) {
        typeInstruction = `Para cada día, planifica SOLO las comidas de tipo: ${targetTypes.join(", ")}.`;
    }

    const prompt = `Actúa como Chef de Fresco. 
    Stock Disponible: ${pantryList}. 
    Perfil Usuario: ${user.dietary_preferences.join(", ")}, Gustos: ${user.favorite_cuisines.join(", ")}.
    
    Instrucciones:
    1. ${dateInstruction}
    2. ${typeInstruction}
    3. Prioriza usar el stock disponible antes de caducar.
    4. Devuelve JSON con 'recipes' (nuevas recetas necesarias) y 'plan' (asignación de slots).`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recipes: { type: Type.ARRAY, items: RECIPE_SCHEMA },
            plan: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  type: { type: Type.STRING },
                  recipe_title: { type: Type.STRING }
                },
                required: ["date", "type", "recipe_title"]
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(cleanJson(response.text || ''));
    const newRecipes: Recipe[] = data.recipes.map((r: any, i: number) => ({
      ...r,
      id: `ai-rec-${Date.now()}-${i}`,
      servings: user.household_size,
      dietary_tags: user.dietary_preferences,
      image_url: `https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&sig=${i}`
    }));

    const newSlots: MealSlot[] = data.plan.map((p: any) => ({
      date: p.date,
      type: p.type,
      recipeId: newRecipes.find(r => r.title === p.recipe_title)?.id,
      servings: user.household_size
    }));

    return { plan: newSlots, newRecipes };
  } catch (error) {
    console.error(error);
    notifyError("Error generando el plan.");
    return { plan: existingPlan, newRecipes: [] }; 
  }
};

export const generateBatchCookingAI = async (recipes: Recipe[]): Promise<BatchSession> => {
  if (!API_KEY) { notifyError("Falta API Key para Batch Cooking"); return { total_duration: 0, steps: [] }; }
  try {
    const recipeTitles = recipes.map(r => r.title).join(", ");
    const prompt = `Como experto en eficiencia culinaria, crea un plan de Batch Cooking para cocinar estas ${recipes.length} recetas a la vez: ${recipeTitles}. 
    Optimiza para que el tiempo total sea el mínimo posible usando tareas paralelas. 
    Responde solo con el JSON siguiendo el esquema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            total_duration: { type: Type.INTEGER },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  instruction: { type: Type.STRING },
                  duration_mins: { type: Type.INTEGER },
                  recipes_affected: { type: Type.ARRAY, items: { type: Type.STRING } },
                  type: { type: Type.STRING }
                },
                required: ["instruction", "duration_mins"]
              }
            }
          }
        }
      }
    });

    return JSON.parse(cleanJson(response.text || ''));
  } catch (error) {
    notifyError("La IA de cocina paralela no está disponible.");
    return { total_duration: 0, steps: [] };
  }
};

export const generateRecipesAI = async (user: UserProfile, pantry: PantryItem[], count: number = 3, customPrompt?: string): Promise<Recipe[]> => {
    if (!API_KEY) { notifyError("Falta API Key de Gemini"); return []; }
    try {
        const pantryList = pantry.map(p => p.name).join(", ");
        const prompt = `Genera ${count} recetas ${customPrompt || `basadas en: ${pantryList}`}. Dieta: ${user.dietary_preferences.join(", ")}.`;
        
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: { 
              responseMimeType: "application/json",
              responseSchema: { type: Type.ARRAY, items: RECIPE_SCHEMA }
            }
        });
        
        const data = JSON.parse(cleanJson(response.text || ''));
        return data.map((r: any, i: number) => ({
            ...r,
            id: `gen-rec-${Date.now()}-${i}`,
            servings: user.household_size,
            dietary_tags: user.dietary_preferences,
            image_url: `https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&q=80&sig=${Math.random()}`
        }));
    } catch (e) {
        notifyError("Error conectando con la cocina IA.");
        return [];
    }
};

export const extractItemsFromTicket = async (base64Image: string): Promise<any[]> => {
  if (!API_KEY) { notifyError("Falta API Key para escanear"); return []; }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } }, 
          { text: "Extrae productos del ticket en JSON. Simplifica nombres." }
        ]
      },
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              unit: { type: Type.STRING },
              category: { type: Type.STRING }
            },
            required: ["name", "quantity", "unit"]
          }
        }
      }
    });
    return JSON.parse(cleanJson(response.text || ''));
  } catch (error) {
    notifyError("Error leyendo el ticket.");
    return [];
  }
};
