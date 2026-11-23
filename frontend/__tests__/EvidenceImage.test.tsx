import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Image } from 'react-native';
import EvidenceImage from '../src/components/EvidenceImage';

it('shows a recoverable failure and retries the same authenticated evidence URL', async () => {
  const source = {
    uri: 'http://localhost/api/guided-inspections/record/photos/photo/',
  };
  let app!: ReactTestRenderer;
  await act(async () => {
    app = create(
      <EvidenceImage source={source} accessibilityLabel="Saved evidence" />,
    );
  });
  await act(async () => {
    app.root.findByType(Image).props.onError();
  });
  expect(JSON.stringify(app.toJSON())).toContain('Photo unavailable');
  await act(async () => {
    app.root
      .findAll(
        n =>
          n.props.accessibilityLabel === 'Retry Saved evidence' &&
          typeof n.props.onPress === 'function',
      )[0]
      .props.onPress();
  });
  expect(app.root.findByType(Image).props.source).toEqual(source);
  expect(JSON.stringify(app.toJSON())).not.toContain('Photo unavailable');
  await act(async () => {
    app.unmount();
  });
});
