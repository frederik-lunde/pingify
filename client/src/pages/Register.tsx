// client/src/pages/Register.tsx
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
  InputAdornment,
  Tooltip,
  IconButton,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
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
import FormNotification, { 
  initialNotificationState,
  FormNotificationState
} from "../components/common/FormNotification";
import { handleFormSubmit } from "../utils/formUtils";

// Registration form values interface
interface RegisterFormValues {
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
}

// Validation schema using Yup
const RegisterSchema = Yup.object().shape({
  email: Yup.string()
    .email("Please enter a valid email address")
    .required("Email is required"),
  name: Yup.string().max(50, "Display name must be 50 characters or less"),
  password: Yup.string()
    .min(6, "Password must be at least 6 characters")
    .required("Password is required"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password")], "Passwords must match")
    .required("Confirm password is required"),
});

const Register: React.FC = () => {
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [notification, setNotification] = useState<FormNotificationState>(initialNotificationState);

  const { register, loading, error: authError } = useAuth();
  const navigate = useNavigate();

  // Initial form values
  const initialValues: RegisterFormValues = {
    email: "",
    name: "",
    password: "",
    confirmPassword: "",
  };

  // Form submission handler
  const handleSubmit = async (
    values: RegisterFormValues,
    formikHelpers: FormikHelpers<RegisterFormValues>
  ) => {
    await handleFormSubmit({
      values,
      formikHelpers,
      submitFn: async (formValues) => {
        await register(formValues.email, formValues.password, formValues.name || undefined);
      },
      setNotification,
      navigate,
      redirectPath: "/",
      successMessage: "Registration successful! Redirecting to dashboard..."
    });
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword((prev) => !prev);
  };

  // Handle notification close
  const handleNotificationClose = () => {
    setNotification({
      ...notification,
      open: false
    });
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

        <Formik
          initialValues={initialValues}
          validationSchema={RegisterSchema}
          onSubmit={handleSubmit}
        >
          {({ errors, touched, isSubmitting, status }) => (
            <Form>
              {status?.error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {status.error}
                </Alert>
              )}
              
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
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip title="We'll never share your email with anyone else">
                            <IconButton size="small" tabIndex={-1} aria-label="Email privacy info">
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
                  <Field
                    as={TextField}
                    fullWidth
                    id="name"
                    name="name"
                    label="Display Name (Optional)"
                    autoComplete="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
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
                  <Field
                    as={TextField}
                    required
                    fullWidth
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    label="Password"
                    autoComplete="new-password"
                    error={touched.password && Boolean(errors.password)}
                    helperText={touched.password && errors.password}
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
                  <Field
                    as={TextField}
                    required
                    fullWidth
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    label="Confirm Password"
                    autoComplete="new-password"
                    error={
                      touched.confirmPassword && Boolean(errors.confirmPassword)
                    }
                    helperText={
                      touched.confirmPassword && errors.confirmPassword
                    }
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
                            aria-label="toggle confirm password visibility"
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
                    disabled={isSubmitting || loading}
                    sx={{
                      py: 1.5,
                      borderRadius: 2,
                      textTransform: "none",
                      fontSize: "1rem",
                    }}
                    data-testid="register-button"
                  >
                    {loading || isSubmitting
                      ? "Creating Account..."
                      : "Create Account"}
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
            </Form>
          )}
        </Formik>
      </Paper>

      {/* Success/Error Notification */}
      <FormNotification 
        notification={notification}
        onClose={handleNotificationClose}
      />
    </Container>
  );
};

export default Register;