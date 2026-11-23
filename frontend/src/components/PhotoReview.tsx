import { colors } from '../theme/colors';
import React from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import CameraFrame from './CameraFrame';
import ActionButton from './ActionButton';
import ScreenTitle from './ScreenTitle';
import { layout } from '../theme/layout';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
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
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={layout.content}>
            <ScreenTitle
              title="Review photo"
              subtitle={`${remaining} remaining`}
            />
            <Text style={layout.muted}>
              Check that the area is clear and in focus before accepting.
              Accepting uploads this photo to your saved draft.
            </Text>
            {asset?.uri && <CameraFrame uri={asset.uri} />}
            <View style={styles.actions}>
              <ActionButton
                title="Discard / retake"
                variant="secondary"
                onPress={onDiscard}
              />
              <ActionButton title="Accept photo" onPress={onAccept} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  actions: {
    gap: 12,
  },
});
