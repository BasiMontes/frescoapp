
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';
import { ArrowRight, Mail, Lock, User, AlertCircle, Loader2, Check, Send, ChevronLeft } from 'lucide-react';
import { LegalModal } from './LegalModal';

interface AuthPageProps {
  onLogin: (user: UserProfile) => void;
  onSignup: (name: string, email: string) => void; 
}

// Helper para traducir errores de Supabase a humano
const translateAuthError = (errorMsg: string): string => {
    const msg = errorMsg.toLowerCase();
    if (msg.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
    if (msg.includes('user already registered')) return 'Este email ya está registrado. Intenta iniciar sesión.';
    if (msg.includes('email not confirmed')) return 'Debes confirmar tu email antes de entrar.';
    if (msg.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (msg.includes('rate limit exceeded')) return 'Demasiados intentos. Espera un momento.';
    return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
};

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Estado para flujo de verificación
  const [verificationSent, setVerificationSent] = useState(false);
  
  // Estado para Términos Legales
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState<'privacy' | 'terms' | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validación Legal
    if (!isLogin && !acceptedTerms) {
        setError('Debes aceptar los Términos y la Política de Privacidad para registrarte.');
        return;
    }

    setLoading(true);

    try {
        if (isLogin) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
        } else {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name,
                        onboarding_completed: false
                    }
                }
            });
            if (error) throw error;
            
            // Si el registro requiere confirmación (común en Supabase), mostramos la pantalla
            if (data.user && data.user.identities && data.user.identities.length === 0) {
                 setError('Este usuario ya existe. Intenta iniciar sesión.');
            } else {
                 setVerificationSent(true);
            }
        }
    } catch (err: any) {
        setError(translateAuthError(err.message || ''));
    } finally {
        setLoading(false);
    }
  };

  // VISTA DE VERIFICACIÓN PENDIENTE
  if (verificationSent) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 animate-fade-in">
              <div className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 text-center">
                  <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce-subtle">
                      <Send className="w-10 h-10 text-teal-600" />
                  </div>
                  <h2 className="text-3xl font-black text-teal-900 mb-4">¡Casi listo!</h2>
                  <p className="text-gray-500 text-lg mb-8 leading-relaxed">
                      Hemos enviado un enlace de confirmación a <span className="font-bold text-teal-700">{email}</span>.
                  </p>
                  
                  <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl mb-8 text-left">
                      <p className="text-sm text-orange-800 font-medium">
                          <strong>Importante:</strong> Revisa tu carpeta de Spam si no lo encuentras. Una vez confirmado, podrás entrar.
                      </p>
                  </div>

                  <button 
                      onClick={() => { setVerificationSent(false); setIsLogin(true); }}
                      className="w-full py-4 bg-teal-900 text-white font-bold rounded-xl shadow-lg hover:bg-teal-800 transition-all active:scale-[0.98]"
                  >
                      Ya lo he confirmado, ir a Login
                  </button>
                  
                  <button 
                      onClick={() => setVerificationSent(false)}
                      className="mt-6 text-gray-400 font-bold text-sm hover:text-gray-600 flex items-center justify-center gap-2"
                  >
                      <ChevronLeft className="w-4 h-4" /> Volver atrás
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">
      {showLegalModal && (
          <LegalModal type={showLegalModal} onClose={() => setShowLegalModal(null)} />
      )}

      <div className="hidden lg:flex w-1/2 bg-teal-800 relative overflow-hidden flex-col justify-between p-16 text-white">
        <div className="relative z-10 animate-fade-in">
            <div className="flex items-center gap-3 mb-16">
                <Logo variant="inverted" className="w-64" align="left" />
            </div>
            <h1 className="text-6xl font-extrabold leading-tight mb-8">
                Tu cocina,<br/>
                <span className="text-orange-400">sincronizada.</span>
            </h1>
            <p className="text-teal-100 text-xl max-w-lg leading-relaxed font-light">
                Gestión de despensa en tiempo real para hogares modernos. Tus datos seguros en la nube, accesibles desde cualquier lugar.
            </p>
        </div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-600 rounded-full blur-[100px] opacity-30 transform translate-x-1/2 -translate-y-1/2"></div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white p-10 rounded-[2rem] shadow-2xl border border-gray-100/50">
            <div className="flex justify-center mb-10">
                <Logo className="w-56" align="center" />
            </div>
            <div className="mb-10">
                <h2 className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">
                    {isLogin ? 'Bienvenido' : 'Crear Cuenta'}
                </h2>
                <p className="text-lg text-gray-500">
                    {isLogin ? 'Accede a tu despensa en la nube.' : 'Empieza a ahorrar hoy mismo.'}
                </p>
            </div>

            <div className="flex p-1.5 bg-gray-100 rounded-2xl mb-8 border border-gray-200">
                <button
                    onClick={() => { setIsLogin(true); setError(''); }}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-200 ${
                        isLogin ? 'bg-white text-teal-900 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Iniciar Sesión
                </button>
                <button
                    onClick={() => { setIsLogin(false); setError(''); }}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-200 ${
                        !isLogin ? 'bg-white text-teal-900 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Registrarse
                </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-6">
                {!isLogin && (
                    <div className="space-y-2 animate-slide-up">
                        <label className="text-sm font-semibold text-gray-700 ml-1">Nombre Completo</label>
                        <div className="relative group">
                            <User className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-teal-600 transition-colors" />
                            <input
                                type="text"
                                placeholder="Ej. Alex García"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                            />
                        </div>
                    </div>
                )}
                
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 ml-1">Correo Electrónico</label>
                    <div className="relative group">
                        <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-teal-600 transition-colors" />
                        <input
                            type="email"
                            placeholder="hola@ejemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 ml-1">Contraseña</label>
                    <div className="relative group">
                        <Lock className="absolute left-4 top-4 w-5 h-5 text-gray-400 group-focus-within:text-teal-600 transition-colors" />
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
                        />
                    </div>
                </div>

                {/* Checkbox de Términos (Solo Registro) */}
                {!isLogin && (
                    <div className="flex items-start gap-3 pt-2 animate-slide-up">
                        <div className="relative flex items-center">
                            <input
                                type="checkbox"
                                id="terms"
                                checked={acceptedTerms}
                                onChange={(e) => setAcceptedTerms(e.target.checked)}
                                className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border-2 border-gray-300 transition-all checked:border-teal-600 checked:bg-teal-600 hover:border-teal-400"
                            />
                            <Check className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                        </div>
                        <label htmlFor="terms" className="text-xs text-gray-500 leading-relaxed cursor-pointer select-none">
                            He leído y acepto los <span onClick={(e) => { e.preventDefault(); setShowLegalModal('terms'); }} className="font-bold text-teal-700 hover:underline">Términos y Condiciones</span> y la <span onClick={(e) => { e.preventDefault(); setShowLegalModal('privacy'); }} className="font-bold text-teal-700 hover:underline">Política de Privacidad</span>.
                        </label>
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-3 text-red-600 font-medium text-sm bg-red-50 border border-red-100 p-4 rounded-xl animate-fade-in">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-teal-800 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-teal-900 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <>{isLogin ? 'Entrar a mi cuenta' : 'Crear cuenta gratis'}<ArrowRight className="w-5 h-5" /></>
                    )}
                </button>
            </form>

            {isLogin && (
                <div className="mt-8 text-center">
                    <p className="text-sm text-gray-500">
                        ¿Olvidaste tu contraseña? <span className="font-bold text-teal-700 cursor-pointer hover:underline">Recuperar</span>
                    </p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
