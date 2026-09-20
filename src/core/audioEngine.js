import { spawn } from 'child_process';
import os from 'os';
import { EventEmitter } from 'events';

export class AudioEngine extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.isPlaying = false;
    this.currentFile = null;
    this.playerCmd = 'ffplay'; // Use ffplay for everything because afplay lacks seeking
  }

  play(filePath, seekSecs = 0) {
    this.stop();
    this.currentFile = filePath;
    this.isPlaying = true;

    const args = [];
    if (this.playerCmd === 'afplay') {
      args.push(filePath);
    } else {
      // ffplay fallback
      args.push('-nodisp', '-autoexit', '-loglevel', 'quiet');
      if (seekSecs > 0) {
        args.push('-ss', seekSecs.toString());
      }
      args.push(filePath);
    }

    this.process = spawn(this.playerCmd, args);

    this.process.on('close', (code) => {
      this.isPlaying = false;
      this.process = null;
      // Code 0 or null implies normal exit, not a forced kill (usually)
      if (code === 0) {
        this.emit('ended');
      }
    });

    this.process.on('error', (err) => {
      console.error(`AudioEngine Error: ${err.message}`);
      this.isPlaying = false;
    });
  }

  pause() {
    if (this.process && this.isPlaying) {
      // SIGKILL instantly terminates to prevent audio buffering delays
      this.process.kill('SIGKILL');
      this.process = null;
      this.isPlaying = false;
    }
  }

  resume() {
    if (this.process && !this.isPlaying) {
      // SIGCONT unfreezes the process
      this.process.kill('SIGCONT');
      this.isPlaying = true;
    }
  }

  stop() {
    if (this.process) {
      this.process.removeAllListeners('close');
      this.process.kill('SIGKILL');
      this.process = null;
    }
    this.isPlaying = false;
  }
}

export const audioEngine = new AudioEngine();
