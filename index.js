import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const app = express();
const PORT = 3000;
const PASTES_DIR = './pastes';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

async function ensurePastesDir() {
  try {
    await fs.access(PASTES_DIR);
  } catch {
    await fs.mkdir(PASTES_DIR, { recursive: true });
  }
}

function generateId(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function generateShortId(content) {
  return generateId(content).substring(0, 8);
}

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Pastebin Lite</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        textarea { width: 100%; height: 300px; font-family: monospace; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; cursor: pointer; }
        button:hover { background: #0056b3; }
        .paste-link { margin-top: 20px; padding: 10px; background: #f8f9fa; border: 1px solid #dee2e6; }
    </style>
</head>
<body>
    <h1>Pastebin Lite</h1>
    <form action="/paste" method="POST">
        <textarea name="content" placeholder="Paste your content here..." required></textarea><br><br>
        <button type="submit">Create Paste</button>
    </form>
</body>
</html>
  `);
});

app.post('/paste', async (req, res) => {
  try {
    const { content } = req.body;
    const id = generateId(content);
    const shortId = generateShortId(content);
    const filename = `${id}.txt`;
    
    try {
      await fs.access(path.join(PASTES_DIR, filename));
    } catch {
      await fs.writeFile(path.join(PASTES_DIR, filename), content);
    }
    
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Paste Created</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        a { color: #007bff; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .url-info { margin: 10px 0; }
    </style>
</head>
<body>
    <div class="url-info">Full URL: <a href="/paste/${id}">${id}</a></div>
    <div class="url-info">Short URL: <a href="/s/${shortId}">${shortId}</a></div>
</body>
</html>
    `);
  } catch (error) {
    res.status(500).send('Error creating paste');
  }
});

app.get('/paste/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filename = `${id}.txt`;
    const content = await fs.readFile(path.join(PASTES_DIR, filename), 'utf-8');
    
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Paste ${id}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .paste-content { 
            background: #f8f9fa; 
            border: 1px solid #dee2e6; 
            padding: 15px; 
            white-space: pre-wrap; 
            font-family: monospace; 
            overflow-x: auto; 
        }
        a { color: #007bff; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>Paste ${id}</h1>
    <div class="paste-content">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <p><a href="/">← Create new paste</a></p>
</body>
</html>
    `);
  } catch (error) {
    res.status(404).send(`
<!DOCTYPE html>
<html>
<head>
    <title>Paste Not Found</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
    </style>
</head>
<body>
    <h1>Paste Not Found</h1>
    <p>The paste you're looking for doesn't exist.</p>
    <p><a href="/">← Go back home</a></p>
</body>
</html>
    `);
  }
});

app.get('/s/:shortId', async (req, res) => {
  try {
    const { shortId } = req.params;
    
    const files = await fs.readdir(PASTES_DIR);
    const matchingFile = files.find(file => file.startsWith(shortId) && file.endsWith('.txt'));
    
    if (!matchingFile) {
      return res.status(404).send(`
<!DOCTYPE html>
<html>
<head>
    <title>Paste Not Found</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
    </style>
</head>
<body>
    <h1>Paste Not Found</h1>
    <p>The paste you're looking for doesn't exist.</p>
    <p><a href="/">← Go back home</a></p>
</body>
</html>
      `);
    }
    
    const fullId = matchingFile.replace('.txt', '');
    res.redirect(`/paste/${fullId}`);
  } catch (error) {
    res.status(500).send('Error processing short URL');
  }
});

app.get('/raw/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filename = `${id}.txt`;
    const content = await fs.readFile(path.join(PASTES_DIR, filename), 'utf-8');
    
    res.setHeader('Content-Type', 'text/plain');
    res.send(content);
  } catch (error) {
    res.status(404).send('Paste not found');
  }
});

async function startServer() {
  await ensurePastesDir();
  app.listen(PORT, () => {
    console.log(`Pastebin server running at http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);

