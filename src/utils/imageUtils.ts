export const compressImageToBlob = (
  file: File,
  maxSide = 1024,
  initialQuality = 0.80
): Promise<Blob> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Preserve original aspect ratio; scale longest side to maxSide
        if (width > maxSide || height > maxSide) {
          if (width >= height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        // Draw image keeping original proportions (no stretching, cropping, or distorting)
        ctx.drawImage(img, 0, 0, width, height);

        // Try outputting webp first, with target size logic (100-250KB where practical)
        const tryEncode = (mimeType: string, quality: number): Promise<Blob | null> => {
          return new Promise((res) => {
            try {
              canvas.toBlob(
                (blob) => res(blob),
                mimeType,
                quality
              );
            } catch {
              res(null);
            }
          });
        };

        (async () => {
          let blob = await tryEncode('image/webp', initialQuality);
          // Fallback to jpeg if webp isn't created or returned null
          if (!blob || blob.type !== 'image/webp') {
            blob = await tryEncode('image/jpeg', initialQuality);
          }

          if (!blob) {
            resolve(file);
            return;
          }

          // If blob is still larger than 250KB and > 300KB, attempt second pass with 0.72 quality
          if (blob.size > 250 * 1024) {
            const secondBlob = await tryEncode(blob.type, 0.72);
            if (secondBlob && secondBlob.size < blob.size) {
              blob = secondBlob;
            }
          }

          // Never upload larger than original if original was already smaller
          if (blob.size >= file.size) {
            resolve(file);
          } else {
            resolve(blob);
          }
        })();
      };

      img.onerror = () => resolve(file);
      img.src = (e.target?.result as string) || '';
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

export const fileToCompressedDataUrl = (
  file: File,
  maxSide = 1024,
  initialQuality = 0.80
): Promise<string> => {
  return new Promise((resolve) => {
    compressImageToBlob(file, maxSide, initialQuality).then((blob) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  });
};
