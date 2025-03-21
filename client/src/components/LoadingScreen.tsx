// client/src/components/LoadingScreen.tsx
import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { keyframes } from '@mui/system';

const pulse = keyframes`
  0% {
    opacity: 0.6;
    transform: scale(0.98);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0.6;
    transform: scale(0.98);
  }
`;

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = "Loading your dashboard..." 
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100%',
        background: theme => 
          `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.primary.dark}22 100%)`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: 4,
          borderRadius: 2,
          backdropFilter: 'blur(8px)',
          bgcolor: 'background.paper',
          boxShadow: 3,
          animation: `${pulse} 2s infinite ease-in-out`,
          maxWidth: '80%',
        }}
      >
        <CircularProgress 
          size={60} 
          thickness={4} 
          color="primary" 
          sx={{ mb: 3 }} 
        />
        
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 1,
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          {message}
        </Typography>
        
        <Typography 
          variant="body2" 
          color="textSecondary" 
          sx={{ 
            textAlign: 'center',
            maxWidth: '400px',
          }}
        >
          Please wait while we load your data and verify your credentials.
        </Typography>
      </Box>
    </Box>
  );
};

export default LoadingScreen;