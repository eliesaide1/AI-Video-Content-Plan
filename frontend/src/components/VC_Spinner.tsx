interface Props {
  label?: string;
}

export function VC_Spinner({ label = 'Loading...' }: Props) {
  return (
    <div className="vc-spinner" role="status" aria-live="polite">
      <span className="vc-spinner__ring" aria-hidden="true" />
      <span className="vc-spinner__label">{label}</span>
    </div>
  );
}

export default VC_Spinner;
