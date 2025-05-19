import React, { useState, useCallback } from "react";
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
  Checkbox,
  FormControlLabel,
  InputAdornment,
  IconButton,
  CircularProgress,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Login as LoginIcon,
} from "@mui/icons-material";
import { useLoginMutation } from "../hooks/api/useAuth";
import { ApiError } from "../types";
import FormNotification, {
  initialNotificationState, FormNotificationState
} from "../components/common/FormNotification";

interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

const LoginSchema = Yup.object().shape({
  email: Yup.string().email("Please enter a valid email address").required("Email is required"),
  password: Yup.string().required("Password is required"),
  rememberMe: Yup.boolean(),
});


const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState<FormNotificationState>(initialNotificationState);
  const { mutateAsync: loginUser, isPending: isLoggingIn  } = useLoginMutation();
  const navigate = useNavigate();

  const initialValues: LoginFormValues = { email: "", password: "", rememberMe: false };


  const handleSubmit = async (
    values: LoginFormValues,
    formikHelpers: FormikHelpers<LoginFormValues>
  ) => {
     setNotification(initialNotificationState);
    try {
      await loginUser({
          email: values.email,
          password: values.password,
          rememberMe: values.rememberMe
      });
      navigate("/");
    } catch (err) {
      const apiError = err as ApiError;
      const message = apiError.message || "Login failed. Please check your credentials.";
      setNotification({ open: true, message, severity: "error" });
      console.error("Login error:", apiError);
    } finally {
         formikHelpers.setSubmitting(false);
    }
  };


  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);


  const handleNotificationClose = useCallback((_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <Container maxWidth="sm" sx={{ mt: 4, mb: 8 }}>
      <Paper
        elevation={3}
        sx={{ p: 4, borderRadius: 2,  }}
      >
        <Box textAlign="center" mb={3}>
          <LoginIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
          <Typography component="h1" variant="h4" fontWeight="bold">Welcome Back</Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>Sign in to your account to continue</Typography>
        </Box>
        <Formik
          initialValues={initialValues}
          validationSchema={LoginSchema}
          onSubmit={handleSubmit}
        >
          {({ errors, touched, isSubmitting  }) => (
            <Form>
              {}
        
              <Grid container spacing={2}>
                {}
                 <Grid size={12}>
                  <Field as={TextField} required fullWidth id="email" name="email" label="Email Address" autoComplete="email" autoFocus error={touched.email && Boolean(errors.email)} helperText={touched.email && errors.email} InputProps={{ startAdornment: (<InputAdornment position="start"><EmailIcon color="action" /></InputAdornment>), }}/>
                </Grid>
                {}
                <Grid size={12}>
                   <Field as={TextField} required fullWidth id="password" name="password" type={showPassword ? "text" : "password"} label="Password" autoComplete="current-password" error={touched.password && Boolean(errors.password)} helperText={touched.password && errors.password} InputProps={{ startAdornment: (<InputAdornment position="start"><LockIcon color="action" /></InputAdornment>), endAdornment: (<InputAdornment position="end"><IconButton onClick={togglePasswordVisibility} edge="end">{showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}</IconButton></InputAdornment>),}}/>
                </Grid>
                {}
                 <Grid size={12}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Field as={FormControlLabel} control={<Checkbox name="rememberMe" color="primary"/>} label="Remember me"/>
                  </Box>
                </Grid>
                {}
                <Grid size={12} sx={{ mt: 2 }}>
                  <Button type="submit" fullWidth variant="contained" size="large" disabled={isLoggingIn || isSubmitting} sx={{ py: 1.5, borderRadius: 2, textTransform: "none", fontSize: "1rem" }}>
                    {isLoggingIn ? (
                        <>
                          <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                          Signing In...
                        </>
                     ) : (
                        "Sign In"
                     )}
                  </Button>
                </Grid>
                {}
                <Grid size={12} sx={{ mt: 2, textAlign: "center" }}>
                  <Typography variant="body2" color="textSecondary">Don't have an account? <Link to="/register" style={{ textDecoration: "none", color: "white" }}>Create account</Link></Typography>
                </Grid>
              </Grid>
            </Form>
          )}
        </Formik>
      </Paper>
       {}
       <FormNotification
         notification={notification}
         onClose={handleNotificationClose}
      />
    </Container>
  );
};
export default Login;