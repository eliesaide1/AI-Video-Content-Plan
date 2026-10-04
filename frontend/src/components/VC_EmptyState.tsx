import type { ReactNode } from 'react';

interface Props {
  title: string;
  message?: string;
  action?: ReactNode;
}

export function VC_EmptyState({ title, message, action }: Props) {
  return (
    <div className="vc-empty">
      <h3 className="vc-empty__title">{title}</h3>
      {message ? <p className="vc-empty__message">{message}</p> : null}
      {action ? <div className="vc-empty__action">{action}</div> : null}
    </div>
  );
}

export default VC_EmptyState;
