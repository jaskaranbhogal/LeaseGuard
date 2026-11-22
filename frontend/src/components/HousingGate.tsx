import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import ConsentScreen from './ConsentScreen';
import ScreenContainer from './ScreenContainer';
import ActionButton from './ActionButton';
import LoadingView from './LoadingView';
import { useLandlordDemo } from '../context/LandlordDemoContext';
import { useTenantDemo } from '../context/TenantDemoContext';
import AddedToUnitScreen from '../screens/tenant/AddedToUnitScreen';
import TenantInvitePromptScreen from '../screens/tenant/TenantInvitePromptScreen';
import { PrivacyPolicyContent } from '../screens/shared/PrivacyPolicyScreen';
import type { PropsWithChildren } from 'react';
function Gate({
  children,
  loading,
  error,
  consented,
  acceptConsent,
  refresh,
}: PropsWithChildren<{
  loading: boolean;
  error: string;
  consented: boolean;
  acceptConsent: () => Promise<void>;
  refresh: () => Promise<unknown>;
}>) {
  const [policy, setPolicy] = useState(false);
  if (loading) return <LoadingView />;
  if (policy)
    return (
      <ScreenContainer style={styles.policy}>
        <ActionButton
          title="Back to consent"
          onPress={() => setPolicy(false)}
        />
        <PrivacyPolicyContent />
      </ScreenContainer>
    );
  if (!consented)
    return (
      <>
        <ConsentScreen
          intro="LeaseGuard keeps a shared record of rental condition. Policy version: November 21, 2026."
          sections={[
            {
              title: 'Evidence and access',
              body: 'Inspection and maintenance photos, notes, dates and unit details are stored privately. Authorized tenants, property managers, application services and processors handle the relevant evidence.',
            },
            {
              title: 'AI suggestions',
              body: 'A landlord can explicitly request Google Gemini analysis of inspection images. AI results are advisory; human review determines decisions.',
            },
            {
              title: 'Retention',
              body: 'Photos have a minimum 90-day retention period. Guided evidence is held for historical review; automatic deletion after 90 days is not implemented.',
            },
          ]}
          footnote="Required acknowledgment is saved to your account on the server."
          onAccept={acceptConsent}
          onReadPolicy={() => setPolicy(true)}
        />
        {!!error && (
          <ScreenContainer>
            <Text accessibilityRole="alert">{error}</Text>
            <ActionButton title="Retry loading account" onPress={refresh} />
          </ScreenContainer>
        )}
      </>
    );
  return children;
}
export function LandlordGate({ children }: PropsWithChildren) {
  return <Gate {...useLandlordDemo()}>{children}</Gate>;
}
export function TenantGate({ children }: PropsWithChildren) {
  const state = useTenantDemo();
  return (
    <Gate {...state}>
      {state.justJoined ? (
        <AddedToUnitScreen />
      ) : state.pendingInvite ? (
        <TenantInvitePromptScreen />
      ) : (
        children
      )}
    </Gate>
  );
}

const styles = StyleSheet.create({ policy: { padding: 24 } });
