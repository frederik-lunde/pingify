import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark', // Enable dark mode
    background: {
      default: '#121212', // Dark background color
      paper: '#1e1e1e', // Background color for paper-based components (e.g., Card)
    },
    text: {
      primary: '#ffffff', // 
      secondary: '#b3b3b3', // Light gray
    },
  },
  typography: {
    fontFamily: [
      'system-ui',
      'Avenir',
      'Helvetica',
      'Arial',
      'sans-serif',
    ].join(','), // Set the font family
    fontWeightRegular: 400,
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '1rem',
      fontWeight: 400,
    },
  },
});

export default theme;