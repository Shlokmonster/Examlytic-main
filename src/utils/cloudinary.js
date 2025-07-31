// src/utils/cloudinary.js

// Function to upload a file to Cloudinary using unsigned upload
// This requires a Cloudinary upload preset to be configured
// in the Cloudinary dashboard

export const uploadToCloudinary = async (file, userId, folder = 'examlytic/recordings') => {
  try {
    // Hardcoded values for testing - replace these with environment variables in production
    const cloudName = 'dn2h5nryg';
    const uploadPreset = 'examlytic_upload_preset';
    
    console.log('Using Cloudinary config:', { cloudName, uploadPreset, folder });

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
    
    console.log('Uploading to Cloudinary:', {
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

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Cloudinary upload failed:', {
        status: response.status,
        statusText: response.statusText,
        response: responseData
      });
      throw new Error(responseData.message || `Upload failed with status ${response.status}`);
    }

    console.log('Cloudinary upload successful:', {
      public_id: responseData.public_id,
      url: responseData.secure_url,
      duration: responseData.duration
    });

    return {
      url: responseData.secure_url,
      public_id: responseData.public_id,
      duration: responseData.duration || 0
    };
  } catch (error) {
    console.error('Error in uploadToCloudinary:', {
      error: error.message,
      stack: error.stack,
      userId,
      folder
    });
    throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
  }
};

// Note: For security reasons, file deletion should be handled on the server-side
// This is because it requires your Cloudinary API secret
// If you need to delete files, create an API endpoint on your backend to handle this