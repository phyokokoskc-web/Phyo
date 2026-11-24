export interface ImageReadOptions {
  maxDim?: number;
  quality?: number;
  maxChars?: number;
}

export function readImageFileAsDataUrl(
  file: File,
  onLoad: (result: string) => void,
  options?: ImageReadOptions
): void {
  const targetMaxDim = options?.maxDim ?? 900;
  const targetQuality = options?.quality ?? 0.78;
  const targetMaxChars = options?.maxChars ?? 420000;

  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result !== 'string') return;
    const rawUrl = reader.result;
    const img = new Image();
    img.onload = () => {
      const renderAt = (maxDim: number, quality: number) => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return rawUrl;
        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL('image/jpeg', quality);
      };

      if (
        img.width <= targetMaxDim &&
        img.height <= targetMaxDim &&
        rawUrl.length <= Math.min(280000, targetMaxChars)
      ) {
        onLoad(rawUrl);
        return;
      }

      let compressed = renderAt(targetMaxDim, targetQuality);
      if (compressed.length > targetMaxChars) {
        compressed = renderAt(Math.min(targetMaxDim, 680), Math.min(targetQuality, 0.62));
      }
      if (compressed.length > targetMaxChars) {
        compressed = renderAt(Math.min(targetMaxDim, 540), 0.52);
      }
      onLoad(compressed);
    };
    img.onerror = () => onLoad(rawUrl);
    img.src = rawUrl;
  };
  reader.readAsDataURL(file);
}
