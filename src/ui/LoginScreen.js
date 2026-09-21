import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { authService } from '../core/authService.js';

export function LoginScreen({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login', 'signup', 'forgot_password', 'otp_setup', 'forgot_password_reset'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [activeField, setActiveField] = useState('email');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useInput((input, key) => {
    if (loading) return;

    if (key.tab) {
      const activeFields = getFields().map(f => f.name);
      const currentIndex = activeFields.indexOf(activeField);
      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % activeFields.length;
        setActiveField(activeFields[nextIndex]);
      }
      return;
    }

    if (key.return) {
      handleSubmit();
      return;
    }

    // Ctrl+T to toggle Login / Signup
    if (input === '\\u0014' || (key.ctrl && input === 't')) {
      setMode(prev => prev === 'login' ? 'signup' : 'login');
      setActiveField('email');
      setError(null);
      setMessage(null);
      return;
    }

    // F keybinding for Forgot Password
    if (input.toLowerCase() === 'f' && !['email', 'password', 'name', 'otp'].includes(activeField)) {
       // If no field focused, maybe, but text inputs usually steal focus. 
       // We'll map Ctrl+F to forgot password to be safe
    }
    
    if (key.ctrl && input === 'f') {
      setMode('forgot_password');
      setActiveField('email');
      setError(null);
      setMessage(null);
      return;
    }
    
    // G keybinding for Google Auth Local Server Flow
    if (key.ctrl && input === 'g') {
      triggerGoogleAuth();
      return;
    }
  });

  const triggerGoogleAuth = async () => {
    try {
      const http = (await import('http')).default;
      const open = (await import('open')).default;
      
      setLoading(true);
      setError(null);
      setMessage("Starting local server for Google Auth... Please check your browser.");
      
      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url, `http://${req.headers.host}`);
          if (url.pathname === '/callback') {
            const token = url.searchParams.get('token');
            if (token) {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end('<h1>Login successful! You can close this window and return to the terminal.</h1><script>setTimeout(() => window.close(), 3000);</script>');
              
              authService.setToken(token);
              await authService.getMe(); // Fetch user profile and set it
              
              server.close();
              onLoginSuccess();
            } else {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Login failed. No token received.</h1>');
            }
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
        } catch (err) {
          console.error(err);
        }
      });
      
      server.listen(8123, async () => {
        const loginUrl = process.env.NODE_ENV === 'development' 
            ? 'http://localhost:3000/login?returnTo=http://localhost:8123/callback' 
            : 'https://syncbeats.in/login?returnTo=http://localhost:8123/callback';
        await open(loginUrl);
      });
      
      server.on('error', (err) => {
        setError("Failed to start local server. Is port 8123 in use?");
        setLoading(false);
      });
      
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);

    if (mode === 'login') {
      if (!email || !password) return setError('Email and password required');
      setLoading(true);
      try {
        await authService.login(email, password);
        onLoginSuccess();
      } catch (err) {
        const msg = err.message || '';
        if (msg.includes('GOOGLE_AUTH_SETUP_PASSWORD')) {
          setMode('otp_setup');
          setActiveField('otp');
          setPassword('');
          setMessage('Google Account detected. An OTP was sent to your email. Enter it below to set a password.');
        } else {
          setError(msg);
        }
        setLoading(false);
      }
    } else if (mode === 'signup') {
      if (!name || !email || !password) return setError('All fields required');
      setLoading(true);
      try {
        await authService.register(name, email, password);
        onLoginSuccess();
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    } else if (mode === 'forgot_password') {
      if (!email) return setError('Email required');
      setLoading(true);
      try {
        await authService.forgotPassword(email);
        setMessage('OTP sent to your email. Please enter it below along with your new password.');
        setMode('forgot_password_reset');
        setActiveField('otp');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else if (mode === 'otp_setup' || mode === 'forgot_password_reset') {
      if (!otp || !password) return setError('OTP and new password required');
      setLoading(true);
      try {
        await authService.resetPasswordWithOtp(email, otp, password);
        // After reset, try to login automatically
        await authService.login(email, password);
        onLoginSuccess();
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }
  };

  const getFields = () => {
    switch (mode) {
      case 'login':
        return [
          { name: 'email', label: 'Email', value: email, onChange: setEmail },
          { name: 'password', label: 'Password', value: password, onChange: setPassword, mask: '*' }
        ];
      case 'signup':
        return [
          { name: 'name', label: 'Name', value: name, onChange: setName },
          { name: 'email', label: 'Email', value: email, onChange: setEmail },
          { name: 'password', label: 'Password', value: password, onChange: setPassword, mask: '*' }
        ];
      case 'forgot_password':
        return [
          { name: 'email', label: 'Email', value: email, onChange: setEmail }
        ];
      case 'otp_setup':
      case 'forgot_password_reset':
        return [
          { name: 'otp', label: 'OTP Code', value: otp, onChange: setOtp },
          { name: 'password', label: 'New Password', value: password, onChange: setPassword, mask: '*' }
        ];
      default:
        return [];
    }
  };

  const fields = getFields();
  const getModeTitle = () => {
    if (mode === 'login') return 'SyncBeats Login';
    if (mode === 'signup') return 'SyncBeats Sign Up';
    if (mode === 'forgot_password') return 'Forgot Password';
    return 'Setup Password via OTP';
  };

  return (
    <Box minHeight="100%" minWidth="100%" justifyContent="center" alignItems="center" flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" paddingX={4} paddingY={2} flexDirection="column">
        <Box justifyContent="center" marginBottom={1}>
          <Text bold color="cyanBright">{getModeTitle()}</Text>
        </Box>
        
        {message && (
          <Box marginY={1} width={50}>
            <Text color="greenBright">{message}</Text>
          </Box>
        )}

        {fields.map((f, i) => (
          <Box key={f.name} marginY={1}>
            <Box width={15}>
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

        <Box marginTop={2} justifyContent="center" flexDirection="column" alignItems="center">
          <Text color="gray">Shortcuts:</Text>
          <Text color="gray">[TAB] switch fields • [ENTER] submit</Text>
          <Text color="gray">[Ctrl+T] Toggle Login/Signup</Text>
          <Text color="gray">[Ctrl+F] Forgot Password</Text>
          <Text color="gray">[Ctrl+G] Google Auth Help</Text>
        </Box>

        {error && (
          <Box marginTop={1} justifyContent="center">
            <Text color="redBright">{error}</Text>
          </Box>
        )}
        
        {loading && (
          <Box marginTop={1} justifyContent="center">
            <Text color="blueBright"><Spinner type="dots" /> Processing...</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
