import { useAppearance } from '../appearance/AppearanceProvider';
import logo from '../assets/brand/cullpilot-lockup-horizontal.svg';
import logoInverse from '../assets/brand/cullpilot-lockup-horizontal-inverse.svg';

export function BrandLogo({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  const { mode } = useAppearance();
  return <img className={className} src={inverse || mode === 'dark' ? logoInverse : logo} alt="CullPilot" />;
}
