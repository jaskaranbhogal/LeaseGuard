import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ActionButton from '../../components/ActionButton';
import Field from '../../components/Field';
import Icon from '../../components/Icon';
import ScreenContainer from '../../components/ScreenContainer';
import ScreenTitle from '../../components/ScreenTitle';
import {
  MAX_AREAS,
  MIN_AREAS,
  firstName,
  useLandlordDemo,
} from '../../context/LandlordDemoContext';
import type { LandlordStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { emailError } from '../../utils/validation';
import {
  bathroomCountError,
  bedroomCountError,
} from '../../utils/landlordValidation';
import AddAreaSheet from './AddAreaSheet';
import { layout } from '../../theme/layout';

type Props = NativeStackScreenProps<LandlordStackParamList, 'EditUnit'>;

export default function EditUnitScreen({ navigation, route }: Props) {
  const { propertyId, unitId } = route.params;
  const {
    findUnit,
    updateUnit,
    removeTenant,
    sendInvite,
    cancelInvite,
    busy,
    error,
  } = useLandlordDemo();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const found = findUnit(propertyId, unitId);

  const [name, setName] = useState(found?.unit.name ?? '');
  const [bedrooms, setBedrooms] = useState(found?.unit.bedrooms ?? '');
  const [bathrooms, setBathrooms] = useState(found?.unit.bathrooms ?? '');
  const [inviteEmail, setInviteEmail] = useState(
    found?.unit.tenant && found.unit.tenant.status !== 'joined'
      ? found.unit.tenant.email
      : '',
  );
  const [areas, setAreas] = useState(found?.unit.areas ?? []);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!found) {
    return (
      <ScreenContainer style={styles.content}>
        <ScreenTitle title="Edit unit" onBack={() => navigation.goBack()} />
        <Text style={styles.note}>This unit no longer exists.</Text>
      </ScreenContainer>
    );
  }

  const { property, unit } = found;
  const tenant = unit.tenant;
  const tenantFirst = firstName(tenant);
  const pending = tenant?.status === 'pending' || tenant?.status === 'declined';
  const declined = tenant?.status === 'declined';
  const errors = {
    name: name.trim() ? undefined : 'Enter a unit name.',
    bedrooms: bedroomCountError(bedrooms),
    bathrooms: bathroomCountError(bathrooms),
    areas:
      areas.length < MIN_AREAS
        ? `Keep at least ${MIN_AREAS} areas.`
        : undefined,
    invite: pending || inviteEmail.trim() ? emailError(inviteEmail) : undefined,
  };
  const emailChanged =
    inviteEmail.trim().toLowerCase() !== (tenant?.email ?? '').toLowerCase();
  const show = (error?: string) => (submitted ? error : undefined);
  const atLimit = areas.length >= MAX_AREAS;

  const draftTaken = areas.some(
    a => a !== renaming && a.toLowerCase() === draftName.trim().toLowerCase(),
  );

  function saveAreaName() {
    const next = draftName.trim();
    if (!renaming || !next || draftTaken) return;
    setAreas(current => current.map(a => (a === renaming ? next : a)));
    setRenaming(null);
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setAreas(current => {
      const next = [...current];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  async function save() {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    const saved = await updateUnit(propertyId, unitId, {
      name: name.trim(),
      bedrooms: bedrooms.trim(),
      bathrooms: bathrooms.trim(),
      areas,
    });
    if (!saved) return;
    if ((pending || !tenant) && inviteEmail.trim() && emailChanged) {
      if (tenant?.status === 'pending') {
        resendInvite();
        return;
      }
      if (!(await sendInvite(propertyId, unitId, inviteEmail))) return;
    }
    navigation.goBack();
  }

  async function resendInvite() {
    setSubmitted(true);
    if (errors.invite) return;
    if (tenant?.status !== 'pending') {
      await sendInvite(propertyId, unitId, inviteEmail);
      return;
    }
    Alert.alert(
      'Replace pending invitation?',
      `The previous code will stop working. A new invitation will be created for ${inviteEmail.trim()}. Email delivery depends on the configured mail service.`,
      [
        { text: 'Keep invitation', style: 'cancel' },
        {
          text: 'Revoke and reissue',
          onPress: async () => {
            if (await cancelInvite(propertyId, unitId))
              await sendInvite(propertyId, unitId, inviteEmail);
          },
        },
      ],
    );
  }

  function confirmCancelInvite() {
    Alert.alert(
      'Cancel invite?',
      `The invite to ${tenant?.email} will stop working. You can invite someone else later.`,
      [
        { text: 'Keep invite', style: 'cancel' },
        {
          text: 'Cancel invite',
          style: 'destructive',
          onPress: async () => {
            if (await cancelInvite(propertyId, unitId)) setInviteEmail('');
          },
        },
      ],
    );
  }

  function confirmRemoveTenant() {
    Alert.alert(
      'Remove tenant?',
      `${tenant?.name ?? tenant?.email} will lose access to Unit ${
        unit.name
      }. Their past photos stay in the unit's history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (await removeTenant(propertyId, unitId)) navigation.goBack();
          },
        },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenContainer style={styles.content}>
        <ScreenTitle
          title="Edit unit"
          subtitle={`${property.street} • Unit ${unit.name}`}
          onBack={() => navigation.goBack()}
        />

        {!!error && (
          <Text accessibilityRole="alert" style={layout.error}>
            {error}
          </Text>
        )}

        <View style={styles.row}>
          <Field
            label="Unit"
            value={name}
            onChangeText={setName}
            error={show(errors.name)}
            autoCapitalize="characters"
            containerStyle={styles.third}
          />
          <Field
            label="Bedrooms"
            value={bedrooms}
            onChangeText={setBedrooms}
            error={show(errors.bedrooms)}
            keyboardType="number-pad"
            containerStyle={styles.third}
          />
          <Field
            label="Bathrooms"
            value={bathrooms}
            onChangeText={setBathrooms}
            error={show(errors.bathrooms)}
            keyboardType="decimal-pad"
            containerStyle={styles.third}
          />
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Tenant</Text>
          {tenant?.status === 'joined' ? (
            <>
              <View style={[styles.card, styles.tenant]}>
                <View style={styles.flex}>
                  <Text style={styles.tenantName}>{tenant.name}</Text>
                  <Text style={styles.meta}>{tenant.email}</Text>
                </View>
                <View style={[styles.pill, styles.pillBrand]}>
                  <Text style={[styles.pillText, styles.pillTextBrand]}>
                    JOINED
                  </Text>
                </View>
              </View>
              <Text style={styles.note}>
                {`Name and email come from ${tenantFirst}'s account.`}
              </Text>
            </>
          ) : pending ? (
            <View style={[styles.card, styles.invite]}>
              <View style={styles.labelRow}>
                <Text style={styles.inviteLabel}>Tenant</Text>
                <View
                  style={[
                    styles.pill,
                    declined ? styles.pillDanger : styles.pillWarn,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      declined ? styles.pillTextDanger : styles.pillTextWarn,
                    ]}
                  >
                    {declined ? 'DECLINED' : 'PENDING'}
                  </Text>
                </View>
              </View>
              <Field
                label="Invited email"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                error={show(errors.invite)}
                hint={
                  declined
                    ? `Declined ${tenant.declinedOn}. Check the email and resend, or invite someone else.`
                    : `Invitation created ${new Date(
                        tenant.invitedOn,
                      ).toLocaleDateString()}. Reissuing revokes the previous code. Check email delivery status on your dashboard.`
                }
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <View style={styles.inviteActions}>
                <ActionButton
                  title="Resend invite"
                  variant="secondary"
                  compact
                  disabled={busy}
                  onPress={resendInvite}
                  style={styles.flexButton}
                />
                <ActionButton
                  title="Cancel invite"
                  variant="dangerOutline"
                  compact
                  disabled={busy}
                  onPress={confirmCancelInvite}
                  style={styles.flexButton}
                />
              </View>
            </View>
          ) : (
            <Field
              label="Tenant email"
              placeholder="tenant@example.com"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              error={show(errors.invite)}
              hint="Optional. Saving sends them an invite to this unit."
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          )}
        </View>

        <View style={styles.group}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Inspection areas</Text>
            <Text style={[styles.count, atLimit && styles.countLimit]}>
              {`${areas.length} of ${MAX_AREAS}`}
            </Text>
          </View>
          <Text style={styles.note}>
            Area edits configure future templates. Approved baselines and
            historical reports keep their original areas.
          </Text>
          <View style={[styles.card, styles.areas]}>
            {areas.map((area, index) =>
              renaming === area ? (
                <View key={area} style={styles.renameArea}>
                  <Field
                    label={`Rename ${area}`}
                    value={draftName}
                    onChangeText={setDraftName}
                    maxLength={60}
                    autoFocus
                    error={
                      draftTaken
                        ? 'Another area already has this name.'
                        : undefined
                    }
                  />
                  <View style={styles.renameButtons}>
                    <ActionButton
                      title="Save name"
                      compact
                      disabled={!draftName.trim() || draftTaken}
                      onPress={saveAreaName}
                    />
                    <ActionButton
                      title="Cancel"
                      compact
                      variant="secondary"
                      onPress={() => setRenaming(null)}
                    />
                  </View>
                </View>
              ) : (
                <View
                  key={area}
                  style={[
                    styles.area,
                    index < areas.length - 1 && styles.divider,
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${area} up`}
                    onPress={() => moveUp(index)}
                    hitSlop={8}
                  >
                    <Icon name="grip" size={18} color="#94A3B8" />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Rename ${area}`}
                    onPress={() => {
                      setDraftName(area);
                      setRenaming(area);
                    }}
                    style={styles.areaNameButton}
                  >
                    <Text style={styles.areaName}>{`${
                      index + 1
                    }. ${area}`}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${area}`}
                    onPress={() =>
                      setAreas(current => current.filter(a => a !== area))
                    }
                    hitSlop={8}
                  >
                    <Icon name="close" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              ),
            )}
          </View>
          {show(errors.areas) ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {errors.areas}
            </Text>
          ) : null}
          {atLimit ? (
            <Text style={styles.limit}>
              You've reached the {MAX_AREAS}-area limit. Remove one to add
              another.
            </Text>
          ) : (
            <View style={styles.labelRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSheetOpen(true)}
                style={styles.addArea}
              >
                <Text style={styles.addAreaText}>+ Add area</Text>
              </Pressable>
              <Text style={styles.meta}>
                {`Inspections follow this order. Min ${MIN_AREAS}.`}
              </Text>
            </View>
          )}
        </View>

        <ActionButton title="Save changes" disabled={busy} onPress={save} />
        {pending ? (
          <Text style={styles.footnote}>
            {`Once ${tenantFirst} signs up, their name replaces the email and it can't be edited here.`}
          </Text>
        ) : null}
        {tenant?.status === 'joined' ? (
          <ActionButton
            title="Remove tenant from unit"
            variant="danger"
            disabled={busy}
            onPress={confirmRemoveTenant}
          />
        ) : null}
      </ScreenContainer>

      <AddAreaSheet
        visible={sheetOpen}
        tenantName={tenantFirst}
        existing={areas}
        onClose={() => setSheetOpen(false)}
        onAdd={area => {
          setAreas(current => [...current, area]);
          setSheetOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 14,
  },
  row: { flexDirection: 'row', gap: 10 },
  third: { flex: 1 },
  group: { gap: 8 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  label: {
    fontSize: 13,
    fontWeight: typography.medium,
    color: colors.muted,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: { fontSize: 12, color: colors.muted },
  countLimit: { color: colors.warnText, fontWeight: typography.semibold },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
  },
  tenant: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  tenantName: {
    fontSize: 15,
    fontWeight: typography.semibold,
    color: colors.ink,
  },
  meta: { fontSize: 12, color: colors.muted },
  note: { fontSize: 12, color: colors.muted },
  invite: { gap: 12, padding: 14 },
  inviteLabel: {
    fontSize: 13,
    fontWeight: typography.medium,
    color: colors.muted,
  },
  inviteActions: { flexDirection: 'row', gap: 10 },
  flexButton: { flex: 1 },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.muted,
  },
  pill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  pillBrand: { backgroundColor: colors.brandTint },
  pillWarn: { backgroundColor: colors.warnBg },
  pillDanger: { backgroundColor: colors.errorTint },
  pillTextDanger: { color: colors.error },
  pillText: { fontSize: 11, fontWeight: typography.bold, letterSpacing: 0.3 },
  pillTextBrand: { color: colors.brand },
  pillTextWarn: { color: colors.warnText },
  areas: { paddingHorizontal: 8 },
  area: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 48,
    paddingHorizontal: 8,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  areaName: { fontSize: 15, color: colors.ink },
  areaNameButton: { flex: 1 },
  renameArea: { gap: 10, paddingVertical: 12 },
  renameButtons: { flexDirection: 'row', gap: 10 },
  addArea: { paddingVertical: 12 },
  addAreaText: {
    fontSize: 14,
    fontWeight: typography.semibold,
    color: colors.brand,
  },
  error: { fontSize: 12, color: colors.error },
  limit: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.warnBg,
    fontSize: 12,
    lineHeight: 17,
    color: colors.warnText,
  },
});
