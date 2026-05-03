import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

function ErrorFallback({ error }: { error?: Error }) {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 shadow-lg p-8 text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">{t.errBoundaryTitle}</h2>
          <p className="text-sm text-slate-500 mt-2">
            {t.errBoundaryDesc}
          </p>
          {error && (
            <p className="text-xs text-red-500 mt-2 font-mono bg-red-50 px-3 py-2 rounded-lg">
              {error.message}
            </p>
          )}
        </div>
        <Button
          onClick={() => window.location.reload()}
          className="gap-2 bg-brand-700 hover:bg-brand-800 text-white"
          data-testid="btn-reload"
        >
          <RefreshCw className="w-4 h-4" />
          {t.errBoundaryReload}
        </Button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("[ErrorBoundary] Uncaught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
