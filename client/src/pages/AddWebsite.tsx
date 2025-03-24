// client/src/pages/AddWebsite.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Switch,
  FormControlLabel,
  Snackbar,
  Alert,
  Tooltip,
  IconButton
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { Add as AddIcon, HelpOutline as HelpIcon } from '@mui/icons-material';
import { useWebsiteCrud } from '../api/hooks/useWebsites';
import { WebsiteCreateDTO, Website } from '../types';
import WebsiteUrlSearch from '../components/WebsiteUrlSearch';

const AddWebsite: React.FC = () => {
  const navigate = useNavigate();
  const { create, loading, error: apiError } = useWebsiteCrud();

  // Form state
  const [formData, setFormData] = useState<Partial<WebsiteCreateDTO>>({
    name: '',
    url: '',
    interval: 300, // Default: 5 minutes (in seconds)
    alertEnabled: false,
    alertThreshold: 1000, // Default: 1 second (in milliseconds)
    notifyEmail: '',
  });

  // UI state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newValue
    }));

    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Handle URL change from the search component
  const handleUrlChange = (url: string) => {
    setFormData(prev => ({ ...prev, url }));
    
    if (validationErrors.url) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.url;
        return newErrors;
      });
    }
  };

  // Handle website selection from search
  const handleWebsiteSelect = (website: Website | null) => {
    if (!website) return;
    
    // Suggest a name based on the URL if user hasn't entered one yet
    setFormData(prev => ({
      ...prev,
      name: prev.name || new URL(website.url).hostname.replace(/^www\./, '')
    }));
  };

  // Form validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      errors.name = 'Website name is required';
    }

    if (!formData.url?.trim()) {
      errors.url = 'URL is required';
    } else {
      try {
        new URL(formData.url);
      } catch (e) {
        errors.url = 'Please enter a valid URL (include http:// or https://)';
      }
    }

    if (formData.interval) {
      const interval = Number(formData.interval);
      if (isNaN(interval) || interval < 30 || interval > 86400) {
        errors.interval = 'Interval must be between 30 seconds and 1 day (86400 seconds)';
      }
    }

    if (formData.alertEnabled) {
      if (formData.alertThreshold) {
        const threshold = Number(formData.alertThreshold);
        if (isNaN(threshold) || threshold < 1 || threshold > 60000) {
          errors.alertThreshold = 'Threshold must be between 1 and 60000 milliseconds';
        }
      } else {
        errors.alertThreshold = 'Response threshold is required when alerts are enabled';
      }

      if (!formData.notifyEmail) {
        errors.notifyEmail = 'Email is required when alerts are enabled';
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.notifyEmail)) {
          errors.notifyEmail = 'Please enter a valid email address';
        }
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      // Build the WebsiteCreateDTO object
      const websiteData: WebsiteCreateDTO = {
        name: formData.name!.trim(),
        url: formData.url!.trim(),
        interval: Number(formData.interval),
        alertEnabled: formData.alertEnabled || false,
        alertThreshold: formData.alertEnabled ? Number(formData.alertThreshold) : null,
        notifyEmail: formData.alertEnabled ? formData.notifyEmail : null,
      };

      await create(websiteData);

      setSnackbarMessage('Website added successfully!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);

      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      setSnackbarMessage(apiError?.message || 'Failed to add website. Please try again.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Add Website to Monitor
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
          <Grid container spacing={3}>
            {/* Website Name */}
            <Grid size={12}>
              <TextField
                name="name"
                label="Website Name"
                value={formData.name}
                onChange={handleChange}
                fullWidth
                required
                variant="outlined"
                error={!!validationErrors.name}
                helperText={validationErrors.name || "A name to identify this website in your dashboard"}
              />
            </Grid>

            {/* Website URL with Search Component */}
            <Grid size={12}>
              <WebsiteUrlSearch
                value={formData.url || ''}
                onChange={handleUrlChange}
                onSelect={handleWebsiteSelect}
                error={validationErrors.url}
              />
            </Grid>

            {/* Check Interval */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                name="interval"
                label="Check Interval (seconds)"
                type="number"
                value={formData.interval}
                onChange={handleChange}
                fullWidth
                variant="outlined"
                error={!!validationErrors.interval}
                helperText={validationErrors.interval || "How often the website should be checked (in seconds). Minimum 30s."}
              />
            </Grid>

            {/* Alert Enable Switch */}
            <Grid size={12}>
              <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2, mt: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Alert Settings
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.alertEnabled}
                        onChange={handleChange}
                        name="alertEnabled"
                        color="primary"
                      />
                    }
                    label="Enable Alerts"
                  />
                  <Tooltip title="Get notified when the website goes down or response time exceeds threshold">
                    <IconButton size="small">
                      <HelpIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </Grid>

            {formData.alertEnabled && (
              <>
                {/* Response Time Threshold */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    name="alertThreshold"
                    label="Response Threshold (ms)"
                    type="number"
                    value={formData.alertThreshold}
                    onChange={handleChange}
                    fullWidth
                    variant="outlined"
                    error={!!validationErrors.alertThreshold}
                    helperText={validationErrors.alertThreshold || "Send an alert if response time exceeds this value (in milliseconds)"}
                  />
                </Grid>

                {/* Notification Email */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    name="notifyEmail"
                    label="Notification Email"
                    value={formData.notifyEmail}
                    onChange={handleChange}
                    fullWidth
                    variant="outlined"
                    error={!!validationErrors.notifyEmail}
                    helperText={validationErrors.notifyEmail || "Email address to receive alert notifications"}
                  />
                </Grid>
              </>
            )}

            {/* Buttons */}
            <Grid size={12} sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button variant="outlined" onClick={() => navigate('/')}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="contained" 
                disabled={loading} 
                startIcon={<AddIcon />}
              >
                {loading ? 'Adding...' : 'Add Website'}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AddWebsite;