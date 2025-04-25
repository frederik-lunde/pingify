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
import { useAuth } from "../context/AuthContext"; // Assuming AuthContext provides structure similar to AuthContextType | null
import { useWebsiteData } from "../hooks";
import AlertsDropdown from "./navbar/AlertDropdown";
import StatsHeader from "../components/dashboard/StatsHeader";
// Import necessary types from your types file
import { AuthContextType, User } from "../types";

const pages = [
  { name: "Add Website", path: "/add-website", icon: <AddIcon fontSize="small" />, ariaLabel: "Add new website to monitor" },
];

const settings = ["Profile", "Logout"];

// Helper type guard to check if user is not null
function isUser(user: User | null): user is User {
  return user !== null;
}

function Navbar() {
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

  // Use the type from types.ts, assuming useAuth provides this structure or null
  // You might need to adjust the cast based on the actual return type of useAuth
  const auth = useAuth() as AuthContextType | null;
  const navigate = useNavigate();
  const location = useLocation();

  const {
      overallStats,
      incidentsLast24h,
      lastIncidentTimestamp,
      isLoading: isLoadingData,
      totalWebsitesCount,
      upWebsitesCount,
  } = useWebsiteData(
      'week', // Example timeframe
      60000   // Example polling interval
  );

  // --- Handle Null Auth Context ---
  // Check for loading state if your context provides it
  // if (auth?.loading) {
  //   return <AppBar position="static">...</AppBar>; // Render a loading skeleton navbar if desired
  // }

  // If not loading and still no auth object or user, render nothing or redirect.
  // Returning null is simple, but consider UX implications.
  if (!auth || !isUser(auth.user)) {
    // You might want to add a useEffect hook here to redirect to '/login' if not authenticated
    // after an initial check.
    return null;
  }
  // --- Now we know auth and auth.user are not null ---
  const { logout, user } = auth; // user is guaranteed User, logout is () => void or Promise<void>

  const headerUptime = useMemo(() => overallStats?.overallUptime ?? null, [overallStats]);

  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorElNav(event.currentTarget);
  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorElUser(event.currentTarget);
  const handleCloseNavMenu = useCallback(() => setAnchorElNav(null), []);
  const handleCloseUserMenu = useCallback(() => setAnchorElUser(null), []);

  const handlePageClick = useCallback((path: string) => {
    handleCloseNavMenu();
    if (path !== "#") navigate(path);
  }, [navigate, handleCloseNavMenu]);

  const handleSettingClick = useCallback(async (setting: string) => {
    handleCloseUserMenu();
    if (setting === "Logout") {
      try {
        // Ensure logout exists and is a function before calling
        if (typeof logout === 'function') {
            await logout(); // Await if logout returns a Promise
            navigate('/login');
        } else {
            console.error("Logout function not available in AuthContext");
            // Potentially navigate to login anyway or show an error
            navigate('/login');
        }
      }
      catch (error) { console.error("Failed to logout:", error); }
    } else if (setting === "Profile") {
      navigate("/profile");
    }
  }, [logout, navigate, handleCloseUserMenu]); // Include logout in dependency array


  const isDashboard = location.pathname === '/';
  // Safely access user properties now
  const userInitial = user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || "?";

  return (
    <AppBar position="static">
      <Container maxWidth={false} sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
        <Toolbar disableGutters>

          {/* --- Left Section --- */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: { xs: 0, md: 1 } }}>
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

            {/* Mobile Logo (Centered) */}
            <Box onClick={() => navigate("/")} sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", cursor: "pointer", flexGrow: 1, justifyContent: 'center' }}>
              <AdbIcon sx={{ mr: 1 }}/>
              <Typography variant="h5" noWrap component="div" sx={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: ".3rem" }}>PINGIFY</Typography>
            </Box>

            {/* Desktop Nav Links (Icons) */}
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, ml: 2 }}>
              {pages.map((page) => (
                <Tooltip key={page.name} title={page.ariaLabel || page.name} arrow>
                  {/* Wrap IconButton in span for Tooltip when needed (e.g., if disabled) */}
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

          {/* --- Center Section: Stats Header --- */}
          {/* Show stats header only when *not* on the dashboard page */}
          {!isDashboard && (
            <StatsHeader
              isLoading={isLoadingData && !overallStats} // Show loading if data is fetching and no stats are available yet
              upCount={upWebsitesCount}
              totalCount={totalWebsitesCount}
              uptime={headerUptime}
              incidentsLast24h={incidentsLast24h ?? 0} // Provide a default value if null/undefined
              lastIncidentTimestamp={lastIncidentTimestamp}
              center={true} // Prop to center the stats header
            />
          )}

          {/* --- Right Section: Controls --- */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexGrow: 0, gap: { xs: 0.5, sm: 1 } }}>
            {/* Alert Dropdown */}
            <AlertsDropdown
                // Remove status filter as it's not supported by AlertQueryOptions in types.ts
                apiFilters={{ limit: 10 }}
                pollingInterval={60000} // e.g., poll every minute
              />

            {/* User Menu Avatar Button */}
            <Tooltip title="Open settings">
                <IconButton onClick={handleOpenUserMenu} aria-label="open user menu" aria-controls="menu-appbar-user" aria-haspopup="true" sx={{ p: 0 }}>
                  <Avatar
                    alt={user.name || user.email || 'User'}
                    sx={{
                        width: { xs: 32, sm: 40 },
                        height: { xs: 32, sm: 40 },
                        bgcolor: "secondary.main", // Example color
                        color: (theme) => theme.palette.getContrastText(theme.palette.secondary.main),
                        fontSize: "1rem"
                    }}
                  >
                    {userInitial}
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
              {/* User Info Header in Menu */}
              <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle1" fontWeight="bold" noWrap>{user.name || 'User'}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>{user.email}</Typography>
              </Box>
              {/* Settings Menu Items */}
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