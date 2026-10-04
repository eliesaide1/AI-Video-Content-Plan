import type { TextareaHTMLAttributes } from 'react';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

export function VC_TextArea({ label, hint, id, ...rest }: Props) {
  const areaId = id ?? `vc-textarea-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <label className="vc-field" htmlFor={areaId}>
      <span className="vc-field__label">{label}</span>
      <textarea {...rest} id={areaId} className="vc-field__control vc-field__control--area" />
      {hint ? <span className="vc-field__hint">{hint}</span> : null}
    </label>
  );
}

export default VC_TextArea;
