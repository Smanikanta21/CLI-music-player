import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { authService } from '../core/authService.js';
import fetch from 'node-fetch';
import { SERVER_URL } from '../core/config.js';

export function RoomSelectScreen({ onJoin }) {
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;
    if (roomId.trim()) {
      onJoin(roomId.trim());
    } else {
      setLoading(true);
      try {
        const token = authService.getToken();
        const res = await fetch(`${SERVER_URL}/rooms/mine`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.rooms && data.rooms.length > 0) {
          // The most recently created/active room is typically first
          onJoin(data.rooms[0].id);
        } else {
          onJoin(Math.floor(100000 + Math.random() * 900000).toString());
        }
      } catch (e) {
        onJoin(Math.floor(100000 + Math.random() * 900000).toString());
      }
    }
  };

  return (
    <Box minHeight="100%" minWidth="100%" justifyContent="center" alignItems="center" flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" paddingX={4} paddingY={2} flexDirection="column">
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="cyanBright">Join a Room</Text>
        </Box>
        
        <Box marginY={1}>
          <Box width={15}>
            <Text color="white">Room Code:</Text>
          </Box>
          <Box>
            <TextInput
              value={roomId}
              onChange={setRoomId}
              focus={true}
              onSubmit={handleSubmit}
            />
          </Box>
        </Box>

        <Box marginTop={2} justifyContent="center" flexDirection="column" alignItems="center">
          {loading ? (
            <Text color="yellow">Fetching your most recent room...</Text>
          ) : (
            <>
              <Text color="gray">Type a room code and press Enter.</Text>
              <Text color="gray">Leave blank and press Enter to rejoin your last active room.</Text>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
