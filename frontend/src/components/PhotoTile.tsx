import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import EvidenceImage from './EvidenceImage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type Props = {
  area: string;
  uri?: string;
  placeholder: string;
  onRetake?: () => void;
  retakeLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export default function PhotoTile({
  area,
  uri,
  placeholder,
  onRetake,
  retakeLabel = 'Retake',
  style,
}: Props) {
  return (
    <View style={[styles.tile, style]}>
      <View style={styles.photo}>
        {uri ? (
          <EvidenceImage
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
            accessibilityLabel={`${area} photo`}
          />
        ) : (
          <Text style={styles.placeholder}>{placeholder}</Text>
        )}
      </View>
      <Text style={styles.area}>{area}</Text>
      {onRetake ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${retakeLabel} ${area}`}
          onPress={onRetake}
          hitSlop={6}
        >
          <Text style={styles.retake}>{retakeLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '100%',
    gap: 8,
    padding: 8,
    paddingBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  photo: {
    aspectRatio: 4 / 3,
    borderRadius: 10,
    backgroundColor: '#CDD6E2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  placeholder: {
    fontSize: 11,
    fontWeight: typography.semibold,
    letterSpacing: 0.4,
    color: colors.brandSoftText,
  },
  area: { paddingHorizontal: 4, fontSize: 13, color: colors.ink },
  retake: {
    minHeight: 44,
    paddingTop: 12,
    paddingHorizontal: 4,
    fontSize: 13,
    fontWeight: typography.semibold,
    color: colors.brand,
  },
});
