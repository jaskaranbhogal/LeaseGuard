import type { StyleProp, ViewStyle } from 'react-native';
import ActionButton from './ActionButton';

// Existing API-backed screens share the same controls as Jon's redesigned flows.
interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'reset' | 'outline';
  style?: StyleProp<ViewStyle>;
}
export default function Button({ variant = 'primary', ...props }: Props) {
  return (
    <ActionButton
      {...props}
      variant={variant === 'outline' ? 'secondary' : 'primary'}
    />
  );
}
