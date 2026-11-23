import { colors } from '../theme/colors';
import React, { useEffect, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import CameraFrame from './CameraFrame';
import ActionButton from './ActionButton';
import EvidenceImage from './EvidenceImage';
import Field from './Field';
import ScreenTitle from './ScreenTitle';
import { layout } from '../theme/layout';
import { typography } from '../theme/typography';
import { Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Asset } from 'react-native-image-picker';

export default function PhotoReview({
  asset,
  remaining,
  onAccept,
  onDiscard,
  step,
  baselineUri,
  withNote = false,
}: {
  asset?: Asset;
  remaining: number;
  onAccept: (note?: string) => void;
  onDiscard: () => void;
  step?: string;
  baselineUri?: string;
  withNote?: boolean;
}) {
  const [note, setNote] = useState('');
  useEffect(() => {
    if (asset) setNote('');
  }, [asset]);
  return (
    <Modal visible={!!asset} onRequestClose={onDiscard} animationType="slide">
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={layout.content}
          >
            <ScreenTitle
              title="Review photo"
              subtitle={step || `${remaining} remaining`}
            />
            {baselineUri && asset?.uri ? (
              <>
                <View style={styles.pair}>
                  <View style={styles.side}>
                    <EvidenceImage
                      source={{ uri: baselineUri }}
                      style={styles.tile}
                      accessibilityLabel="Baseline photo"
                    />
                    <Text style={styles.caption}>Baseline</Text>
                  </View>
                  <View style={styles.side}>
                    <Image
                      source={{ uri: asset.uri }}
                      style={styles.tile}
                      resizeMode="cover"
                      accessibilityLabel="Your photo"
                    />
                    <Text style={styles.caption}>Your photo • Today</Text>
                  </View>
                </View>
                <View style={layout.card}>
                  <Text style={styles.cardTitle}>
                    Same view as your baseline?
                  </Text>
                  <Text style={layout.muted}>
                    If the angle or distance is off, retake it so the comparison
                    stays fair.
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={layout.muted}>
                  Check that the area is clear and in focus before accepting.
                  Accepting uploads this photo to your saved draft.
                </Text>
                {asset?.uri && <CameraFrame uri={asset.uri} />}
              </>
            )}
            {withNote && (
              <Field
                label="Anything to point out? (optional)"
                placeholder="For example: the faucet started dripping last week."
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={1200}
              />
            )}
            <View style={styles.actions}>
              <ActionButton
                title={withNote ? 'Use this photo' : 'Accept photo'}
                onPress={() => onAccept(note)}
              />
              <ActionButton
                title={withNote ? 'Retake' : 'Discard / retake'}
                variant="secondary"
                onPress={onDiscard}
              />
            </View>
            {withNote && remaining > 0 && (
              <Text style={styles.footnote}>
                You'll review all your photos before you submit.
              </Text>
            )}
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
  pair: { flexDirection: 'row', gap: 10 },
  side: { flex: 1, gap: 6 },
  tile: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
    backgroundColor: colors.readOnly,
    overflow: 'hidden',
  },
  caption: { fontSize: 12, color: colors.muted },
  cardTitle: {
    fontSize: 15,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  actions: {
    gap: 12,
  },
  footnote: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});
