/* eslint-env jest */
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';
jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

// Native picker UI is outside Jest; tests control its responses.
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

// Firebase SDKs use native modules and are exercised through mocked responses.
jest.mock('@react-native-firebase/auth', () => {
  const instance = {
    currentUser: null,
  };
  return {
    getAuth: jest.fn(() => instance),
    onAuthStateChanged: jest.fn((_auth, callback) => {
      callback(null);
      return jest.fn();
    }),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signInWithCredential: jest.fn(),
    linkWithCredential: jest.fn(),
    sendEmailVerification: jest.fn(),
    updateProfile: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    reload: jest.fn(),
    signOut: jest.fn(),
    GoogleAuthProvider: { credential: jest.fn(() => 'google-credential') },
    __mockAuthInstance: instance,
  };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn().mockResolvedValue(null),
  },
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));
