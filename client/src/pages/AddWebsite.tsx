import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Formik, Form, Field, FormikHelpers } from "formik";
import * as Yup from "yup";
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
  IconButton,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { Add as AddIcon, HelpOutline as HelpIcon } from "@mui/icons-material";
import { WebsiteCreateDTO, Website } from "../types";
import WebsiteUrlSearch from "../components/WebsiteUrlSearch";
import { useWebsiteCrud } from "../hooks";

// Form values interface
interface AddWebsiteFormValues {
  name: string;
  url: string;
  interval: number;
  alertEnabled: boolean;
  alertThreshold: number;
  notifyEmail: string;
}

// Validation schema using Yup
const websiteUrlRegex = /^https?:\/\/.+\..+/;

const AddWebsiteSchema = Yup.object().shape({
  name: Yup.string().required("Website name is required"),
  url: Yup.string()
    .matches(websiteUrlRegex, "Please enter a valid URL (include http:// or https://)")
    .required("URL is required"),
  interval: Yup.number()
    .min(30, "Interval must be at least 30 seconds")
    .max(86400, "Interval must be at most 1 day (86400 seconds)")
    .required("Check interval is required"),
  alertEnabled: Yup.boolean(),
  alertThreshold: Yup.number()
    .when("alertEnabled", {
      is: true,
      then: (schema) => schema
        .min(1, "Threshold must be at least 1 millisecond")
        .max(60000, "Threshold must be at most 60000 milliseconds")
        .required("Response threshold is required when alerts are enabled"),
    }),
  notifyEmail: Yup.string()
    .when("alertEnabled", {
      is: true,
      then: (schema) => schema
        .email("Please enter a valid email address")
        .required("Email is required when alerts are enabled"),
    }),
});

const AddWebsite: React.FC = () => {
  const navigate = useNavigate();
  const { create, loading, error: apiError } = useWebsiteCrud();

  // UI state
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">("success");

  // Initial form values
  const initialValues: AddWebsiteFormValues = {
    name: "",
    url: "",
    interval: 300, // Default: 5 minutes (in seconds)
    alertEnabled: false,
    alertThreshold: 1000, // Default: 1 second (in milliseconds)
    notifyEmail: "",
  };

  // No longer need the handleWebsiteSelect function as it's handled directly
  // in the onSelect callback of WebsiteUrlSearch

  // Form submission handler
  const handleSubmit = async (
    values: AddWebsiteFormValues,
    { setSubmitting }: FormikHelpers<AddWebsiteFormValues>
  ) => {
    try {
      // Prepare website data
      const websiteData: WebsiteCreateDTO = {
        name: values.name.trim(),
        url: values.url.trim(),
        interval: values.interval,
        alertEnabled: values.alertEnabled,
        alertThreshold: values.alertEnabled ? values.alertThreshold : null,
        notifyEmail: values.alertEnabled ? values.notifyEmail : null,
      };

      await create(websiteData);

      setSnackbarMessage("Website added successfully!");
      setSnackbarSeverity("success");
      setSnackbarOpen(true);

      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to add website";
      setSnackbarMessage(errorMessage);
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Add Website to Monitor
        </Typography>

        <Formik
          initialValues={initialValues}
          validationSchema={AddWebsiteSchema}
          onSubmit={handleSubmit}
        >
          {({
            errors,
            touched,
            handleChange,
            values,
            isSubmitting,
            setFieldValue,
          }) => (
            <Form>
              <Box sx={{ mt: 3 }}>
                <Grid container spacing={3}>
                  {/* Website Name */}
                  <Grid size={12}>
                    <Field
                      as={TextField}
                      name="name"
                      label="Website Name"
                      fullWidth
                      required
                      variant="outlined"
                      error={touched.name && Boolean(errors.name)}
                      helperText={
                        (touched.name && errors.name) ||
                        "A name to identify this website in your dashboard"
                      }
                    />
                  </Grid>

                  {/* Website URL with Search Component */}
                  <Grid size={12}>
                    {/* Using WebsiteUrlSearch with Formik integration */}
                    <WebsiteUrlSearch
                      name="url"
                      onSelect={(website: Website | null) => {
                        if (website && !values.name) {
                          // Suggest a name based on the URL if name field is empty
                          setFieldValue(
                            "name",
                            new URL(website.url).hostname.replace(/^www\./, "")
                          );
                        }
                      }}
                      searchLimit={15}
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
                      variant="outlined"
                      error={touched.interval && Boolean(errors.interval)}
                      helperText={
                        (touched.interval && errors.interval) ||
                        "How often the website should be checked (in seconds). Minimum 30s."
                      }
                    />
                  </Grid>

                  {/* Alert Enable Switch */}
                  <Grid size={12}>
                    <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2, mt: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Alert Settings
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={values.alertEnabled}
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

                  {values.alertEnabled && (
                    <>
                      {/* Response Time Threshold */}
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Field
                          as={TextField}
                          name="alertThreshold"
                          label="Response Threshold (ms)"
                          type="number"
                          fullWidth
                          variant="outlined"
                          error={
                            touched.alertThreshold && Boolean(errors.alertThreshold)
                          }
                          helperText={
                            (touched.alertThreshold && errors.alertThreshold) ||
                            "Send an alert if response time exceeds this value (in milliseconds)"
                          }
                        />
                      </Grid>

                      {/* Notification Email */}
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Field
                          as={TextField}
                          name="notifyEmail"
                          label="Notification Email"
                          fullWidth
                          variant="outlined"
                          error={
                            touched.notifyEmail && Boolean(errors.notifyEmail)
                          }
                          helperText={
                            (touched.notifyEmail && errors.notifyEmail) ||
                            "Email address to receive alert notifications"
                          }
                        />
                      </Grid>
                    </>
                  )}

                  {/* Buttons */}
                  <Grid
                    size={12}
                    sx={{
                      mt: 2,
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 2,
                    }}
                  >
                    <Button variant="outlined" onClick={() => navigate("/")}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={isSubmitting || loading}
                      startIcon={<AddIcon />}
                    >
                      {loading || isSubmitting ? "Adding..." : "Add Website"}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Form>
          )}
        </Formik>
      </Paper>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
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

export default AddWebsite;