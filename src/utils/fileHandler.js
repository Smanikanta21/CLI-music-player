import { readdir, stat } from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * Reads the local music directory and returns an array of available audio tracks.
 * 
 * @param {string} dirPath - The relative or absolute path to the music directory.
 * @returns {Promise<Array<{name: string, filename: string, path: string}>>}
 */
export async function getMusicFiles(dirPath = './music') {
  const musicDir = path.resolve(process.cwd(), dirPath);
  
  // Ensure the directory exists
  if (!existsSync(musicDir)) {
    mkdirSync(musicDir, { recursive: true });
    return [];
  }

  try {
    const files = await readdir(musicDir);
    const audioFiles = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      
      // Filter strictly for .mp3 and .wav
      if (ext === '.mp3' || ext === '.wav') {
        const fullPath = path.join(musicDir, file);
        const fileStat = await stat(fullPath);
        
        if (fileStat.isFile()) {
          audioFiles.push({
            name: path.basename(file, ext), // Track name without extension
            filename: file,
            path: fullPath
          });
        }
      }
    }

    return audioFiles;
  } catch (error) {
    console.error('Error reading music directory:', error.message);
    return [];
  }
}
