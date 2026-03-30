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
  blue:    'linear-gradient(hsl(223, 90%, 50%), hsl(208, 90%, 50%))',
  purple:  'linear-gradient(hsl(283, 90%, 50%), hsl(268, 90%, 50%))',
  red:     'linear-gradient(hsl(3, 90%, 50%), hsl(348, 90%, 50%))',
  indigo:  'linear-gradient(hsl(253, 90%, 50%), hsl(238, 90%, 50%))',
  orange:  'linear-gradient(hsl(43, 90%, 50%), hsl(28, 90%, 50%))',
  green:   'linear-gradient(hsl(123, 90%, 40%), hsl(108, 90%, 40%))',
  pink:    'linear-gradient(hsl(330, 90%, 50%), hsl(315, 90%, 50%))',
  cyan:    'linear-gradient(hsl(190, 90%, 45%), hsl(175, 90%, 45%))',
  yellow:  'linear-gradient(hsl(45, 90%, 50%), hsl(35, 90%, 50%))',
  teal:    'linear-gradient(hsl(170, 80%, 40%), hsl(155, 80%, 40%))',
};

const GlassIcons: React.FC<GlassIconsProps> = ({ items, className }) => {
  const getBackgroundStyle = (color: string): React.CSSProperties => ({
    background: gradientMapping[color] ?? color
  });

  return (
    <div className={`icon-btns ${className || ''}`}>
      {items.map((item, index) => {
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
      })}
    </div>
  );
};

export default GlassIcons;
