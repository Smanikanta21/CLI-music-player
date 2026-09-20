import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { getMusicFiles } from '../utils/fileHandler.js';

const App = () => {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMusic() {
      const files = await getMusicFiles();
      setTracks(files);
      setLoading(false);
    }
    fetchMusic();
  }, []);

  return (
    <Box borderStyle="round" borderColor="green" padding={1} width="100%" flexDirection="column">
      <Box flexDirection="column" alignItems="center" width="100%" marginBottom={1}>
        <Text color="cyan" bold>🎵 Terminal Music Player 🎵</Text>
        <Text color="gray">Your journey to CLI beats starts here.</Text>
      </Box>

      <Box flexDirection="column">
        <Text bold underline color="yellow">Available Tracks:</Text>
        {loading ? (
          <Text color="gray">Loading music...</Text>
        ) : tracks.length === 0 ? (
          <Text color="red">No .mp3 or .wav files found in ./music directory.</Text>
        ) : (
          tracks.map((track, index) => (
            <Text key={track.path}>
              <Text color="blue">{index + 1}. </Text>
              <Text color="white">{track.name} </Text>
              <Text color="gray" dimColor>({track.filename})</Text>
            </Text>
          ))
        )}
      </Box>
    </Box>
  );
};

export default App;
