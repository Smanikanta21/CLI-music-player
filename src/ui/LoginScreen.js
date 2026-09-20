import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { authService } from '../core/authService.js';

export function LoginScreen({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeField, setActiveField] = useState('email');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useInput((input, key) => {
    if (loading) return;

    if (key.tab) {
      if (mode === 'login') {
        setActiveField(f => f === 'email' ? 'password' : 'email');
      } else {
        setActiveField(f => {
          if (f === 'name') return 'email';
          if (f === 'email') return 'password';
          return 'name';
        });
      }
      return;
    }

    if (key.return) {
      handleSubmit();
      return;
    }

    if (input === 'S' && activeField === 'none') {
      // Toggle mode if nothing is focused, or we can use ctrl+s
    }
  });

  const handleSubmit = async () => {
    if (!email || !password || (mode === 'signup' && !name)) {
      setError('Please fill in all fields.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await authService.login(email, password);
      } else {
        await authService.register(name, email, password);
      }
      onLoginSuccess();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fields = [
    mode === 'signup' && { name: 'name', label: 'Name', value: name, onChange: setName },
    { name: 'email', label: 'Email', value: email, onChange: setEmail },
    { name: 'password', label: 'Password', value: password, onChange: setPassword, mask: '*' }
  ].filter(Boolean);

  return (
    <Box minHeight="100%" minWidth="100%" justifyContent="center" alignItems="center" flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" paddingX={4} paddingY={2} flexDirection="column">
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="cyanBright">{mode === 'login' ? 'SyncBeats Login' : 'SyncBeats Sign Up'}</Text>
        </Box>
        
        {fields.map((f, i) => (
          <Box key={f.name} marginY={1}>
            <Box width={10}>
              <Text color={activeField === f.name ? "cyan" : "white"}>{f.label}:</Text>
            </Box>
            <Box>
              <TextInput
                value={f.value}
                onChange={f.onChange}
                focus={activeField === f.name}
                mask={f.mask}
                onSubmit={() => {
                  const nextField = fields[i + 1];
                  if (nextField) setActiveField(nextField.name);
                  else handleSubmit();
                }}
              />
            </Box>
          </Box>
        ))}

        <Box marginTop={2} justifyContent="center">
          <Text color="gray">Use [TAB] to switch fields, [ENTER] to submit.</Text>
        </Box>
        
        <Box marginTop={1} justifyContent="center">
          <Text color="gray">
            Mode: {mode === 'login' ? 'Login' : 'Sign Up'}. 
            Press <Text color="yellow" underline>Ctrl+T</Text> to toggle.
          </Text>
        </Box>

        {error && (
          <Box marginTop={1} justifyContent="center">
            <Text color="redBright">{error}</Text>
          </Box>
        )}
        
        {loading && (
          <Box marginTop={1} justifyContent="center">
            <Text color="blueBright">Authenticating...</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
