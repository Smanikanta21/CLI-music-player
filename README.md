# 🎵 SyncBeats Terminal Player

A terminal-based music player that syncs playback across devices in real-time using [SyncBeats](https://github.com/Smanikanta21/syncbeats) rooms. Search YouTube, queue tracks, and listen in perfect sync — all from your terminal.

> **⚠️ Platform Support: macOS and Linux only.** Windows is not supported.

---

## ⚡ Quick Install

```bash
curl -fsSL https://syncbeats-server-1006171035854.asia-south1.run.app/cli | bash
```

Or manually:

```bash
git clone https://github.com/Smanikanta21/CLI-music-player.git
cd CLI-music-player
npm install
npm run build
npm start
```

---

## 📋 Requirements

| Dependency | Version | Install |
|---|---|---|
| **Node.js** | ≥ 18.0.0 | [nodejs.org](https://nodejs.org) |
| **npm** | ≥ 9.0.0 | Comes with Node.js |
| **ffplay** | Any | `brew install ffmpeg` (macOS) or `sudo apt install ffmpeg` (Linux) |
| **Git** | Any | `brew install git` (macOS) or `sudo apt install git` (Linux) |

> `ffplay` is part of the `ffmpeg` suite and is used as the audio backend for playback.

---

## 🚀 How It Works

SyncBeats Terminal Player connects to the SyncBeats backend server via **WebSockets (Socket.IO)** and synchronizes music playback across all connected clients (mobile app, web app, and this terminal player) in real-time.

### Architecture

```
┌─────────────────────────┐
│   SyncBeats Terminal    │
│   Player (this app)     │
│                         │
│  ┌───────────────────┐  │
│  │   Ink/React UI    │  │  ← Terminal UI rendered with Ink
│  └────────┬──────────┘  │
│           │              │
│  ┌────────▼──────────┐  │
│  │ SyncBeatsClient   │  │  ← Socket.IO connection + REST API calls
│  └────────┬──────────┘  │
│           │              │
│  ┌────────▼──────────┐  │
│  │   SyncEngine      │  │  ← NTP clock sync + drift correction
│  └────────┬──────────┘  │
│           │              │
│  ┌────────▼──────────┐  │
│  │   AudioEngine     │  │  ← Spawns ffplay child process
│  └────────┬──────────┘  │
│           │              │
│  ┌────────▼──────────┐  │
│  │  TrackDownloader   │  │  ← Downloads .m4a from server
│  └───────────────────┘  │
└───────────┬─────────────┘
            │ WebSocket + HTTPS
            ▼
┌─────────────────────────┐
│   SyncBeats Backend     │
│   (Cloud Run)           │
│                         │
│  • Room management      │
│  • Queue & playback     │
│  • YouTube search       │
│  • NTP clock sync       │
│  • User authentication  │
└─────────────────────────┘
```

### Playback Flow

1. **Login/Register** → Authenticate with the SyncBeats backend
2. **Room Selection** → Join an existing room (fetched from your account) or auto-join
3. **Search & Queue** → Search YouTube directly from the terminal, enqueue tracks
4. **Download** → When a track is set, the terminal player downloads the `.m4a` audio file from the server to a local `music/` cache
5. **Synchronized Play** → The backend broadcasts a `playback:schedule` event with a precise `startEpoch` timestamp. All clients start playback at the exact same moment using NTP-synced clocks
6. **Drift Correction** → A background loop checks the expected vs actual playback position and corrects drift

### Clock Synchronization

The terminal player implements NTP-style clock synchronization:

- Sends `sync:ping` with a timestamp `t0`
- Server responds with `sync:pong` containing `t0`, `t1` (server receive), `t2` (server send)
- Client calculates:
  - **RTT** = `(t3 - t0) - (t2 - t1)` (round-trip time minus server processing)
  - **Clock Offset** = `((t1 - t0) + (t2 - t3)) / 2`
- All playback scheduling uses `Date.now() + clockOffset` to align with server time

---

## 🎮 Keybindings

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `N` | Next track |
| `P` | Previous track |
| `S` | Open YouTube search |
| `M` | Focus queue (navigate with ↑↓, Enter to play) |
| `R` | Toggle repeat mode (off → all → track) |
| `Q` | Quit |
| `Esc` | Close search / Unfocus queue |
| `↑` / `↓` | Navigate search results or queue items |
| `Enter` | Select search result / Play queue item |

---

## 📁 Project Structure

```
terminal-player/
├── bin/
│   └── index.js          # Entry point (imports built dist)
├── src/
│   ├── index.js           # App bootstrap (Ink render)
│   ├── core/
│   │   ├── syncBeatsClient.js   # Socket.IO client + REST API
│   │   ├── syncEngine.js        # NTP clock sync + drift correction
│   │   ├── audioEngine.js       # ffplay child process manager
│   │   ├── trackDownloader.js   # HTTP file downloader with progress
│   │   └── authService.js       # JWT auth + device registration
│   └── ui/
│       ├── PlayerScreen.js      # Main player UI (Now Playing, Queue, Stats)
│       ├── RoomSelectScreen.js  # Room picker screen
│       ├── LoginScreen.js       # Login/Register form
│       └── App.js               # Screen router
├── music/                 # Cached audio files (gitignored)
├── dist/                  # esbuild output (gitignored)
├── package.json
└── .gitignore
```

---

## 🔧 Configuration

The app stores auth tokens and device keys using [Configstore](https://github.com/yeoman/configstore) at:

```
~/.config/configstore/syncbeats-terminal.json
```

### Backend URL

The terminal player connects to the production SyncBeats backend at:

```
https://syncbeats-server-1006171035854.asia-south1.run.app
```

---

## 🛠️ Development

```bash
# Clone
git clone https://github.com/Smanikanta21/CLI-music-player.git
cd CLI-music-player

# Install dependencies
npm install

# Build and run (rebuilds src/ → dist/ via esbuild, then starts)
npm run dev

# Run without rebuilding (uses existing dist/)
npm start
```

### Build System

Uses [esbuild](https://esbuild.github.io/) to bundle JSX/ESM source into a single `dist/index.js`:

```bash
esbuild src/index.js --bundle --platform=node --format=esm --outfile=dist/index.js --loader:.js=jsx --packages=external
```

---

## 🤝 Related Projects

- **[SyncBeats Backend](https://github.com/Smanikanta21/syncbeats)** — Node.js/Express server with Socket.IO, Prisma, and YouTube integration
- **SyncBeats Mobile App** — React Native companion app
- **SyncBeats Web App** — Next.js web frontend

---

## 📄 License

ISC
