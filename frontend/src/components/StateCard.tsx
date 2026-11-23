import { ActivityIndicator, Text, View } from 'react-native';
import { layout } from '../theme/layout';
import { colors } from '../theme/colors';

export default function StateCard({
  title,
  message,
  loading = false,
}: {
  title: string;
  message?: string;
  loading?: boolean;
}) {
  return (
    <View style={layout.card} accessibilityLiveRegion="polite">
      {loading && (
        <ActivityIndicator color={colors.brand} accessibilityLabel={title} />
      )}
      <Text style={layout.sectionTitle}>{title}</Text>
      {!!message && <Text style={layout.muted}>{message}</Text>}
    </View>
  );
}
