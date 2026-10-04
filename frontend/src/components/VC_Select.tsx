import type { SelectHTMLAttributes } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  hint?: string;
}

export function VC_Select({ label, options, hint, id, ...rest }: Props) {
  const selectId = id ?? `vc-select-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <label className="vc-field" htmlFor={selectId}>
      <span className="vc-field__label">{label}</span>
      <select {...rest} id={selectId} className="vc-field__control">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? <span className="vc-field__hint">{hint}</span> : null}
    </label>
  );
}

export default VC_Select;
