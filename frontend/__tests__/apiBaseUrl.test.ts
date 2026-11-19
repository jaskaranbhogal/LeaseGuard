const mockSourceCode: {
  scriptURL?: string;
  getConstants?: () => { scriptURL: string };
} = {};

jest.mock('react-native', () => ({
  NativeModules: { SourceCode: mockSourceCode },
  Platform: { OS: 'ios' },
}));

function backendUrl() {
  let url = '';
  jest.isolateModules(() => {
    url = require('../src/services/api').API_BASE_URL;
  });
  return url;
}

afterEach(() => {
  delete mockSourceCode.scriptURL;
  delete mockSourceCode.getConstants;
});

test('physical iPhone uses the Metro host from New Architecture constants', () => {
  mockSourceCode.getConstants = () => ({
    scriptURL: 'http://192.168.1.178:8081/index.bundle?platform=ios',
  });
  expect(backendUrl()).toBe('http://192.168.1.178:8000/api');
});

test('legacy SourceCode constants still resolve the physical-device backend', () => {
  mockSourceCode.scriptURL = 'http://192.168.1.178:8081/index.bundle';
  expect(backendUrl()).toBe('http://192.168.1.178:8000/api');
});

test('simulator retains the localhost backend', () => {
  mockSourceCode.getConstants = () => ({ scriptURL: 'http://localhost:8081/index.bundle' });
  expect(backendUrl()).toBe('http://localhost:8000/api');
});
