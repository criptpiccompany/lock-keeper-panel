import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("[ErrorBoundary] Caught render error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card border rounded-xl p-6 space-y-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">
              {this.props.fallbackTitle || "Algo deu errado"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente recarregar a página.
            </p>
            {this.state.error && (
              <details className="text-left text-xs bg-muted/50 rounded-lg p-3 max-h-32 overflow-auto">
                <summary className="cursor-pointer font-medium text-muted-foreground mb-1">
                  Detalhes do erro
                </summary>
                <pre className="whitespace-pre-wrap break-all text-destructive">
                  {this.state.error.message}
                  {this.state.error.stack?.slice(0, 500)}
                </pre>
              </details>
            )}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors"
              >
                Tentar novamente
              </button>
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <RefreshCcw className="h-4 w-4" />
                Recarregar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
