import { colors } from '../theme/colors';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import CameraFrame from './CameraFrame';
import ActionButton from './ActionButton';
import { Modal, StyleSheet, Text, View } from 'react-native';
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
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Review photo · {remaining} remaining</Text>
        {asset?.uri && <CameraFrame uri={asset.uri} />}
        <View style={styles.actions}>
          <ActionButton
            title="Discard / retake"
            variant="secondary"
            onPress={onDiscard}
          />
          <ActionButton title="Accept photo" onPress={onAccept} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 64,
    backgroundColor: colors.background,
  },
  title: { fontSize: 20, color: colors.ink },
  preview: { flex: 1, width: '100%' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 30,
  },
  button: { padding: 16, backgroundColor: colors.brandSoft, borderRadius: 12 },
});
