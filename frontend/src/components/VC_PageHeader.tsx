import type { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function VC_PageHeader({ title, description, actions }: Props) {
  return (
    <header className="vc-page-header">
      <div>
        <h1 className="vc-page-header__title">{title}</h1>
        {description ? <p className="vc-page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="vc-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export default VC_PageHeader;
