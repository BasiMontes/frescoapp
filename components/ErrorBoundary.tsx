
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-teal-900 flex flex-col items-center justify-center p-8 text-center text-white animate-fade-in">
          <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl backdrop-blur-md">
            <AlertTriangle className="w-12 h-12 text-orange-400" />
          </div>
          
          <h1 className="text-4xl font-black mb-4">¡Ups! Algo se quemó</h1>
          <p className="text-teal-200 text-lg mb-10 max-w-md mx-auto leading-relaxed opacity-80">
            Hemos tenido un problema técnico en la cocina. No te preocupes, tus datos están a salvo.
          </p>

          <div className="flex flex-col gap-4 w-full max-w-xs">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-5 bg-orange-500 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-orange-600 transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4" /> Recargar App
              </button>
              
              <button
                onClick={() => {
                    localStorage.clear();
                    window.location.href = '/';
                }}
                className="w-full py-5 bg-white/5 rounded-2xl font-black text-xs uppercase tracking-widest border border-white/10 flex items-center justify-center gap-3 hover:bg-white/10 transition-all"
              >
                <Home className="w-4 h-4" /> Volver al Inicio (Reset)
              </button>
          </div>
          
          <div className="mt-12 text-[10px] font-mono text-teal-500 opacity-40 bg-black/20 p-4 rounded-xl max-w-lg break-all">
            Error: {this.state.error?.message || 'Unknown Error'}
          </div>
        </div>
      );
    }

    // Standard class property this.props accessed correctly via destructuring to ensure type safety
    const { children } = this.props;
    return children;
  }
}
