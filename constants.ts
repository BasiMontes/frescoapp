
import { Recipe, UserProfile } from "./types";

// Base de datos de precios blindada
export const SPANISH_PRICES: Record<string, number> = {
  "tomate": 2.20, "cebolla": 1.20, "ajo": 5.50, "pollo": 7.50, "leche": 1.15,
  "huevos": 0.25, "arroz": 1.30, "aceite": 9.50, "pan": 1.00, "lechuga": 1.00,
  "pasta": 1.50, "queso": 12.00, "manzana": 2.50, "platano": 1.80, "pimiento": 2.50,
  "zanahoria": 1.00, "patata": 1.20, "salmon": 18.00, "ternera": 14.00, "yogur": 2.50,
  "aguacate": 1.50, "limon": 0.40, "pepino": 0.80, "quinoa": 3.50, "queso feta": 2.50,
  "aceitunas": 1.20, "calabacin": 1.10, "default": 1.50 
};

// Motor de equivalencias (Unidad -> Gramos)
export const UNIT_WEIGHTS: Record<string, number> = {
  "tomate": 150, "cebolla": 130, "ajo": 8, "huevo": 60, "pimiento": 180,
  "zanahoria": 90, "patata": 200, "aguacate": 220, "limon": 110, "pepino": 250,
  "calabacin": 320, "manzana": 180, "platano": 130, "rebanada": 40, "diente": 6
};

// Conversiones de volumen/medida a gramos
export const MEASURE_CONVERSIONS: Record<string, number> = {
  "pizca": 1, "cucharadita": 5, "cucharada": 15, "taza": 240, "chorrito": 10, "un": 1, "ud": 1, "unidad": 1
};

// AUDITORÍA 26: Reglas predictivas centralizadas
export const PREDICTIVE_CATEGORY_RULES: Record<string, { category: string, unit: string }> = {
    'leche': { category: 'dairy', unit: 'l' },
    'yogur': { category: 'dairy', unit: 'unidades' },
    'huevo': { category: 'dairy', unit: 'unidades' },
    'queso': { category: 'dairy', unit: 'g' },
    'arroz': { category: 'grains', unit: 'kg' },
    'pasta': { category: 'grains', unit: 'kg' },
    'pan': { category: 'grains', unit: 'unidades' },
    'harina': { category: 'pantry', unit: 'kg' },
    'azucar': { category: 'pantry', unit: 'kg' },
    'sal': { category: 'spices', unit: 'kg' },
    'aceite': { category: 'pantry', unit: 'l' },
    'tomate': { category: 'vegetables', unit: 'kg' },
    'lechuga': { category: 'vegetables', unit: 'unidades' },
    'cebolla': { category: 'vegetables', unit: 'kg' },
    'ajo': { category: 'vegetables', unit: 'unidades' },
    'pollo': { category: 'meat', unit: 'kg' },
    'carne': { category: 'meat', unit: 'kg' },
    'pescado': { category: 'fish', unit: 'kg' },
    'atun': { category: 'pantry', unit: 'unidades' },
    'manzana': { category: 'fruits', unit: 'kg' },
    'platano': { category: 'fruits', unit: 'kg' },
    'naranja': { category: 'fruits', unit: 'kg' },
    'papel': { category: 'other', unit: 'unidades' },
    'jabon': { category: 'other', unit: 'l' },
};

// HEURÍSTICA DE CADUCIDAD (Días por defecto según categoría)
export const EXPIRY_DAYS_BY_CATEGORY: Record<string, number> = {
    "vegetables": 7,
    "fruits": 7,
    "dairy": 14,
    "meat": 3,
    "fish": 2,
    "grains": 180, // 6 meses
    "pantry": 90,  // 3 meses
    "spices": 365, // 1 año
    "other": 30
};

// Supermercados para comparativa real de ahorro
export const SUPERMARKETS = [
  { id: 'mercadona', name: 'Mercadona', multiplier: 1.0, color: 'bg-green-600' },
  { id: 'carrefour', name: 'Carrefour', multiplier: 1.05, color: 'bg-blue-600' },
  { id: 'lidl', name: 'Lidl', multiplier: 0.95, color: 'bg-yellow-500' },
  { id: 'aldi', name: 'Aldi', multiplier: 0.98, color: 'bg-blue-800' }
];

// Fix: Add missing time_saved_mins to satisfies UserProfile interface
export const MOCK_USER: UserProfile = {
  name: "Alex Demo",
  dietary_preferences: ["none"],
  favorite_cuisines: ["mediterranean", "spanish"],
  cooking_experience: "intermediate",
  household_size: 2,
  onboarding_completed: true,
  total_savings: 124.80,
  meals_cooked: 34,
  time_saved_mins: 0,
  history_savings: [{ date: '2024-05-01', amount: 124.80 }]
};

export const FALLBACK_RECIPES: Recipe[] = [
  {
    id: "1",
    title: "Tostada de Aguacate y Huevo",
    description: "Desayuno energético con grasas saludables.",
    meal_category: "breakfast",
    cuisine_type: "healthy",
    difficulty: "easy",
    prep_time: 10,
    servings: 1,
    dietary_tags: ["vegetarian"],
    ingredients: [
      { name: "pan", quantity: 1, unit: "rebanada", category: "grains" },
      { name: "aguacate", quantity: 0.5, unit: "unidad", category: "fruits" },
      { name: "huevos", quantity: 1, unit: "unidad", category: "dairy" }
    ],
    instructions: ["Tostar el pan.", "Chafar aguacate.", "Añadir huevo."],
    image_url: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&q=80"
  }
];
