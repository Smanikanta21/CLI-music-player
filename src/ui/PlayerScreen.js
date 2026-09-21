import React, { useEffect, useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { syncBeatsClient } from '../core/syncBeatsClient.js';
import { syncEngine } from '../core/syncEngine.js';
import { authService } from '../core/authService.js';
import { trackDownloader } from '../core/trackDownloader.js';

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

export function PlayerScreen({ roomId: initialRoomId }) {
  const { exit } = useApp();
  const [roomState, setRoomState] = useState(null);
  const [syncStats, setSyncStats] = useState({ latency: 0, offset: 0 });
  const [buffering, setBuffering] = useState(false);
  const [searchState, setSearchState] = useState('none'); // 'none', 'input', 'loading', 'results'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const [driftInfo, setDriftInfo] = useState({ tier: 'synced', expected: 0 });
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [queueState, setQueueState] = useState('none');
  const [queueSelectedIndex, setQueueSelectedIndex] = useState(0);
  
  useEffect(() => {
    // Start connection and join the selected room immediately
    syncBeatsClient.connect();
    // Ensure room exists in DB before joining so we can enqueue tracks
    syncBeatsClient.createRoom(initialRoomId).then(() => {
      syncBeatsClient.joinRoom(initialRoomId);
    });

    const onRoomState = (state) => setRoomState(state);
    const onStats = (stats) => setSyncStats(stats);
    const onBuffering = (isBuffering) => {
      setBuffering(isBuffering);
      if (!isBuffering) setDownloadProgress(null);
    };
    const onDrift = (info) => setDriftInfo(info);
    const onProgress = (p) => setDownloadProgress(p.progress);
    const onReady = () => setDownloadProgress(100);

    syncBeatsClient.on('roomState', onRoomState);
    syncBeatsClient.on('buffering', onBuffering);
    syncEngine.on('stats', onStats);
    syncEngine.on('drift', onDrift);
    trackDownloader.on('progress', onProgress);
    trackDownloader.on('ready', onReady);

    return () => {
      syncBeatsClient.off('roomState', onRoomState);
      syncBeatsClient.off('buffering', onBuffering);
      syncEngine.off('stats', onStats);
      syncEngine.off('drift', onDrift);
      trackDownloader.off('progress', onProgress);
      trackDownloader.off('ready', onReady);
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

    if (queueState === 'focused') {
      if (key.escape) {
        setQueueState('none');
      } else if (key.upArrow) {
        setQueueSelectedIndex(Math.max(0, queueSelectedIndex - 1));
      } else if (key.downArrow) {
        setQueueSelectedIndex(Math.min((roomState?.queue?.length || 1) - 1, queueSelectedIndex + 1));
      } else if (key.return && roomState?.queue?.[queueSelectedIndex]) {
        syncBeatsClient.jumpToQueueItem(roomState.queue[queueSelectedIndex].id);
        setQueueState('none');
      }
      return;
    }

    if (input === 'q' || input === 'Q') {
      exit();
      process.exit(0);
    }
    if (input === 'm' || input === 'M') {
      setQueueState('focused');
      setQueueSelectedIndex(0);
    }
    if (input === 'r' || input === 'R') {
      syncBeatsClient.toggleRepeat();
    }
    if (input === 's' || input === 'S') {
      setSearchState('input');
      setSearchResults([]);
      setSearchSelectedIndex(0);
    }
    if (input === ' ') {
      syncBeatsClient.togglePlayPause();
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

  const currentTrack = roomState?.queue?.find(q => q.isCurrent) 
    || roomState?.queue?.find(q => q.trackUrl === roomState?.trackUrl) 
    || (roomState?.trackUrl ? { title: 'Unknown Track', artist: 'Unknown', trackUrl: roomState.trackUrl } : null);

  if (!roomState) {
    return (
      <Box minHeight="100%" minWidth="100%" flexDirection="column" borderStyle="round" borderColor="cyan" justifyContent="center" alignItems="center">
        <Text color="cyan">Connecting to Room {initialRoomId}...</Text>
      </Box>
    );
  }

  return (
    <Box minHeight="100%" minWidth="100%" flexDirection="column" borderStyle="round" borderColor="cyan">
      {/* Header */}
      <Box borderStyle="round" borderColor="green" padding={1} marginBottom={1} justifyContent="space-between">
        <Text bold color="greenBright">SyncBeats Terminal</Text>
        <Text color="gray">Room: {initialRoomId}</Text>
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
          <Box borderStyle="round" borderColor="magenta" padding={1} flexDirection="column" flexBasis="50%">
            <Text bold color="magentaBright">Now Playing</Text>
            {currentTrack ? (
              <>
                <Text bold>{currentTrack.title}</Text>
                <Text color="gray">{currentTrack.artist}</Text>
                <Box marginTop={1}>
                  {buffering ? (
                    <Box flexDirection="column">
                      <Text color="yellow">
                        {downloadProgress === 100 
                          ? 'Waiting for other participants to sync...' 
                          : 'Downloading track...'}
                      </Text>
                      {downloadProgress !== null && downloadProgress < 100 && (
                        <Box marginTop={1} flexDirection="row" alignItems="center">
                          <Text color="cyan">{downloadProgress}% </Text>
                          <Text color="gray">
                            [{'▬'.repeat(Math.floor(downloadProgress / 100 * 20))}{' '.repeat(20 - Math.floor(downloadProgress / 100 * 20))}]
                          </Text>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Box flexDirection="column">
                      <Text color={roomState?.state?.toUpperCase() === 'PLAYING' ? 'green' : 'yellow'}>
                        {roomState?.state?.toUpperCase() === 'PLAYING' ? '> Playing' : '|| Paused'}
                      </Text>
                      <Box marginTop={1} flexDirection="row" alignItems="center">
                        <Text color="cyan">{formatTime(driftInfo.expected)} </Text>
                        <Text color="gray"> (Duration unknown)</Text>
                      </Box>
                    </Box>
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
          <Box borderStyle="round" borderColor="green" padding={1} flexDirection="column" flexBasis="50%">
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
            <Text>{Math.round(syncStats.latency)}ms Latency</Text>
            <Text>Drift: {driftInfo.tier}</Text>
          </Box>
        </Box>
      </Box>

      {/* Footer Controls */}
      <Box marginTop={1} justifyContent="center">
        <Text color="gray">
          [SPACE] Play/Pause • [N] Next • [P] Prev • [R] Repeat • [M] Queue • [S] Search • [Q] Quit
        </Text>
      </Box>
    </Box>
  );
}
