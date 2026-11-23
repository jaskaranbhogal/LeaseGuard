import type { Asset } from 'react-native-image-picker';

// The iOS picker builds its MIME type from the extension and returns image/jpg.
// Use the standard JPEG MIME type for both selection validation and multipart I/O.
export function normalizePhotoAsset(asset: Asset): Asset {
  const type = asset.type?.trim().toLowerCase();
  return { ...asset, type: type === 'image/jpg' ? 'image/jpeg' : type };
}
