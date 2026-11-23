import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Asset } from 'react-native-image-picker';

export default function PhotoReview({
  asset,
  remaining,
  onAccept,
  onDiscard,
}: {
  asset?: Asset;
  remaining: number;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  return (
    <Modal visible={!!asset} onRequestClose={onDiscard} animationType="slide">
      <View style={styles.container}>
        <Text style={styles.title}>Review photo · {remaining} remaining</Text>
        {asset?.uri && (
          <Image
            source={{ uri: asset.uri }}
            resizeMode="contain"
            style={styles.preview}
          />
        )}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Discard photo"
            onPress={onDiscard}
            style={styles.button}
          >
            <Text>✕ Discard / retake</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Accept photo"
            onPress={onAccept}
            style={styles.button}
          >
            <Text>✓ Accept</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 64,
    backgroundColor: '#F5F7FB',
  },
  title: { fontSize: 20, color: '#131824' },
  preview: { flex: 1, width: '100%' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 30,
  },
  button: { padding: 16, backgroundColor: '#EBF2FF', borderRadius: 12 },
});
