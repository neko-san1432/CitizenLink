# CitizenLink - Render Deployment Guide

## Pre-compression Setup for Render

This project is optimized for Render deployment with pre-compression for maximum performance.

## How Pre-compression Works

1. **Build Time**: Files are compressed once during the build process
2. **Runtime**: Server serves pre-compressed `.gz` files when available
3. **Fallback**: Falls back to runtime compression for non-precompressed files

## Render Configuration

### Build Command
```bash
npm install && npm run build
```

### Start Command
```bash
npm start
```

### Environment Variables
- `NODE_ENV=production`
- `PORT=10000` (Render will override this)

## File Structure After Build
```
web/
├── index.html
├── index.html.gz          ← Pre-compressed version
├── css/
│   ├── styles.css
│   └── styles.css.gz      ← Pre-compressed version
├── js/
│   ├── main.js
│   └── main.js.gz         ← Pre-compressed version
└── ...
```

## Performance Benefits

✅ **Faster Response Times**: No CPU overhead during requests  
✅ **Better Server Performance**: Less CPU usage per request  
✅ **Consistent Compression**: Same compression level every time  
✅ **Reduced Memory Usage**: No compression buffers in memory  
✅ **Better Caching**: Pre-compressed files cache more effectively  

## Deployment Steps

1. **Connect Repository**: Link your GitHub repo to Render
2. **Configure Service**: Use the provided `render.yaml` or manual setup
3. **Set Environment Variables**: Add your Supabase credentials
4. **Deploy**: Render will automatically run the build process

## Build Process Details

The build script (`build-script.js`) will:
- Compress all HTML, CSS, JS, JSON, XML, TXT, and SVG files
- Only compress files larger than 1KB
- Use gzip level 6 for optimal compression/speed balance
- Create `.gz` versions alongside original files

## Server Behavior

The server (`server.js`) will:
1. Check if client accepts gzip encoding
2. Look for pre-compressed `.gz` file
3. Serve pre-compressed file if available
4. Fall back to runtime compression if not available
5. Set appropriate headers for compressed content

## Monitoring Performance

After deployment, you can monitor:
- Response times in Render dashboard
- Bandwidth usage reduction
- CPU usage (should be lower with pre-compression)

## Troubleshooting

If you encounter issues:
1. Check Render build logs for compression errors
2. Verify all `.gz` files are created during build
3. Test with browser dev tools to see if compression is working
4. Check server logs for any compression-related errors

## Local Development

For local development:
```bash
npm run dev          # Start with file watching
npm run build        # Run pre-compression build
npm run deploy       # Full deployment process
```
