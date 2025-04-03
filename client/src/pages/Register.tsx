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
  CircularProgress, // Import CircularProgress
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
// Import the mutation hook, remove useAuth context usage for register
import { useRegisterMutation } from "../hooks/api/useAuth"; // Adjust path
import { ApiError } from "../types"; // Adjust path
import FormNotification from "../components/common/FormNotification"; // Keep if used for success message

// Register form values interface - unchanged
interface RegisterFormValues {
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
}

// Validation schema using Yup - unchanged
const RegisterSchema = Yup.object().shape({
  email: Yup.string().email("Please enter a valid email address").required("Email is required"),
  name: Yup.string().max(50, "Display name must be 50 characters or less"),
  password: Yup.string().min(6, "Password must be at least 6 characters").required("Password is required"),
  confirmPassword: Yup.string().oneOf([Yup.ref("password")], "Passwords must match").required("Confirm password is required"),
});

const Register: React.FC = () => {
  // UI state - unchanged
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Keep FormNotification state if you still want success messages
  // const [notification, setNotification] = useState<FormNotificationState>(initialNotificationState);

  // --- Use the register mutation hook ---
  const { mutateAsync: registerUser, isPending: isRegistering, error: registerError } = useRegisterMutation();
  const navigate = useNavigate();

  // Initial form values - unchanged
  const initialValues: RegisterFormValues = { email: "", name: "", password: "", confirmPassword: "" };

  // Form submission handler - uses mutateAsync
  const handleSubmit = async (
    values: RegisterFormValues,
    formikHelpers: FormikHelpers<RegisterFormValues>
  ) => {
     formikHelpers.setStatus({ error: null }); // Clear previous form error
    try {
        // Call the mutation
        await registerUser({
            email: values.email,
            password: values.password,
            name: values.name || undefined // Pass undefined if name is empty
        });
         // On success, navigate after token storage/invalidation handled by mutation's onSuccess
         // Optionally show success notification before navigating
         // setNotification({ open: true, message: "Registration successful!", severity: "success" });
         // setTimeout(() => navigate("/"), 1500); // Delay navigation for notification
         navigate("/"); // Navigate immediately

    } catch (err) {
        // Catch errors from the mutation
        const apiError = err as ApiError;
        formikHelpers.setStatus({ error: apiError.message || "Registration failed. Please try again." });
        console.error("Registration error:", apiError);
    } finally {
         formikHelpers.setSubmitting(false);
    }
    // Remove old handleFormSubmit logic if not needed for complex success handling
  };

  // Toggle password visibility - unchanged
  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword((prev) => !prev);
  // const handleNotificationClose = () => setNotification({ ...notification, open: false }); // Keep if using FormNotification

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 8 }}>
      <Paper
        elevation={3}
        sx={{ p: 4, borderRadius: 2, /* background gradient */ }}
      >
        <Box textAlign="center" mb={3}>
            <LoginIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
            <Typography component="h1" variant="h4" fontWeight="bold">Create Account</Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>Sign up to start monitoring your websites</Typography>
        </Box>

        {/* Display direct mutation error if not handled by Formik status */}
        {/* Usually prefer Formik status for consistency */}
        {/* {registerError && !status?.error && (
            <Alert severity="error" sx={{ mb: 3 }}>{registerError.message}</Alert>
        )} */}

        <Formik
          initialValues={initialValues}
          validationSchema={RegisterSchema}
          onSubmit={handleSubmit}
        >
          {({ errors, touched, isSubmitting, status }) => (
            <Form>
               {/* Display form-level errors from Formik status */}
              {status?.error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {status.error}
                </Alert>
              )}

              <Grid container spacing={2}>
                 {/* Email Field - unchanged */}
                 <Grid size={12}>
                     <Field as={TextField} required fullWidth id="email" name="email" label="Email Address" autoComplete="email" autoFocus error={touched.email && Boolean(errors.email)} helperText={touched.email && errors.email} InputProps={{ startAdornment: (<InputAdornment position="start"><EmailIcon color="action" /></InputAdornment>), endAdornment: (<InputAdornment position="end"><Tooltip title="We'll never share your email"><IconButton size="small" tabIndex={-1}><HelpIcon fontSize="small" /></IconButton></Tooltip></InputAdornment>), }}/>
                 </Grid>

                 {/* Name Field - unchanged */}
                 <Grid size={12}>
                     <Field as={TextField} fullWidth id="name" name="name" label="Display Name (Optional)" autoComplete="name" error={touched.name && Boolean(errors.name)} helperText={touched.name && errors.name} InputProps={{ startAdornment: (<InputAdornment position="start"><PersonIcon color="action" /></InputAdornment>), }}/>
                 </Grid>

                 {/* Password Field - unchanged */}
                 <Grid size={12}>
                    <Field as={TextField} required fullWidth id="password" name="password" type={showPassword ? "text" : "password"} label="Password" autoComplete="new-password" error={touched.password && Boolean(errors.password)} helperText={touched.password && errors.password} InputProps={{ startAdornment: (<InputAdornment position="start"><LockIcon color="action" /></InputAdornment>), endAdornment: (<InputAdornment position="end"><IconButton onClick={togglePasswordVisibility} edge="end">{showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}</IconButton></InputAdornment>),}}/>
                 </Grid>

                 {/* Confirm Password Field - unchanged */}
                <Grid size={12}>
                    <Field as={TextField} required fullWidth id="confirmPassword" name="confirmPassword" type={showConfirmPassword ? "text" : "password"} label="Confirm Password" autoComplete="new-password" error={touched.confirmPassword && Boolean(errors.confirmPassword)} helperText={touched.confirmPassword && errors.confirmPassword} InputProps={{ startAdornment: (<InputAdornment position="start"><LockIcon color="action" /></InputAdornment>), endAdornment: (<InputAdornment position="end"><IconButton onClick={toggleConfirmPasswordVisibility} edge="end">{showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}</IconButton></InputAdornment>),}}/>
                </Grid>

                {/* Submit Button - uses isRegistering from mutation */}
                <Grid size={12} sx={{ mt: 2 }}>
                  <Button type="submit" fullWidth variant="contained" size="large" disabled={isRegistering || isSubmitting} sx={{ py: 1.5, borderRadius: 2, textTransform: "none", fontSize: "1rem" }} data-testid="register-button">
                    {isRegistering ? (
                         <>
                          <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                          Creating Account...
                        </>
                     ) : (
                        "Create Account"
                     )}
                  </Button>
                </Grid>

                {/* Sign In Link - unchanged */}
                <Grid size={12} sx={{ mt: 2, textAlign: "center" }}>
                  <Typography variant="body2" color="textSecondary">Already have an account? <Link to="/login" style={{ textDecoration: "none", color: "primary.main" }}>Sign in</Link></Typography>
                </Grid>
              </Grid>
            </Form>
          )}
        </Formik>
      </Paper>

      {/* Optional: Success/Error Notification - Keep if desired */}
      {/* <FormNotification notification={notification} onClose={handleNotificationClose} /> */}
    </Container>
  );
};

export default Register;