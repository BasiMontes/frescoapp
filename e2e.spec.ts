
import { test, expect } from '@playwright/test';

test.describe('Auditoría 25: Verification Suite (Notificaciones, Precios y UX)', () => {

  // Limpieza antes de cada test
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await page.addInitScript(() => window.sessionStorage.clear());
    // Inyectamos un usuario base para saltar onboarding
    await page.addInitScript(() => {
        localStorage.setItem('fresco_user', JSON.stringify({ 
            name: 'QA Tester', 
            email: 'qa@fresco.app', 
            onboarding_completed: true, 
            household_size: 2, 
            total_savings: 0, 
            meals_cooked: 0,
            dietary_preferences: [],
            favorite_cuisines: []
        }));
    });
    await page.goto('/');
  });

  test('VERIFICACIÓN 1: El Dashboard respeta los Precios Personalizados (Fix Valor Despensa)', async ({ page }) => {
    // ESCENARIO:
    // El usuario define que el "Aceite de Oliva" cuesta 50€ (precio personalizado).
    // Añadimos 2 botellas. El valor en dashboard debe ser 100€, ignorando la base de datos estática.
    
    await page.addInitScript(() => {
        // 1. Definimos precio custom
        localStorage.setItem('fresco_custom_prices', JSON.stringify({ 
            'Aceite de Oliva Premium': 50.0 
        }));
        // 2. Añadimos item a la despensa
        localStorage.setItem('fresco_pantry', JSON.stringify([
            { 
                id: 'item-1', 
                name: 'Aceite de Oliva Premium', 
                quantity: 2, 
                unit: 'unidades', 
                category: 'pantry', 
                added_at: new Date().toISOString() 
            }
        ]));
    });

    await page.reload();

    // Verificación
    // Buscamos el widget de "Valor en Nevera" (borde naranja)
    const dashboardValue = page.locator('text=100.0€'); 
    await expect(dashboardValue).toBeVisible();
    console.log('✅ Dashboard calcula correctamente usando precios de usuario.');
  });

  test('VERIFICACIÓN 2: Sistema de Notificaciones "Muerto" Revivido (Fix Notificaciones)', async ({ page }) => {
    // ESCENARIO:
    // Inyectamos un producto que caduca HOY. 
    // Al cargar la app, el sistema debe detectar la fecha crítica y generar una notificación persistente automáticamente.
    
    await page.addInitScript(() => {
        const today = new Date().toISOString();
        localStorage.setItem('fresco_pantry', JSON.stringify([
            { 
                id: 'milk-1', 
                name: 'Leche Fresca', 
                quantity: 1, 
                unit: 'l', 
                category: 'dairy', 
                added_at: today, 
                expires_at: today // CADUCA HOY
            }
        ]));
    });

    await page.reload();

    // 1. Verificamos que la campana tiene el badge rojo con "1"
    const badge = page.locator('button:has(.lucide-bell) >> span');
    await expect(badge).toHaveText('1');

    // 2. Abrimos el centro de notificaciones
    await page.click('button:has(.lucide-bell)');

    // 3. Verificamos el contenido del mensaje
    const alertTitle = page.locator('text=¡Leche Fresca caduca pronto!');
    const alertMsg = page.locator('text=Úsalo hoy sin falta.'); // Mensaje específico para día 0
    
    await expect(alertTitle).toBeVisible();
    await expect(alertMsg).toBeVisible();
    console.log('✅ Centro de notificaciones genera y persiste alertas de caducidad.');
  });

  test('VERIFICACIÓN 3: Seguridad contra Gestos "Atrás" en Cocina (Fix Touch Action)', async ({ page }) => {
    // ESCENARIO:
    // Entramos en el "Modo Cocina". En móviles, hacer swipe horizontal para pasar de paso 
    // a menudo dispara el gesto "Atrás" del navegador, sacando al usuario de la app.
    // Verificamos que la propiedad CSS 'touch-action: none' esté aplicada para evitar esto.

    // Navegar a una receta (usamos una mockeada o la generada por defecto)
    await page.click('button:has-text("Recetas")');
    // Esperamos a que carguen las recetas (la default)
    await page.waitForTimeout(500); 
    await page.click('div.group.cursor-pointer >> nth=0'); // Click en la primera tarjeta
    
    // Entrar en modo cocina
    await page.click('button:has-text("Cocinar")');

    // Localizar el contenedor principal del CookMode
    // Usamos un selector específico basado en las clases del componente CookMode
    const cookContainer = page.locator('div.fixed.inset-0.z-\\[5000\\] >> nth=0');

    // Verificación de Atributo CSS Crítico
    await expect(cookContainer).toHaveCSS('touch-action', 'none');
    
    console.log('✅ CookMode tiene "touch-action: none" activado para prevenir gestos de navegador.');
  });

});
