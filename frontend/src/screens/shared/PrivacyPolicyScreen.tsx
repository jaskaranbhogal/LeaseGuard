import { useNavigation } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';

import Header from '../../components/Header';
import ScreenContainer from '../../components/ScreenContainer';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const LAST_UPDATED = 'October 21, 2026';

type Section = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

const INTRO =
  'LeaseGuard helps landlords and tenants document the condition of rental units through photo and video inspections, maintenance reports, and AI-assisted comparisons. This policy explains what information we collect, how we use it, and the choices you have.';

const SECTIONS: Section[] = [
  {
    title: '1. Information we collect',
    bullets: [
      'Account information: your name, email address, password (stored in protected form), and whether you are a landlord or tenant.',
      'Property and unit information: addresses, unit details, and the link between a landlord and the tenant of a unit.',
      'Photos and videos: images and videos you capture or upload during inspections or maintenance reports, with related notes, dates, and times.',
      'Inspection and maintenance data: schedules, availability you choose, maintenance requests, condition history, and AI inspection results.',
      'Notifications: if enabled, a device token so we can send you notifications.',
    ],
  },
  {
    title: '2. How we use your information',
    bullets: [
      'Create and manage your account and sign you in.',
      'Store and show inspection photos, videos, and condition history to the landlord and tenant of the relevant unit.',
      'Compare inspection photos and generate AI-assisted condition reports.',
      'Schedule inspections, process maintenance requests, and send notifications.',
      'Maintain security, prevent misuse, and fix bugs.',
      'Comply with legal obligations.',
    ],
    paragraphs: ['We do not sell your personal information.'],
  },
  {
    title: '3. AI-assisted comparisons',
    paragraphs: [
      'LeaseGuard uses AI to compare photos and flag possible changes in unit condition. These results are advisory only. Landlords and tenants make the final decisions.',
    ],
  },
  {
    title: '4. Who can see your information',
    bullets: [
      'Landlords and tenants: photos, videos, and inspection records are visible only to the landlord and tenant of the unit they belong to.',
      'Service providers: we use trusted providers for hosting, storage, authentication, notifications, and AI processing. They may only use your information to provide services to us.',
      'Legal reasons: we may disclose information if required by law, court order, or to protect rights, safety, or security.',
      'Business transfers: if LeaseGuard is involved in a merger or sale, your information may be transferred as part of that process.',
    ],
  },
  {
    title: '5. Camera permission',
    paragraphs: [
      'LeaseGuard asks for camera access so you can take inspection and maintenance photos and videos. The camera is used only when you choose to capture media in the app. You can turn camera access on or off at any time in your device Settings under LeaseGuard.',
    ],
  },
  {
    title: '6. Data retention',
    paragraphs: [
      'We keep your information while your account is active and as needed to provide the service. Inspection records may be kept for 30 days so both parties have a record of unit condition. When information is no longer needed, we delete or de-identify it.',
    ],
  },
  {
    title: '7. Security',
    paragraphs: [
      'We use reasonable technical and organizational safeguards, including [encryption in transit and at rest, access controls]. No system is completely secure, so we cannot guarantee absolute security.',
    ],
  },
  {
    title: '8. Your choices and rights',
    bullets: [
      'Access and update your account information.',
      'Request deletion of your account and personal data.',
      'Control camera and notification permissions in your device Settings.',
    ],
    paragraphs: [
      'Depending on where you live, you may have additional rights, such as access, correction, deletion, portability, and objection. Contact us to use any of these rights. Some inspection records may need to be kept if the other party to the tenancy relies on them, or where the law requires it.',
    ],
  },
  {
    title: "9. Children's privacy",
    paragraphs: [
      'LeaseGuard is not intended for anyone under 18, and we do not knowingly collect information from children. If you believe a child has given us information, contact us and we will delete it.',
    ],
  },
  {
    title: '10. Changes to this policy',
    paragraphs: [
      'We may update this policy from time to time. If we make significant changes, we will notify you in the app or by email and update the "Last updated" date.',
    ],
  },
];

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <ScreenContainer style={styles.container}>
      <Header
        title="Privacy policy"
        subtitle={`Last updated: ${LAST_UPDATED}`}
        onBack={handleBack}
        titleStyle={styles.title}
        style={styles.header}
      />

      <View>
        <Text style={styles.body}>{INTRO}</Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {section.title}
            </Text>
            {section.bullets?.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={[styles.body, styles.bulletText]}>{item}</Text>
              </View>
            ))}
            {section.paragraphs?.map((text) => (
              <Text key={text} style={[styles.body, styles.paragraph]}>
                {text}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}

// Sizes and spacing mirror SettingsScreen so the screens feel consistent.
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },

  // 24px like Settings, Profile, Login, and Register (Header defaults to 32).
  title: {
    fontSize: 24,
  },

  header: {
    marginBottom: spacing.lg,
  },

  section: {
    marginTop: spacing.lg,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: typography.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.label,
  },

  paragraph: {
    marginTop: spacing.sm,
  },

  bulletRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },

  bullet: {
    width: spacing.md,
    fontSize: 14,
    lineHeight: 20,
    color: colors.label,
  },

  bulletText: {
    flex: 1,
  },
});