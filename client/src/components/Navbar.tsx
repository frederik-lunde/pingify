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
import logo from "../assets/logo.png";
import AddIcon from "@mui/icons-material/Add";
import { useAuth } from "../context/AuthContext";
import { useWebsiteData } from "../hooks";
import AlertsDropdown from "./navbar/AlertDropdown";
import StatsHeader from "./dashboard/StatsHeader";
import { AuthContextType, User } from "../types";

const pages = [
  { name: "Add Website", path: "/add-website", icon: <AddIcon fontSize="small" />, ariaLabel: "Add new website to monitor" },
];
const settings = ["Profile", "Logout"];

/**
 * Type guard to check if a user object is valid.
 */
function isUser(user: User | null): user is User {
  return user !== null;
}

/**
 * Main navigation bar component for the application.
 */
function Navbar() {
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const auth = useAuth() as AuthContextType | null;
  const navigate = useNavigate();
  const location = useLocation();
  const {
      overallStats,
      incidentsLast24h,
      lastIncidentTimestamp,
      isLoading: isLoadingStats,
      totalWebsitesCount,
      upWebsitesCount,
  } = useWebsiteData('week', 60000);

  const headerUptime = useMemo(() => overallStats?.overallUptime ?? null, [overallStats]);

  /**
   * Closes the navigation menu.
   */
  const handleCloseNavMenu = useCallback(() => setAnchorElNav(null), []);

  /**
   * Closes the user settings menu.
   */
  const handleCloseUserMenu = useCallback(() => setAnchorElUser(null), []);

  /**
   * Handles navigation to a page from the nav menu.
   */
  const handlePageClick = useCallback((path: string) => {
    handleCloseNavMenu();
    if (path !== "#") navigate(path);
  }, [navigate, handleCloseNavMenu]);

  /**
   * Handles actions from the user settings menu (Profile, Logout).
   */
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

  /**
   * Opens the navigation menu.
   */
  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorElNav(event.currentTarget);

  /**
   * Opens the user settings menu.
   */
  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorElUser(event.currentTarget);

  if (!auth || !isUser(auth.user)) {
    return null;
  }
  const { user } = auth;
  const isDashboard = location.pathname === '/';
  const userInitial = user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "?";

  return (
    <AppBar position="static">
      {}
      <Container maxWidth={false} sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
        <Toolbar disableGutters>
          {}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: { xs: 1, md: 0 } }}>
            {}
            <Box onClick={() => navigate("/")} sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", cursor: "pointer", mr: 1 }}>
              {}
              <Box
                component="img"
                src={logo}
                alt="Pingify Logo"
                sx={{ height: 28, mr: 2.5 }}
              />
              {}
              <Typography variant="h6" noWrap component="div" sx={{ mr: 2, fontFamily: "sans-serif", fontWeight: 700, letterSpacing: ".3rem" }}>PINGIFY</Typography>
            </Box>
            {}
            <Box sx={{ display: { xs: "flex", md: "none" } }}>
              <IconButton size="large" aria-label="navigation menu" aria-controls="menu-appbar-nav" aria-haspopup="true" onClick={handleOpenNavMenu} color="inherit"><MenuIcon /></IconButton>
              {}
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
             {}
             <Box onClick={() => navigate("/")} sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", cursor: "pointer", flexGrow: 1, justifyContent: 'center', pr: { xs: '48px', sm: 0 }  }}>
                {}
                <Box
                  component="img"
                  src={logo}
                  alt="Pingify Logo"
                  sx={{ height: 30, mr: 3 }}
                />
                {}
                <Typography variant="h5" noWrap component="div" sx={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: ".5rem"}}>PINGIFY</Typography>
             </Box>
            {}
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, ml: 2 }}>
              {pages.map((page) => (
                <Tooltip key={page.name} title={page.ariaLabel || page.name} arrow>
                  {}
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
          {}
          {}
          {!isDashboard && (
            <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, justifyContent: 'center', px: 2 }}>
              <StatsHeader
                isLoading={isLoadingStats && !overallStats}
                upCount={upWebsitesCount}
                totalCount={totalWebsitesCount}
                uptime={headerUptime}
                incidentsLast24h={incidentsLast24h}
                lastIncidentTimestamp={lastIncidentTimestamp}
                layoutMode="navbar"
              />
            </Box>
          )}
          {}
          {isDashboard && <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'block' } }} />}
          {}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexGrow: 0, gap: { xs: 0.5, sm: 1 } }}>
            <AlertsDropdown
                apiFilters={{ limit: 10 }}
                pollingInterval={60000}
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
                        fontSize: "1rem"
                    }}
                  >
                    {userInitial}
                  </Avatar>
                </IconButton>
            </Tooltip>
            {}
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