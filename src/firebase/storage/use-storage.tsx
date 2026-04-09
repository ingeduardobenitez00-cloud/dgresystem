'use client';

import { useState } from 'react';
import { ref, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
import { useFirebase } from '@/firebase';

export function useStorage() {
  const { storage } = useFirebase();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Uploads a Base64 string or File to Firebase Storage and returns the download URL.
   * Path should be something like 'solicitudes/id_registro/foto.jpg'
   */
  const uploadFile = async (path: string, data: string | File): Promise<string> => {
    if (!storage) throw new Error('Storage service not initialized');
    
    setIsUploading(true);
    setError(null);
    
    try {
      const storageRef = ref(storage, path);
      
      if (typeof data === 'string' && data.startsWith('data:')) {
        // Handle Base64 strings (like from canvas or camera)
        // We need to extract the raw base64 part
        const base64Content = data.split(',')[1];
        const contentType = data.split(';')[0].split(':')[1];
        
        await uploadString(storageRef, base64Content, 'base64', {
          contentType: contentType
        });
      } else if (data instanceof File) {
        // Handle File objects from <input type="file" />
        await uploadBytes(storageRef, data);
      } else {
        throw new Error('Invalid data format for upload');
      }
      
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (err: any) {
      setError(err);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading, error };
}
