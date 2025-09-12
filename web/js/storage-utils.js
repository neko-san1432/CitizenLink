// Supabase Storage Utilities for CitizenLink
// Handles file uploads to the 'complaint-evidence' bucket

class StorageManager {
  constructor() {
    this.bucketName = 'complaint-evidence';
    this.supabase = null;
    this._ready = false;
  }

  // Initialize storage manager with Supabase client
  async initialize() {
    try {
      if (window.supabaseManager && window.supabaseManager.initialize) {
        this.supabase = await window.supabaseManager.initialize();
        this._ready = true;
        console.log('✅ StorageManager initialized with bucket:', this.bucketName);
        return this.supabase;
      } else {
        throw new Error('Supabase manager not available');
      }
    } catch (error) {
      console.error('❌ Error initializing StorageManager:', error);
      throw error;
    }
  }

  // Check if storage is ready
  isReady() {
    return this._ready && this.supabase !== null;
  }

  // Generate unique file path for complaint evidence
  generateFilePath(complaintId, fileName, fileType) {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = fileName.split('.').pop();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Simple path: just the file path within the bucket
    return `${complaintId}/${timestamp}_${randomId}_${sanitizedFileName}`;
  }

  // Upload single file to Supabase Storage
  async uploadFile(file, complaintId, onProgress = null) {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      const fileType = this.getFileTypeCategory(file);
      const filePath = this.generateFilePath(complaintId, file.name, fileType);
      
      console.log('📤 Uploading file:', {
        name: file.name,
        size: file.size,
        type: fileType,
        path: filePath
      });

      // Upload file to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('❌ Upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL for the uploaded file
      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      const fileInfo = {
        name: file.name,
        type: fileType,
        mimeType: file.type,
        size: file.size,
        path: filePath, // Just the path within bucket
        storage_path: filePath, // Same as path - simple!
        url: urlData.publicUrl,
        uploadedAt: new Date().toISOString()
      };

      console.log('✅ File uploaded successfully:', fileInfo);
      return fileInfo;

    } catch (error) {
      console.error('❌ Error uploading file:', error);
      throw error;
    }
  }

  // Upload multiple files
  async uploadFiles(files, complaintId, onProgress = null) {
    if (!Array.isArray(files) || files.length === 0) {
      return [];
    }

    const uploadPromises = files.map((file, index) => 
      this.uploadFile(file, complaintId, (progress) => {
        if (onProgress) {
          onProgress(index, progress);
        }
      })
    );

    try {
      const results = await Promise.all(uploadPromises);
      console.log(`✅ Successfully uploaded ${results.length} files`);
      return results;
    } catch (error) {
      console.error('❌ Error uploading files:', error);
      throw error;
    }
  }

  // Delete file from storage
  async deleteFile(filePath) {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        console.error('❌ Delete error:', error);
        throw new Error(`Delete failed: ${error.message}`);
      }

      console.log('✅ File deleted successfully:', filePath);
      return true;
    } catch (error) {
      console.error('❌ Error deleting file:', error);
      throw error;
    }
  }

  // Delete multiple files
  async deleteFiles(filePaths) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      return true;
    }

    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove(filePaths);

      if (error) {
        console.error('❌ Delete error:', error);
        throw new Error(`Delete failed: ${error.message}`);
      }

      console.log(`✅ Successfully deleted ${filePaths.length} files`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting files:', error);
      throw error;
    }
  }

  // Get file type category
  getFileTypeCategory(file) {
    const allowedTypes = {
      image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      video: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime', 'video/webm'],
      audio: ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/ogg']
    };

    if (allowedTypes.image.includes(file.type)) return 'image';
    if (allowedTypes.video.includes(file.type)) return 'video';
    if (allowedTypes.audio.includes(file.type)) return 'audio';
    return 'unknown';
  }

  // Get public URL for a file path
  getPublicUrl(filePath) {
    if (!this.isReady()) {
      throw new Error('Storage manager not initialized');
    }

    const { data } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  // Create a long-lived signed URL (default ~10 years)
  async getSignedUrl(filePath, expiresInSeconds = 315360000) {
    if (!this.isReady()) {
      await this.initialize();
    }

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(filePath, expiresInSeconds);
    if (error) throw error;
    return data?.signedUrl || null;
  }

  // List files in a complaint folder
  async listComplaintFiles(complaintId) {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .list(`complaints/${complaintId}`, {
          limit: 100,
          offset: 0
        });

      if (error) {
        console.error('❌ List error:', error);
        throw new Error(`List failed: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error listing files:', error);
      throw error;
    }
  }
}

// Create global instance
window.storageManager = new StorageManager();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
