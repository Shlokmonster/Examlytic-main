// src/utils/cloudinary.js

// Function to upload a file to Cloudinary using unsigned upload
// This requires a Cloudinary upload preset to be configured
// in the Cloudinary dashboard

export const uploadToCloudinary = (file, userId, folder = 'examlytic/recordings', onProgress) => {
  return new Promise((resolve, reject) => {
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dn2h5nryg';
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOUD_PRESET || 'examlytic_upload_preset';
      
      console.log('Using Cloudinary config:', { cloudName, uploadPreset, folder });

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
      
      console.log('Uploading to Cloudinary via XHR:', {
        cloudName,
        uploadPreset,
        folder,
        fileSize: file.size,
        fileType: file.type
      });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', folder);
      formData.append('resource_type', 'video');
      formData.append('public_id', `exam_${Date.now()}_${userId}`);
      formData.append('tags', ['examlytic', 'recording', `user_${userId}`]);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl, true);

      // Track progress percentage
      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onProgress(percentComplete);
          }
        };
      }

      xhr.onload = () => {
        try {
          const responseData = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('Cloudinary upload successful:', responseData.secure_url);
            resolve({
              url: responseData.secure_url,
              public_id: responseData.public_id,
              duration: responseData.duration || 0
            });
          } else {
            console.error('Cloudinary upload failed:', responseData);
            reject(new Error(responseData.error?.message || `Upload failed with status ${xhr.status}`));
          }
        } catch (err) {
          reject(new Error('Failed to parse Cloudinary response'));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during Cloudinary upload'));
      };

      xhr.send(formData);
    } catch (error) {
      reject(error);
    }
  });
};