import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import {
  Container,
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  Tooltip,
  IconButton,
  Snackbar,
} from "@mui/material";
import Grid from "@mui/material/Grid2"; // Using Grid2 instead of legacy Grid
import {
  Email as EmailIcon,
  Person as PersonIcon,
  Lock as LockIcon,
  HelpOutline as HelpIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Login as LoginIcon,
} from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";
import { useForm } from "../hooks"; // Import from the new hooks directory

//Should replace with useForm
import {
  validateRegistrationForm,
  prepareRegistrationData,
  RegisterFormData,
} from "../utils/validation/registerValidation";

const Register: React.FC = () => {
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const { register, loading, error: authError } = useAuth();
  const navigate = useNavigate();

  // Use our new form hook
  const {
    values: formData,
    errors,
    handleChange,
    handleSubmit,
    setFieldValue, //look into
  } = useForm<RegisterFormData>({
    initialValues: {
      email: "",
      name: "",
      password: "",
      confirmPassword: "",
    },
    validator: validateRegistrationForm,
    onSubmit: async (values) => {
      try {
        // Prepare and submit registration data
        const registrationData = prepareRegistrationData(values);
        await register(
          registrationData.email,
          registrationData.password,
          registrationData.name,
        );

        // Show success message
        setSnackbarMessage(
          "Registration successful! Redirecting to dashboard...",
        );
        setSnackbarOpen(true);

        // Redirect after short delay
        setTimeout(() => {
          navigate("/");
        }, 1500);
      } catch (err) {
        // Error will be handled by the auth context
      }
    },
  });

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword((prev) => !prev);
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 8 }}>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          borderRadius: 2,
          background: (theme) =>
            `linear-gradient(120deg, ${theme.palette.background.paper} 60%, ${theme.palette.primary.dark}22 100%)`,
        }}
      >
        <Box textAlign="center" mb={3}>
          <LoginIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
          <Typography component="h1" variant="h4" fontWeight="bold">
            Create Account
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Sign up to start monitoring your websites
          </Typography>
        </Box>

        {authError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {authError}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {/* Email Address */}
            <Grid size={12}>
              <TextField
                required
                fullWidth
                id="email"
                name="email"
                label="Email Address"
                value={formData.email}
                onChange={handleChange}
                error={!!errors.email}
                helperText={errors.email}
                autoComplete="email"
                autoFocus
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="We'll never share your email with anyone else">
                        <IconButton size="small" tabIndex={-1}>
                          <HelpIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Display Name */}
            <Grid size={12}>
              <TextField
                fullWidth
                id="name"
                name="name"
                label="Display Name (Optional)"
                value={formData.name}
                onChange={handleChange}
                error={!!errors.name}
                helperText={errors.name}
                autoComplete="name"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Password */}
            <Grid size={12}>
              <TextField
                required
                fullWidth
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                label="Password"
                value={formData.password}
                onChange={handleChange}
                error={!!errors.password}
                helperText={errors.password}
                autoComplete="new-password"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={togglePasswordVisibility}
                        edge="end"
                        aria-label="toggle password visibility"
                      >
                        {showPassword ? (
                          <VisibilityOffIcon />
                        ) : (
                          <VisibilityIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Confirm Password */}
            <Grid size={12}>
              <TextField
                required
                fullWidth
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                label="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={!!errors.confirmPassword}
                helperText={errors.confirmPassword}
                autoComplete="new-password"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={toggleConfirmPasswordVisibility}
                        edge="end"
                        aria-label="toggle password visibility"
                      >
                        {showConfirmPassword ? (
                          <VisibilityOffIcon />
                        ) : (
                          <VisibilityIcon />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Submit Button */}
            <Grid size={12} sx={{ mt: 2 }}>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: "none",
                  fontSize: "1rem",
                }}
              >
                {loading ? "Creating Account..." : "Create Account"}
              </Button>
            </Grid>

            {/* Sign In Link */}
            <Grid size={12} sx={{ mt: 2, textAlign: "center" }}>
              <Typography variant="body2" color="textSecondary">
                Already have an account?{" "}
                <Link
                  to="/login"
                  style={{ textDecoration: "none", color: "primary.main" }}
                >
                  Sign in
                </Link>
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Success Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity="success"
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Register;
