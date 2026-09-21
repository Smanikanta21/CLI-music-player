import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { SplashScreen } from './SplashScreen.js';
import { LoginScreen } from './LoginScreen.js';
import { RoomSelectScreen } from './RoomSelectScreen.js';
import { PlayerScreen } from './PlayerScreen.js';
import { authService } from '../core/authService.js';

export function App() {
  const [stage, setStage] = useState('splash'); // splash, auth, room-select, player
  const [roomId, setRoomId] = useState('');

  useEffect(() => {
    // When splash screen finishes, check if we have a valid token
    if (stage === 'auth-check') {
      authService.getMe().then((user) => {
        if (user) {
          setStage('room-select');
        } else {
          setStage('auth');
        }
      });
    }
  }, [stage]);
  if (stage === 'splash') {
    return <SplashScreen onComplete={() => setStage('auth-check')} />;
  }

  if (stage === 'auth-check') {
    return (
      <Box minHeight="100%" minWidth="100%" justifyContent="center" alignItems="center">
        <Text color="cyan">Checking authentication...</Text>
      </Box>
    );
  }

  if (stage === 'auth') {
    return <LoginScreen onLoginSuccess={() => setStage('room-select')} />;
  }

  if (stage === 'room-select') {
    return (
      <RoomSelectScreen onJoin={(id) => {
        setRoomId(id);
        setStage('player');
      }} />
    );
  }

  if (stage === 'player') {
    return <PlayerScreen roomId={roomId} />;
  }

  return null;
}
