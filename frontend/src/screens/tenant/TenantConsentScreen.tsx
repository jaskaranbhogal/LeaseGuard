import ConsentScreen from '../../components/ConsentScreen';
import { useTenantDemo } from '../../context/TenantDemoContext';

type Props = { onReadPolicy?: () => void };

const sections = [
  {
    title: 'What we collect',
    body: 'Photos of your unit, with the date and area each one covers.',
  },
  {
    title: 'Who can see it',
    body: 'Authorized unit tenants, property managers, application services and processors.',
  },
  {
    title: 'How AI is used',
    body: 'Photos are sent to Google Gemini to compare against your baseline. AI flags possible changes. You and your landlord make the final decisions.',
  },
  {
    title: 'How it is stored',
    body: "Securely, as part of your unit's condition record.",
  },
];

export default function TenantConsentScreen({ onReadPolicy }: Props) {
  const { acceptConsent } = useTenantDemo();
  return (
    <ConsentScreen
      intro="LeaseGuard records the condition of your unit. Here is how your photos are handled."
      sections={sections}
      footnote="Camera and upload features stay locked until you accept."
      onAccept={acceptConsent}
      onReadPolicy={onReadPolicy}
    />
  );
}
