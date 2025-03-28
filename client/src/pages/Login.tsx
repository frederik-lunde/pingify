import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Formik, Form, Field, FormikHelpers } from "formik";
import * as Yup from "yup";
import {
  Container,
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  IconButton,
  Snackbar,
} from "@mui/material";
import Grid from "@mui/material/Grid2"; // Using Grid2 instead of legacy Grid
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Login as LoginIcon,
} from "@mui/icons-material";
import { useAuth } from "../context/AuthContext";

// Login form values interface
interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

// Validation schema using Yup
const LoginSchema = Yup.object().shape({
  email: Yup.string()
    .email("Please enter a valid email address")
    .required("Email is required"),
  password: Yup.string().required("Password is required"),
  rememberMe: Yup.boolean(),
});

const Login: React.FC = () => {
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  const { login, loading, error: authError } = useAuth();
  const navigate = useNavigate();

  // Initial form values
  const initialValues: LoginFormValues = {
    email: "",
    password: "",
    rememberMe: false,
  };

  // Form submission handler
  const handleSubmit = async (
    values: LoginFormValues,
    { setSubmitting }: FormikHelpers<LoginFormValues>
  ) => {
    try {
      await login(values.email, values.password, values.rememberMe);

      // Show success message
      setSnackbarMessage("Login successful! Redirecting to dashboard...");
      setSnackbarOpen(true);

      // Redirect after short delay
      setTimeout(() => {
        navigate("/");
      }, 1000);
    } catch (err) {
      // Error will be handled by the auth context
      setSubmitting(false);
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
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
            Welcome Back
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Sign in to your account to continue
          </Typography>
        </Box>

        {authError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {authError}
          </Alert>
        )}

        <Formik
          initialValues={initialValues}
          validationSchema={LoginSchema}
          onSubmit={handleSubmit}
        >
          {({ errors, touched, handleChange, values, isSubmitting }) => (
            <Form>
              <Grid container spacing={2}>
                {/* Email Address */}
                <Grid size={12}>
                  <Field
                    as={TextField}
                    required
                    fullWidth
                    id="email"
                    name="email"
                    label="Email Address"
                    autoComplete="email"
                    autoFocus
                    error={touched.email && Boolean(errors.email)}
                    helperText={touched.email && errors.email}
                    onChange={handleChange}
                    value={values.email}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* Password */}
                <Grid size={12}>
                  <Field
                    as={TextField}
                    required
                    fullWidth
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    label="Password"
                    autoComplete="current-password"
                    error={touched.password && Boolean(errors.password)}
                    helperText={touched.password && errors.password}
                    onChange={handleChange}
                    value={values.password}
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

                {/* Remember Me Checkbox */}
                <Grid size={12}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Field
                      as={FormControlLabel}
                      control={
                        <Checkbox
                          name="rememberMe"
                          color="primary"
                          checked={values.rememberMe}
                          onChange={handleChange}
                        />
                      }
                      label="Remember me"
                    />
                    <Typography
                      variant="body2"
                      color="primary"
                      sx={{ cursor: "pointer" }}
                    >
                      Forgot password?
                    </Typography>
                  </Box>
                </Grid>

                {/* Submit Button */}
                <Grid size={12} sx={{ mt: 2 }}>
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={isSubmitting || loading}
                    sx={{
                      py: 1.5,
                      borderRadius: 2,
                      textTransform: "none",
                      fontSize: "1rem",
                    }}
                  >
                    {loading || isSubmitting ? "Signing In..." : "Sign In"}
                  </Button>
                </Grid>

                {/* Sign Up Link */}
                <Grid size={12} sx={{ mt: 2, textAlign: "center" }}>
                  <Typography variant="body2" color="textSecondary">
                    Don't have an account?{" "}
                    <Link
                      to="/register"
                      style={{ textDecoration: "none", color: "primary.main" }}
                    >
                      Create account
                    </Link>
                  </Typography>
                </Grid>
              </Grid>
            </Form>
          )}
        </Formik>
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

export default Login;