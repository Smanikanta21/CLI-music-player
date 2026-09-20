import { io } from 'socket.io-client';
import { EventEmitter } from 'events';
import { authService } from './authService.js';
import { syncEngine } from './syncEngine.js';
import { trackDownloader } from './trackDownloader.js';
import { audioEngine } from './audioEngine.js';

const SERVER_URL = 'http://localhost:4000';

export class SyncBeatsClient extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.roomState = null;
    this.roomId = null;
    this.pingInterval = null;
  }

  connect() {
    if (this.socket) return;
    
    const token = authService.getToken();
    if (!token) throw new Error('Cannot connect socket: not authenticated');

    this.socket = io(SERVER_URL, {
      auth: { token },
      extraHeaders: {
        'x-device-id': authService.deviceKey
      }
    });

    this.socket.on('connect', () => {
      this.emit('connected');
      this.socket.emit('device:register', { deviceKey: authService.deviceKey });
      this._startNTP();
    });

    this.socket.on('disconnect', () => {
      this.emit('disconnected');
      this._stopNTP();
    });

    // Room Sync Events
    this.socket.on('room:snapshot', (snapshot) => {
      this.roomState = snapshot;
      this.roomId = snapshot.roomId;
      this.emit('roomState', snapshot);
      this._handleTrackUpdate(snapshot);
    });

    this.socket.on('room:stateChanged', (snapshot) => {
      this.roomState = snapshot;
      this.emit('roomState', snapshot);
    });

    this.socket.on('room:trackSet', (payload) => {
      // payload = { trackUrl, trackId }
      this._handleTrackUpdate(payload);
    });

    trackDownloader.on('error', (err) => {
      this.emit('error', err);
    });

    this.socket.on('playback:schedule', (payload) => {
      // payload = { startEpoch, fromPosition, trackUrl, atEpoch }
      if (this.roomState) {
        this.roomState.state = 'playing';
      }
      this.emit('buffering', false);
      const url = payload.trackUrl || this.roomState?.trackUrl;
      let trackId = url;
      if (url && url.startsWith('youtube:')) {
        trackId = url.split(':')[1];
      } else if (url) {
        trackId = url.split('=').pop();
      } else {
        trackId = 'unknown';
      }
      const localPath = `${process.cwd()}/music/${trackId}.m4a`;
      syncEngine.schedule(payload, localPath);
    });

    this.socket.on('playback:pause', (payload) => {
      if (this.roomState) {
        this.roomState.state = 'paused';
      }
      syncEngine.pause(payload.position);
    });

    this.socket.on('sync:pong', (payload) => {
      const t3 = Date.now();
      const rtt = (t3 - payload.t0) - (payload.t2 - payload.t1);
      const offset = ((payload.t1 - payload.t0) + (payload.t2 - t3)) / 2;
      syncEngine.setClockOffset(offset, rtt);
    });

    // Room Participants
    this.socket.on('room:participantJoined', (p) => {
      if (this.roomState) {
        this.roomState.participants.push(p);
        this.emit('roomState', this.roomState);
      }
    });

    this.socket.on('room:participantLeft', (payload) => {
      if (this.roomState) {
        this.roomState.participants = this.roomState.participants.filter(x => x.socketId !== payload.socketId);
        this.emit('roomState', this.roomState);
      }
    });
    
    this.socket.on('room:queueChanged', (payload) => {
       if (this.roomState) {
           this.roomState.queue = Array.isArray(payload) ? payload : (payload?.queue || []);
           this.emit('roomState', this.roomState);
       }
    });

    audioEngine.on('ended', () => {
      // When audio finishes playing naturally
      this.socket.emit('playback:ended');
    });
  }

  async createRoom(roomId) {
    const token = authService.getToken();
    try {
      await fetch(`${SERVER_URL}/rooms`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roomId })
      });
    } catch (e) {
      console.error(e);
    }
  }

  joinRoom(roomId) {
    if (!this.socket) this.connect();
    this.roomId = roomId;
    const user = authService.getUser();
    this.socket.emit('room:join', { 
      roomId, 
      displayName: user?.name || 'Terminal User',
      userId: user?.id
    });
  }

  async searchTracks(query) {
    if (!this.roomId) return [];
    const token = authService.getToken();
    try {
      const res = await fetch(`${SERVER_URL}/rooms/${this.roomId}/youtube-search?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      return Array.isArray(data) ? data : (data.videos || []);
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  async enqueueTrack(vid) {
    if (!this.roomId || !vid) return;
    const token = authService.getToken();

    try {
      const res = await fetch(`${SERVER_URL}/rooms/${this.roomId}/enqueue-youtube`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          youtubeUrl: vid.url,
          title: vid.title
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Enqueue error:', errorData);
      }
    } catch (err) {
      console.error(err);
    }
  }

  togglePlayPause() {
    const state = this.roomState?.state?.toUpperCase();
    if (state === 'PLAYING' || this.roomState?.isPlaying) {
      this.socket.emit('playback:pause', { roomId: this.roomId });
    } else {
      this.socket.emit('playback:play', { roomId: this.roomId });
    }
  }

  sendControls(action) {
     if (!this.roomId) return;
     if (action === 'pause') {
       this.socket.emit('playback:pause', { roomId: this.roomId });
     }
     if (action === 'play') {
       this.socket.emit('playback:play', { roomId: this.roomId });
     }
     if (action === 'next') {
       this.socket.emit('room:nextTrack', { roomId: this.roomId });
     }
     if (action === 'prev') {
       this.socket.emit('room:prevTrack', { roomId: this.roomId });
     }
  }

  async _handleTrackUpdate(payload) {
    let url = payload.trackUrl;
    if (!url) return;
    
    this.emit('buffering', true);
    
    let trackId = url;
    if (url.startsWith('youtube:')) {
      const videoId = url.split(':')[1];
      url = `/rooms/${this.roomId}/yt-proxy?videoId=${videoId}`;
      trackId = videoId;
    } else {
      trackId = url.split('=').pop(); 
    }
    
    const filePath = await trackDownloader.download(url, trackId);
    if (filePath) {
      this.socket.emit('room:clientReady', { roomId: this.roomId });
      
      // If the room is already playing (e.g. late join), start playback immediately
      // instead of waiting for playback:schedule, because the server won't send it again.
      if (payload.state === 'playing' || payload.timeline?.isPlaying || this.roomState?.isPlaying) {
        this.emit('buffering', false);
        syncEngine.schedule({
          startEpoch: payload.timeline?.startEpoch || this.roomState?.startEpoch,
          fromPosition: payload.position || payload.timeline?.pauseOffset || this.roomState?.pauseOffset || 0,
          trackUrl: payload.trackUrl,
          atEpoch: Date.now() // start instantly
        }, filePath);
      } else if (payload.state === 'PAUSED' || payload.state === 'paused') {
        this.emit('buffering', false);
        const pos = payload.position || payload.positionMs || 0;
        this.emit('drift', { expected: pos / 1000, actual: 0 });
      } else if (this.roomState && !this.roomState.pendingPlay) {
        // If the room is not pending an auto-play (meaning it's just paused),
        // clear the buffering state so the user sees the Paused UI instead of getting stuck.
        this.emit('buffering', false);
        // Force the UI to show the correct paused time instead of 0s
        const expectedSec = (payload.timeline?.pauseOffset || this.roomState?.pauseOffset || 0) / 1000;
        syncEngine.emit('drift', { expected: expectedSec, tier: 'synced' });
      }
    }
  }

  _startNTP() {
    this._stopNTP();
    this.pingInterval = setInterval(() => {
      this.socket.emit('sync:ping', { t0: Date.now() });
    }, 2000);
  }

  _stopNTP() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export const syncBeatsClient = new SyncBeatsClient();
