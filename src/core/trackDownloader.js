import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { EventEmitter } from 'events';
import { authService } from './authService.js';

const MUSIC_DIR = path.resolve(process.cwd(), 'music');

if (!fs.existsSync(MUSIC_DIR)) {
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
}

export class TrackDownloader extends EventEmitter {
  constructor() {
    super();
    this.downloading = new Map(); // trackId -> progress
  }

  async download(trackUrl, trackId) {
    // trackUrl from the server is usually /rooms/:roomId/yt-proxy?videoId=123
    // Wait, the client usually passes the trackUrl directly.
    // If it's a relative URL, we need to append the server URL.
    const fullUrl = trackUrl.startsWith('http') ? trackUrl : `http://localhost:4000${trackUrl}`;
    
    // Sanitize filename
    const safeId = trackId.replace(/[^a-zA-Z0-9_-]/g, '');
    const ext = fullUrl.includes('youtube') || fullUrl.includes('yt-proxy') ? '.m4a' : '.mp3';
    const filePath = path.join(MUSIC_DIR, `${safeId}${ext}`);

    // Check cache
    if (fs.existsSync(filePath)) {
      this.emit('ready', { trackId, filePath });
      return filePath;
    }

    if (this.downloading.has(trackId)) {
      return null; // already downloading
    }

    this.downloading.set(trackId, 0);
    this.emit('progress', { trackId, progress: 0 });

    try {
      const token = authService.getToken();
      const res = await fetch(fullUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error(`Failed to fetch track: ${res.statusText}`);

      const totalBytes = parseInt(res.headers.get('content-length') || '0', 10);
      let downloadedBytes = 0;

      const fileStream = fs.createWriteStream(filePath);
      
      res.body.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const progress = Math.round((downloadedBytes / totalBytes) * 100);
          this.downloading.set(trackId, progress);
          this.emit('progress', { trackId, progress });
        }
      });

      await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on('error', reject);
        fileStream.on('finish', resolve);
      });

      this.downloading.delete(trackId);
      this.emit('progress', { trackId, progress: 100 });
      this.emit('ready', { trackId, filePath });
      return filePath;
    } catch (err) {
      this.downloading.delete(trackId);
      this.emit('error', { trackId, error: err.message });
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return null;
    }
  }
}

export const trackDownloader = new TrackDownloader();
