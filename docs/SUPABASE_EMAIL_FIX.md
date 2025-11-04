# Fixing Supabase Email Sending Issue

## Problem
Getting "Unable to process request" (500) error when trying to send password reset emails.

## Root Cause
Supabase email sending is disabled or not configured in your project.

## Solution Steps 

### Step 1: Enable Email Sending
1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **Authentication** → **Email**
3. Enable the following:
   - ✅ **Enable email confirmations**
   - ✅ **Enable email change confirmations**
   - ✅ Ensure email templates exist

### Step 2: Configure Redirect URLs
1. Go to **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add:
   - `http://localhost:3000`
   - `http://localhost:3000/reset-password`
   - `http://localhost:3000/**` (wildcard for all routes)

### Step 3: Check Email Service Status
1. Go to **Settings** → **Auth** → **Email**
2. Verify email sending service is enabled
3. If using custom SMTP:
   - Go to **Settings** → **Auth** → **SMTP Settings**
   - Configure your SMTP credentials

### Step 4: Check Project Limits
- Free tier projects may have email sending limits
- Check **Settings** → **Usage** for any email-related restrictions
- Upgrade plan if needed

### Step 5: Verify Email Templates
1. Go to **Authentication** → **Email Templates**
2. Ensure these templates exist:
   - **Confirm signup**
   - **Magic Link**
   - **Change Email Address**
   - **Reset Password**

### Step 6: Test Email Sending
1. Go to **Authentication** → **Users**
2. Click on a user
3. Try **"Send magic link"** button
4. If this fails, the issue is with Supabase email configuration, not your code

## Alternative: Use Custom SMTP
If Supabase's default email service doesn't work:

1. Go to **Settings** → **Auth** → **SMTP Settings**
2. Enable **Custom SMTP**
3. Configure:
   - SMTP Host (e.g., `smtp.gmail.com`)
   - SMTP Port (e.g., `587`)
   - SMTP User (your email)
   - SMTP Password (app-specific password)
   - Sender Email
   - Sender Name

## Still Not Working?
1. Check Supabase status: https://status.supabase.com
2. Review email logs in **Logs** → **Email Logs**
3. Contact Supabase support with your project reference


