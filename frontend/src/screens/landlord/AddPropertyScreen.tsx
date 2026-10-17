import { useState } from 'react';
import { Keyboard, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Input from '../../components/Input';
import ScreenContainer from '../../components/ScreenContainer';
import type { LandlordStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { emailError } from '../../utils/validation';

type Props = NativeStackScreenProps<LandlordStackParamList, 'AddProperty'>;

function countError(value: string, label: string) {
  return /^\d+(\.5)?$/.test(value.trim()) ? undefined : `Enter ${label}.`;
}

export default function AddPropertyScreen({ navigation }: Props) {
  const [address, setAddress] = useState('');
  const [unit, setUnit] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [assignTenant, setAssignTenant] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    address: address.trim() ? undefined : 'Enter the property address.',
    unit: unit.trim() ? undefined : 'Enter a unit name or number.',
    bedrooms: countError(bedrooms, 'the number of bedrooms'),
    bathrooms: countError(bathrooms, 'the number of bathrooms'),
    tenantEmail: assignTenant ? emailError(tenantEmail) : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  function submit() {
    setSubmitted(true);
    if (hasErrors) {
      return;
    }
    Keyboard.dismiss();
    navigation.goBack();
  }

  return (
    <ScreenContainer style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Add property</Text>
        <Text style={styles.subtitle}>
          Create the property, unit, and tenant link.
        </Text>
      </View>

      <Input
        label="Property address"
        placeholder="Street, city, state"
        value={address}
        onChangeText={setAddress}
        error={submitted ? errors.address : undefined}
        autoCapitalize="words"
        autoComplete="street-address"
        returnKeyType="next"
      />
      <Input
        label="Unit"
        placeholder="1A"
        value={unit}
        onChangeText={setUnit}
        error={submitted ? errors.unit : undefined}
        autoCapitalize="characters"
        returnKeyType="next"
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <Input
            label="Bedrooms"
            placeholder="1"
            value={bedrooms}
            onChangeText={setBedrooms}
            error={submitted ? errors.bedrooms : undefined}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.half}>
          <Input
            label="Bathrooms"
            placeholder="1"
            value={bathrooms}
            onChangeText={setBathrooms}
            error={submitted ? errors.bathrooms : undefined}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <Card style={styles.tenantCard}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>T</Text>
        </View>
        <View style={styles.tenantText}>
          <Text style={styles.tenantTitle}>Assign tenant to this unit</Text>
          <Text style={styles.tenantDetail}>
            Tenant will be prompted for future inspections.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Assign tenant to this unit"
          value={assignTenant}
          onValueChange={setAssignTenant}
          trackColor={{ true: colors.actionBlue }}
        />
      </Card>

      {assignTenant && (
        <Input
          label="Tenant email"
          placeholder="tenant@example.com"
          value={tenantEmail}
          onChangeText={setTenantEmail}
          error={submitted ? errors.tenantEmail : undefined}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      )}

      <View style={styles.actions}>
        <Button title="Save property & unit" variant="reset" onPress={submit} />
        <Button
          title="Cancel"
          variant="outline"
          onPress={() => navigation.goBack()}
        />
      </View>
      <Text style={styles.note}>
        After saving, this unit appears on the landlord dashboard.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  header: { marginBottom: spacing.sm },
  title: {
    fontSize: 32,
    fontWeight: typography.bold,
    color: colors.headerNavy,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 16,
    color: colors.textSecondary,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  tenantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 20,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F7FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 16,
    fontWeight: typography.bold,
    color: '#1596B0',
  },
  tenantText: { flex: 1, gap: spacing.xs },
  tenantTitle: {
    fontSize: 17,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  tenantDetail: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  note: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});
