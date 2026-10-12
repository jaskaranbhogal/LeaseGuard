import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Image, TextInput } from 'react-native';
import App from '../App';

it('renders Loading, then the real Login screen', async () => {
  jest.useFakeTimers();
  let app!: ReactTestRenderer;
  await act(async () => {
    app = create(<App />);
  });
  expect(JSON.stringify(app.toJSON())).toContain('Loading LeaseGuard');
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
  expect(app.root.findAllByType(TextInput)).toHaveLength(0);
  await act(async () => {
    app.root.findByType(Image).props.onLoadEnd();
  });
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
  expect(app.root.findAllByType(TextInput)).toHaveLength(2);
  expect(JSON.stringify(app.toJSON())).toContain('Welcome back');
  await act(async () => {
    app.unmount();
  });
  jest.useRealTimers();
});
