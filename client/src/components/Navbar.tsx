// src/components/Navbar.tsx
import * as React from "react";
import { useCallback, useState, useMemo } from "react";
import { useLocation, useNavigate } from 'react-router'; // Use react-router-dom
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import MenuIcon from "@mui/icons-material/Menu";
import Container from "@mui/material/Container";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import MenuItem from "@mui/material/MenuItem";
import AdbIcon from "@mui/icons-material/Adb";
import AddIcon from "@mui/icons-material/Add";
// Import theme toggle icons
import Brightness4Icon from '@mui/icons-material/Brightness4'; // Dark mode icon
import Brightness7Icon from '@mui/icons-material/Brightness7'; // Light mode icon
import { useAuth } from "../context/AuthContext";
import AlertsDropdown from "./navbar/AlertDropdown";
import { useWebsiteData } from "../hooks/domain/useWebsiteData";
import StatsHeader from "./dashboard/StatsHeader";
// Import the theme context hook
import { useThemeMode } from "../context/ThemeContext";

// --- Navigation Items ---
const pages = [
  {
    name: "Add Website",
    path: "/add-website",
    icon: <AddIcon fontSize="small" />,
    ariaLabel: "Add new website to monitor",
  },
];

// --- User Menu Items ---
const settings = ["Profile", "Logout"];

function Navbar() {
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get theme mode and toggle function from context
  const { mode, toggleThemeMode } = useThemeMode();

  // --- Fetch Website Data ---
  const {
      overallStats,
      isLoading: isLoadingData,
      error: dataError,
      totalWebsitesCount,
      upWebsitesCount,
  } = useWebsiteData(
      undefined,
      'week',
      60000
  );

  const otherStatsValues = useMemo(() => {
      const safeStats = overallStats || {
          overallUptime: 0,
          overallResponseTime: 0,
      };
      return {
          uptime: safeStats.overallUptime ?? 0,
          responseTime: safeStats.overallResponseTime ?? 0,
      }
  }, [overallStats]);

  // --- Menu Handlers ---
  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElNav(event.currentTarget);
  };
  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };
  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handlePageClick = useCallback(
    (path: string) => {
      handleCloseNavMenu();
      if (path !== "#") {
        navigate(path);
      } else {
        console.log("Placeholder action for:", path);
      }
    },
    [navigate],
  );

  const handleSettingClick = useCallback(
    async (setting: string) => {
      handleCloseUserMenu();
      if (setting === "Logout") {
        try {
          await logout();
          // Navigate to login after logout is successful
          navigate('/login');
        } catch (error) {
          console.error("Failed to logout:", error);
          // Handle logout error (e.g., show a notification)
        }
      } else if (setting === "Profile") {
         navigate("/profile"); // Assuming you have a /profile route
      }
       // Add other settings handlers here
    },
    [logout, navigate], // Added navigate dependency
  );


  // --- Render Logic ---
  const isDashboard = location.pathname === '/';

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>

          {/* === Left Section === */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: { xs: 0, md: 1 } }}>
            {/* Logo and Title (Desktop) */}
             <Box
              onClick={() => navigate("/")}
              sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", cursor: "pointer", mr: 1 }}
            >
              <AdbIcon sx={{ mr: 1 }}/>
              <Typography
                variant="h6"
                noWrap
                component="div"
                sx={{
                  mr: 2,
                  fontFamily: "monospace",
                  fontWeight: 700,
                  letterSpacing: ".3rem",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                PINGIFY
              </Typography>
            </Box>
            {/* Mobile Menu Icon */}
            <Box sx={{ display: { xs: "flex", md: "none" } }}>
              <IconButton
                size="large"
                aria-label="navigation menu"
                aria-controls="menu-appbar-nav"
                aria-haspopup="true"
                onClick={handleOpenNavMenu}
                color="inherit"
              >
                <MenuIcon />
              </IconButton>
              {/* Mobile Navigation Menu */}
              <Menu
                id="menu-appbar-nav"
                anchorEl={anchorElNav}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                keepMounted
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                open={Boolean(anchorElNav)}
                onClose={handleCloseNavMenu}
                sx={{ display: { xs: "block", md: "none" } }}
              >
                {pages.map((page) => (
                  <MenuItem key={page.name} onClick={() => handlePageClick(page.path)}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      {page.icon}
                      <Typography>{page.name}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Menu>
            </Box>
            {/* Logo and Title (Mobile) */}
            <Box
              onClick={() => navigate("/")}
              sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", cursor: "pointer", flexGrow: 1 }}
            >
              <AdbIcon sx={{ mr: 1 }}/>
              <Typography
                variant="h5"
                noWrap
                component="div"
                sx={{
                  fontFamily: "monospace",
                  fontWeight: 700,
                  letterSpacing: ".3rem",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                PINGIFY
              </Typography>
            </Box>
             {/* Desktop Navigation Icons */}
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, ml: 2 }}>
              {pages.map((page) => (
                <Tooltip key={page.name} title={page.ariaLabel || page.name} arrow>
                  <span> {/* Tooltip needs a DOM element child */}
                    <IconButton
                      aria-label={page.ariaLabel || page.name}
                      onClick={() => handlePageClick(page.path)}
                      color="inherit"
                      size="medium"
                    >
                      {page.icon}
                    </IconButton>
                  </span>
                </Tooltip>
              ))}
            </Box>
          </Box>


          {/* === Center Section (Conditional Stats) === */}
          {!isDashboard && (
            <StatsHeader
              isLoading={isLoadingData}
              error={dataError}
              upCount={upWebsitesCount}
              totalCount={totalWebsitesCount}
              uptime={otherStatsValues.uptime}
              responseTime={otherStatsValues.responseTime}
              center={true}
            />
          )}


          {/* === Right Section === */}
          {/* Use flexGrow: 0 to prevent this section from expanding unnecessarily */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexGrow: 0, gap: { xs: 1, sm: 1.5 } }}>
             {/* Alerts Dropdown */}
             <AlertsDropdown
                options={{ limit: 50 }}
                pollingInterval={60000}
              />

             {/* Theme Toggle Button */}
             <Tooltip title={`Toggle ${mode === 'dark' ? 'light' : 'dark'} mode`}>
                <IconButton sx={{ ml: 1 }} onClick={toggleThemeMode} color="inherit">
                    {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                </IconButton>
             </Tooltip>

             {/* User Avatar and Menu */}
             <Tooltip title="Open settings">
                <IconButton
                  onClick={handleOpenUserMenu}
                  sx={{ p: 0 }} // Reset padding for IconButton containing Avatar
                  aria-label="open user menu"
                  aria-controls="menu-appbar-user"
                  aria-haspopup="true"
                >
                  <Avatar
                    alt={user?.name || user?.email || 'User'}
                    sx={{
                      width: { xs: 32, sm: 40 },
                      height: { xs: 32, sm: 40 },
                      bgcolor: "secondary.main", // Or use a theme color
                      fontSize: "1rem", // Adjust as needed
                      // Ensure avatar background contrasts with AppBar
                      color: (theme) => theme.palette.getContrastText(theme.palette.secondary.main),
                    }}
                  >
                    {/* Display initials */}
                    {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "?"}
                  </Avatar>
                </IconButton>
              </Tooltip>

             {/* User Menu Dropdown */}
            <Menu
              id="menu-appbar-user"
              sx={{ mt: "45px" }} // Position below the AppBar
              anchorEl={anchorElUser}
              anchorOrigin={{ vertical: "top", horizontal: "right" }}
              keepMounted
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
            >
              {/* User Info Header */}
              <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle1" fontWeight="bold">{user?.name || 'User'}</Typography>
                  <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
              </Box>
              {/* Menu Items */}
              {settings.map((setting) => (
                <MenuItem key={setting} onClick={() => handleSettingClick(setting)}>
                  {/* Center text within MenuItem */}
                  <Typography sx={{ textAlign: "center", width: '100%' }}>{setting}</Typography>
                </MenuItem>
              ))}
            </Menu>
          </Box>

        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default Navbar;