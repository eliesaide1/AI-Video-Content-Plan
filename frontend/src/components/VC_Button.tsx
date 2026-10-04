import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

export function VC_Button({ variant = 'primary', loading = false, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      type={rest.type ?? 'button'}
      className={`vc-button vc-button--${variant} ${rest.className ?? ''}`}
      disabled={rest.disabled || loading}
    >
      {loading ? <span className="vc-button__spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export default VC_Button;
