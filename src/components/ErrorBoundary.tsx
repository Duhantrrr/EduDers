import React from 'react';
import { Bell } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-8 text-center text-white space-y-4">
          <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mb-4">
            <Bell className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold">Bir şeyler yanlış gitti</h2>
          <p className="text-neutral-400 text-sm max-w-xs">
            Uygulama çalışırken bir hata oluştu. Lütfen sayfayı yenilemeyi deneyin.
          </p>
          <pre className="text-[10px] bg-neutral-900 p-4 rounded-xl text-red-400 max-w-full overflow-auto text-left">
            {this.state.error?.message}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold transition-all hover:scale-105"
          >
            Yeniden Yükle
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
