import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Snackbar,
} from "@mui/material";
import Grid from "@mui/material/Grid2"; // Using Grid2 instead of legacy Grid
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useWebsite, useWebsiteCrud } from "../hooks"; // Import from the new hooks directory

const WebsiteSettings: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const websiteId = parseInt(id || "0", 10);
  const navigate = useNavigate();

  // Use our new hooks for data fetching with polling disabled for this settings page
  const {
    data: website,
    loading: websiteLoading,
    error: websiteError,
  } = useWebsite(websiteId, 0, { enabled: false, fetchOnMount: true });

  // Use our website CRUD hook
  const { update, remove, loading: actionLoading } = useWebsiteCrud();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    interval: 300,
    alertEnabled: false,
    alertThreshold: "",
    notifyEmail: "",
  });

  // UI state
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<
    "success" | "error" | "info"
  >("success");

  // Initialize form when website data is loaded
  useEffect(() => {
    if (website) {
      setFormData({
        name: website.name || "",
        interval: website.interval || 300,
        alertEnabled: website.alertEnabled,
        alertThreshold: website.alertThreshold
          ? website.alertThreshold.toString()
          : "",
        notifyEmail: website.notifyEmail || "",
      });
    }
  }, [website]);

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Submit form and update website
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    setError("");

    try {
      await update(websiteId, {
        name: formData.name,
        interval: parseInt(formData.interval.toString()),
        alertEnabled: formData.alertEnabled,
        alertThreshold: formData.alertThreshold
          ? parseInt(formData.alertThreshold)
          : null,
        notifyEmail: formData.notifyEmail || null,
      });

      showSnackbar("Settings saved successfully");

      // Short delay then navigate back to website details
      setTimeout(() => navigate(`/website/${websiteId}`), 1000);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to update website settings";
      setError(errorMessage);
      showSnackbar("Error: " + errorMessage, "error");
    }
  };

  // Delete website
  const handleDelete = async () => {
    try {
      await remove(websiteId);
      showSnackbar("Website removed successfully");
      setTimeout(() => navigate("/"), 1000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete website";
      setError(errorMessage);
      showSnackbar("Error: " + errorMessage, "error");
    }
  };

  // Show snackbar helper
  const showSnackbar = (
    message: string,
    severity: "success" | "error" | "info" = "success",
  ) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  // Loading state
  if (websiteLoading && !website) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // Error state
  if (websiteError || !website) {
    const errorMessage =
      websiteError?.message ||
      "Website not found or you do not have access to it.";
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")}>
          Return to Dashboard
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box
        sx={{
          mb: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Tooltip title="Back to Website Details">
            <IconButton
              onClick={() => navigate(`/website/${websiteId}`)}
              sx={{ mr: 2 }}
            >
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="h4" component="h1">
            Website Settings
          </Typography>
        </Box>
      </Box>

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            General Settings
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Website Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Check Interval (seconds)"
                name="interval"
                type="number"
                value={formData.interval}
                onChange={handleChange}
                required
                InputProps={{ inputProps: { min: 60 } }}
                helperText="Minimum 60 seconds"
              />
            </Grid>
          </Grid>
        </Paper>

        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Alert Settings
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <FormControlLabel
            control={
              <Switch
                name="alertEnabled"
                checked={formData.alertEnabled}
                onChange={handleChange}
              />
            }
            label="Enable Alerts"
            sx={{ mb: 2 }}
          />

          {formData.alertEnabled && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Response Time Threshold (ms)"
                  name="alertThreshold"
                  type="number"
                  value={formData.alertThreshold}
                  onChange={handleChange}
                  helperText="You'll receive alerts when response time exceeds this value"
                  InputProps={{ inputProps: { min: 100 } }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Notification Email"
                  name="notifyEmail"
                  type="email"
                  value={formData.notifyEmail}
                  onChange={handleChange}
                  helperText="Email address to receive alert notifications"
                />
              </Grid>
            </Grid>
          )}
        </Paper>

        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 4 }}>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteConfirm(true)}
          >
            Remove Website
          </Button>

          <Button
            type="submit"
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={actionLoading}
          >
            {actionLoading ? "Saving..." : "Save Changes"}
          </Button>
        </Box>
      </form>

      {deleteConfirm && (
        <Card sx={{ mb: 3, bgcolor: "error.light" }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Confirm Removal
            </Typography>
            <Typography variant="body1" paragraph>
              Are you sure you want to remove "{website.name}" from your
              dashboard? This action cannot be undone.
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleDelete}
                disabled={actionLoading}
              >
                {actionLoading ? "Removing..." : "Yes, Remove Website"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Feedback Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: "100%" }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default WebsiteSettings;
