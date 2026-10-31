import AppleLogo from '../assets/apple-logo.svg';
import GoogleLogo from '../assets/google-logo.svg';

export default function BrandIcon({ brand }: { brand: 'google' | 'apple' }) {
  const Logo = brand === 'apple' ? AppleLogo : GoogleLogo;
  return <Logo width={20} height={20} />;
}
