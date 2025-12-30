
// Servicio robusto para normalizar unidades y comparar cantidades

export const cleanName = (name: string): string => {
    if (!name) return '';
    return name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos (tildes)
        .replace(/\(.*\)/g, '') // Quitar texto entre paréntesis
        .replace(/[^a-z0-9ñ ]/g, '') // Quitar caracteres especiales excepto ñ
        .replace(/s$/, '') // Singularizar básico (plural simple)
        .replace(/es$/, '') // Singularizar básico (plural complejo)
        .trim();
};

export const normalizeUnit = (quantity: number, unit: string): { value: number, type: 'mass' | 'volume' | 'count' } => {
    const u = unit.toLowerCase().trim()
        .replace(/\.$/, '') // Quitar puntos finales (gr.)
        .replace(/s$/, ''); // Singularizar básico (litros -> litro)

    // --- MASA (Base: Gramos) ---
    // Métrico
    if (['kg', 'kilo', 'kilogramo'].includes(u)) return { value: quantity * 1000, type: 'mass' };
    if (['g', 'gr', 'gramo'].includes(u)) return { value: quantity, type: 'mass' };
    if (['mg', 'miligramo'].includes(u)) return { value: quantity / 1000, type: 'mass' };
    // Imperial
    if (['lb', 'libra', 'pound'].includes(u)) return { value: quantity * 453.59, type: 'mass' };
    if (['oz', 'onza', 'ounce'].includes(u)) return { value: quantity * 28.35, type: 'mass' };
    
    // --- VOLUMEN (Base: Mililitros) ---
    // Métrico
    if (['l', 'litro', 'lt'].includes(u)) return { value: quantity * 1000, type: 'volume' };
    if (['ml', 'mililitro', 'cc'].includes(u)) return { value: quantity, type: 'volume' };
    if (['cl', 'centilitro'].includes(u)) return { value: quantity * 10, type: 'volume' };
    if (['dl', 'decilitro'].includes(u)) return { value: quantity * 100, type: 'volume' };
    // Cocina / Imperial
    if (['taza', 'cup', 'vaso'].includes(u)) return { value: quantity * 240, type: 'volume' }; // Estándar aproximado
    if (['cucharada', 'tbsp', 'cda'].includes(u)) return { value: quantity * 15, type: 'volume' };
    if (['cucharadita', 'tsp', 'cdta'].includes(u)) return { value: quantity * 5, type: 'volume' };
    if (['pinta', 'pint', 'pt'].includes(u)) return { value: quantity * 473.17, type: 'volume' }; // US Pint
    if (['galon', 'gallon', 'gal'].includes(u)) return { value: quantity * 3785.41, type: 'volume' };
    if (['onza fluida', 'fl oz'].includes(u)) return { value: quantity * 29.57, type: 'volume' };

    // --- CONTEO (Base: Unidad) ---
    // Tratamos "manojo", "puñado", "pizca" como unidades abstractas difíciles de convertir a g/ml sin contexto
    // pero útiles para comparar entre sí.
    if (['docena'].includes(u)) return { value: quantity * 12, type: 'count' };
    
    return { value: quantity, type: 'count' };
};

export const convertBack = (value: number, type: 'mass' | 'volume' | 'count'): { quantity: number, unit: string } => {
    if (type === 'mass') {
        if (value >= 1000) return { quantity: parseFloat((value / 1000).toFixed(2)), unit: 'kg' };
        return { quantity: parseFloat(value.toFixed(0)), unit: 'g' };
    }
    if (type === 'volume') {
        if (value >= 1000) return { quantity: parseFloat((value / 1000).toFixed(2)), unit: 'l' };
        // Si es pequeño, a veces ml es mejor, pero el usuario puede preferir tazas si viene de ahí.
        // Por estandarización de la app, devolvemos ml o l para inventario.
        return { quantity: parseFloat(value.toFixed(0)), unit: 'ml' };
    }
    return { quantity: parseFloat(value.toFixed(1)), unit: 'uds' };
};

// Devuelve la cantidad restante tras restar 'used' de 'source'
// Retorna null si las unidades son incompatibles
export const subtractIngredient = (sourceQty: number, sourceUnit: string, usedQty: number, usedUnit: string): { quantity: number, unit: string } | null => {
    const source = normalizeUnit(sourceQty, sourceUnit);
    const used = normalizeUnit(usedQty, usedUnit);

    if (source.type !== used.type) {
        // Heurística de emergencia (densidad 1 para líquidos/sólidos comunes)
        // Útil para "1kg de leche" vs "200ml de leche"
        if ((source.type === 'mass' && used.type === 'volume') || (source.type === 'volume' && used.type === 'mass')) {
            // Asumimos 1g = 1ml
            const remainingVal = Math.max(0, source.value - used.value);
            return convertBack(remainingVal, source.type);
        }
        return null; 
    }

    const remainingVal = Math.max(0, source.value - used.value);
    return convertBack(remainingVal, source.type);
};

// PRIORIDAD 1: Sumar ingredientes (Fusión de Inventario)
export const addIngredient = (currentQty: number, currentUnit: string, addedQty: number, addedUnit: string): { quantity: number, unit: string } => {
    const current = normalizeUnit(currentQty, currentUnit);
    const added = normalizeUnit(addedQty, addedUnit);

    let totalValue = current.value;
    
    if (current.type === added.type) {
        totalValue += added.value;
    } else if ((current.type === 'mass' && added.type === 'volume') || (current.type === 'volume' && added.type === 'mass')) {
        // Densidad 1 fallback
        totalValue += added.value;
    } else {
        // Incompatible. Retornamos suma numérica bruta manteniendo unidad original (fallback básico)
        return { quantity: currentQty + addedQty, unit: currentUnit };
    }

    return convertBack(totalValue, current.type);
};
