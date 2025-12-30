
export type DietPreference = "vegetarian" | "vegan" | "gluten_free" | "lactose_free" | "keto" | "paleo" | "none";
export type CuisineType = "mediterranean" | "mexican" | "italian" | "asian" | "indian" | "spanish" | "healthy" | "fast";
export type MealCategory = "breakfast" | "lunch" | "dinner";
export type Difficulty = "easy" | "medium" | "hard";

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  category: "vegetables" | "fruits" | "dairy" | "meat" | "fish" | "grains" | "spices" | "pantry" | "other";
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  meal_category: MealCategory;
  cuisine_type: CuisineType;
  difficulty: Difficulty;
  prep_time: number;
  servings: number;
  ingredients: Ingredient[];
  instructions: string[];
  image_url?: string;
  calories?: number;
  dietary_tags: DietPreference[];
}

export interface PantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  added_at: string;
  expires_at?: string;
}

export interface UserProfile {
  name: string;
  email?: string;
  dietary_preferences: DietPreference[];
  favorite_cuisines: CuisineType[];
  cooking_experience: "beginner" | "intermediate" | "advanced";
  household_size: number;
  onboarding_completed: boolean;
  total_savings: number;
  meals_cooked: number;
  time_saved_mins: number;
  history_savings: { date: string; amount: number }[];
}

export interface MealSlot {
  date: string;
  type: MealCategory;
  recipeId?: string;
  servings: number;
  isCooked?: boolean;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  estimated_price: number;
  is_purchased: boolean;
}

export interface BatchStep {
  id: string;
  instruction: string;
  duration_mins: number;
  recipes_affected: string[];
  type: 'prep' | 'cook' | 'clean';
}

export interface BatchSession {
  total_duration: number;
  steps: BatchStep[];
}
