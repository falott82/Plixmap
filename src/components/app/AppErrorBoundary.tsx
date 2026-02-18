import { Component, ErrorInfo, ReactNode } from 'react';
import { appLogger } from '../../utils/logger';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected rendering error'
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    appLogger.error('React boundary captured an unhandled error', {
      message: error instanceof Error ? error.message : String(error || ''),
      stack: error instanceof Error ? error.stack : '',
      componentStack: info.componentStack || ''
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist px-6 text-ink">
        <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-card">
          <h1 className="text-lg font-semibold text-red-700">Errore applicativo</h1>
          <p className="mt-2 text-sm text-slate-700">
            Si e&apos; verificato un errore inatteso durante il rendering. Ricarica la pagina per ripristinare la sessione.
          </p>
          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">{this.state.message || 'Unknown error'}</p>
          <div className="mt-5 flex justify-end">
            <button
              onClick={this.handleReload}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Ricarica
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
