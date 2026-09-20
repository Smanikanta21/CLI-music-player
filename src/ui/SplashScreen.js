import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

export function SplashScreen({ onComplete }) {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d + 1) % 4);
    }, 125);
    
    const timeout = setTimeout(() => {
      clearInterval(interval);
      onComplete();
    }, 500);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <Box minHeight="100%" minWidth="100%" justifyContent="center" alignItems="center" flexDirection="column">
      <Text bold color="cyanBright">
        {`
   _____                  ____             __      
  / ___/__  ______  ___  / __ )___  ____ _/ /______
  \\__ \\/ / / / __ \\/ _ \\/ __  / _ \\/ __ \`/ __/ ___/
 ___/ / /_/ / / / /  __/ /_/ /  __/ /_/ / /_(__  ) 
/____/\\__, /_/ /_/\\___/_____/\\___/\\__,_/\\__/____/  
     /____/                                        
        `}
      </Text>
      <Box marginTop={2}>
        <Text color="gray">Starting up{'.'.repeat(dots)}</Text>
      </Box>
    </Box>
  );
}
