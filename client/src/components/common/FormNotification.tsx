import React from "react";
import { Snackbar, Alert, AlertProps } from "@mui/material";

export interface FormNotificationState {
  open: boolean;
  message: string;
  severity: AlertProps["severity"];
}

interface FormNotificationProps {
  notification: FormNotificationState;
  onClose: (event?: React.SyntheticEvent | Event, reason?: string) => void;
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
  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    onClose(event, reason);
  };
  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={handleClose}
      anchorOrigin={position}
      data-testid="form-notification"
    >
      {}
      {message ? (
        <Alert
          onClose={handleClose}
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

export const initialNotificationState: FormNotificationState = {
  open: false,
  message: "",
  severity: "info",
};

export default FormNotification;