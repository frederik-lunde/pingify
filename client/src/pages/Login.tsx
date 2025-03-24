import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router'; // Fixed import for react-router-dom
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
  Snackbar
} from '@mui/material';
import Grid from '@mui/material/Grid2'; // Using Grid2 instead of legacy Grid
import { 
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Login as LoginIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { 
  validateLoginForm, 
  prepareLoginData, 
  LoginFormData,
  ValidationErrors
} from '../utils/validation/loginValidation';

const Login: React.FC = () => {
  // Form state
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false
  });
  
  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData((prev) => ({
      ...prev,
      [name]: newValue
    }));
    
    // Clear validation error when field is edited
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const errors = validateLoginForm(formData);
    setValidationErrors(errors);
    
    // Stop if there are validation errors
    if (Object.keys(errors).length > 0) return;
    
    try {
      // Prepare and submit login data
      const loginData = prepareLoginData(formData);
      await login(loginData.email, loginData.password, loginData.rememberMe);      
      
      // Show success message
      setSnackbarMessage('Login successful! Redirecting to dashboard...');
      setSnackbarOpen(true);
      
      // Redirect after short delay
      setTimeout(() => {
        navigate('/');
      }, 1000);
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    }
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
          background: theme => 
            `linear-gradient(120deg, ${theme.palette.background.paper} 60%, ${theme.palette.primary.dark}22 100%)`
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

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        
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
                error={!!validationErrors.email}
                helperText={validationErrors.email}
                autoComplete="email"
                autoFocus
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  )
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
                type={showPassword ? 'text' : 'password'}
                label="Password"
                value={formData.password}
                onChange={handleChange}
                error={!!validationErrors.password}
                helperText={validationErrors.password}
                autoComplete="current-password"
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
                        {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Grid>

            {/* Remember Me Checkbox */}
            <Grid size={12}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="rememberMe"
                      color="primary"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                    />
                  }
                  label="Remember me"
                />
                <Typography variant="body2" color="primary" sx={{ cursor: 'pointer' }}>
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
                disabled={loading}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1rem'
                }}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </Grid>

            {/* Sign Up Link */}
            <Grid size={12} sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="textSecondary">
                Don't have an account?{' '}
                <Link to="/register" style={{ textDecoration: 'none', color: 'primary.main' }}>
                  Create account
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
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity="success"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Login;