import { forwardRef, useMemo, useRef, useEffect, type RefObject, type HTMLAttributes } from 'react';
import { motion } from 'motion/react';
import './VariableProximity.css';

function useAnimationFrame(callback: () => void) {
  useEffect(() => {
    let id: number;
    const loop = () => { callback(); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [callback]);
}

function useMousePositionRef(containerRef: RefObject<HTMLElement>) {
  const positionRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const update = (x: number, y: number) => {
      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        positionRef.current = { x: x - rect.left, y: y - rect.top };
      } else {
        positionRef.current = { x, y };
      }
    };
    const onMouse = (e: MouseEvent) => update(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => { const t = e.touches[0]; update(t.clientX, t.clientY); };
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('touchmove', onTouch);
    return () => { window.removeEventListener('mousemove', onMouse); window.removeEventListener('touchmove', onTouch); };
  }, [containerRef]);
  return positionRef;
}

interface VariableProximityProps extends HTMLAttributes<HTMLSpanElement> {
  label: string;
  fromFontVariationSettings: string;
  toFontVariationSettings: string;
  containerRef: RefObject<HTMLElement>;
  radius?: number;
  falloff?: 'linear' | 'exponential' | 'gaussian';
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

const VariableProximity = forwardRef<HTMLSpanElement, VariableProximityProps>((props, ref) => {
  const { label, fromFontVariationSettings, toFontVariationSettings, containerRef, radius = 50, falloff = 'linear', className = '', onClick, style, ...rest } = props;
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const interpolatedRef = useRef<string[]>([]);
  const mouseRef = useMousePositionRef(containerRef);
  const lastRef = useRef<{ x: number | null; y: number | null }>({ x: null, y: null });

  const parsed = useMemo(() => {
    const parse = (s: string) => new Map(s.split(',').map(x => x.trim()).map(x => { const [n, v] = x.split(' '); return [n.replace(/['"]/g, ''), parseFloat(v)]; }));
    const from = parse(fromFontVariationSettings), to = parse(toFontVariationSettings);
    return Array.from(from.entries()).map(([axis, fromValue]) => ({ axis, fromValue, toValue: to.get(axis) ?? fromValue }));
  }, [fromFontVariationSettings, toFontVariationSettings]);

  const calcFalloff = (dist: number) => {
    const n = Math.min(Math.max(1 - dist / radius, 0), 1);
    if (falloff === 'exponential') return n ** 2;
    if (falloff === 'gaussian') return Math.exp(-((dist / (radius / 2)) ** 2) / 2);
    return n;
  };

  useAnimationFrame(() => {
    if (!containerRef?.current) return;
    const { x, y } = mouseRef.current;
    if (lastRef.current.x === x && lastRef.current.y === y) return;
    lastRef.current = { x, y };
    const cr = containerRef.current.getBoundingClientRect();
    letterRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2 - cr.left, cy = r.top + r.height / 2 - cr.top;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist >= radius) { el.style.fontVariationSettings = fromFontVariationSettings; return; }
      const fv = calcFalloff(dist);
      el.style.fontVariationSettings = parsed.map(({ axis, fromValue, toValue }) => `'${axis}' ${fromValue + (toValue - fromValue) * fv}`).join(', ');
    });
  });

  const words = label.split(' ');
  let li = 0;
  return (
    <span ref={ref} className={`${className} variable-proximity`} onClick={onClick} style={{ display: 'inline', ...style }} {...rest}>
      {words.map((word, wi) => (
        <span key={wi} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
          {word.split('').map(letter => {
            const ci = li++;
            return (
              <motion.span key={ci} ref={el => { letterRefs.current[ci] = el; }}
                style={{ display: 'inline-block', fontVariationSettings: interpolatedRef.current[ci] }} aria-hidden="true">
                {letter}
              </motion.span>
            );
          })}
          {wi < words.length - 1 && <span style={{ display: 'inline-block' }}>&nbsp;</span>}
        </span>
      ))}
      <span className="sr-only">{label}</span>
    </span>
  );
});

VariableProximity.displayName = 'VariableProximity';
export default VariableProximity;
