export function readImageFileAsDataUrl(file: File, onLoad: (result: string) => void): void {
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

      if (img.width <= 900 && img.height <= 900 && rawUrl.length < 280000) {
        onLoad(rawUrl);
        return;
      }
      let compressed = renderAt(900, 0.78);
      if (compressed.length > 420000) {
        compressed = renderAt(700, 0.62);
      }
      onLoad(compressed);
    };
    img.onerror = () => onLoad(rawUrl);
    img.src = rawUrl;
  };
  reader.readAsDataURL(file);
}
