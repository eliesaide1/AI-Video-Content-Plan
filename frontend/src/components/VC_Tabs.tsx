interface Props {
  tabs: { id: string; label: string }[];
  activeId: string;
  onChange: (id: string) => void;
}

export function VC_Tabs({ tabs, activeId, onChange }: Props) {
  return (
    <div className="vc-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === activeId}
          className={`vc-tabs__tab ${tab.id === activeId ? 'vc-tabs__tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default VC_Tabs;
