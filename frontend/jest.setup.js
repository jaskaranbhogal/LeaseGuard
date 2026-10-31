/* eslint-env jest */
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';
jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

// Native picker UI is outside Jest; tests control its responses.
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

// Native OAuth UI is outside Jest; feature tests mock the service response.
jest.mock('react-native-app-auth', () => ({ authorize: jest.fn() }));
