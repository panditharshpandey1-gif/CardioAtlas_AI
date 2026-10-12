import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ModelErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("3D Model Error Caught by Boundary:", error, errorInfo);
  }

  public handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[460px] flex flex-col items-center justify-center p-6 text-center bg-surface border border-border rounded space-y-4">
          <div className="w-12 h-12 rounded-full bg-surface-alt border border-border flex items-center justify-center text-risk-high">
            <AlertTriangle className="w-6 h-6 text-risk-high" />
          </div>

          <div className="max-w-md space-y-2">
            <h4 className="text-body font-bold text-text">
              3D Anatomy Viewport Error / WebGL Fallback
            </h4>
            <p className="text-caption text-text-secondary">
              The 3D WebGL renderer or anatomical asset could not be loaded. Please ensure WebGL is enabled in your browser hardware settings.
            </p>
            <p className="text-caption text-text-tertiary font-mono bg-surface-alt p-2 rounded border border-border break-all text-left">
              {this.state.error?.message || 'WebGL context or GLTF model loading failure'}
            </p>
            <p className="text-[11px] text-text-tertiary">
              Reference Asset: <code className="font-mono text-accent">/models/realistic_human_heart.glb</code>
            </p>
            <p className="text-caption text-text-secondary italic">
              Illustrative anatomical structures (LAD, RCA, LCX, Aorta, Apex) remain available for review in the clinical structures panel.
            </p>
          </div>

          <button
            id="retry-3d-model-button"
            type="button"
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xs bg-surface border border-border text-text hover:bg-surface-alt font-medium text-caption transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry 3D Stage Load</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

