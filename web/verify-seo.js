#!/usr/bin/env node

/**
 * SEO Verification Script for CitizenLink
 * This script checks if all SEO elements are properly implemented
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 SEO Verification for CitizenLink\n');

// Check if required files exist
const requiredFiles = [
  'index.html',
  'sitemap.xml',
  'robots.txt',
  'site.webmanifest'
];

const requiredImages = [
  'images/og-image.jpg',
  'images/logo.png',
  'favicon.ico',
  'favicon-32x32.png',
  'favicon-16x16.png',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png'
];

const requiredDirectories = [
  'images'
];

console.log('📁 Checking required files and directories...\n');

// Check directories
requiredDirectories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (fs.existsSync(dirPath)) {
    console.log(`✅ Directory: ${dir}`);
  } else {
    console.log(`❌ Missing directory: ${dir}`);
  }
});

console.log('');

// Check files
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ File: ${file}`);
  } else {
    console.log(`❌ Missing file: ${file}`);
  }
});

console.log('');

// Check images
requiredImages.forEach(image => {
  const imagePath = path.join(__dirname, image);
  if (fs.existsSync(imagePath)) {
    console.log(`✅ Image: ${image}`);
  } else {
    console.log(`❌ Missing image: ${image}`);
  }
});

console.log('\n🔍 Checking HTML content...\n');

// Check HTML content for SEO elements
try {
  const htmlPath = path.join(__dirname, 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  
  const seoChecks = [
    { name: 'Title tag', pattern: /<title>.*<\/title>/i, required: true },
    { name: 'Meta description', pattern: /<meta name="description"/i, required: true },
    { name: 'Meta keywords', pattern: /<meta name="keywords"/i, required: true },
    { name: 'Canonical URL', pattern: /<link rel="canonical"/i, required: true },
    { name: 'Open Graph tags', pattern: /<meta property="og:/i, required: true },
    { name: 'Twitter Card tags', pattern: /<meta property="twitter:/i, required: true },
    { name: 'Structured data', pattern: /<script type="application\/ld\+json">/i, required: true },
    { name: 'Favicon links', pattern: /<link rel="icon"/i, required: true },
    { name: 'Web app manifest', pattern: /<link rel="manifest"/i, required: true },
    { name: 'Preconnect links', pattern: /<link rel="preconnect"/i, required: true }
  ];
  
  seoChecks.forEach(check => {
    if (check.pattern.test(htmlContent)) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name}`);
    }
  });
  
} catch (error) {
  console.log(`❌ Error reading HTML file: ${error.message}`);
}

console.log('\n🔍 Checking sitemap...\n');

// Check sitemap content
try {
  const sitemapPath = path.join(__dirname, 'sitemap.xml');
  const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');
  
  const sitemapChecks = [
    { name: 'XML declaration', pattern: /<\?xml version="1\.0"/i, required: true },
    { name: 'URL set namespace', pattern: /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/i, required: true },
    { name: 'Homepage URL', pattern: /https:\/\/citizenlink-abwi\.onrender\.com\//i, required: true },
    { name: 'Last modified dates', pattern: /<lastmod>/i, required: true },
    { name: 'Change frequency', pattern: /<changefreq>/i, required: true },
    { name: 'Priority values', pattern: /<priority>/i, required: true }
  ];
  
  sitemapChecks.forEach(check => {
    if (check.pattern.test(sitemapContent)) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name}`);
    }
  });
  
} catch (error) {
  console.log(`❌ Error reading sitemap: ${error.message}`);
}

console.log('\n🔍 Checking robots.txt...\n');

// Check robots.txt content
try {
  const robotsPath = path.join(__dirname, 'robots.txt');
  const robotsContent = fs.readFileSync(robotsPath, 'utf8');
  
  const robotsChecks = [
    { name: 'User-agent directive', pattern: /User-agent: \*/i, required: true },
    { name: 'Allow directive', pattern: /Allow: \//i, required: true },
    { name: 'Sitemap location', pattern: /Sitemap:/i, required: true },
    { name: 'Disallow admin', pattern: /Disallow: \/admin\//i, required: true },
    { name: 'Disallow API', pattern: /Disallow: \/api\//i, required: true }
  ];
  
  robotsChecks.forEach(check => {
    if (check.pattern.test(robotsContent)) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name}`);
    }
  });
  
} catch (error) {
  console.log(`❌ Error reading robots.txt: ${error.message}`);
}

console.log('\n📊 SEO Implementation Summary\n');
console.log('=====================================');
console.log('✅ = Implemented');
console.log('❌ = Missing or needs attention');
console.log('\n🎯 Next Steps:');
console.log('1. Create missing images (see images/README.md)');
console.log('2. Set up Google Search Console');
console.log('3. Set up Google Analytics');
console.log('4. Submit sitemap to search engines');
console.log('5. Monitor indexing progress');

console.log('\n📚 For detailed instructions, see SEO-CHECKLIST.md');
console.log('🚀 Your website should be searchable within 1-2 weeks!');
