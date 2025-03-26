import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#121212',
      paper: '#1e1e1e', 
    },
    text: {
      primary: '#ffffff', 
      secondary: '#b3b3b3', 
    },
    // Adding standardized primary/secondary colors
    primary: {
      main: '#90caf9', // Light blue as primary
      contrastText: '#121212',
    },
    secondary: {
      main: '#f48fb1', // Pink as secondary
      contrastText: '#121212',
    },
  },
  typography: {
    fontFamily: [
      'system-ui',
      'Avenir',
      'Helvetica',
      'Arial',
      'sans-serif',
    ].join(','),
    // Standardized typography scale
    fontSize: 14, // Base font size
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: {
      fontSize: '2.5rem', // 40px
      fontWeight: 500,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2rem', // 32px
      fontWeight: 500,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.75rem', // 28px
      fontWeight: 500,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '1.5rem', // 24px
      fontWeight: 500,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.25rem', // 20px
      fontWeight: 500,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '1rem', // 16px
      fontWeight: 500,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '1rem', // 16px
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem', // 14px
      lineHeight: 1.5,
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      textTransform: 'none', // Buttons don't uppercase by default
    },
    caption: {
      fontSize: '0.75rem', // 12px
      lineHeight: 1.5,
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 500,
      lineHeight: 1.5,
      textTransform: 'uppercase',
    },
  },
  // Standardized spacing (8px base unit)
  spacing: 8,
  // Component defaults
  components: {
    MuiAvatar: {
      styleOverrides: {
        root: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '1.2rem'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4, // Standard border radius
          padding: '6px 16px', // Standard button padding
        },
      },
      defaultProps: {
        size: 'medium', // Standard medium size
      },
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          fontSize: '1.5rem', // Standard icon size (24px)
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined', // Standard text field variant
        size: 'small', // Standard compact size
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8, // Standard card border radius
          padding: 0, // Standard card padding
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          height: 64, // Standard app bar height
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: 64, // Standard toolbar height
        },
      },
    },
  },
  // Shape defaults
  shape: {
    borderRadius: 0, // Standard border radius for most components
  },
  // Breakpoints (standard Material-UI values)
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
});

export default theme;