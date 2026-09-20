import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';

// Enter alternate screen buffer for full-screen UI
process.stdout.write('\x1b[?1049h');

const { waitUntilExit } = render(<App />);

waitUntilExit().then(() => {
  // Exit alternate screen buffer on quit
  process.stdout.write('\x1b[?1049l');
});
