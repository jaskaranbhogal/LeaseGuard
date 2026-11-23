import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';
import EvidenceNotes from '../src/components/EvidenceNotes';
import ActionButton from '../src/components/ActionButton';
it('bounds notes and submits the selected baseline context kind', async () => {
  const save = jest.fn(async () => {});
  let app!: ReactTestRenderer;
  await act(async () => {
    app = create(<EvidenceNotes baseline onSave={save} />);
  });
  expect(app.root.findByType(TextInput).props.maxLength).toBe(1200);
  await act(async () =>
    app.root.findByType(TextInput).props.onChangeText('Existing scuff'),
  );
  await act(async () =>
    app.root.findAllByType(ActionButton)[0].props.onPress(),
  );
  await act(async () =>
    app.root.findAllByType(ActionButton)[1].props.onPress(),
  );
  expect(save).toHaveBeenCalledWith('Existing scuff', 'known-issue');
  await act(async () => app.unmount());
});
it('renders submitted notes with actor/timestamp without editing controls', async () => {
  let app!: ReactTestRenderer;
  await act(async () => {
    app = create(
      <EvidenceNotes
        notes={[
          {
            text: '<script>untrusted</script>',
            kind: 'observation',
            actor: 'tenant-id',
            at: '2026-11-21T12:00:00Z',
            step_id: 'entry',
            slot: 0,
            template_version: 1,
          },
        ]}
      />,
    );
  });
  expect(app.root.findAllByType(TextInput)).toHaveLength(0);
  expect(JSON.stringify(app.toJSON())).toContain('tenant-id');
  expect(JSON.stringify(app.toJSON())).toContain('untrusted');
  await act(async () => app.unmount());
});
