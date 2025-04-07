// src/pages/AddWebsite.tsx
import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router"; // Use react-router-dom
import { Formik, Form, Field, FormikHelpers } from "formik";
import * as Yup from "yup";
import {
  Container, Paper, Typography, TextField, Button, Box, Switch,
  FormControlLabel, Alert, Tooltip, IconButton, CircularProgress,
} from "@mui/material";
// --- Use Grid v2 ---
import Grid from "@mui/material/Grid2";
// --- End Grid v2 ---
import { Add as AddIcon, HelpOutline as HelpIcon } from "@mui/icons-material";

// --- Import SHARED Types ---
import {
    AddWebsiteUserDTO,
    Website,
    WebsiteUser,
    ApiError
} from "../types"; // Adjust path

// --- Import Components ---
import WebsiteUrlSearch from "../components/WebsiteUrlSearch"; // Adjust path
import FormNotification, {
  initialNotificationState, FormNotificationState
} from "../components/common/FormNotification"; // Adjust path

// --- Import Hooks ---
import { useWebsiteMutations } from "../hooks/api/useWebsites"; // Adjust path


// Helper to ensure URL has a protocol
const ensureUrlProtocol = (url: string): string => {
    if (!url) return "";
    if (!/^(https?|ftp):\/\//i.test(url)) { return `https://${url}`; }
    return url;
};

// Form values interface
interface AddWebsiteFormValues {
  name: string;
  url: string;
  interval: number;
  alertEnabled: boolean;
  alertThreshold: number | string;
  notifyEmail: string;
}

// URL validation regex
const websiteUrlRegex = /^(https?:\/\/)((([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)+([a-zA-Z]{2,}|[0-9]{1,3})(\.[0-9]{1,3})?|localhost)(:[0-9]+)?(\/.*)?$/i;

// Validation schema using Yup
const AddWebsiteSchema = Yup.object().shape({
  name: Yup.string().trim().required("Website name is required"),
  url: Yup.string()
    .trim()
    .transform(value => ensureUrlProtocol(value))
    .matches(websiteUrlRegex, "Enter a valid URL (e.g., https://example.com)")
    .required("URL is required"),
  interval: Yup.number()
    .typeError("Interval must be a number")
    .integer("Interval must be a whole number")
    .min(30, "Interval must be at least 30 seconds")
    .max(86400, "Interval must be at most 1 day (86400s)")
    .required("Check interval is required"),
  alertEnabled: Yup.boolean(),
  alertThreshold: Yup.number()
    .when("alertEnabled", ([alertEnabled], schema) => { // Updated Yup v1+ syntax
        return alertEnabled
            ? schema
                .typeError("Threshold must be a number")
                .min(1, "Threshold must be at least 1ms")
                .max(60000, "Threshold must be 1 min (60000ms) or less")
                .required("Response threshold is required when alerts are enabled")
            : schema.optional().nullable();
    }),
  notifyEmail: Yup.string()
    .email("Enter a valid email address")
     .when("alertEnabled", ([alertEnabled], schema) => { // Updated Yup v1+ syntax
         return alertEnabled
             ? schema.required("Email is required for alerts")
             : schema.optional().nullable();
     }),
});

const AddWebsite: React.FC = () => {
  const navigate = useNavigate();
  // Use refactored hook names
  const {
      addWebsite,
      isAdding,
      errorAdding,
      isTriggeringCheck
    } = useWebsiteMutations();
  const [notification, setNotification] = useState<FormNotificationState>(initialNotificationState);

  // Combined loading state for UI disabling
  const isProcessing = isAdding || isTriggeringCheck;

  const initialValues: AddWebsiteFormValues = {
    name: "",
    url: "",
    interval: 300, // Default 5 minutes
    alertEnabled: false,
    alertThreshold: "", // Start empty for input flexibility
    notifyEmail: "",
  };

  const handleSubmit = async (
    values: AddWebsiteFormValues,
    formikHelpers: FormikHelpers<AddWebsiteFormValues>
  ) => {
    const { setSubmitting, setStatus } = formikHelpers;
    setStatus(null);
    setNotification(initialNotificationState);

    const websiteData: AddWebsiteUserDTO = {
      name: values.name.trim() || null,
      url: ensureUrlProtocol(values.url.trim()),
      interval: Number(values.interval), // Convert string/number to number
      alertEnabled: values.alertEnabled,
      alertThreshold: values.alertEnabled && values.alertThreshold !== ""
          ? Number(values.alertThreshold)
          : null,
      notifyEmail: values.alertEnabled && values.notifyEmail.trim() !== ""
          ? values.notifyEmail.trim()
          : null,
    };

     // Pre-submit validation (redundant with Yup but provides immediate feedback)
     if (isNaN(websiteData.interval!) || websiteData.interval! < 30) {
         setStatus({ error: "Invalid interval value." });
         setNotification({ open: true, message: "Error: Invalid check interval.", severity: "error" });
         setSubmitting(false);
         return;
     }
     if (websiteData.alertEnabled && (websiteData.alertThreshold === null || isNaN(websiteData.alertThreshold!) || websiteData.alertThreshold! < 1 )) {
         setStatus({ error: "Invalid alert threshold value." });
         setNotification({ open: true, message: "Error: Invalid alert threshold (must be >= 1ms).", severity: "error" });
         setSubmitting(false);
         return;
     }


    try {
      const newWebsiteUser: WebsiteUser = await addWebsite(websiteData);
      const successName = newWebsiteUser.name || newWebsiteUser.website?.url || 'Website';
      setNotification({ open: true, message: `Website "${successName}" added successfully! Initial check triggered.`, severity: "success" });
      setTimeout(() => navigate("/"), 2000); // Redirect after delay
    } catch (err) {
      const apiError = err as ApiError;
      console.error("Failed to add website:", apiError);
      const message = apiError?.data?.message || apiError?.message || "An unexpected error occurred.";
      setStatus({ error: message });
      setNotification({ open: true, message: `Error: ${message}`, severity: "error" });
      // Ensure submitting is set to false on error *if* Formik doesn't do it automatically
      setSubmitting(false);
    }
  };

  const handleNotificationClose = useCallback(() => {
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

   const handleUrlSelect = useCallback((
        website: Website | null,
        setFieldValue: FormikHelpers<AddWebsiteFormValues>['setFieldValue'], // Use Formik's type
        currentName: string
    ) => {
        if (website?.url) {
             const formattedUrl = ensureUrlProtocol(website.url);
             setFieldValue("url", formattedUrl, true);

             if (!currentName) {
                try {
                  const hostname = new URL(formattedUrl).hostname.replace(/^www\./, "");
                  setFieldValue("name", hostname, true);
                } catch (e) {
                  console.error("Invalid URL format for prefilling name:", formattedUrl, e);
                }
             }
        }
    }, []); // Dependencies: none, uses args directly

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 } }}> {/* Added elevation */}
        <Typography variant="h4" component="h1" gutterBottom>
          Add Website to Monitor
        </Typography>

        <Formik
          initialValues={initialValues}
          validationSchema={AddWebsiteSchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ errors, touched, values, isSubmitting, setFieldValue, status, dirty, isValid }) => (
            <Form noValidate>
              {status?.error && (
                <Alert severity="error" sx={{ mb: 3 }}>{status.error}</Alert>
              )}
              {errorAdding && !status?.error && (
                 <Alert severity="error" sx={{ mb: 3 }}>{ (errorAdding as ApiError).message || 'Failed to add website.' }</Alert>
              )}

              <Box sx={{ mt: 3 }}>
                {/* Grid v2 container */}
                <Grid container spacing={3}>

                  {/* Website Name */}
                  <Grid size={12}> {/* Grid v2 size prop */}
                    <Field
                      as={TextField}
                      name="name"
                      label="Website Name"
                      fullWidth
                      required
                      variant="outlined"
                      error={touched.name && Boolean(errors.name)}
                      helperText={touched.name && errors.name ? errors.name : "A name for your dashboard (e.g., My Blog)"}
                      disabled={isSubmitting || isProcessing}
                    />
                  </Grid>

                  {/* Website URL Search Component */}
                  <Grid size={12}> {/* Grid v2 size prop */}
                    <WebsiteUrlSearch
                      name="url" // Name matches Formik field
                      label="Website URL"
                      placeholder="https://example.com"
                      helperText="Enter the full URL including https://"
                      searchLimit={10}
                      disabled={isSubmitting || isProcessing}
                      onSelect={(website) => handleUrlSelect(website, setFieldValue, values.name)}
                      // Pass Formik state down for validation display
                      error={touched.url && Boolean(errors.url)}
                      errorMessage={touched.url && errors.url ? errors.url : undefined}
                      required // Mark visually required
                    />
                  </Grid>

                  {/* Check Interval */}
                  <Grid size={{ xs: 12, sm: 6 }}> {/* Grid v2 responsive size prop */}
                    <Field
                      as={TextField}
                      name="interval"
                      label="Check Interval (seconds)"
                      type="number"
                      fullWidth
                      required
                      variant="outlined"
                      error={touched.interval && Boolean(errors.interval)}
                      helperText={touched.interval && errors.interval ? errors.interval : "Minimum 30 seconds"}
                      InputProps={{ inputProps: { min: 30, step: 30 } }}
                      disabled={isSubmitting || isProcessing}
                    />
                  </Grid>

                   {/* Empty Grid item for spacing if needed on smaller screens */}
                   <Grid size={{ xs: 0, sm: 6 }} />

                  {/* Alert Settings Section */}
                  <Grid size={12} sx={{ borderTop: 1, borderColor: "divider", pt: 3, mt: 2 }}>
                    <Typography variant="h6" gutterBottom>Alert Settings</Typography>
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <FormControlLabel
                        control={
                          <Field
                            as={Switch}
                            name="alertEnabled"
                            color="primary"
                            disabled={isSubmitting || isProcessing}
                          />
                        }
                        label="Enable Downtime/Slow Alerts"
                      />
                      <Tooltip title="Get notified via email when the website goes down or response time exceeds the threshold.">
                        <IconButton size="small" tabIndex={-1} sx={{ ml: 0.5 }}><HelpIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </Box>
                  </Grid>

                  {/* Conditional Alert Fields */}
                  {values.alertEnabled && (
                    <>
                      <Grid size={{ xs: 12, sm: 6 }}> {/* Grid v2 responsive size prop */}
                        <Field
                          as={TextField}
                          name="alertThreshold"
                          label="Slow Response Threshold (ms)"
                          type="number"
                          fullWidth
                          variant="outlined"
                          required={values.alertEnabled}
                          error={touched.alertThreshold && Boolean(errors.alertThreshold)}
                          helperText={touched.alertThreshold && errors.alertThreshold ? errors.alertThreshold : "Alert if response > value (e.g., 2000)"}
                          InputProps={{ inputProps: { min: 1 } }}
                          disabled={isSubmitting || isProcessing}
                        />
                      </Grid>

                      <Grid size={{ xs: 12, sm: 6 }}> {/* Grid v2 responsive size prop */}
                        <Field
                          as={TextField}
                          name="notifyEmail"
                          label="Notification Email"
                          type="email"
                          fullWidth
                          variant="outlined"
                          required={values.alertEnabled}
                          error={touched.notifyEmail && Boolean(errors.notifyEmail)}
                          helperText={touched.notifyEmail && errors.notifyEmail ? errors.notifyEmail : "Email address to receive alerts"}
                          disabled={isSubmitting || isProcessing}
                        />
                      </Grid>
                    </>
                  )}

                  {/* Action Buttons */}
                  <Grid size={12} sx={{ mt: 3, display: "flex", justifyContent: "flex-end", gap: 2 }}>
                    <Button variant="outlined" onClick={() => navigate("/")} disabled={isSubmitting || isProcessing}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={isSubmitting || isProcessing || !dirty || !isValid}
                      startIcon={(isSubmitting || isProcessing) ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
                    >
                      {(isSubmitting || isAdding) ? "Adding..." : (isTriggeringCheck ? "Checking..." : "Add Website")}
                    </Button>
                  </Grid>
                </Grid> {/* End container Grid */}
              </Box>
            </Form>
          )}
        </Formik>
      </Paper>

      <FormNotification
        notification={notification}
        onClose={handleNotificationClose}
      />
    </Container>
  );
};

export default AddWebsite;