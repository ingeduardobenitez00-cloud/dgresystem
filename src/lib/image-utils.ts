/**
 * Utility for image compression and resizing before upload.
 * Standardizes quality to 0.4 (40%) and maximum width to 800px.
 */

export const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Don't compress PDFs, just read them as Data URLs
      if (file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; 
          const scaleSize = Math.min(1, MAX_WIDTH / img.width);
          
          canvas.width = img.width * scaleSize;
          canvas.height = img.height * scaleSize;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Could not get canvas context'));
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Quality 0.4 as requested for storage optimization
          resolve(canvas.toDataURL('image/jpeg', 0.4));
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
};

/**
 * Captures a frame from a video element and compresses it.
 */
export const captureVideoFrame = (videoElement: HTMLVideoElement): string => {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    ctx.drawImage(videoElement, 0, 0);
    // Quality 0.4 as requested
    return canvas.toDataURL('image/jpeg', 0.4);
};
