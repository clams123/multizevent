import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = await loadEnv(path.join(__dirname, '.env'));

const PORT = Number(env.PORT || 3030);
const PUBLIC_DIR = path.join(__dirname, 'public');
const CHANNELS_PATH = path.join(__dirname, 'data', 'channels.json');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/channels.json') {
      return sendJson(res, await readChannelList());
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    sendText(res, 'Internal server error', 500);
  }
});

server.listen(PORT, () => {
  console.log(`Petit multiview Twitch: http://localhost:${PORT}`);
});

async function loadEnv(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const raw = await readFile(filePath, 'utf8');
  return raw.split(/\r?\n/).reduce((acc, line) => {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith('#')) {
      return acc;
    }

    const separatorIndex = cleanLine.indexOf('=');
    if (separatorIndex === -1) {
      return acc;
    }

    const key = cleanLine.slice(0, separatorIndex).trim();
    const value = cleanLine.slice(separatorIndex + 1).trim();
    acc[key] = value;
    return acc;
  }, {});
}

async function readChannelList() {
  const raw = await readFile(CHANNELS_PATH, 'utf8');
  const channels = JSON.parse(raw);
  return channels.map(normalizeChannel).filter(Boolean);
}

function normalizeChannel(channel) {
  return String(channel || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
    .toLowerCase();
}

async function serveStatic(requestPath, res) {
  const safePath = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendText(res, 'Forbidden', 403);
  }

  try {
    const content = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': contentTypes[extension] || 'application/octet-stream'
    });
    res.end(content);
  } catch {
    sendText(res, 'Not found', 404);
  }
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendText(res, text, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

