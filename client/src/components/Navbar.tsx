// src/components/Navbar.tsx
import * as React from "react";
import { useCallback, useState, useMemo } from "react";
import { useLocation, useNavigate } from 'react-router';
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
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

import { useAuth } from "../context/AuthContext";
// Import the theme context hook
import { useThemeMode } from "../context/ThemeContext";
import { useWebsiteData } from "../hooks/domain/useWebsiteData";
import AlertsDropdown from "./navbar/AlertDropdown";
import StatsHeader from "./dashboard/StatsHeader";


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

// Helper function (can be moved to a util file)
const getUserThemeKey = (userId: string | number | undefined): string | null => {
  return userId ? `themeMode_${userId}` : null;
};


function Navbar() {
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

  const { logout, user } = useAuth(); // Get user object
  const navigate = useNavigate();
  const location = useLocation(); // Get location object

  // Get theme mode and toggle function from context
  const { mode, toggleThemeMode } = useThemeMode();

  const {
      overallStats,
      incidentsLast24h,
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
      return {
          uptime: overallStats?.overallUptime ?? null,
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
          navigate('/login');
        } catch (error) {
          console.error("Failed to logout:", error);
        }
      } else if (setting === "Profile") {
         navigate("/profile");
      }
    },
    [logout, navigate],
  );

  // --- Theme Toggle Handler ---
  const handleThemeToggle = useCallback(() => {
    // Determine the mode *after* the toggle happens
    const newMode = mode === 'light' ? 'dark' : 'light';

    // Toggle the theme in the context state
    toggleThemeMode();

    // If a user is logged in, save their preference
    if (user?.id) {
        const userThemeKey = getUserThemeKey(user.id);
        if (userThemeKey) {
            console.log(`Saving theme preference '${newMode}' for user ${user.id}`);
            localStorage.setItem(userThemeKey, newMode);
        }
    }
    // Optionally update a generic preference as well
    // localStorage.setItem('lastUsedThemeMode', newMode);

  }, [mode, toggleThemeMode, user]); // Depend on mode, toggle function, and user


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
              isLoading={isLoadingData && !overallStats}
              error={dataError}
              upCount={upWebsitesCount}
              totalCount={totalWebsitesCount}
              uptime={otherStatsValues.uptime}
              incidentsLast24h={incidentsLast24h}
              center={true}
            />
          )}


          {/* === Right Section === */}
          {/* Use flexGrow: 0 and adjust gap */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexGrow: 0, gap: { xs: 1, sm: 1.5 } }}>
             {/* Alerts Dropdown */}
             <AlertsDropdown
                options={{ limit: 50 }}
                pollingInterval={60000}
              />

             {/* Theme Toggle Button */}
             <Tooltip title={`Toggle ${mode === 'dark' ? 'light' : 'dark'} mode`}>
                {/* Use the theme toggle handler */}
                <IconButton sx={{ ml: 1 }} onClick={handleThemeToggle} color="inherit">
                    {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                </IconButton>
             </Tooltip>

             {/* User Avatar and Menu */}
             <Tooltip title="Open settings">
                <IconButton
                  onClick={handleOpenUserMenu}
                  // Removed p: 0 here, let the gap handle spacing
                  sx={{ /* p: 0 */ }}
                  aria-label="open user menu"
                  aria-controls="menu-appbar-user"
                  aria-haspopup="true"
                >
                  <Avatar
                    alt={user?.name || user?.email || 'User'}
                    sx={{
                      width: { xs: 32, sm: 40 },
                      height: { xs: 32, sm: 40 },
                      bgcolor: "secondary.main",
                      color: (theme) => theme.palette.getContrastText(theme.palette.secondary.main),
                      fontSize: "1rem",
                    }}
                  >
                    {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "?"}
                  </Avatar>
                </IconButton>
              </Tooltip>

             {/* User Menu Dropdown */}
            <Menu
              id="menu-appbar-user"
              sx={{ mt: "45px" }}
              anchorEl={anchorElUser}
              anchorOrigin={{ vertical: "top", horizontal: "right" }}
              keepMounted
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
            >
              <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle1" fontWeight="bold">{user?.name || 'User'}</Typography>
                  <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
              </Box>
              {settings.map((setting) => (
                <MenuItem key={setting} onClick={() => handleSettingClick(setting)}>
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