import { compressImageToBlob } from './imageUtils';

export interface CloudinarySignatureResponse {
  signature: string;
  timestamp: number;
  folder: string;
  publicId: string;
  cloudName: string;
  apiKey: string;
}

/**
 * Format any profile photo URL with Cloudinary's dynamic optimization and face-detection transformation rules.
 * If the URL is not from Cloudinary (e.g. legacy Firebase Storage or Data URL), it is returned untouched.
 */
export function getOptimizedCloudinaryUrl(
  url: string | null | undefined,
  width = 400,
  height = 400
): string {
  if (!url || typeof url !== 'string' || !url.trim()) return '';

  const cleanUrl = url.trim();

  // If it is a Cloudinary URL, inject dynamic auto-format, quality, and face-detection crop parameters
  if (cleanUrl.includes('res.cloudinary.com') || cleanUrl.includes('cloudinary.com')) {
    const transformationString = `f_auto,q_auto,c_fill,g_face,w_${width},h_${height}`;

    if (cleanUrl.includes('/image/upload/')) {
      // Avoid duplicating transformations if already applied
      if (cleanUrl.includes('/f_auto,q_auto')) {
        return cleanUrl;
      }
      return cleanUrl.replace('/image/upload/', `/image/upload/${transformationString}/`);
    }
  }

  // Fallback for legacy Firebase Storage URLs, base64 Data URLs, or external images
  return cleanUrl;
}

/**
 * Requests a short-lived authenticated upload signature from the secure backend endpoint.
 * Requires the user's current Firebase ID Token.
 */
export async function fetchCloudinarySignature(idToken: string): Promise<CloudinarySignatureResponse> {
  const response = await fetch('/api/cloudinary-signature', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Server signature request failed with status ${response.status}`);
  }

  return await response.json();
}

/**
 * Compresses photo to <= 1024px longest side, targets 100-250KB WebP, gets signature from backend,
 * and uploads signed bytes directly to Cloudinary API.
 */
export async function uploadPhotoToCloudinary(
  file: File,
  idToken: string
): Promise<string> {
  const t0 = performance.now();
  console.log('[Cloudinary] Starting photo compression & authenticated signed upload...');

  // 1. Validate raw file size (limit 5 MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Photo size must be less than 5 MB.');
  }

  // 2. Validate format
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (file.type && !validTypes.includes(file.type.toLowerCase())) {
    throw new Error('Please select a valid image file (JPG, PNG, or WebP).');
  }

  // 3. Client-side compression (longest side 1024px, 80% quality, WebP target)
  const compressedBlob = await compressImageToBlob(file, 1024, 0.80);
  console.log(`[Cloudinary] Compressed ${(file.size / 1024).toFixed(1)}KB -> ${(compressedBlob.size / 1024).toFixed(1)}KB in ${(performance.now() - t0).toFixed(1)}ms`);

  // 4. Get signature from backend
  const tSig0 = performance.now();
  const sigData = await fetchCloudinarySignature(idToken);
  console.log(`[Cloudinary] Signature generated in ${(performance.now() - tSig0).toFixed(1)}ms`);

  // 5. Build signed multipart form data for Cloudinary upload
  const formData = new FormData();
  const fileExt = compressedBlob.type.includes('webp') ? 'webp' : 'jpg';
  formData.append('file', compressedBlob, `profile.${fileExt}`);
  formData.append('api_key', sigData.apiKey);
  formData.append('timestamp', String(sigData.timestamp));
  formData.append('signature', sigData.signature);
  formData.append('folder', sigData.folder);
  if (sigData.publicId) {
    formData.append('public_id', sigData.publicId);
  }

  const cloudName = sigData.cloudName || import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'garba-saathi';
  const cloudinaryUploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  // 6. Post bytes to Cloudinary API
  const tUp0 = performance.now();
  const uploadRes = await fetch(cloudinaryUploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    const errorJson = await uploadRes.json().catch(() => ({}));
    console.error('[Cloudinary Upload Error]', errorJson);
    throw new Error(errorJson.error?.message || `Cloudinary upload failed (${uploadRes.status})`);
  }

  const result = await uploadRes.json();
  const totalMs = (performance.now() - t0).toFixed(1);
  console.log(`[Cloudinary] Upload success in ${totalMs}ms! Secure URL:`, result.secure_url);

  return result.secure_url;
}
