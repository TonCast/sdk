import { Component, type ErrorInfo, type ReactNode } from "react";
import { useWidgetConfig } from "./context";
import { useT } from "./i18n/useT";

/**
 * Catches render errors and shows an inline retry card.
 * Text props allow the parent functional wrapper to inject translated strings
 * since class components cannot call hooks directly.
 */
class ErrorBoundary extends Component<
  {
    children: ReactNode;
    errorText: string;
    retryText: string;
    onRenderError?: (error: Error, info: ErrorInfo) => void;
  },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ToncastWidget] Uncaught render error:", error, info.componentStack);
    this.props.onRenderError?.(error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="tc-error tc-error-card">
          <p className="tc-error-card-msg">{this.props.errorText}</p>
          <button
            type="button"
            className="tc-btn tc-btn-secondary"
            onClick={() => this.setState({ error: null })}
          >
            {this.props.retryText}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Functional wrapper that supplies translated strings to the class ErrorBoundary. */
export function WidgetErrorBoundary({ children }: { children: ReactNode }) {
  const t = useT();
  const config = useWidgetConfig();
  return (
    <ErrorBoundary
      errorText={t("error.somethingWentWrong")}
      retryText={t("error.retry")}
      onRenderError={config.widget?.onRenderError}
    >
      {children}
    </ErrorBoundary>
  );
}
