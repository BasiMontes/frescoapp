
import { createClient } from '@supabase/supabase-js';

// Helper para leer variables de entorno en distintos bundlers (Vite, Next.js, CRA)
const getEnvVar = (key: string) => {
  // Soporte para Vite (import.meta.env)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  
  // Soporte para process.env (Standard/Next.js)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  
  return '';
};

// Claves de respaldo extraídas de tu configuración para garantizar que funcione ya
const FALLBACK_URL = 'https://wslyoakqysiiwpmecfsy.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzbHlvYWtxeXNpaXdwbWVjZnN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzODk0MjIsImV4cCI6MjA1NTk2NTQyMn0.HTHfBiobaJ8K70Be0G3G3kYUAW5tE_QLMsbxZ_m4xDg';

// Intentamos leer del .env, si falla usamos los valores directos
const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || FALLBACK_URL;
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || FALLBACK_KEY;

export const isConfigured = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'PON_AQUI_TU_URL_DE_SUPABASE';

if (!isConfigured) {
    console.warn('⚠️ FRESCO: Faltan las claves de Supabase. Revisa el archivo .env');
}

// Cliente Singleton
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
);
