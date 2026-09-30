import { useAppearance } from '../appearance/AppearanceProvider';
import mark from '../assets/brand/cullpilot-mark-cycle.svg';
import markInverse from '../assets/brand/cullpilot-mark-cycle-inverse.svg';
import horizontal from '../assets/brand/cullpilot-lockup-horizontal-cycle.svg';
import horizontalInverse from '../assets/brand/cullpilot-lockup-horizontal-cycle-inverse.svg';
import './brand-loader.css';

interface BrandLoaderProps {
  variant?: 'mark' | 'horizontal';
  size?: 'inline' | 'panel' | 'hero';
  className?: string;
  inverse?: boolean;
}

// Self-contained v2 SVGs own their animation; never spin or recolor the image.
export function BrandLoader({ variant = 'mark', size = 'inline', className = '', inverse = false }: BrandLoaderProps) {
  const { mode } = useAppearance();
  const dark = inverse || mode === 'dark';
  const src = variant === 'horizontal' ? (dark ? horizontalInverse : horizontal) : (dark ? markInverse : mark);
  return <span className={`brand-loader ${className}`} data-variant={variant} data-size={size} aria-hidden="true">
    <img src={src} alt="" />
  </span>;
}

export function BrandLoading({ label, variant = 'mark', size = 'inline', className = '', inverse = false }: BrandLoaderProps & { label: string }) {
  return <span className={`brand-loading ${className}`} data-size={size} role="status" aria-live="polite">
    <BrandLoader variant={variant} size={size} inverse={inverse} /><span>{label}</span>
  </span>;
}
