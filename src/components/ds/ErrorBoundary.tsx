import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          padding: 24,
          margin: 16,
          borderRadius: 8,
          background: '#fee2e220',
          border: '1px solid #ef444440',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>
            Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: '1px solid #ef4444',
              background: 'transparent',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
