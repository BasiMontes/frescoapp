
import { supabase } from '../lib/supabase';
import * as db from './dbService';

type SyncActionType = 
    | 'ADD_PANTRY' 
    | 'UPDATE_PANTRY' 
    | 'DELETE_PANTRY' 
    | 'SAVE_RECIPE' 
    | 'UPDATE_SLOT' 
    | 'DELETE_SLOT' 
    | 'UPDATE_PROFILE'
    | 'ADD_SHOPPING'    // NUEVO
    | 'UPDATE_SHOPPING' // NUEVO
    | 'DELETE_SHOPPING'; // NUEVO

interface SyncItem {
    id: string;
    type: SyncActionType;
    payload: any;
    timestamp: number;
    userId: string;
}

const QUEUE_KEY = 'fresco_sync_queue';

// Leer cola
const getQueue = (): SyncItem[] => {
    try {
        return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    } catch {
        return [];
    }
};

// Guardar cola
const saveQueue = (queue: SyncItem[]) => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

// Añadir a la cola
export const addToSyncQueue = (userId: string, type: SyncActionType, payload: any) => {
    const queue = getQueue();
    // Evitar duplicados simples si es la misma acción sobre el mismo ID muy seguido
    const newItem = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        payload,
        timestamp: Date.now(),
        userId
    };
    
    queue.push(newItem);
    saveQueue(queue);
    console.log(`🔌 Offline: Acción ${type} encolada.`);
};

// Procesar cola
export const processQueue = async () => {
    if (!navigator.onLine) return;

    const queue = getQueue();
    if (queue.length === 0) return;

    console.log(`🔄 Sincronizando ${queue.length} cambios pendientes...`);
    
    const remainingQueue: SyncItem[] = [];
    let processedCount = 0;

    for (const item of queue) {
        try {
            switch (item.type) {
                case 'ADD_PANTRY':
                    await db.addPantryItemDB(item.userId, item.payload);
                    break;
                case 'UPDATE_PANTRY':
                    await db.updatePantryItemDB(item.userId, item.payload);
                    break;
                case 'DELETE_PANTRY':
                    await db.deletePantryItemDB(item.payload.id);
                    break;
                case 'SAVE_RECIPE':
                    await db.saveRecipeDB(item.userId, item.payload);
                    break;
                case 'UPDATE_SLOT':
                    await db.updateMealSlotDB(item.userId, item.payload);
                    break;
                case 'DELETE_SLOT':
                    await db.deleteMealSlotDB(item.userId, item.payload.date, item.payload.type);
                    break;
                case 'UPDATE_PROFILE':
                    await supabase.from('profiles').update(item.payload).eq('id', item.userId);
                    break;
                // NUEVOS CASOS SHOPPING
                case 'ADD_SHOPPING':
                    await db.addShoppingItemDB(item.userId, item.payload);
                    break;
                case 'UPDATE_SHOPPING':
                    await db.updateShoppingItemDB(item.userId, item.payload);
                    break;
                case 'DELETE_SHOPPING':
                    await db.deleteShoppingItemDB(item.payload.id);
                    break;
            }
            processedCount++;
        } catch (e) {
            console.error(`Error syncing item ${item.type}:`, e);
            remainingQueue.push(item);
        }
    }

    saveQueue(remainingQueue);
    
    if (processedCount > 0) {
        console.log("✅ Sincronización completada.");
        window.dispatchEvent(new CustomEvent('fresco-toast', { 
            detail: { type: 'success', message: `${processedCount} cambios sincronizados con la nube` } 
        }));
    }
};

// Listener global
export const initSyncListener = () => {
    window.addEventListener('online', processQueue);
    setTimeout(processQueue, 5000);
};
