import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ActionButton from './ActionButton';
import Icon from './Icon';
import ScreenContainer from './ScreenContainer';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export type ConsentSection = { title: string; body: string };

type Props = {
  intro: string;
  sections: ConsentSection[];
  footnote: string;
  onAccept: () => void;
  onReadPolicy?: () => void;
};

export default function ConsentScreen({
  intro,
  sections,
  footnote,
  onAccept,
  onReadPolicy,
}: Props) {
  const [agreed, setAgreed] = useState(false);

  return (
    <ScreenContainer style={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        Before you start
      </Text>
      <Text style={styles.intro}>{intro}</Text>

      <View style={styles.card}>
        {sections.map((section, index) => (
          <View
            key={section.title}
            style={[styles.row, index < sections.length - 1 && styles.divider]}
          >
            <Text style={styles.rowTitle}>{section.title}</Text>
            <Text style={styles.rowBody}>{section.body}</Text>
          </View>
        ))}
      </View>

      {onReadPolicy ? (
        <Pressable accessibilityRole="link" onPress={onReadPolicy}>
          <Text style={styles.link}>Read the full privacy policy</Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="I agree to the privacy and consent policy."
        accessibilityState={{ checked: agreed }}
        onPress={() => setAgreed(value => !value)}
        style={styles.agree}
      >
        <View style={[styles.box, agreed && styles.boxChecked]}>
          {agreed ? (
            <Icon name="check" size={14} color={colors.white} strokeWidth={3} />
          ) : null}
        </View>
        <Text style={styles.agreeText}>
          I agree to the privacy and consent policy.
        </Text>
      </Pressable>

      <ActionButton
        title="Accept and continue"
        disabled={!agreed}
        onPress={onAccept}
        style={styles.accept}
      />
      <Text style={styles.footnote}>{footnote}</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 32 },
  title: {
    fontSize: 28,
    fontWeight: typography.bold,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  intro: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  card: {
    marginTop: 20,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  row: { paddingVertical: 14, gap: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowTitle: {
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  rowBody: { fontSize: 13, lineHeight: 18, color: colors.muted },
  link: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.brand,
  },
  agree: {
    marginTop: 18,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  agreeText: { flex: 1, fontSize: 14, color: colors.ink },
  accept: { marginTop: 14 },
  footnote: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.muted,
  },
});
