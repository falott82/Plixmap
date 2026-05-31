import { Component, ErrorInfo, ReactNode } from 'react';
import { appLogger } from '../../utils/logger';

type Props = {
  children: ReactNode;
  /** Optional hook so the host can react to a canvas crash (e.g. exit a tool mode). */
  onError?: (error: unknown) => void;
};

type State = {
  hasError: boolean;
  message: string;
};

/**
 * Error boundary scoped to the Konva canvas (CanvasStage). A rendering error in
 * the canvas layer is isolated here so the rest of PlanView (sidebar, toolbars,
 * modals) keeps working instead of falling back to the full-app boundary and a
 * page reload. The user can retry the canvas in place.
 */
class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected canvas rendering error'
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    appLogger.error('Canvas boundary captured an unhandled error', {
      message: error instanceof Error ? error.message : String(error || ''),
      stack: error instanceof Error ? error.stack : '',
      componentStack: info.componentStack || ''
    });
    this.props.onError?.(error);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex h-full min-h-[240px] w-full items-center justify-center bg-mist px-6 text-ink">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-card">
          <h2 className="text-base font-semibold text-red-700">Errore nella mappa</h2>
          <p className="mt-2 text-sm text-slate-700">
            Si e&apos; verificato un errore durante il rendering della mappa. Il resto dell&apos;applicazione e&apos; ancora utilizzabile.
          </p>
          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">{this.state.message || 'Unknown error'}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              onClick={this.handleRetry}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Riprova
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Ricarica pagina
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default CanvasErrorBoundary;
