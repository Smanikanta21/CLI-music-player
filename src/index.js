import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { exec } from 'child_process';
import path from 'path';

// Async Auto-Updater
function runAsyncUpdater() {
  try {
    // We do this completely in the background without awaiting
    exec('git fetch origin main', { timeout: 5000 }, (err) => {
      if (err) return;
      exec('git rev-parse HEAD', (err1, local) => {
        if (err1) return;
        exec('git rev-parse origin/main', (err2, remote) => {
          if (err2) return;
          if (local.trim() !== remote.trim()) {
            // Found an update! Pull and build in the background
            exec('git pull origin main && npm install && npm run build', (err3) => {
              if (!err3) {
                // We could send an IPC message or write a file to notify the UI
                // But for now it just safely updates the files so the NEXT run uses the new code!
              }
            });
          }
        });
      });
    });
  } catch (e) {}
}

runAsyncUpdater();


// Enter alternate screen buffer for full-screen UI
process.stdout.write('\x1b[?1049h');

const { waitUntilExit } = render(<App />);

waitUntilExit().then(() => {
  // Exit alternate screen buffer on quit
  process.stdout.write('\x1b[?1049l');
});
