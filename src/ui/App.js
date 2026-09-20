import React, { useState, useEffect } from 'react';
import { SplashScreen } from './SplashScreen.js';
import { LoginScreen } from './LoginScreen.js';
import { PlayerScreen } from './PlayerScreen.js';
import { authService } from '../core/authService.js';

export function App() {
  const [stage, setStage] = useState('splash'); // splash, auth, player

  useEffect(() => {
    // When splash screen finishes, check if we have a valid token
    if (stage === 'auth-check') {
      authService.getMe().then((user) => {
        if (user) {
          setStage('player');
        } else {
          setStage('auth');
        }
      });
    }
  }, [stage]);

  if (stage === 'splash') {
    return <SplashScreen onComplete={() => setStage('auth-check')} />;
  }

  if (stage === 'auth' || stage === 'auth-check') {
    return <LoginScreen onLoginSuccess={() => setStage('player')} />;
  }

  if (stage === 'player') {
    return <PlayerScreen />;
  }

  return null;
}
