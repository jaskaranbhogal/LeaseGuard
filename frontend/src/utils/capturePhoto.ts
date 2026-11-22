import { Alert } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

export async function capturePhoto(): Promise<string | null> {
  try {
    const result = await launchCamera({
      mediaType: 'photo',
      cameraType: 'back',
      saveToPhotos: false,
      quality: 0.8,
    });
    if (result.didCancel) return null;
    if (result.errorCode) {
      Alert.alert(
        'Camera unavailable',
        result.errorCode === 'camera_unavailable'
          ? 'This device has no camera available.'
          : 'Allow camera access in your settings and try again.',
      );
      return null;
    }
    return result.assets?.[0]?.uri ?? null;
  } catch {
    Alert.alert('Camera unavailable', 'Unable to open the camera. Try again.');
    return null;
  }
}

export async function choosePhoto(): Promise<string | null> {
  try {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.8,
    });
    if (result.didCancel) return null;
    if (result.errorCode) {
      Alert.alert(
        'Photos unavailable',
        'Allow photo access in your settings and try again.',
      );
      return null;
    }
    return result.assets?.[0]?.uri ?? null;
  } catch {
    Alert.alert('Photos unavailable', 'Unable to open your photos. Try again.');
    return null;
  }
}
