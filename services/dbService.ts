
import { supabase } from '../lib/supabase';
import { PantryItem, Recipe, MealSlot, UserProfile, ShoppingItem } from '../types';
import { FALLBACK_RECIPES } from '../constants';

// --- PANTRY ---
export const fetchPantry = async (userId: string): Promise<PantryItem[]> => {
    const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', userId);
    
    if (error) {
        console.error('Error fetching pantry:', error);
        return [];
    }
    return data || [];
};

export const addPantryItemDB = async (userId: string, item: PantryItem) => {
    const { error } = await supabase.from('pantry_items').upsert({
        id: item.id,
        user_id: userId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        added_at: item.added_at,
        expires_at: item.expires_at
    });
    if (error) console.error('Error adding pantry item:', error);
};

export const deletePantryItemDB = async (id: string) => {
    const { error } = await supabase.from('pantry_items').delete().eq('id', id);
    if (error) console.error('Error deleting pantry item:', error);
};

export const updatePantryItemDB = async (userId: string, item: PantryItem) => {
    return addPantryItemDB(userId, item);
};

// --- SHOPPING LIST (NUEVO) ---
export const fetchShoppingList = async (userId: string): Promise<ShoppingItem[]> => {
    const { data, error } = await supabase
        .from('shopping_list')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching shopping list:', error);
        return [];
    }
    return data || [];
};

export const addShoppingItemDB = async (userId: string, item: ShoppingItem) => {
    const { error } = await supabase.from('shopping_list').upsert({
        id: item.id,
        user_id: userId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        estimated_price: item.estimated_price,
        is_purchased: item.is_purchased
    });
    if (error) console.error('Error adding shopping item:', error);
};

export const updateShoppingItemDB = async (userId: string, item: ShoppingItem) => {
    return addShoppingItemDB(userId, item);
};

export const deleteShoppingItemDB = async (id: string) => {
    const { error } = await supabase.from('shopping_list').delete().eq('id', id);
    if (error) console.error('Error deleting shopping item:', error);
};

// --- RECIPES ---
export const fetchRecipes = async (userId: string): Promise<Recipe[]> => {
    const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching recipes:', error);
        return [];
    }
    
    return (data || []).map(r => ({
        ...r,
        ingredients: typeof r.ingredients === 'string' ? JSON.parse(r.ingredients) : r.ingredients,
        instructions: typeof r.instructions === 'string' ? JSON.parse(r.instructions) : r.instructions,
        dietary_tags: typeof r.dietary_tags === 'string' ? JSON.parse(r.dietary_tags) : r.dietary_tags,
    }));
};

export const saveRecipeDB = async (userId: string, recipe: Recipe) => {
    const { error } = await supabase.from('recipes').upsert({
        id: recipe.id,
        user_id: userId,
        title: recipe.title,
        description: recipe.description,
        meal_category: recipe.meal_category,
        cuisine_type: recipe.cuisine_type,
        difficulty: recipe.difficulty,
        prep_time: recipe.prep_time,
        servings: recipe.servings,
        calories: recipe.calories,
        image_url: recipe.image_url,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        dietary_tags: recipe.dietary_tags
    });
    if (error) console.error('Error saving recipe:', error);
};

// --- MEAL PLAN ---
export const fetchMealPlan = async (userId: string): Promise<MealSlot[]> => {
    const { data, error } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching plan:', error);
        return [];
    }
    return (data || []).map(p => ({
        date: p.date,
        type: p.type,
        recipeId: p.recipe_id,
        servings: p.servings,
        isCooked: p.is_cooked
    }));
};

export const updateMealSlotDB = async (userId: string, slot: MealSlot) => {
    const { error } = await supabase.from('meal_plans').upsert({
        user_id: userId,
        date: slot.date,
        type: slot.type,
        recipe_id: slot.recipeId,
        servings: slot.servings,
        is_cooked: slot.isCooked
    }, { onConflict: 'user_id, date, type' });
    
    if (error) console.error('Error updating meal plan:', error);
};

export const deleteMealSlotDB = async (userId: string, date: string, type: string) => {
    const { error } = await supabase
        .from('meal_plans')
        .delete()
        .match({ user_id: userId, date, type });
        
    if (error) console.error('Error deleting slot:', error);
};

// --- SEEDER ---
export const seedDatabaseIfEmpty = async (userId: string) => {
    const recipes = await fetchRecipes(userId);
    if (recipes.length === 0) {
        console.log('🌱 Seeding database for new user...');
        for (const recipe of FALLBACK_RECIPES) {
            await saveRecipeDB(userId, { ...recipe, id: `seed-${Date.now()}-${Math.random()}` });
        }
        const starterPantry: PantryItem[] = [
            { id: `start-1`, name: 'Aceite de Oliva', quantity: 1, unit: 'l', category: 'pantry', added_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000 * 365).toISOString() },
            { id: `start-2`, name: 'Sal', quantity: 1, unit: 'kg', category: 'spices', added_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000 * 700).toISOString() },
            { id: `start-3`, name: 'Arroz', quantity: 1, unit: 'kg', category: 'grains', added_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000 * 180).toISOString() },
            { id: `start-4`, name: 'Huevos', quantity: 6, unit: 'unidades', category: 'dairy', added_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000 * 14).toISOString() },
            { id: `start-5`, name: 'Leche', quantity: 2, unit: 'l', category: 'dairy', added_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000 * 30).toISOString() },
        ];
        for (const item of starterPantry) {
            await addPantryItemDB(userId, item);
        }
        return true; 
    }
    return false;
};
