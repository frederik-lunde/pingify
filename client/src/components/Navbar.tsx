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
import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";
import { useWebsiteData } from "../hooks";
import AlertsDropdown from "./navbar/AlertDropdown";
import StatsHeader from "../components/dashboard/StatsHeader";


const pages = [
  { name: "Add Website", path: "/add-website", icon: <AddIcon fontSize="small" />, ariaLabel: "Add new website to monitor" },
];

const settings = ["Profile", "Logout"];

function Navbar() {
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleThemeMode } = useThemeMode();

  const {
      overallStats,
      incidentsLast24h,
      lastIncidentTimestamp,
      lastIncidentWebsiteId,
      isLoading: isLoadingData,
      error: dataError,
      totalWebsitesCount,
      upWebsitesCount,
  } = useWebsiteData(
      'week',
      60000
  );

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
      {/* Change Container to use full width and apply padding manually */}
      <Container maxWidth={false} sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
        <Toolbar disableGutters>

          {/* Left Section: Stays left due to parent Toolbar flex layout */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: { xs: 0, md: 1 } }}>
            <Box onClick={() => navigate("/")} sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", cursor: "pointer", mr: 1 }}>
              <AdbIcon sx={{ mr: 1 }}/>
              <Typography variant="h6" noWrap component="div" sx={{ mr: 2, fontFamily: "monospace", fontWeight: 700, letterSpacing: ".3rem" }}>PINGIFY</Typography>
            </Box>

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

            <Box onClick={() => navigate("/")} sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", cursor: "pointer", flexGrow: 1, justifyContent: 'center' }}>
              <AdbIcon sx={{ mr: 1 }}/>
              <Typography variant="h5" noWrap component="div" sx={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: ".3rem" }}>PINGIFY</Typography>
            </Box>

            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, ml: 2 }}>
              {pages.map((page) => (
                <Tooltip key={page.name} title={page.ariaLabel || page.name} arrow>
                  <span><IconButton aria-label={page.ariaLabel || page.name} onClick={() => handlePageClick(page.path)} color="inherit" size="medium">{page.icon}</IconButton></span>
                </Tooltip>
              ))}
            </Box>
          </Box>

          {/* Center Section: Will occupy space between left/right */}
          {!isDashboard && (
            <StatsHeader
              isLoading={isLoadingData && !overallStats}
              error={dataError}
              upCount={upWebsitesCount}
              totalCount={totalWebsitesCount}
              uptime={headerUptime}
              incidentsLast24h={incidentsLast24h}
              lastIncidentTimestamp={lastIncidentTimestamp}
              lastIncidentWebsiteId={lastIncidentWebsiteId}
              center={true}
              onShowDownWebsites={() => {}}
              showDownWebsites={false}
              onToggleHighlight={undefined}
              isHighlightActive={false}
            />
          )}

          {/* Right Section: Stays right due to parent Toolbar flex layout */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexGrow: 0, gap: { xs: 0.5, sm: 1 } }}>
             <AlertsDropdown options={{ limit: 50 }} pollingInterval={60000} />

             <Tooltip title={`Toggle ${mode === 'dark' ? 'light' : 'dark'} mode`}>
                <IconButton onClick={handleThemeToggle} color="inherit">
                    {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                </IconButton>
             </Tooltip>

             <Tooltip title="Open settings">
                <IconButton onClick={handleOpenUserMenu} aria-label="open user menu" aria-controls="menu-appbar-user" aria-haspopup="true" sx={{ p: 0 }}>
                  <Avatar alt={user?.name || user?.email || 'User'} sx={{ width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, bgcolor: "secondary.main", color: (theme) => theme.palette.getContrastText(theme.palette.secondary.main), fontSize: "1rem" }}>
                    {userInitial}
                  </Avatar>
                </IconButton>
              </Tooltip>

            <Menu id="menu-appbar-user" sx={{ mt: "45px" }} anchorEl={anchorElUser} anchorOrigin={{ vertical: "top", horizontal: "right" }} keepMounted transformOrigin={{ vertical: "top", horizontal: "right" }} open={Boolean(anchorElUser)} onClose={handleCloseUserMenu}>
              <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle1" fontWeight="bold" noWrap>{user?.name || 'User'}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>{user?.email}</Typography>
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