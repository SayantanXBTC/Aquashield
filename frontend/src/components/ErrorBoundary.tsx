import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * A generic React error boundary — used to wrap the 3D scene so a Three.js
 * runtime failure (e.g. WebGL unavailable) renders an actionable
 * ErrorState instead of crashing the whole command center (Prompt 8
 * "3D scene failed to initialize" is a required error state, not an
 * afterthought). React error boundaries must be class components.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error("AQUASHIELD scene error:", error);
  }

  retry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback(this.retry);
    }
    return this.props.children;
  }
}
