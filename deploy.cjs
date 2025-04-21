#!/usr/bin/env node
/**
 * Emergency deployment script for Render.com
 * Simple copy approach without build tools
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== EMERGENCY DEPLOYMENT SCRIPT ===');

// 1. Install essential dependencies
console.log('1. Installing essential dependencies...');
try {
  execSync('npm install express @neondatabase/serverless dotenv ws bcrypt', {
    stdio: 'inherit'
  });
  console.log('✅ Essential dependencies installed');
} catch (err) {
  console.error('Error installing dependencies:', err);
}

// 2. Create dist directory
console.log('2. Setting up server code...');
try {
  // Create dist directory if it doesn't exist
  if (!fs.existsSync('./dist')) {
    fs.mkdirSync('./dist', { recursive: true });
  }

  console.log('✅ Server structure created');
} catch (err) {
  console.error('Error setting up server structure:', err);
  process.exit(1);
}

// 3. Create ES Module compatible server file
console.log('3. Creating server code...');
try {
  // Create an index.js file using ES module syntax
  const serverIndexJs = `
// Generated server index.js for production
import express from 'express';
import path from 'path';
import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Serve static files from the public directory
app.use(express.static('public'));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Session handling
app.use(express.urlencoded({ extended: true }));
const sessionSecret = process.env.SESSION_SECRET || 'default_session_secret_for_development';
const sessions = {};

// Basic auth functions
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return \`\${hash}.\${salt}\`;
}

async function verifyPassword(inputPassword, storedPassword) {
  const [hash, salt] = storedPassword.split('.');
  const inputHash = crypto.pbkdf2Sync(inputPassword, salt, 1000, 64, 'sha512').toString('hex');
  return hash === inputHash;
}

// Authentication routes
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    
    if (!user || !(await verifyPassword(password, user.password))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // Create session
    const sessionId = crypto.randomBytes(32).toString('hex');
    sessions[sessionId] = { userId: user.id, username: user.username };
    
    res.cookie('session_id', sessionId, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ id: user.id, username: user.username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/logout', (req, res) => {
  const sessionId = req.cookies?.session_id;
  if (sessionId && sessions[sessionId]) {
    delete sessions[sessionId];
  }
  res.clearCookie('session_id');
  res.status(200).send('Logged out');
});

app.get('/api/user', (req, res) => {
  const sessionId = req.cookies?.session_id;
  if (sessionId && sessions[sessionId]) {
    res.json({ id: sessions[sessionId].userId, username: sessions[sessionId].username });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// API routes
app.get('/api/articles', async (req, res) => {
  try {
    const limit = req.query.limit || 20;
    const result = await pool.query('SELECT * FROM articles ORDER BY id DESC LIMIT $1', [limit]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/articles/featured', async (req, res) => {
  try {
    const limit = req.query.limit || 1;
    const result = await pool.query('SELECT * FROM articles WHERE featured = true ORDER BY id DESC LIMIT $1', [limit]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching featured articles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/articles/popular', async (req, res) => {
  try {
    const limit = req.query.limit || 5;
    const result = await pool.query('SELECT * FROM articles ORDER BY views DESC LIMIT $1', [limit]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching popular articles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/tags', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tags ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Catch-all route for SPA
app.get('/*', (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'public/index.html'));
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
  console.log(\`Environment: \${process.env.NODE_ENV}\`);
});
`;
  
  fs.writeFileSync('./dist/index.js', serverIndexJs);
  console.log('✅ Server code created using ES modules');
} catch (err) {
  console.error('Error creating server code:', err);
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
  <title>yourbuzzfeed</title>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8333936306401310" crossorigin="anonymous"></script>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="root">
    <div class="app-layout">
      <header>
        <nav>
          <div class="logo">
            <a href="/"><h1>yourbuzzfeed</h1></a>
          </div>
          <div class="nav-links">
            <a href="/">Home</a>
            <a href="/category/technology">Technology</a>
            <a href="/category/health">Health</a>
            <a href="/category/entertainment">Entertainment</a>
            <a href="/admin" class="admin-link">Admin</a>
          </div>
        </nav>
      </header>
      
      <main>
        <section class="hero">
          <div class="container">
            <h2>Latest Trending News & Content</h2>
            <p>Stay informed with the most current stories across various topics</p>
          </div>
        </section>
        
        <section class="articles">
          <div class="container">
            <h3>Featured Articles</h3>
            <div id="articles-container" class="articles-grid">
              <p class="loading">Loading articles...</p>
            </div>
          </div>
        </section>
        
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
        
        <section class="admin-info">
          <div class="container">
            <h3>Admin Access</h3>
            <p>To access the admin panel, click the Admin link in the navigation or type "admin" on your keyboard.</p>
            <p>Default credentials: username "admin" with password "admin123"</p>
          </div>
        </section>
      </main>
      
      <footer>
        <div class="container">
          <p>&copy; 2025 yourbuzzfeed. All rights reserved.</p>
        </div>
      </footer>
    </div>
  </div>
  
  <script src="/app.js"></script>
</body>
</html>`;

  // Create CSS file
  const cssStyles = `
/* Base styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #333;
  background: #f9f9f9;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

a {
  color: #0066cc;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* Header styles */
header {
  background: #fff;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
}

.logo h1 {
  color: #FF4500;
  font-size: 24px;
  margin: 0;
}

.nav-links {
  display: flex;
  gap: 20px;
}

.nav-links a {
  color: #333;
  font-weight: 500;
}

.nav-links a:hover {
  color: #FF4500;
}

.admin-link {
  color: #666;
  font-weight: 400;
}

/* Main content */
.hero {
  background: linear-gradient(135deg, #FF4500, #FF8C63);
  color: white;
  padding: 60px 0;
  text-align: center;
  margin-bottom: 30px;
}

.hero h2 {
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.articles {
  margin-bottom: 40px;
}

.articles h3 {
  font-size: 24px;
  margin-bottom: 20px;
  border-bottom: 2px solid #eee;
  padding-bottom: 10px;
}

.articles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.article-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.article-card img {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.article-card-content {
  padding: 15px;
}

.article-card h4 {
  font-size: 18px;
  margin-bottom: 10px;
}

.read-more {
  display: inline-block;
  margin-top: 10px;
  font-weight: 500;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.ad-unit {
  background: #f0f0f0;
  padding: 20px;
  text-align: center;
  margin: 30px 0;
  border: 1px solid #ddd;
}

.admin-info {
  background: #e8f4fc;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 40px;
}

.admin-info h3 {
  color: #0066cc;
  margin-bottom: 10px;
}

/* Footer */
footer {
  background: #333;
  color: #fff;
  padding: 30px 0;
  text-align: center;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  nav {
    flex-direction: column;
    gap: 15px;
  }
  
  .nav-links {
    width: 100%;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .hero h2 {
    font-size: 2rem;
  }
  
  .articles-grid {
    grid-template-columns: 1fr;
  }
}`;

  // Create JS file
  const appJs = `
// Main application script
document.addEventListener('DOMContentLoaded', function() {
  console.log('yourbuzzfeed application loaded');
  
  // Load articles
  fetchArticles();
  
  // Admin access shortcut
  let adminKeySequence = '';
  document.addEventListener('keydown', function(e) {
    adminKeySequence += e.key.toLowerCase();
    if (adminKeySequence.includes('admin')) {
      window.location.href = '/admin';
      adminKeySequence = '';
    }
    // Reset after 2 seconds of inactivity
    setTimeout(() => { adminKeySequence = ''; }, 2000);
  });
});

// Fetch articles from API
function fetchArticles() {
  fetch('/api/articles')
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch articles');
      }
      return response.json();
    })
    .then(articles => {
      renderArticles(articles);
    })
    .catch(error => {
      console.error('Error fetching articles:', error);
      document.getElementById('articles-container').innerHTML = \`
        <div class="error-message">
          <p>Failed to load articles.</p>
          <p>You can check the API directly: <a href="/api/articles">/api/articles</a></p>
        </div>
      \`;
    });
}

// Render articles to the page
function renderArticles(articles) {
  const container = document.getElementById('articles-container');
  
  if (!articles || articles.length === 0) {
    container.innerHTML = '<p>No articles found.</p>';
    return;
  }
  
  let html = '';
  
  articles.forEach(article => {
    html += \`
      <div class="article-card">
        <div class="article-card-content">
          <h4><a href="/article/\${article.slug}">\${article.title}</a></h4>
          <p>\${article.summary || article.content.substring(0, 100) + '...'}</p>
          <a href="/article/\${article.slug}" class="read-more">Read More</a>
        </div>
      </div>
    \`;
  });
  
  container.innerHTML = html;
}`;
  
  fs.writeFileSync('./public/index.html', indexHtml);
  fs.writeFileSync('./public/styles.css', cssStyles);
  fs.writeFileSync('./public/app.js', appJs);
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
