# 🔧 News Image Upload Fix - CitizenLink

## **Problem**
The news image upload feature is failing with the error:
```
Error: Upload failed: new row violates row-level security policy
```

This occurs because the Supabase Storage bucket `news-images` doesn't have proper Row Level Security (RLS) policies configured to allow LGU admin users to upload files.

## **Root Cause**
- The `news-images` storage bucket exists but lacks RLS policies
- LGU admin users (`lgu-admin-wst`, `lgu-admin-pnp`, etc.) don't have upload permissions
- The current user `lgu-admin-wst` is authenticated but can't upload due to missing policies

## **Solution Options**

### **Option 1: Configure RLS Policies (Recommended)**

#### **Step 1: Create Storage Bucket**
In your Supabase dashboard:
1. Go to **Storage** → **Buckets**
2. Create a new bucket named `news-images`
3. Set it as **Public** (so images can be accessed via URL)

#### **Step 2: Set up RLS Policies**
Run these SQL commands in your Supabase SQL Editor:

```sql
-- Enable RLS on the storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy to allow LGU admins to upload news images
CREATE POLICY "Allow LGU admins to upload news images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'news-images' AND
  auth.role() = 'authenticated' AND
  (
    auth.jwt() ->> 'role' = 'lgu-admin-pnp' OR
    auth.jwt() ->> 'role' = 'lgu-admin-bfp' OR
    auth.jwt() ->> 'role' = 'lgu-admin-dpwh' OR
    auth.jwt() ->> 'role' = 'lgu-admin-hlt' OR
    auth.jwt() ->> 'role' = 'lgu-admin-wst' OR
    auth.jwt() ->> 'role' = 'superadmin'
  )
);

-- Policy to allow LGU admins to update news images
CREATE POLICY "Allow LGU admins to update news images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'news-images' AND
  auth.role() = 'authenticated' AND
  (
    auth.jwt() ->> 'role' = 'lgu-admin-pnp' OR
    auth.jwt() ->> 'role' = 'lgu-admin-bfp' OR
    auth.jwt() ->> 'role' = 'lgu-admin-dpwh' OR
    auth.jwt() ->> 'role' = 'lgu-admin-hlt' OR
    auth.jwt() ->> 'role' = 'lgu-admin-wst' OR
    auth.jwt() ->> 'role' = 'superadmin'
  )
);

-- Policy to allow LGU admins to delete news images
CREATE POLICY "Allow LGU admins to delete news images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'news-images' AND
  auth.role() = 'authenticated' AND
  (
    auth.jwt() ->> 'role' = 'lgu-admin-pnp' OR
    auth.jwt() ->> 'role' = 'lgu-admin-bfp' OR
    auth.jwt() ->> 'role' = 'lgu-admin-dpwh' OR
    auth.jwt() ->> 'role' = 'lgu-admin-hlt' OR
    auth.jwt() ->> 'role' = 'lgu-admin-wst' OR
    auth.jwt() ->> 'role' = 'superadmin'
  )
);

-- Policy to allow public read access to news images
CREATE POLICY "Allow public read access to news images" ON storage.objects
FOR SELECT USING (bucket_id = 'news-images');
```

#### **Step 3: Verify User Roles**
Make sure your LGU admin users have the correct role in their JWT token. Check the `auth.users` table and ensure the `raw_user_meta_data` contains the correct role:

```sql
-- Check user roles
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'department' as department
FROM auth.users 
WHERE raw_user_meta_data->>'role' LIKE 'lgu-admin-%';
```

### **Option 2: Temporary Workaround (Quick Fix)**

If you need an immediate fix, you can temporarily disable RLS for the news-images bucket:

```sql
-- TEMPORARY: Disable RLS for news-images bucket (NOT RECOMMENDED FOR PRODUCTION)
CREATE POLICY "Allow all authenticated users to upload news images" ON storage.objects
FOR ALL USING (bucket_id = 'news-images' AND auth.role() = 'authenticated');
```

**⚠️ Warning**: This is less secure and should only be used temporarily.

### **Option 3: Server-Side Upload (Advanced)**

The code has been updated to include a fallback server-side upload mechanism. To implement this:

1. **Add multer for file handling**:
```bash
npm install multer
```

2. **Update the server endpoint** in `web/server.js`:
```javascript
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/upload-news-image", upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    // Use Supabase service role for upload
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key
    );

    const { data, error } = await supabase.storage
      .from('news-images')
      .upload(req.body.path, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600'
      });

    if (error) {
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from('news-images')
      .getPublicUrl(req.body.path);

    res.json({
      url: urlData.publicUrl,
      path: req.body.path
    });
  } catch (error) {
    console.error("Error in news image upload:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});
```

## **Testing the Fix**

After implementing the RLS policies:

1. **Clear browser cache** and refresh the page
2. **Try uploading an image** in the news management section
3. **Check the browser console** for any remaining errors
4. **Verify the image appears** in the news article

## **Code Changes Made**

### **Updated Files:**
1. **`web/js/lgu-news.js`**:
   - Added fallback server-side upload mechanism
   - Enhanced error handling for RLS policy failures
   - Added `uploadViaServer()` function

2. **`web/server.js`**:
   - Added `/api/upload-news-image` endpoint (placeholder)
   - Provides guidance for implementing server-side upload

## **Verification Steps**

1. **Check Storage Bucket**:
   ```sql
   SELECT * FROM storage.buckets WHERE name = 'news-images';
   ```

2. **Check RLS Policies**:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%news%';
   ```

3. **Test Upload**:
   - Go to LGU News Management
   - Click "Add News Article"
   - Try uploading an image
   - Check browser console for errors

## **Expected Result**

After implementing the RLS policies, the image upload should work successfully:
- ✅ No more "row-level security policy" errors
- ✅ Images upload to `news-images` bucket
- ✅ Public URLs are generated correctly
- ✅ Images display in news articles

## **Security Notes**

- The RLS policies ensure only authenticated LGU admins can upload
- Public read access allows images to be displayed to all users
- File paths are sanitized and include timestamps for uniqueness
- Images are stored with proper cache control headers

## **Troubleshooting**

If issues persist:

1. **Check user authentication**:
   ```javascript
   console.log('User role:', auth.jwt()?.role);
   ```

2. **Verify bucket exists**:
   ```sql
   SELECT * FROM storage.buckets;
   ```

3. **Check policy syntax**:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'objects';
   ```

4. **Test with different user roles** to isolate the issue

---

**Need Help?** If you continue to experience issues, check the Supabase logs in your dashboard for more detailed error messages.
