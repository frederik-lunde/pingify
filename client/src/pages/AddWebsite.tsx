// src/pages/AddWebsite.tsx
import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Formik, Form, Field, FormikHelpers } from "formik";
import * as Yup from "yup";
import {
  Container, Paper, Typography, TextField, Button, Box, Switch,
  FormControlLabel, Alert, Tooltip, IconButton, CircularProgress,
} from "@mui/material";
import Grid from "@mui/material/Grid2"; // Using Grid v2
import { Add as AddIcon, HelpOutline as HelpIcon } from "@mui/icons-material";

// --- Import SHARED Types (Adjust path as needed) ---
import {
    AddWebsiteUserDTO, // <--- Use this DTO for adding to user list
    Website,           // Use the shared Website type
    WebsiteUser,       // Use this for the expected return type of the mutation
    ApiError           // Use the shared ApiError type
} from "../types"; // Adjust path to your shared types file

// --- Import Components (Adjust paths as needed) ---
import WebsiteUrlSearch from "../components/WebsiteUrlSearch"; // Example path
import FormNotification, {
  initialNotificationState, FormNotificationState
} from "../components/common/FormNotification"; // Example path

// --- Import Hooks (Adjust paths as needed) ---
import { useWebsiteMutations } from "../hooks/api/useWebsites"; // Example path


// Helper to ensure URL has a protocol
const ensureUrlProtocol = (url: string): string => {
    if (!url) return "";
    // Regex to check if protocol exists
    if (!/^(https?|ftp):\/\//i.test(url)) {
        // Default to https:// if no protocol is present
        return `https://${url}`;
    }
    return url;
};

// Form values interface (remains the same, represents form state)
interface AddWebsiteFormValues {
  name: string;
  url: string;
  interval: number;
  alertEnabled: boolean;
  alertThreshold: number | string; // Keep string here for initial input flexibility
  notifyEmail: string;
}

// URL validation regex - ensure it handles various valid domain structures
const websiteUrlRegex = /^(https?:\/\/)((([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)+([a-zA-Z]{2,}|[0-9]{1,3})(\.[0-9]{1,3})?|localhost)(:[0-9]+)?(\/.*)?$/i;


// Validation schema using Yup
const AddWebsiteSchema = Yup.object().shape({
  // Allow empty name initially, but require if URL doesn't auto-populate well? Or always require? Let's require for now.
  name: Yup.string().trim().required("Website name is required"),
  url: Yup.string()
    .trim()
     // Apply protocol formatting *before* validation if needed, or adjust regex slightly
    .transform(value => ensureUrlProtocol(value)) // Transform before validating
    .matches(websiteUrlRegex, "Enter a valid URL (e.g., https://example.com)")
    .required("URL is required"),
  interval: Yup.number()
    .typeError("Interval must be a number") // Better type error
    .integer("Interval must be a whole number")
    .min(30, "Interval must be at least 30 seconds")
    .max(86400, "Interval must be at most 1 day (86400s)")
    .required("Check interval is required"),
  alertEnabled: Yup.boolean(),
  alertThreshold: Yup.number()
    .when("alertEnabled", {
      is: true,
      then: (schema) => schema
        .typeError("Threshold must be a number")
        .min(1, "Threshold must be at least 1ms")
        .max(60000, "Threshold must be 1 min (60000ms) or less")
        .required("Response threshold is required when alerts are enabled"),
      otherwise: (schema) => schema.optional().nullable(), // Allow null when not enabled
    }),
  notifyEmail: Yup.string()
    .email("Enter a valid email address")
    .when("alertEnabled", {
      is: true,
      // Require email only if alertEnabled is explicitly true
      then: (schema) => schema.required("Email is required for alerts"),
      otherwise: (schema) => schema.optional().nullable(), // Allow null when not enabled
    }),
});

const AddWebsite: React.FC = () => {
  const navigate = useNavigate();
  // Assuming useWebsiteMutations returns functions typed correctly
  const { create: createWebsite, isCreating, errorCreating } = useWebsiteMutations();
  const [notification, setNotification] = useState<FormNotificationState>(initialNotificationState);

  const initialValues: AddWebsiteFormValues = {
    name: "",
    url: "",
    interval: 300, // Default to 5 minutes
    alertEnabled: false,
    alertThreshold: "", // Start empty, let validation handle requirement
    notifyEmail: "",
  };

  const handleSubmit = async (
    values: AddWebsiteFormValues,
    formikHelpers: FormikHelpers<AddWebsiteFormValues>
  ) => {
    const { setSubmitting, setStatus } = formikHelpers;
    setStatus(null); // Clear previous status
    setNotification(initialNotificationState); // Clear previous notification

    // Convert form values to the DTO expected by the API/mutation
    const websiteData: AddWebsiteUserDTO = { // <--- Use AddWebsiteUserDTO
      name: values.name.trim() || null, // Allow null if backend handles it, otherwise ensure non-empty
      url: ensureUrlProtocol(values.url.trim()),
      // Ensure interval is a number
      interval: typeof values.interval === 'number' ? values.interval : parseInt(String(values.interval), 10),
      alertEnabled: values.alertEnabled,
       // Convert alertThreshold to number or null
      alertThreshold: values.alertEnabled && values.alertThreshold !== ""
          ? Number(values.alertThreshold)
          : null,
      // Set notifyEmail to null if empty or alerts disabled
      notifyEmail: values.alertEnabled && values.notifyEmail.trim() !== ""
          ? values.notifyEmail.trim()
          : null,
    };

    // Double-check interval validity after parsing
     if (isNaN(websiteData.interval!) || websiteData.interval! < 30) {
         setStatus({ error: "Invalid interval value." });
         setNotification({ open: true, message: "Error: Invalid check interval.", severity: "error" });
         setSubmitting(false);
         return;
     }
     if (websiteData.alertEnabled && (websiteData.alertThreshold === null || isNaN(websiteData.alertThreshold!))) {
         setStatus({ error: "Invalid alert threshold value." });
         setNotification({ open: true, message: "Error: Invalid alert threshold.", severity: "error" });
         setSubmitting(false);
         return;
     }


    try {
      // Assume createWebsite mutation returns the newly created WebsiteUser object
      const newWebsiteUser: WebsiteUser = await createWebsite(websiteData); // <--- Expect WebsiteUser
      const successName = newWebsiteUser.name || newWebsiteUser.website?.url || 'Website'; // Use optional chaining
      setNotification({ open: true, message: `Website "${successName}" added successfully!`, severity: "success" });
      // Redirect after a short delay
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      const apiError = err as ApiError; // Use shared ApiError type
      console.error("Failed to add website:", apiError);
      const message = apiError?.data?.message || apiError?.message || "An unexpected error occurred.";
      setStatus({ error: message }); // Display error in form status
      setNotification({ open: true, message: `Error: ${message}`, severity: "error" });
       setSubmitting(false); // Ensure submitting is set to false on error
    }
    // No need for finally if setSubmitting(false) is handled in error case
  };

  const handleNotificationClose = useCallback(() => {
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

   // Callback for when a URL is selected from the search component
   const handleUrlSelect = useCallback((
        website: Website | null, // Expects the core Website type from search
        setFieldValue: (field: string, value: any, shouldValidate?: boolean) => void,
        currentName: string
    ) => {
        if (website?.url) {
             const formattedUrl = ensureUrlProtocol(website.url);
             setFieldValue("url", formattedUrl, true); // Set formatted URL and validate

            // Auto-fill name only if the current name field is empty
             if (!currentName) {
                try {
                  // Extract hostname as default name (remove www.)
                  const hostname = new URL(formattedUrl).hostname.replace(/^www\./, "");
                  setFieldValue("name", hostname, true); // Set name and validate
                } catch (e) {
                  console.error("Invalid URL format for prefilling name:", formattedUrl, e);
                  // Don't attempt to set name if URL is invalid
                }
             }
        }
    }, []); // Dependencies: none


  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Add Website to Monitor
        </Typography>

        <Formik
          initialValues={initialValues}
          validationSchema={AddWebsiteSchema}
          onSubmit={handleSubmit}
          enableReinitialize // Allows initial values to update if needed (though not used here)
        >
          {/* Destructure helpers and form state */}
          {({ errors, touched, values, isSubmitting, setFieldValue, status, dirty, isValid }) => (
            <Form noValidate> {/* Add noValidate to prevent browser validation */}
              {/* Display Form-level errors (from setStatus) */}
              {status?.error && (
                <Alert severity="error" sx={{ mb: 3 }}>{status.error}</Alert>
              )}
              {/* Display hook-level errors if not handled by setStatus */}
              {errorCreating && !status?.error && (
                 <Alert severity="error" sx={{ mb: 3 }}>{ (errorCreating as ApiError).message || 'Failed to create website.' }</Alert>
              )}

              <Box sx={{ mt: 3 }}>
                <Grid container spacing={3}>
                  {/* Website Name */}
                  <Grid size={{ xs: 12 }}>
                    <Field
                      as={TextField}
                      name="name"
                      label="Website Name"
                      fullWidth
                      required
                      variant="outlined"
                      error={touched.name && Boolean(errors.name)}
                      helperText={touched.name && errors.name ? errors.name : "A name for your dashboard (e.g., My Blog)"}
                      disabled={isSubmitting || isCreating}
                    />
                  </Grid>

                  {/* Website URL Search Component */}
                  <Grid size={{ xs: 12 }}>
                    {/* Ensure WebsiteUrlSearch component handles Formik's field props correctly */}
                    {/* or passes necessary info like errors/touched down */}
                    <WebsiteUrlSearch
                      name="url" // Field name for Formik
                      label="Website URL"
                      placeholder="https://example.com"
                      helperText="Enter the full URL including https://" // Static helper text ok here
                      searchLimit={10}
                      disabled={isSubmitting || isCreating}
                       // Pass setFieldValue and current name to the handler
                      onSelect={(website) => handleUrlSelect(website, setFieldValue, values.name)}
                      // Pass error/touched state down if needed by WebsiteUrlSearch for styling
                      error={touched.url && Boolean(errors.url)}
                      errorMessage={touched.url && errors.url ? errors.url : undefined}
                    />
                  </Grid>

                  {/* Check Interval */}
                  <Grid size={{ xs: 12, sm: 6 }}>
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
                      InputProps={{ inputProps: { min: 30, step: 30 } }} // HTML5 input attributes
                      disabled={isSubmitting || isCreating}
                    />
                  </Grid>

                  {/* Alert Settings Section */}
                  <Grid size={{ xs: 12 }} sx={{ borderTop: 1, borderColor: "divider", pt: 3, mt: 2 }}>
                    <Typography variant="h6" gutterBottom>Alert Settings</Typography>
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <FormControlLabel
                        control={
                          <Field
                            as={Switch}
                            name="alertEnabled"
                            color="primary"
                            disabled={isSubmitting || isCreating}
                          />
                        }
                        label="Enable Downtime/Slow Alerts"
                      />
                      <Tooltip title="Get notified via email when the website goes down or response time exceeds the threshold.">
                        <IconButton size="small" tabIndex={-1}><HelpIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </Box>
                  </Grid>

                  {/* Conditional Alert Fields */}
                  {values.alertEnabled && (
                    <>
                      {/* Response Time Threshold */}
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Field
                          as={TextField}
                          name="alertThreshold"
                          label="Slow Response Threshold (ms)"
                          type="number" // Input type
                          fullWidth
                          variant="outlined"
                          required={values.alertEnabled} // Conditionally required
                          error={touched.alertThreshold && Boolean(errors.alertThreshold)}
                          helperText={touched.alertThreshold && errors.alertThreshold ? errors.alertThreshold : "Alert if response is slower than this (e.g., 2000)"}
                          InputProps={{ inputProps: { min: 1 } }}
                          disabled={isSubmitting || isCreating}
                        />
                      </Grid>

                      {/* Notification Email */}
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Field
                          as={TextField}
                          name="notifyEmail"
                          label="Notification Email"
                          type="email" // Input type
                          fullWidth
                          variant="outlined"
                          required={values.alertEnabled} // Conditionally required
                          error={touched.notifyEmail && Boolean(errors.notifyEmail)}
                          helperText={touched.notifyEmail && errors.notifyEmail ? errors.notifyEmail : "Email address to receive alerts"}
                          disabled={isSubmitting || isCreating}
                        />
                      </Grid>
                    </>
                  )}

                  {/* Action Buttons */}
                  <Grid size={{ xs: 12 }} sx={{ mt: 3, display: "flex", justifyContent: "flex-end", gap: 2 }}>
                    <Button variant="outlined" onClick={() => navigate("/")} disabled={isSubmitting || isCreating}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                       // Disable if submitting, creating, form is untouched, or form is invalid
                      disabled={isSubmitting || isCreating || !dirty || !isValid}
                      startIcon={(isSubmitting || isCreating) ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
                    >
                      {(isSubmitting || isCreating) ? "Adding..." : "Add Website"}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Form>
          )}
        </Formik>
      </Paper>

      {/* Notification Component */}
      <FormNotification
        notification={notification}
        onClose={handleNotificationClose}
      />
    </Container>
  );
};

export default AddWebsite;