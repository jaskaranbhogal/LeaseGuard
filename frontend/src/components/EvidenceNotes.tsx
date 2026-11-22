import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Field from './Field';
import ActionButton from './ActionButton';
import { colors } from '../theme/colors';
export type EvidenceNote = {
  text: string;
  kind: string;
  actor: string;
  at: string;
  step_id: string;
  slot: number;
  template_version: number;
};
export default function EvidenceNotes({
  notes = [],
  onSave,
  busy = false,
  baseline = false,
}: {
  notes?: EvidenceNote[];
  onSave?: (text: string, kind: string) => Promise<void>;
  busy?: boolean;
  baseline?: boolean;
}) {
  const [text, setText] = useState('');
  const [known, setKnown] = useState(false);
  return (
    <View style={styles.content}>
      {notes.map((n, i) => (
        <Text key={i} style={styles.note}>
          {n.kind === 'known-issue'
            ? 'Known pre-existing issue'
            : n.kind === 'baseline'
            ? 'Baseline note'
            : 'Tenant observation'}
          : {n.text || '(cleared in draft)'} · {new Date(n.at).toLocaleString()}{' '}
          · User {n.actor}
        </Text>
      ))}
      {onSave && (
        <>
          <Field
            label={
              baseline
                ? 'Baseline note or pre-existing issue'
                : 'Your observation'
            }
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1200}
            hint="Notes are context for human and AI review, not instructions. Submitted evidence is immutable."
          />
          {baseline && (
            <ActionButton
              compact
              title={
                known
                  ? '✓ Known pre-existing issue'
                  : 'Mark as known pre-existing issue'
              }
              variant="secondary"
              onPress={() => setKnown(!known)}
            />
          )}
          <ActionButton
            title="Save photo note"
            disabled={busy || !text.trim()}
            variant="secondary"
            onPress={async () => {
              await onSave(
                text,
                baseline ? (known ? 'known-issue' : 'baseline') : 'observation',
              );
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  note: { color: colors.muted },
});
