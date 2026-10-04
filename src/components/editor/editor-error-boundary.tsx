import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** changing this (e.g. view mode or document id) resets the boundary */
  resetKey: unknown;
  onOpenSource: () => void;
};

type State = { error: Error | null };

/**
 * F02 safety net: a crash inside an editor surface shows a recovery panel
 * instead of blanking the window. The document text lives in App state, so it
 * is untouched; the user can retry or continue in the markdown view.
 */
export class EditorErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("marknote: editor crashed", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mdv-editor-crash" role="alert">
        <h2>Düzenleyici beklenmedik bir hatayla karşılaştı</h2>
        <p>Notunuz kaybolmadı; içerik bellekte duruyor. Yeniden deneyebilir ya da Markdown görünümünde devam edebilirsiniz.</p>
        <p className="mdv-editor-crash__detail">{this.state.error.message}</p>
        <div className="mdv-dialog__actions">
          <button type="button" className="mdv-btn mdv-btn--quiet" onClick={() => this.setState({ error: null })}>
            Yeniden dene
          </button>
          <button
            type="button"
            className="mdv-btn mdv-btn--primary"
            onClick={() => {
              this.setState({ error: null });
              this.props.onOpenSource();
            }}
          >
            Markdown görünümünde aç
          </button>
        </div>
      </div>
    );
  }
}
