import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

export default function LoadingView() {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading">
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
