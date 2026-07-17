import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminGate } from '../../App';
import { THEME } from '../../theme';

describe('AdminGate', () => {
  let originalValue;

  beforeEach(() => {
    originalValue = import.meta.env.VITE_ADMIN_ENABLED;
  });

  afterEach(() => {
    import.meta.env.VITE_ADMIN_ENABLED = originalValue;
  });

  it('renders children when VITE_ADMIN_ENABLED is "true"', () => {
    import.meta.env.VITE_ADMIN_ENABLED = 'true';
    render(
      <AdminGate t={THEME}>
        <div>Admin content</div>
      </AdminGate>
    );
    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('renders "Access Restricted" when VITE_ADMIN_ENABLED is not set', () => {
    delete import.meta.env.VITE_ADMIN_ENABLED;
    render(
      <AdminGate t={THEME}>
        <div>Admin content</div>
      </AdminGate>
    );
    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('renders "Access Restricted" when VITE_ADMIN_ENABLED is "false"', () => {
    import.meta.env.VITE_ADMIN_ENABLED = 'false';
    render(
      <AdminGate t={THEME}>
        <div>Admin content</div>
      </AdminGate>
    );
    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });
});
