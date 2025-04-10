/*
src/components/Navbar.tsx
*/
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
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
// Consider adding incident icon if linking to incidents page
// import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";
import { useWebsiteData } from "../hooks"; // Provides updated data structure
import AlertsDropdown from "./navbar/AlertDropdown";
import StatsHeader from "../components/dashboard/StatsHeader"; // Component uses updated props


const pages = [
  { name: "Add Website", path: "/add-website", icon: <AddIcon fontSize="small" />, ariaLabel: "Add new website to monitor" },
  // Example: Add link to incidents page
  // { name: "Incidents", path: "/incidents", icon: <ReportProblemOutlinedIcon fontSize="small" />, ariaLabel: "View incidents" },
];

const settings = ["Profile", "Logout"];

function Navbar() {
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleThemeMode } = useThemeMode();

  // useWebsiteData hook provides the necessary stats including incident info
  const {
      overallStats,
      incidentsLast24h,
      lastIncidentTimestamp,
      // lastIncidentWebsiteId, // Not needed for navbar header display
      isLoading: isLoadingData,
      error: dataError,
      totalWebsitesCount,
      upWebsitesCount,
  } = useWebsiteData(
      'week', // Use 'week' for navbar stats consistency
      60000   // Poll every minute
  );

  // Extract overall uptime for the header
  const headerUptime = useMemo(() => overallStats?.overallUptime ?? null, [overallStats]);

  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorElNav(event.currentTarget);
  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorElUser(event.currentTarget);
  const handleCloseNavMenu = () => setAnchorElNav(null);
  const handleCloseUserMenu = useCallback(() => setAnchorElUser(null), []);

  const handlePageClick = useCallback((path: string) => {
    handleCloseNavMenu();
    if (path !== "#") navigate(path);
  }, [navigate]);

  const handleSettingClick = useCallback(async (setting: string) => {
    handleCloseUserMenu();
    if (setting === "Logout") {
      try { await logout(); navigate('/login'); }
      catch (error) { console.error("Failed to logout:", error); }
    } else if (setting === "Profile") {
       navigate("/profile");
    }
  }, [logout, navigate, handleCloseUserMenu]);

  const handleThemeToggle = useCallback(() => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    toggleThemeMode();
    if (user?.id) {
        const userThemeKey = `themeMode_${user.id}`;
        try {
            localStorage.setItem(userThemeKey, newMode);
        } catch (e) {
            console.error("Failed to save theme preference:", e);
        }
    }
  }, [mode, toggleThemeMode, user]);


  const isDashboard = location.pathname === '/';
  const userInitial = user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "?";

  return (
    <AppBar position="static">
      {/* Use full width container */}
      <Container maxWidth={false} sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
        <Toolbar disableGutters>

          {/* Left Section */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: { xs: 0, md: 1 } }}>
            {/* Desktop Logo */}
            <Box onClick={() => navigate("/")} sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", cursor: "pointer", mr: 1 }}>
              <AdbIcon sx={{ mr: 1 }}/>
              <Typography variant="h6" noWrap component="div" sx={{ mr: 2, fontFamily: "monospace", fontWeight: 700, letterSpacing: ".3rem" }}>PINGIFY</Typography>
            </Box>

            {/* Mobile Nav Menu */}
            <Box sx={{ display: { xs: "flex", md: "none" } }}>
              <IconButton size="large" aria-label="navigation menu" aria-controls="menu-appbar-nav" aria-haspopup="true" onClick={handleOpenNavMenu} color="inherit"><MenuIcon /></IconButton>
              <Menu id="menu-appbar-nav" anchorEl={anchorElNav} anchorOrigin={{ vertical: "bottom", horizontal: "left" }} keepMounted transformOrigin={{ vertical: "top", horizontal: "left" }} open={Boolean(anchorElNav)} onClose={handleCloseNavMenu} sx={{ display: { xs: "block", md: "none" } }}>
                {pages.map((page) => (
                  <MenuItem key={page.name} onClick={() => handlePageClick(page.path)}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>{page.icon}<Typography>{page.name}</Typography></Box>
                  </MenuItem>
                ))}
              </Menu>
            </Box>

            {/* Mobile Logo */}
            <Box onClick={() => navigate("/")} sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", cursor: "pointer", flexGrow: 1, justifyContent: 'center' }}>
              <AdbIcon sx={{ mr: 1 }}/>
              <Typography variant="h5" noWrap component="div" sx={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: ".3rem" }}>PINGIFY</Typography>
            </Box>

            {/* Desktop Nav Links */}
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, ml: 2 }}>
              {pages.map((page) => (
                <Tooltip key={page.name} title={page.ariaLabel || page.name} arrow>
                  {/* Wrap IconButton in span for Tooltip when disabled might be needed */}
                  <span>
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

          {/* Center Section: Stats Header (only shown when NOT on dashboard) */}
          {/* Conditionally render StatsHeader based on route */}
          {!isDashboard && (
            <StatsHeader
              // Pass relevant data from useWebsiteData
              isLoading={isLoadingData && !overallStats} // Show loading if stats are pending
              error={dataError} // Pass potential error (though header might hide it)
              upCount={upWebsitesCount}
              totalCount={totalWebsitesCount}
              uptime={headerUptime}
              incidentsLast24h={incidentsLast24h}
              lastIncidentTimestamp={lastIncidentTimestamp}
              // lastIncidentWebsiteId={lastIncidentWebsiteId} // Not needed for navbar display
              center={true} // Use compact navbar layout
              // Remove props not applicable to navbar header
              // onShowDownWebsites={() => {}} // Removed
              // showDownWebsites={false} // Removed
              // onToggleHighlight={undefined} // Removed
              // isHighlightActive={false} // Removed
            />
          )}

          {/* Right Section: Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexGrow: 0, gap: { xs: 0.5, sm: 1 } }}>
             {/* Alert Dropdown */}
             <AlertsDropdown options={{ limit: 10 }} pollingInterval={60000} />

             {/* Theme Toggle */}
             <Tooltip title={`Toggle ${mode === 'dark' ? 'light' : 'dark'} mode`}>
                <IconButton onClick={handleThemeToggle} color="inherit">
                    {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                </IconButton>
             </Tooltip>

             {/* User Menu */}
             <Tooltip title="Open settings">
                <IconButton onClick={handleOpenUserMenu} aria-label="open user menu" aria-controls="menu-appbar-user" aria-haspopup="true" sx={{ p: 0 }}>
                  <Avatar alt={user?.name || user?.email || 'User'} sx={{ width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, bgcolor: "secondary.main", color: (theme) => theme.palette.getContrastText(theme.palette.secondary.main), fontSize: "1rem" }}>
                    {userInitial}
                  </Avatar>
                </IconButton>
              </Tooltip>

            {/* User Menu Dropdown */}
            <Menu id="menu-appbar-user" sx={{ mt: "45px" }} anchorEl={anchorElUser} anchorOrigin={{ vertical: "top", horizontal: "right" }} keepMounted transformOrigin={{ vertical: "top", horizontal: "right" }} open={Boolean(anchorElUser)} onClose={handleCloseUserMenu}>
              {/* User Info Header */}
              <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle1" fontWeight="bold" noWrap>{user?.name || 'User'}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>{user?.email}</Typography>
              </Box>
              {/* Settings Items */}
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