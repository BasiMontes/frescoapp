
import React from 'react';
import { X, Shield, FileText, Lock, Eye } from 'lucide-react';

interface LegalModalProps {
  type: 'privacy' | 'terms';
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  return (
    <div className="fixed inset-0 z-[9000] bg-teal-900/95 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-teal-50 p-8 border-b border-teal-100 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-teal-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
              {type === 'privacy' ? <Lock className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-teal-900 leading-none">
                {type === 'privacy' ? 'Política de Privacidad' : 'Términos y Condiciones'}
              </h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                Última actualización: Octubre 2023
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 bg-white rounded-2xl hover:bg-gray-100 transition-all text-gray-500 hover:text-red-500"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 md:p-12 overflow-y-auto space-y-8 text-gray-600 leading-relaxed font-medium">
          
          {type === 'privacy' ? (
            <>
              <section>
                <h3 className="text-teal-900 font-black text-lg mb-3 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-orange-500" /> 1. Recopilación de Datos
                </h3>
                <p>
                  En Fresco, nos tomamos tu privacidad muy en serio. Solo recopilamos los datos necesarios para gestionar tu despensa virtual: nombre, correo electrónico y las preferencias dietéticas que tú configures. Las imágenes de tus tickets se procesan temporalmente para la extracción de datos y no se utilizan para entrenar modelos externos sin tu consentimiento explícito.
                </p>
              </section>
              
              <section>
                <h3 className="text-teal-900 font-black text-lg mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-500" /> 2. Seguridad
                </h3>
                <p>
                  Tus datos están almacenados en servidores seguros (Supabase) con encriptación estándar de la industria. No vendemos, alquilamos ni compartimos tu información personal con terceros para fines comerciales.
                </p>
              </section>

              <section>
                <h3 className="text-teal-900 font-black text-lg mb-3">3. Tus Derechos</h3>
                <p>
                  Tienes derecho a acceder, rectificar o eliminar tus datos en cualquier momento desde la sección "Perfil" de la aplicación o contactando a privacy@fresco.app.
                </p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h3 className="text-teal-900 font-black text-lg mb-3">1. Uso del Servicio</h3>
                <p>
                  Fresco es una herramienta de asistencia para la gestión del hogar. Aunque nos esforzamos por ofrecer información precisa sobre nutrición y caducidad, los usuarios son responsables finales de verificar el estado de los alimentos antes de su consumo.
                </p>
              </section>

              <section>
                <h3 className="text-teal-900 font-black text-lg mb-3">2. Propiedad Intelectual</h3>
                <p>
                  Todo el diseño, código fuente y contenido generado por la aplicación es propiedad exclusiva de Fresco App Inc. No está permitida la ingeniería inversa ni la redistribución no autorizada.
                </p>
              </section>

              <section>
                <h3 className="text-teal-900 font-black text-lg mb-3">3. Limitación de Responsabilidad</h3>
                <p>
                  Fresco no se hace responsable de daños directos o indirectos derivados del uso de la aplicación, incluyendo pero no limitado a reacciones alérgicas por recetas sugeridas (ver descargo de responsabilidad en cada receta).
                </p>
              </section>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-4 bg-teal-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-teal-800 transition-all active:scale-95"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
