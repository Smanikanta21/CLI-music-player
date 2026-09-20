import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { syncBeatsClient } from '../core/syncBeatsClient.js';
import { syncEngine } from '../core/syncEngine.js';
import { authService } from '../core/authService.js';

export function PlayerScreen() {
  const { exit } = useApp();
  const [roomState, setRoomState] = useState(null);
  const [syncStats, setSyncStats] = useState({ latency: 0, offset: 0 });
  const [buffering, setBuffering] = useState(false);
  const [searchState, setSearchState] = useState('none'); // 'none', 'input', 'loading', 'results'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const [driftInfo, setDriftInfo] = useState({ tier: 'synced', expected: 0 });
  
  useEffect(() => {
    // Start connection and join default room immediately
    syncBeatsClient.connect();
    // Ensure room exists in DB before joining so we can enqueue tracks
    syncBeatsClient.createRoom('global').then(() => {
      syncBeatsClient.joinRoom('global');
    });

    const onRoomState = (state) => setRoomState(state);
    const onStats = (stats) => setSyncStats(stats);
    const onBuffering = (isBuffering) => setBuffering(isBuffering);
    const onDrift = (info) => setDriftInfo(info);

    syncBeatsClient.on('roomState', onRoomState);
    syncBeatsClient.on('buffering', onBuffering);
    syncEngine.on('stats', onStats);
    syncEngine.on('drift', onDrift);

    return () => {
      syncBeatsClient.off('roomState', onRoomState);
      syncBeatsClient.off('buffering', onBuffering);
      syncEngine.off('stats', onStats);
      syncEngine.off('drift', onDrift);
    };
  }, []);

  useInput((input, key) => {
    if (searchState !== 'none') {
      if (key.escape) {
        setSearchState('none');
        setSearchQuery('');
      } else if (searchState === 'results') {
        if (key.upArrow) {
          setSearchSelectedIndex(Math.max(0, searchSelectedIndex - 1));
        } else if (key.downArrow) {
          setSearchSelectedIndex(Math.min(searchResults.slice(0, 5).length - 1, searchSelectedIndex + 1));
        } else if (key.return) {
          syncBeatsClient.enqueueTrack(searchResults[searchSelectedIndex]);
          setSearchState('none');
          setSearchQuery('');
        }
      }
      return; // let TextInput handle the rest
    }

    if (input === 'q' || input === 'Q') {
      exit();
      process.exit(0);
    }
    if (input === 's' || input === 'S') {
      setSearchState('input');
      setSearchResults([]);
      setSearchSelectedIndex(0);
    }
    if (input === ' ') {
      syncBeatsClient.sendControls(roomState?.state === 'playing' ? 'pause' : 'play');
    }
    if (input === 'n' || input === 'N') {
      syncBeatsClient.sendControls('next');
    }
    if (input === 'p' || input === 'P') {
      syncBeatsClient.sendControls('prev');
    }
  });

  const handleSearchSubmit = async () => {
    if (searchQuery.trim()) {
      setSearchState('loading');
      const results = await syncBeatsClient.searchTracks(searchQuery);
      setSearchResults(results);
      setSearchSelectedIndex(0);
      setSearchState('results');
    } else {
      setSearchState('none');
      setSearchQuery('');
    }
  };

  const currentTrack = roomState?.queue?.find(q => q.isCurrent) || null;

  return (
    <Box minHeight="100%" minWidth="100%" flexDirection="column" borderStyle="round" borderColor="cyan">
      {/* Header */}
      <Box paddingX={1} borderBottom={false} marginBottom={1} justifyContent="space-between">
        <Text bold color="cyanBright">SyncBeats Terminal</Text>
        <Text color="gray">Room: {roomState?.roomId || 'Connecting...'}</Text>
      </Box>

      {/* Search Bar */}
      {searchState !== 'none' && (
        <Box paddingX={2} paddingY={1} borderStyle="single" borderColor="yellow" flexDirection="column">
          <Box>
            <Text color="yellow">🔍 Search: </Text>
            <TextInput 
              value={searchQuery} 
              onChange={setSearchQuery} 
              onSubmit={handleSearchSubmit} 
              focus={searchState === 'input'}
            />
          </Box>
          {searchState === 'loading' && <Text color="gray">Loading results...</Text>}
          {searchState === 'results' && searchResults.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="gray" underline>Select a track (Up/Down + Enter):</Text>
              {searchResults.slice(0, 5).map((res, i) => (
                <Text key={res.videoId || res.url || i} color={i === searchSelectedIndex ? 'black' : 'white'} backgroundColor={i === searchSelectedIndex ? 'yellow' : undefined}>
                  {i === searchSelectedIndex ? '> ' : '  '}{res.title} - {res.author?.name || res.uploaderName || 'Unknown'}
                </Text>
              ))}
            </Box>
          )}
          {searchState === 'results' && searchResults.length === 0 && (
            <Text color="red">No results found.</Text>
          )}
        </Box>
      )}

      {/* Main Content Split */}
      <Box flexGrow={1} flexDirection="row">
        
        {/* Left Column - Now Playing & Queue */}
        <Box width="60%" flexDirection="column" paddingRight={2}>
          
          {/* Now Playing */}
          <Box borderStyle="round" borderColor="magenta" padding={1} flexDirection="column" height={8}>
            <Text bold color="magentaBright">Now Playing</Text>
            {currentTrack ? (
              <>
                <Text bold>{currentTrack.title}</Text>
                <Text color="gray">{currentTrack.artist}</Text>
                <Box marginTop={1}>
                  {buffering ? (
                    <Text color="yellow">⏳ Buffering...</Text>
                  ) : (
                    <Text color="green">{roomState?.state === 'playing' ? '▶ Playing' : '⏸ Paused'} {Math.floor(driftInfo.expected)}s</Text>
                  )}
                </Box>
              </>
            ) : (
              <Text color="gray">Nothing playing</Text>
            )}
          </Box>

          {/* Queue */}
          <Box borderStyle="round" borderColor="blue" padding={1} flexDirection="column" flexGrow={1} marginTop={1}>
            <Text bold color="blueBright">Queue</Text>
            {(roomState?.queue || []).map((q, i) => (
              <Text key={q.id} color={q.isCurrent ? 'cyan' : 'white'}>
                {i + 1}. {q.title} {q.isCurrent ? '←' : ''}
              </Text>
            ))}
          </Box>
        </Box>

        {/* Right Column - Participants & Stats */}
        <Box width="40%" flexDirection="column">
          
          {/* Participants */}
          <Box borderStyle="round" borderColor="green" padding={1} flexDirection="column" flexGrow={1}>
            <Text bold color="greenBright">Participants</Text>
            {(roomState?.participants || []).map((p) => (
              <Text key={p.socketId}>
                🟢 {p.displayName} {p.userId === authService.getUser()?.id ? '(you)' : ''}
              </Text>
            ))}
          </Box>

          {/* Sync Stats */}
          <Box borderStyle="round" borderColor="yellow" padding={1} flexDirection="column" marginTop={1} height={6}>
            <Text bold color="yellowBright">Sync Status</Text>
            <Text>⚡ {Math.round(syncStats.latency)}ms Latency</Text>
            <Text>🔄 Drift: {driftInfo.tier}</Text>
          </Box>
        </Box>
      </Box>

      {/* Footer Controls */}
      <Box marginTop={1} justifyContent="center">
        <Text color="gray">
          [SPACE] Play/Pause • [N] Next • [P] Prev • [S] Search • [Q] Quit
        </Text>
      </Box>
    </Box>
  );
}
