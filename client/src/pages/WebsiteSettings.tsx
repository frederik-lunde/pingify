// client/src/pages/WebsiteSettings.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Formik, Form, Field, FormikHelpers } from "formik";
import * as Yup from "yup";
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
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { useWebsite, useWebsiteCrud } from "../hooks";
import FormNotification, { 
  initialNotificationState,
  FormNotificationState
} from "../components/common/FormNotification";
import { handleFormSubmit } from "../utils/formUtils";
import { WebsiteUpdateDTO } from "../types";

// Form values interface
interface WebsiteSettingsFormValues {
  name: string;
  interval: number;
  alertEnabled: boolean;
  alertThreshold: string;
  notifyEmail: string;
}

// Validation schema using Yup
const WebsiteSettingsSchema = Yup.object().shape({
  name: Yup.string().required("Website name is required"),
  interval: Yup.number()
    .min(60, "Interval must be at least 60 seconds")
    .max(86400, "Interval must be at most 86400 seconds")
    .required("Interval is required"),
  alertEnabled: Yup.boolean(),
  alertThreshold: Yup.string()
    .when("alertEnabled", {
      is: true,
      then: (schema) => schema
        .test(
          "is-number",
          "Threshold must be a valid number",
          (value) => !value || !isNaN(Number(value))
        )
        .test(
          "min",
          "Threshold must be at least 100 milliseconds",
          (value) => !value || Number(value) >= 100
        ),
    }),
  notifyEmail: Yup.string()
    .when("alertEnabled", {
      is: true,
      then: (schema) => schema.email("Please enter a valid email address"),
    }),
});

interface WebsiteSettingsProps {
  websiteId: number; // Receive validated ID as a prop
}

const WebsiteSettings: React.FC<WebsiteSettingsProps> = ({ websiteId }) => {
  const navigate = useNavigate();
  
  // UI state
  const [notification, setNotification] = useState<FormNotificationState>(initialNotificationState);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Fetch website data
  const {
    data: website,
    loading: websiteLoading,
    error: websiteError,
  } = useWebsite(websiteId, 0); // Polling disabled by setting interval to 0

  // Website CRUD operations
  const { update, remove, loading: actionLoading } = useWebsiteCrud();

  // Initial form values
  const [initialValues, setInitialValues] = useState<WebsiteSettingsFormValues>({
    name: "",
    interval: 300,
    alertEnabled: false,
    alertThreshold: "",
    notifyEmail: "",
  });

  // Update initialValues when website data is loaded
  useEffect(() => {
    if (website) {
      setInitialValues({
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

  // Form submission handler
  const handleSubmit = async (
    values: WebsiteSettingsFormValues,
    formikHelpers: FormikHelpers<WebsiteSettingsFormValues>
  ) => {
    await handleFormSubmit({
      values,
      formikHelpers,
      submitFn: async (formValues) => {
        // Prepare update data
        const updateData: WebsiteUpdateDTO = {
          name: formValues.name.trim(),
          interval: parseInt(formValues.interval.toString()),
          alertEnabled: formValues.alertEnabled,
          alertThreshold: formValues.alertEnabled && formValues.alertThreshold
            ? parseInt(formValues.alertThreshold)
            : null,
          notifyEmail: formValues.alertEnabled ? formValues.notifyEmail || null : null,
        };

        return await update(websiteId, updateData);
      },
      setNotification,
      navigate,
      redirectPath: `/website/${websiteId}`,
      successMessage: "Settings saved successfully"
    });
  };

  // Delete website handler
  const handleDelete = useCallback(async () => {
    try {
      await remove(websiteId);
      
      setNotification({
        open: true,
        message: "Website removed successfully",
        severity: "success",
      });
      
      // Redirect after a short delay
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete website";
      
      setNotification({
        open: true,
        message: errorMessage,
        severity: "error",
      });
    }
  }, [websiteId, remove, navigate]);

  // Navigation handler
  const handleBackClick = useCallback(() => {
    navigate(`/website/${websiteId}`);
  }, [navigate, websiteId]);

  // Handle notification close
  const handleNotificationClose = () => {
    setNotification({
      ...notification,
      open: false
    });
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
  if (websiteError || (!websiteLoading && !website)) {
    // Check !website only *after* loading is false
    const errorMessage =
      websiteError?.message ||
      "Website not found or you do not have access to it.";
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={() => navigate("/")}
          data-testid="error-back-button"
        >
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
              onClick={handleBackClick}
              sx={{ mr: 2 }}
              aria-label="Back to website details"
            >
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="h4" component="h1">
            Website Settings
          </Typography>
        </Box>
      </Box>

      <Formik
        initialValues={initialValues}
        validationSchema={WebsiteSettingsSchema}
        onSubmit={handleSubmit}
        enableReinitialize={true} // Important: This makes Formik update when initialValues change
      >
        {({
          errors,
          touched,
          values,
          isSubmitting,
          status
        }) => (
          <Form>
            {status?.error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {status.error}
              </Alert>
            )}
            
            <Paper sx={{ p: 3, mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                General Settings
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Field
                    as={TextField}
                    fullWidth
                    label="Website Name"
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    required
                    data-testid="website-name-input"
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Field
                    as={TextField}
                    fullWidth
                    label="Check Interval (seconds)"
                    name="interval"
                    type="number"
                    error={touched.interval && Boolean(errors.interval)}
                    helperText={
                      (touched.interval && errors.interval) || 
                      "Minimum 60 seconds"
                    }
                    required
                    InputProps={{ inputProps: { min: 60 } }}
                    data-testid="interval-input"
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
                  <Field
                    as={Switch}
                    name="alertEnabled"
                    color="primary"
                    data-testid="alert-toggle"
                  />
                }
                label="Enable Alerts"
                sx={{ mb: 2 }}
              />

              {values.alertEnabled && (
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Field
                      as={TextField}
                      fullWidth
                      label="Response Time Threshold (ms)"
                      name="alertThreshold"
                      type="number"
                      error={touched.alertThreshold && Boolean(errors.alertThreshold)}
                      helperText={
                        (touched.alertThreshold && errors.alertThreshold) ||
                        "You'll receive alerts when response time exceeds this value"
                      }
                      InputProps={{ inputProps: { min: 100 } }}
                      data-testid="threshold-input"
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <Field
                      as={TextField}
                      fullWidth
                      label="Notification Email"
                      name="notifyEmail"
                      type="email"
                      error={touched.notifyEmail && Boolean(errors.notifyEmail)}
                      helperText={
                        (touched.notifyEmail && errors.notifyEmail) ||
                        "Email address to receive alert notifications"
                      }
                      data-testid="email-input"
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
                disabled={isSubmitting || actionLoading}
                data-testid="delete-button"
              >
                Remove Website
              </Button>

              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={isSubmitting || actionLoading}
                data-testid="save-button"
              >
                {isSubmitting || actionLoading ? "Saving..." : "Save Changes"}
              </Button>
            </Box>
          </Form>
        )}
      </Formik>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <Card sx={{ mb: 3, bgcolor: "error.light" }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Confirm Removal
            </Typography>
            <Typography variant="body1" paragraph>
              Are you sure you want to remove "{website?.name}" from your
              dashboard? This action cannot be undone.
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setDeleteConfirm(false)}
                data-testid="cancel-delete-button"
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleDelete}
                disabled={actionLoading}
                data-testid="confirm-delete-button"
              >
                {actionLoading ? "Removing..." : "Yes, Remove Website"}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Success/Error Notification */}
      <FormNotification 
        notification={notification}
        onClose={handleNotificationClose}
      />
    </Container>
  );
};

export default WebsiteSettings;