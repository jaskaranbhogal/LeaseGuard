import { colors } from '../theme/colors';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { typography } from '../theme/typography';

type Props = {
  uri?: string;
  badge?: string;
  onBadgePress?: () => void;
  overlayUri?: string;
  overlayLabel?: string;
};

export default function CameraFrame({
  uri,
  badge,
  onBadgePress,
  overlayUri,
  overlayLabel,
}: Props) {
  const showOverlay = !uri && (overlayUri || overlayLabel);
  return (
    <View style={styles.frame}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          accessibilityLabel="Captured photo"
        />
      ) : null}
      {showOverlay ? (
        <View style={styles.overlay}>
          {overlayUri ? (
            <Image
              source={{ uri: overlayUri }}
              style={[StyleSheet.absoluteFill, styles.overlayImage]}
              resizeMode="contain"
              accessibilityLabel="Static baseline reference"
            />
          ) : null}
          {overlayLabel ? (
            <Text style={styles.overlayLabel}>{overlayLabel}</Text>
          ) : null}
        </View>
      ) : (
        <>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </>
      )}
      <View style={styles.footer}>
        <Text style={styles.label}>
          {uri ? 'Photo captured' : 'Static baseline reference'}
        </Text>
        {badge ? (
          <Pressable
            accessibilityRole={onBadgePress ? 'button' : undefined}
            accessibilityLabel={badge}
            disabled={!onBadgePress}
            onPress={onBadgePress}
            style={styles.badge}
          >
            <Text style={styles.badgeText}>{badge}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const CORNER = 30;
const styles = StyleSheet.create({
  frame: {
    height: 340,
    borderRadius: 18,
    backgroundColor: colors.cameraBackdrop,
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: 24,
    left: 24,
    right: 24,
    bottom: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  overlayImage: { opacity: 0.35 },
  overlayLabel: {
    fontSize: 12,
    fontWeight: typography.semibold,
    letterSpacing: 0.6,
    color: colors.divider,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: colors.white,
  },
  topLeft: { top: 28, left: 24, borderTopWidth: 3, borderLeftWidth: 3 },
  topRight: { top: 28, right: 24, borderTopWidth: 3, borderRightWidth: 3 },
  bottomLeft: {
    bottom: 64,
    left: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 64,
    right: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { fontSize: 13, color: colors.divider },
  badge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: typography.semibold,
    color: colors.white,
  },
});
