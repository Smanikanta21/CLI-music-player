import { audioEngine } from './src/core/audioEngine.js';
audioEngine.play('./test-audio.js'); // just to see if it spawns
setTimeout(() => audioEngine.stop(), 1000);
