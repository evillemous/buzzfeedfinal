#!/usr/bin/env node
/**
 * Emergency deployment script for Render.com
 * Bypasses Vite and uses direct esbuild
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== EMERGENCY DEPLOYMENT SCRIPT ===');

// 1. Install essential dependencies
console.log('1. Installing essential dependencies...');
try {
  execSync('npm install esbuild express @neondatabase/serverless dotenv ws react', {
    stdio: 'inherit'
  });
  console.log('✅ Essential dependencies installed');
} catch (err) {
  console.error('Error installing dependencies:', err);
}

// 2. Build server directly with esbuild
console.log('2. Building server code...');
try {
  execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', {
    stdio: 'inherit'
  });
  console.log('✅ Server built successfully');
} catch (err) {
  console.error('Error building server:', err);
  process.exit(1);
}

// 3. Fix NewsAPI and other issues
console.log('3. Fixing server code issues...');
try {
  if (fs.existsSync('./dist/index.js')) {
    let serverCode = fs.readFileSync('./dist/index.js', 'utf8');
    
    // Fix 1: Disable NewsAPI
    serverCode = serverCode.replace(
      /https:\/\/newsapi\.org\/v2\/[^"']+/g,
      'https://example.com/disabled-newsapi'
    );
    
    // Fix 2: Add timestamp to slugs to prevent duplicates
    const slugFix = `
      const timestamp = Date.now().toString().slice(-6);
      let slug = slugify(title);
      if (slug.length > 80) {
        slug = slug.substring(0, 80);
      }
      slug = slug + "-" + timestamp;`;
    
    serverCode = serverCode.replace(
      /let\s+slug\s*=\s*slugify\(title\);(\s+if\s*\(\s*slug\.length\s*>\s*80\s*\)\s*\{\s*slug\s*=\s*slug\.substring\(0,\s*80\);\s*\})/g,
      slugFix
    );
    
    // Fix 3: Ensure static file serving
    if (!serverCode.includes('app.use(express.static')) {
      serverCode = serverCode.replace(
        /app\.use\(express\.json\(\)\);/,
        'app.use(express.json());\napp.use(express.static(path.join(process.cwd(), "public")));'
      );
    }
    
    fs.writeFileSync('./dist/index.js', serverCode);
    console.log('✅ Server code fixed');
  } else {
    console.error('Server code not found at ./dist/index.js');
  }
} catch (err) {
  console.error('Error fixing server code:', err);
}

// 4. Create simple public directory with landing page
console.log('4. Creating public directory...');
try {
  if (!fs.existsSync('./public')) {
    fs.mkdirSync('./public', { recursive: true });
  }
  
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>yourbuzzfeed API Server</title>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8333936306401310" crossorigin="anonymous"></script>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1 { color: #FF4500; }
    .panel {
      background: #f9f9f9;
      border-left: 4px solid #0066CC;
      padding: 15px 20px;
      margin: 20px 0;
    }
    .ad-unit {
      background: #f0f0f0;
      padding: 15px;
      text-align: center;
      margin: 20px 0;
      border: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <h1>yourbuzzfeed</h1>
  <div class="panel">
    <h2>API Server Running</h2>
    <p>The yourbuzzfeed API server is running successfully.</p>
    <p>Available endpoints:</p>
    <ul>
      <li><a href="/api/articles">/api/articles</a> - Get all articles</li>
      <li><a href="/api/categories">/api/categories</a> - Get all categories</li>
      <li><a href="/api/articles/featured">/api/articles/featured</a> - Get featured articles</li>
    </ul>
  </div>
  
  <div class="ad-unit">
    <ins class="adsbygoogle"
         style="display:block"
         data-ad-client="ca-pub-8333936306401310"
         data-ad-slot="1234567890"
         data-ad-format="auto"
         data-full-width-responsive="true"></ins>
    <script>
         (adsbygoogle = window.adsbygoogle || []).push({});
    </script>
  </div>
  
  <div class="panel">
    <h3>Admin Access</h3>
    <p>Admin interface is available at: <a href="/admin">/admin</a></p>
    <p>Default credentials: username "admin" with password "admin123"</p>
  </div>
</body>
</html>`;
  
  fs.writeFileSync('./public/index.html', indexHtml);
  console.log('✅ Created public files');
} catch (err) {
  console.error('Error creating public directory:', err);
}

// 5. Create .env file
console.log('5. Creating .env file...');
try {
  const envContent = `NODE_ENV=production
SESSION_SECRET=render_deployment_secret`;
  
  fs.writeFileSync('.env', envContent);
  console.log('✅ Created .env file');
} catch (err) {
  console.error('Error creating .env file:', err);
}

console.log('\n=== DEPLOYMENT SCRIPT COMPLETE ===');
console.log('For Render.com deployment:');
console.log('1. Build Command: node deploy.cjs');
console.log('2. Start Command: NODE_ENV=production node dist/index.js');
