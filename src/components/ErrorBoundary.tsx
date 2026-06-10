import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("App error:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-full grid place-items-center p-6">
          <div className="card p-6 max-w-lg w-full">
            <h1 className="text-lg font-semibold text-red-700">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-600 mt-2">
              The app hit an unexpected error. Your data is safe in local
              storage. You can try again, reload the page, or restore from a
              backup.
            </p>
            <pre className="mt-3 text-xs bg-slate-50 border rounded p-3 overflow-auto max-h-48">
              {this.state.error.message}
            </pre>
            <div className="mt-4 flex gap-2">
              <button className="btn-secondary" onClick={this.reset}>
                Try again
              </button>
              <button
                className="btn-primary"
                onClick={() => location.reload()}
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
