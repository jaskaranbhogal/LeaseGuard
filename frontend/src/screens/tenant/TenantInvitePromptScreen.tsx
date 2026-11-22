import { Alert, StyleSheet, Text, View } from 'react-native';
import ActionButton from '../../components/ActionButton';
import Icon from '../../components/Icon';
import ScreenContainer from '../../components/ScreenContainer';
import { useTenantDemo } from '../../context/TenantDemoContext';
import Field from '../../components/Field';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

function rooms(count: string, word: string) {
  return `${count} ${word}${count === '1' ? '' : 's'}`;
}

export default function TenantInvitePromptScreen() {
  const {
    pendingInvite,
    unit,
    acceptPendingInvite,
    declinePendingInvite,
    token,
    setToken,
    busy,
    error,
  } = useTenantDemo();
  if (!pendingInvite) return null;
  const invite = pendingInvite;
  const landlordFirst = invite.landlordName.split(' ')[0];
  const replacing = Boolean(unit);

  const rows = [
    [
      'Property',
      [invite.street, invite.city.split(',')[0]].filter(Boolean).join(', '),
    ],
    [
      'Unit',
      `${invite.unit} • ${rooms(invite.bedrooms, 'bed')}, ${rooms(
        invite.bathrooms,
        'bath',
      )}`,
    ],
    ['Landlord', invite.landlordName],
  ];

  function confirmDecline() {
    Alert.alert(
      'Decline invite?',
      `${landlordFirst} will see that you declined. Nothing from your account is shared.`,
      [
        { text: 'Go back', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: declinePendingInvite,
        },
      ],
    );
  }

  return (
    <ScreenContainer style={styles.content}>
      <View style={styles.icon}>
        <Icon name="home" size={26} color={colors.brand} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        You've been invited
      </Text>
      <Text style={styles.intro}>
        {invite.previewLocked
          ? `An invitation is waiting for ${invite.email}. Enter the code from your email to verify it. Property details stay private until the code is accepted.`
          : `${invite.landlordName} added you as the tenant for ${invite.street}, Unit ${invite.unit}.`}
      </Text>
      <View style={styles.card}>
        {!invite.previewLocked &&
          rows.map(([label, value], index) => (
            <View
              key={label}
              style={[styles.row, index < rows.length - 1 && styles.divider]}
            >
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
      </View>
      <View style={styles.note}>
        <Text style={styles.noteText}>
          {`Accepting links your account to this unit. ${landlordFirst} will see the photos and repair requests you add for it.`}
          {replacing ? ' Existing unit assignments stay unchanged.' : ''}
        </Text>
      </View>
      <Field
        label="Invitation code"
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        hint="Enter the single-use code from your invitation email."
      />
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <ActionButton
        title="Accept invite"
        disabled={busy || !token.trim()}
        onPress={acceptPendingInvite}
      />
      <ActionButton
        title="Decline"
        disabled={busy || !token.trim()}
        variant="dangerOutline"
        onPress={confirmDecline}
      />
      <Text style={styles.fine}>
        Don't recognize this landlord? Decline and nothing is shared.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 32,
    gap: 14,
  },
  icon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: typography.bold,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  intro: { fontSize: 15, lineHeight: 22, color: colors.muted },
  card: {
    marginTop: 6,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.white,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  label: { fontSize: 13, color: colors.muted },
  value: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: typography.medium,
    color: colors.ink,
  },
  note: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  noteText: { fontSize: 13, lineHeight: 19, color: colors.brandSoftText },
  fine: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.muted,
  },
});
