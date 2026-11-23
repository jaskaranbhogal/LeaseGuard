import { Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import Icon from './Icon';

type Props = {
  onPress?: () => void;
};

export default function BackButton({ onPress }: Props) {
  const navigation = useNavigation();

  const handleBack = () => {
    if (onPress) {
      onPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={handleBack}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon name="back" size={22} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    marginLeft: -12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },

  pressed: {
    opacity: 0.5,
  },
});
