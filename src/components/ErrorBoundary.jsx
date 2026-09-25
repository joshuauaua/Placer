/* PLACER — Error Boundary */

import { Component } from 'react';
import { THEME } from '../theme';
import { Icon } from './Icon';
import { Btn } from './UI';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const t = THEME;
      return (
        <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: t.page, color: t.ink }}>
          <div style={{ textAlign: 'center', maxWidth: 480, padding: 40 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: '#F5F5F5',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Icon name="alert" size={32} stroke={2} style={{ color: '#B3261E' }} />
            </div>
            <h1 className="placer-disp" style={{ fontSize: 28, fontWeight: 700, marginBottom: 8,
              letterSpacing: '-0.02em' }}>Something went wrong</h1>
            <p style={{ fontSize: 15, color: t.inkDim, lineHeight: 1.6, marginBottom: 24 }}>
              An unexpected error occurred. Try refreshing the page or click below to recover.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Btn t={t} variant="accent" icon="rotate" onClick={this.handleReset}>
                Try again
              </Btn>
              <Btn t={t} variant="outline" onClick={() => window.location.reload()}>
                Refresh page
              </Btn>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
