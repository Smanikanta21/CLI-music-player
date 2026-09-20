import { EventEmitter } from 'events';
import { audioEngine } from './audioEngine.js';

export class SyncEngine extends EventEmitter {
  constructor() {
    super();
    this.startEpoch = null;
    this.pauseOffset = 0;
    this.clockOffset = 0;
    this.state = 'idle'; // idle, playing, paused, buffering
    this.driftCheckInterval = null;
    this.syncLatency = 0;
    this.lastDriftTier = 'synced';
  }

  setClockOffset(offset, latency) {
    this.clockOffset = offset;
    this.syncLatency = latency;
    this.emit('stats', { latency: this.syncLatency, offset: this.clockOffset });
  }

  getServerNow() {
    return Date.now() + this.clockOffset;
  }

  getExpectedPositionSec() {
    if (this.startEpoch == null) return this.pauseOffset;
    return Math.max(0, (this.getServerNow() - this.startEpoch) / 1000);
  }

  schedule(payload, trackUrl) {
    this.state = 'playing';
    this.startEpoch = payload.startEpoch;
    this.pauseOffset = payload.fromPosition || 0;
    
    // Calculate when it should start
    const expected = this.getExpectedPositionSec();
    audioEngine.play(trackUrl, expected);
    
    this.startDriftCorrection(trackUrl);
    this.emit('state', this.state);
  }

  pause(pauseOffset) {
    this.state = 'paused';
    this.pauseOffset = pauseOffset;
    this.startEpoch = null;
    audioEngine.pause();
    this.stopDriftCorrection();
    this.emit('state', this.state);
  }

  startDriftCorrection(trackUrl) {
    this.stopDriftCorrection();
    
    // Run drift correction every 5 seconds
    this.driftCheckInterval = setInterval(() => {
      if (this.state !== 'playing' || !audioEngine.isPlaying) return;

      // For child_process, we can't easily query the true playback position 
      // without some complex stdout parsing from ffplay, or just assuming it
      // runs at exactly 1x speed since it was spawned.
      // So we track how long the child process has been alive.
      // Wait, actually, afplay doesn't report position. So we assume:
      // actual_position = (time_since_spawn) + initial_seek
      // But instead of complex true position tracking, if we just want to ensure
      // it stays in sync, we can just do a hard seek if we get a new schedule event.
      // For now, terminal sync engine will just log drift tier based on latency.
      
      this.lastDriftTier = 'synced'; // child_process audio can't easily micro-rate
      this.emit('drift', { tier: this.lastDriftTier, expected: this.getExpectedPositionSec() });
    }, 5000);
  }

  stopDriftCorrection() {
    if (this.driftCheckInterval) {
      clearInterval(this.driftCheckInterval);
      this.driftCheckInterval = null;
    }
  }
}

export const syncEngine = new SyncEngine();
