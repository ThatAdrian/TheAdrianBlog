import React from 'react';
import './GlassIcons.css';

export interface GlassIconsItem {
  icon: React.ReactElement;
  color: string;
  label: string;
  href?: string;
  customClass?: string;
}

export interface GlassIconsProps {
  items: GlassIconsItem[];
  className?: string;
}

const gradientMapping: Record<string, string> = {
  blue:   'linear-gradient(hsl(223, 90%, 50%), hsl(208, 90%, 50%))',
  purple: 'linear-gradient(hsl(283, 90%, 50%), hsl(268, 90%, 50%))',
  red:    'linear-gradient(hsl(3, 90%, 50%), hsl(348, 90%, 50%))',
  indigo: 'linear-gradient(hsl(253, 90%, 50%), hsl(238, 90%, 50%))',
  orange: 'linear-gradient(hsl(43, 90%, 50%), hsl(28, 90%, 50%))',
  green:  'linear-gradient(hsl(123, 90%, 40%), hsl(108, 90%, 40%))',
  pink:   'linear-gradient(hsl(330, 90%, 50%), hsl(315, 90%, 50%))',
  cyan:   'linear-gradient(hsl(190, 90%, 45%), hsl(175, 90%, 45%))',
  yellow: 'linear-gradient(hsl(45, 90%, 50%), hsl(35, 90%, 50%))',
  teal:   'linear-gradient(hsl(170, 80%, 40%), hsl(155, 80%, 40%))',
};

const GlassIcons: React.FC<GlassIconsProps> = ({ items, className }) => {
  const getBackgroundStyle = (color: string): React.CSSProperties => ({
    background: gradientMapping[color] ?? color,
  });

  const renderIcon = (item: GlassIconsItem, index: number) => {
    const inner = (
      <>
        <span className="icon-btn__back" style={getBackgroundStyle(item.color)} />
        <span className="icon-btn__front">
          <span className="icon-btn__icon" aria-hidden="true">{item.icon}</span>
        </span>
        <span className="icon-btn__label">{item.label}</span>
      </>
    );

    return item.href ? (
      <a key={index} href={item.href} target="_blank" rel="noopener noreferrer"
        className={`icon-btn ${item.customClass || ''}`} aria-label={item.label}>
        {inner}
      </a>
    ) : (
      <button key={index} type="button"
        className={`icon-btn ${item.customClass || ''}`} aria-label={item.label}>
        {inner}
      </button>
    );
  };

  // Split into rows: first 6 items normal, remaining items centered
  const firstRows = items.slice(0, 6);
  const lastRow = items.slice(6);

  return (
    <div className={`icon-btns-wrapper ${className || ''}`}>
      {/* First two rows — 3 columns each on mobile, all on desktop */}
      <div className="icon-btns icon-btns--main">
        {firstRows.map((item, i) => renderIcon(item, i))}
        {/* On desktop, render remaining items in the same row */}
        {lastRow.map((item, i) => (
          <div key={`desktop-${i}`} className="icon-btn-desktop-only">
            {renderIcon(item, i + 6)}
          </div>
        ))}
      </div>

      {/* Last row — centered 2 items, mobile only */}
      {lastRow.length > 0 && (
        <div className="icon-btns icon-btns--last-row">
          {/* Spacer to push to center */}
          <div className="icon-btn-spacer" />
          {lastRow.map((item, i) => renderIcon(item, i + 6))}
          <div className="icon-btn-spacer" />
        </div>
      )}
    </div>
  );
};

export default GlassIcons;
