import type { ReactNode } from 'react';

interface Props {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function VC_Card({ title, subtitle, actions, children, className }: Props) {
  return (
    <section className={`vc-card ${className ?? ''}`}>
      {title || actions ? (
        <header className="vc-card__header">
          <div>
            {title ? <h3 className="vc-card__title">{title}</h3> : null}
            {subtitle ? <p className="vc-card__subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="vc-card__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children ? <div className="vc-card__body">{children}</div> : null}
    </section>
  );
}

export default VC_Card;
