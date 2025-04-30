// src/components/Navbar.tsx
import React, { useCallback, useState, useMemo } from "react";
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
import { useAuth } from "../context/AuthContext";
import { useWebsiteData } from "../hooks";
import AlertsDropdown from "./navbar/AlertDropdown";
import StatsHeader from "./dashboard/StatsHeader"; // Corrected path
import { AuthContextType, User } from "../types";

const pages = [
  { name: "Add Website", path: "/add-website", icon: <AddIcon fontSize="small" />, ariaLabel: "Add new website to monitor" },
];

const settings = ["Profile", "Logout"];

function isUser(user: User | null): user is User {
  return user !== null;
}

function Navbar() {
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const auth = useAuth() as AuthContextType | null;
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch data needed for StatsHeader (using a longer interval for Navbar potentially)
  const {
      overallStats,
      incidentsLast24h,
      lastIncidentTimestamp,
      isLoading: isLoadingStats, // Use a distinct name if needed
      totalWebsitesCount,
      upWebsitesCount,
  } = useWebsiteData('week', 60000); // Example: 60 second interval for navbar stats

  const headerUptime = useMemo(() => overallStats?.overallUptime ?? null, [overallStats]);

  const handleCloseNavMenu = useCallback(() => setAnchorElNav(null), []);
  const handleCloseUserMenu = useCallback(() => setAnchorElUser(null), []);

  const handlePageClick = useCallback((path: string) => {
    handleCloseNavMenu();
    if (path !== "#") navigate(path);
  }, [navigate, handleCloseNavMenu]);

  const handleSettingClick = useCallback(async (setting: string) => {
    handleCloseUserMenu();
    if (!auth || !auth.logout) {
         console.error("Auth context or logout function not available.");
         navigate('/login');
         return;
    }

    if (setting === "Logout") {
      try {
        await auth.logout();
        navigate('/login');
      } catch (error) {
        console.error("Failed to logout:", error);
      }
    } else if (setting === "Profile") {
      navigate("/profile");
    }
  }, [auth, navigate, handleCloseUserMenu]);

  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorElNav(event.currentTarget);
  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorElUser(event.currentTarget);

  // --- Conditional Rendering Logic ---
  if (!auth || !isUser(auth.user)) {
    // Return null or a minimal loading bar if auth.loading
    return null;
  }

  const { user } = auth;
  // Determine if the current page IS the dashboard ('/')
  const isDashboard = location.pathname === '/';
  const userInitial = user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "?";

  return (
    <AppBar position="static">
      {/* Use maxWidth={false} for full width */}
      <Container maxWidth={false} sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
        <Toolbar disableGutters>

          {/* --- Left Section: Logo & Nav --- */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: { xs: 1, md: 0 } }}>
            {/* Desktop Logo */}
            <Box onClick={() => navigate("/")} sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", cursor: "pointer", mr: 1 }}>
              <AdbIcon sx={{ mr: 1 }}/>
              <Typography variant="h6" noWrap component="div" sx={{ mr: 2, fontFamily: "monospace", fontWeight: 700, letterSpacing: ".3rem" }}>PINGIFY</Typography>
            </Box>

            {/* Mobile Nav Menu Button */}
            <Box sx={{ display: { xs: "flex", md: "none" } }}>
              <IconButton size="large" aria-label="navigation menu" aria-controls="menu-appbar-nav" aria-haspopup="true" onClick={handleOpenNavMenu} color="inherit"><MenuIcon /></IconButton>
              {/* Mobile Nav Menu Dropdown */}
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

             {/* Mobile Logo (Centered when nav button is present) */}
             <Box onClick={() => navigate("/")} sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", cursor: "pointer", flexGrow: 1, justifyContent: 'center', pr: { xs: '48px', sm: 0 } /* Offset for menu icon */ }}>
                <AdbIcon sx={{ mr: 1 }}/>
                <Typography variant="h5" noWrap component="div" sx={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: ".3rem" }}>PINGIFY</Typography>
             </Box>

            {/* Desktop Nav Links (Icons) */}
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, ml: 2 }}>
              {pages.map((page) => (
                <Tooltip key={page.name} title={page.ariaLabel || page.name} arrow>
                  {/* Wrap IconButton in span for Tooltip when disabled */}
                  <span>
                    <IconButton
                      aria-label={page.ariaLabel || page.name}
                      onClick={() => handlePageClick(page.path)}
                      color="inherit"
                      size="medium"
                      // Example: disable if needed: disabled={someCondition}
                    >
                      {page.icon}
                    </IconButton>
                  </span>
                </Tooltip>
              ))}
            </Box>
          </Box>

          {/* --- Center Section: Stats Header --- */}
          {/* Conditionally render StatsHeader if NOT on the dashboard page */}
          {!isDashboard && (
            <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, justifyContent: 'center', px: 2 }}>
              <StatsHeader
                // Use isLoadingStats from the specific useWebsiteData call for the navbar
                isLoading={isLoadingStats && !overallStats}
                upCount={upWebsitesCount}
                totalCount={totalWebsitesCount}
                uptime={headerUptime}
                incidentsLast24h={incidentsLast24h} // Pass null/undefined if that's the value
                lastIncidentTimestamp={lastIncidentTimestamp}
                // *** Use layoutMode instead of center ***
                layoutMode="navbar"
                // No control props (filter, sort, tv mode) needed for navbar layout
              />
            </Box>
          )}

          {/* If on Dashboard, add a flexible space to push user controls right */}
          {isDashboard && <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'block' } }} />}


          {/* --- Right Section: Controls --- */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexGrow: 0, gap: { xs: 0.5, sm: 1 } }}>
            <AlertsDropdown
                // Pass necessary props for AlertsDropdown
                apiFilters={{ limit: 10 }} // Example filters
                pollingInterval={60000} // Example interval
              />

            <Tooltip title="Open settings">
                <IconButton onClick={handleOpenUserMenu} aria-label="open user menu" aria-controls="menu-appbar-user" aria-haspopup="true" sx={{ p: 0 }}>
                  <Avatar
                    alt={user.name || user.email || 'User'}
                    sx={{
                        width: { xs: 32, sm: 40 },
                        height: { xs: 32, sm: 40 },
                        bgcolor: "secondary.main",
                        color: (theme) => theme.palette.getContrastText(theme.palette.secondary.main),
                        fontSize: "1rem" // Adjust font size if needed
                    }}
                  >
                    {userInitial}
                  </Avatar>
                </IconButton>
            </Tooltip>

            {/* User Menu Dropdown */}
            <Menu
                id="menu-appbar-user"
                sx={{ mt: "45px" }} // Adjust margin top if needed
                anchorEl={anchorElUser}
                anchorOrigin={{ vertical: "top", horizontal: "right" }}
                keepMounted
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                open={Boolean(anchorElUser)}
                onClose={handleCloseUserMenu}
            >
              <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle1" fontWeight="bold" noWrap>{user.name || 'User'}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>{user.email}</Typography>
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