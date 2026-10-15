import { Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';

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
      <Text style={styles.arrow}>{'‹'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },

  arrow: {
    fontSize: 38,
    lineHeight: 42,
    color: colors.navy,
  },
  pressed: {
    opacity: 0.5,
  },
});
