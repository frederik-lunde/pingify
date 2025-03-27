import * as React from "react";
import { useCallback } from "react";
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
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router";
import AddIcon from "@mui/icons-material/Add";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import AlertsDropdown from "./navbar/AlertDropdown";

const pages = [
  {
    name: "Add Website",
    path: "/add-website",
    icon: <AddIcon fontSize="small" />,
    ariaLabel: "Add new website to monitor",
  },
  {
    name: "Export Data",
    path: "#",
    icon: <ImportExportIcon fontSize="small" />,
    ariaLabel: "Export monitoring data",
  },
];

const settings = ["Profile", "Logout"];

function Navbar() {
  const [anchorElNav, setAnchorElNav] = React.useState<null | HTMLElement>(
    null,
  );
  const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(
    null,
  );

  const { logout, user } = useAuth();
  const navigate = useNavigate();

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
      navigate(path);
    },
    [navigate, handleCloseNavMenu],
  );

  const handleSettingClick = useCallback(
    async (setting: string) => {
      handleCloseUserMenu();
      if (setting === "Logout") {
        try {
          await logout();
          navigate("/login");
        } catch (error) {
          console.error("Failed to logout:", error);
        }
      } else if (setting === "Profile") {
        // Future implementation for profile page
        console.log("Profile clicked - not implemented yet");
      }
    },
    [logout, navigate, handleCloseUserMenu],
  );

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Left side - Logo/Brand */}
          <Box
            component="div"
            onClick={() => navigate("/")}
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <AdbIcon sx={{ mr: 1 }} />
          </Box>
          <Typography
            variant="h6"
            noWrap
            component="div"
            onClick={() => navigate("/")}
            sx={{
              mr: 2,
              display: { xs: "none", md: "flex" },
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: ".3rem",
              color: "inherit",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            PINGIFY
          </Typography>

          {/* Mobile Menu */}
          <Box sx={{ flexGrow: 1, display: { xs: "flex", md: "none" } }}>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElNav}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "left",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "left",
              }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{ display: { xs: "block", md: "none" } }}
            >
              {pages.map((page) => (
                <MenuItem
                  key={page.name}
                  onClick={() => handlePageClick(page.path)}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {page.icon}
                    <Typography>{page.name}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Menu>
          </Box>

          {/* Mobile Logo */}
          <Box
            component="div"
            onClick={() => navigate("/")}
            sx={{
              display: { xs: "flex", md: "none" },
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <AdbIcon sx={{ mr: 1 }} />
          </Box>
          <Typography
            variant="h5"
            noWrap
            component="div"
            onClick={() => navigate("/")}
            sx={{
              mr: 2,
              display: { xs: "flex", md: "none" },
              flexGrow: 1,
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: ".3rem",
              color: "inherit",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            PINGIFY
          </Typography>

          {/* Desktop Navigation */}
          <Box
            sx={{
              flexGrow: 1,
              display: { xs: "none", md: "flex" },
              gap: 2,
              ml: 3,
            }}
          >
            {pages.map((page) => (
              <Tooltip key={page.name} title={page.name} arrow>
                <IconButton
                  aria-label={page.ariaLabel}
                  onClick={() => handlePageClick(page.path)}
                  color="inherit"
                  size="large"
                >
                  {page.icon}
                </IconButton>
              </Tooltip>
            ))}
          </Box>

          {/* Right-aligned icons */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              ml: "auto",
            }}
          >
            {/* Alerts Dropdown Component */}
            <AlertsDropdown
              options={{
                limit: 50,
                isResolved: false,
              }}
            />

            {/* User Menu */}
            <Tooltip title="Open settings">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <Avatar
                  alt={user?.name}
                  sx={{
                    bgcolor: "primary.main",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                    fontSize: "1.2rem",
                  }}
                >
                  {user?.name?.charAt(0)?.toUpperCase() ||
                    user?.email?.charAt(0)?.toUpperCase() ||
                    "?"}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>

          {/* User Menu Dropdown */}
          <Menu
            sx={{ mt: "45px" }}
            id="menu-appbar"
            anchorEl={anchorElUser}
            anchorOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            keepMounted
            transformOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            open={Boolean(anchorElUser)}
            onClose={handleCloseUserMenu}
          >
            {settings.map((setting) => (
              <MenuItem
                key={setting}
                onClick={() => handleSettingClick(setting)}
              >
                <Typography sx={{ textAlign: "center" }}>{setting}</Typography>
              </MenuItem>
            ))}
          </Menu>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default Navbar;
