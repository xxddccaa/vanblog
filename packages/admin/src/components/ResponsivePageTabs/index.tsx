import React from 'react';

export type ResponsivePageTabItem = {
  key: string;
  label: React.ReactNode;
  shortLabel?: React.ReactNode;
  icon?: React.ReactNode;
};

export const toPageContainerTabList = (items: ResponsivePageTabItem[]) =>
  items.map((item) => ({
    key: item.key,
    tab: (
      <span className="admin-page-container-tab">
        {item.icon}
        <span>{item.label}</span>
      </span>
    ),
  }));

type ResponsivePageTabsProps = {
  activeKey: string;
  items: ResponsivePageTabItem[];
  onChange: (key: string) => void;
  className?: string;
};

export default function ResponsivePageTabs(props: ResponsivePageTabsProps) {
  const { activeKey, items, onChange, className } = props;

  return (
    <div className={['admin-responsive-tabs', className].filter(Boolean).join(' ')}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            className={['admin-responsive-tab', active ? 'admin-responsive-tab-active' : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => onChange(item.key)}
          >
            {item.icon ? <span className="admin-responsive-tab-icon">{item.icon}</span> : null}
            <span>{item.shortLabel || item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
