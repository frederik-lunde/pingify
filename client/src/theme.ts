import { createTheme } from "@mui/material/styles";
import { blue, orange, deepOrange, grey, green, red, yellow, teal } from "@mui/material/colors";

/**
 * Common typography settings for all themes.
 */
const commonTypography = {
  fontFamily: [
    "system-ui",
    "Avenir",
    "Helvetica",
    "Arial",
    "sans-serif",
  ].join(","),
  fontWeightRegular: 400,
  h1: {
    fontSize: "2.5rem",
    fontWeight: 500,
  },
  body1: {
    fontSize: "1rem",
    fontWeight: 400,
  },
};

/**
 * Defines the light theme for the application.
 */
export const lightTheme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#f4f6f8",
      paper: "#ffffff",
    },
    text: {
      primary: "#1f2937",
      secondary: "#6b7280",
    },
    primary: {
      main: '#3f51b5',
    },
    secondary: {
      main: '#f50057',
    },
    success: {
       main: green[600],
    },
    warning: {
        main: orange[700],
    },
    error: {
        main: red[600],
    },
    info: {
        main: blue[600],
    },
  },
  typography: commonTypography,
});

/**
 * Defines the dark theme for the application.
 */
export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#121212",
      paper: "#1e1e1e",
    },
    text: {
      primary: "#ffffff",
      secondary: "#b3b3b3",
    },
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    success: {
       main: green[400],
    },
    warning: {
        main: orange[400],
    },
    error: {
        main: red[400],
    },
    info: {
        main: blue[300],
    },
  },
  typography: commonTypography,
});

/**
 * Defines a colorblind-friendly dark theme.
 */
export const colorblindTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#121212",
      paper: "#1e1e1e",
    },
    text: {
      primary: "#ffffff",
      secondary: "#b3b3b3",
    },
    primary: {
      main: blue[300],
    },
    secondary: {
      main: '#f48fb1',
    },
    success: {
      main: teal[200],
    },
    warning: {
      main: yellow[600],
    },
    error: {
      main: deepOrange[400],
    },
    info: {
      main: grey[500],
    },
  },
  typography: commonTypography,
});