import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type Props = {
  area: string;
  uri?: string;
  placeholder: string;
  onRetake?: () => void;
  retakeLabel?: string;
};

export default function PhotoTile({
  area,
  uri,
  placeholder,
  onRetake,
  retakeLabel = 'Retake',
}: Props) {
  return (
    <View style={styles.tile}>
      <View style={styles.photo}>
        {uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
            accessibilityLabel={`${area} photo`}
          />
        ) : (
          <Text style={styles.placeholder}>{placeholder}</Text>
        )}
      </View>
      <Text numberOfLines={2} style={styles.area}>
        {area}
      </Text>
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
    flexBasis: '47%',
    flexGrow: 1,
    gap: 8,
    padding: 8,
    paddingBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  photo: {
    height: 110,
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
    paddingHorizontal: 4,
    fontSize: 13,
    fontWeight: typography.semibold,
    color: colors.brand,
  },
});
