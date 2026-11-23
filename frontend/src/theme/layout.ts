import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';

// Shared page and evidence styles use Jon's existing palette and type weights.
export const layout = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  card: {
    padding: spacing.md,
    gap: spacing.sm + spacing.xs,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 27,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  body: { fontSize: 15, lineHeight: 23, color: colors.ink },
  muted: { fontSize: 14, lineHeight: 21, color: colors.muted },
  label: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: typography.semibold,
    color: colors.muted,
  },
  error: {
    fontSize: 14,
    lineHeight: 21,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.errorTint,
    color: colors.error,
  },
  notice: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: spacing.md,
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 15,
  },
});
