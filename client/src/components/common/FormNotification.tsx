// client/src/components/common/FormNotification.tsx
import React from "react";
import { Snackbar, Alert, AlertProps } from "@mui/material";

export interface FormNotificationState {
  open: boolean;
  message: string;
  severity: AlertProps["severity"];
}

interface FormNotificationProps {
  notification: FormNotificationState;
  onClose: (event?: React.SyntheticEvent | Event, reason?: string) => void; // Allow reason argument
  autoHideDuration?: number;
  position?: {
    vertical: "top" | "bottom";
    horizontal: "left" | "center" | "right";
  };
}

const FormNotification: React.FC<FormNotificationProps> = ({
  notification,
  onClose,
  autoHideDuration = 6000,
  position = { vertical: "bottom", horizontal: "center" },
}) => {
  const { open, message, severity } = notification;

  // Handle Snackbar close event
  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    // Prevent closing on clickaway
    if (reason === 'clickaway') {
      return;
    }
    onClose(event, reason); // Call the passed onClose handler
  };


  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={handleClose}
      anchorOrigin={position}
      data-testid="form-notification"
    >
      {/* Check for message and return Alert or undefined */}
      {message ? (
        <Alert
          onClose={handleClose} // Allow closing the alert directly
          severity={severity}
          variant="filled"
          sx={{ width: "100%" }}
          elevation={6}
        >
          {message}
        </Alert>
      ) : undefined} 
    </Snackbar>
  );
};

// Default initial state for the notification
export const initialNotificationState: FormNotificationState = {
  open: false,
  message: "",
  severity: "info",
};

export default FormNotification;