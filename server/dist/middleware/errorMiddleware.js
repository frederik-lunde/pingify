"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client"); // Import Prisma for error type checking
const errorMiddleware = (err, req, res, next) => {
  // Log the original, detailed error for server-side debugging FIRST
  // Include Prisma meta if available for more context on DB errors
  const prismaMeta =
    err instanceof client_1.Prisma.PrismaClientKnownRequestError
      ? err.meta
      : undefined;
  console.error(
    `Error caught: [${req.method}] ${req.originalUrl} - Status: ${err.status || "N/A"} - Message: ${err.message}`,
    prismaMeta ? `- PrismaMeta: ${JSON.stringify(prismaMeta)}` : "",
    err.stack,
  );
  let statusCode = err.status || 500;
  let responseMessage = err.message || "An unexpected error occurred."; // Start with the original message or default
  // --- Centralized Message & Status Mapping ---
  // Auth Errors
  if (err.message === "Invalid credentials") {
    statusCode = 401;
    responseMessage = "Invalid email or password.";
  } else if (err.message === "User with this email already exists") {
    statusCode = 409; // Conflict
    responseMessage = "An account with this email already exists.";
  } else if (
    err.message === "Invalid or expired token" ||
    err.message.includes("jwt") ||
    err.message === "Authentication required"
  ) {
    // Handle various token issues
    statusCode = 401;
    responseMessage =
      "Your session is invalid or has expired. Please log in again.";
  }
  // User Profile/Password Errors (from userService)
  else if (err.message === "Email already in use by another account.") {
    statusCode = 409; // Conflict
    responseMessage =
      "This email address is already associated with another account.";
  } else if (err.message === "Invalid current password.") {
    statusCode = 400; // Bad Request (user provided wrong input)
    responseMessage = "The current password you entered is incorrect.";
  } else if (
    err.message === "New password must be at least 6 characters long."
  ) {
    statusCode = 400; // Bad Request (validation)
    responseMessage = "The new password must be at least 6 characters long.";
  } else if (err.message.startsWith("User not found")) {
    // Handle user not found errors (e.g., from deletion)
    statusCode = 404; // Not Found
    responseMessage = "The specified user account could not be found.";
  } else if (err.message === "No update data provided.") {
    statusCode = 400;
    responseMessage = "Please provide the information you wish to update.";
  } else if (err.message === "Current and new password are required.") {
    statusCode = 400;
    responseMessage = "Both the current and new password fields are required.";
  }
  // Website Service Errors
  else if (err.message.startsWith("Invalid URL format")) {
    statusCode = 400;
    responseMessage =
      "The website URL provided is not valid. Please include http:// or https://";
  } else if (err.message.includes("already exists")) {
    // Covers both 'Website with URL...' and 'Another website with URL...'
    statusCode = 409; // Conflict
    responseMessage = "This website URL is already being monitored.";
  } else if (
    err.message.startsWith("Website with ID") &&
    err.message.includes("not found")
  ) {
    statusCode = 404;
    responseMessage = "The specified website could not be found.";
  } else if (err.message.startsWith("Failed to add website")) {
    statusCode = 500; // Or could be 400 if it's always a user input issue
    responseMessage =
      "There was a problem adding the website. Please try again.";
  }
  // Alert Service Errors
  else if (err.message === "Forbidden: User does not own this alert") {
    statusCode = 403; // Forbidden
    responseMessage = "You do not have permission to modify this alert.";
  }
  // Mail Service Errors (if caught by middleware)
  else if (err.message.startsWith("Failed to send email")) {
    // Log it, but maybe don't send a 500 to the user unless essential
    console.error("Email sending failed:", err.message);
    // Keep status 500 for now, but consider if a different response is better UX
    statusCode = 500;
    responseMessage =
      "An internal error occurred while trying to send a notification.";
  }
  // --- Production Safety Net for 500s ---
  // For truly unexpected internal errors, hide details in production
  if (statusCode === 500 && process.env.NODE_ENV === "production") {
    responseMessage =
      "An internal server error occurred. Please try again later.";
  }
  // --- Send Consistent JSON Response ---
  // Sending a flat message structure based on common frontend patterns
  res.status(statusCode).json({
    message: responseMessage,
  });
};
exports.default = errorMiddleware;
