import { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageProps,
} from 'react-native';
import { colors } from '../theme/colors';

// Evidence stays behind the existing authenticated API. Failed delivery is visible.
export default function EvidenceImage({
  source,
  style,
  accessibilityLabel = 'Evidence photo',
  ...props
}: ImageProps) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const uri =
    source && typeof source === 'object' && 'uri' in source
      ? source.uri
      : undefined;
  useEffect(() => {
    setFailed(false);
  }, [uri]);
  return (
    <View style={[styles.frame, style]}>
      <Image
        {...props}
        key={`${uri}-${attempt}`}
        source={source}
        accessibilityLabel={accessibilityLabel}
        resizeMode="contain"
        style={StyleSheet.absoluteFill}
        onError={() => setFailed(true)}
      />
      {failed && (
        <View style={styles.message}>
          <Text style={styles.text}>Photo unavailable</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Retry ${accessibilityLabel}`}
            style={styles.retry}
            onPress={() => {
              setFailed(false);
              setAttempt(n => n + 1);
            }}
          >
            <Text style={styles.link}>Retry photo</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.readOnly,
    borderRadius: 12,
  },
  message: {
    ...StyleSheet.absoluteFill,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.readOnly,
  },
  text: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
  },
  retry: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  link: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.brand,
    fontWeight: '600',
  },
});
