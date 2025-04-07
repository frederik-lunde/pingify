// client/src/components/Navbar.tsx
import * as React from "react";
import { useCallback, useState, useMemo } from "react";
import { useLocation } from 'react-router'; // Import useLocation
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
// Removed direct stats imports if only used in StatsHeader now
// import Stack from "@mui/material/Stack";
// import Chip from "@mui/material/Chip";
// import CircularProgress from "@mui/material/CircularProgress";
// import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
// import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
// import WarningAmberIcon from '@mui/icons-material/WarningAmber';
// import { useTheme } from '@mui/material/styles';

import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router";
import AlertsDropdown from "./navbar/AlertDropdown";
import { useWebsiteData } from "../hooks/domain/useWebsiteData"; // Keep hook call
import StatsHeader from "./dashboard/StatsHeader"; // Import the new component
// Keep formatters if needed elsewhere, otherwise StatsHeader imports them
// import { getStatusColor, getResponseTimeColor, formatUptime, formatResponseTime } from "../utils/statusUtils";

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

// type StatusColorKey = 'success' | 'warning' | 'error' | 'default'; // Moved to StatsHeader

function Navbar() {
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

  const { logout, user } = useAuth();
  const navigate = useNavigate();
  // const theme = useTheme(); // Moved to StatsHeader if only used there
  const location = useLocation(); // Get location object

  // --- Fetch Website Data (Still needed for conditional display) ---
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

  // Memoize only the stats needed from overallStats
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
  // ... (handlers remain the same)
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
        } catch (error) {
          console.error("Failed to logout:", error);
        }
      } else if (setting === "Profile") {
         navigate("/profile");
      }
    },
    [logout, navigate],
  );

  // const getChipBackgroundColor = ... // Moved to StatsHeader
  // const getUpDownChipProps = ... // Moved to StatsHeader

  // --- Render Logic ---
  const isDashboard = location.pathname === '/'; // Check if on Dashboard route

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>

          {/* === Left Section === */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: { xs: 0, md: 1 } }}>
            {/* ... (rest of Left Section) ... */}
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
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, ml: 2 }}>
              {pages.map((page) => (
                <Tooltip key={page.name} title={page.ariaLabel || page.name} arrow>
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


          {/* === Center Section (Conditional Stats) === */}
          {/* Render StatsHeader ONLY if NOT on the dashboard */}
          {!isDashboard && (
            <StatsHeader
              isLoading={isLoadingData}
              error={dataError}
              upCount={upWebsitesCount}
              totalCount={totalWebsitesCount}
              uptime={otherStatsValues.uptime}
              responseTime={otherStatsValues.responseTime}
              center={true} // Explicitly use centered layout for Navbar
            />
          )}


          {/* === Right Section === */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexGrow: { xs: 0, md: 1 } }}>
             {/* ... (rest of Right Section) ... */}
             <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 2 } }}>
              <AlertsDropdown
                options={{ limit: 50 }}
                pollingInterval={60000}
              />
              <Tooltip title="Open settings">
                <IconButton
                  onClick={handleOpenUserMenu}
                  sx={{ p: 0 }}
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
                      fontSize: "1rem",
                    }}
                  >
                    {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "?"}
                  </Avatar>
                </IconButton>
              </Tooltip>
            </Box>
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
                  <Typography sx={{ textAlign: "center" }}>{setting}</Typography>
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