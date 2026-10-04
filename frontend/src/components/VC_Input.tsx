import type { InputHTMLAttributes } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function VC_Input({ label, hint, id, ...rest }: Props) {
  const inputId = id ?? `vc-input-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <label className="vc-field" htmlFor={inputId}>
      <span className="vc-field__label">{label}</span>
      <input {...rest} id={inputId} className="vc-field__control" />
      {hint ? <span className="vc-field__hint">{hint}</span> : null}
    </label>
  );
}

export default VC_Input;
