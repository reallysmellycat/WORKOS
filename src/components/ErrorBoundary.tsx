import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Catches rendering errors so one broken screen never hides your data. */
export class ErrorBoundary extends Component<{ children: ReactNode; inline?: boolean }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={this.props.inline ? 'p-6' : 'flex min-h-full items-center justify-center p-8'}>
        <div className="card max-w-md p-6">
          <h2 className="text-body-l font-semibold">Something went wrong on this screen</h2>
          <p className="mt-2 text-body-s text-muted leading-relaxed">
            Your data is safe — it's stored separately in this browser. Try reloading. If this keeps happening, export a backup from
            Settings → Data and note what you were doing.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded-sm bg-sunken p-2 text-body-s text-muted">{this.state.error.message}</pre>
          <div className="mt-4 flex gap-2">
            <button className="h-8 rounded-sm bg-accent px-3 text-body-s font-medium text-accent-fg" onClick={() => location.reload()}>
              Reload
            </button>
            <button className="h-8 rounded-sm border border-line px-3 text-body-s" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
