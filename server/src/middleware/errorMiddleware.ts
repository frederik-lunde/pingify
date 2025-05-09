import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";

interface CustomError extends Error {
  status?: number;
}

const errorMiddleware = (
  err: CustomError,
  req: Request,
  res: Response,
): void => {
  const prismaMeta =
    err instanceof Prisma.PrismaClientKnownRequestError ? err.meta : undefined;
  console.error(
    `Error caught: [${req.method}] ${req.originalUrl} - Status: ${err.status || "N/A"} - Message: ${err.message}`,
    prismaMeta ? `- PrismaMeta: ${JSON.stringify(prismaMeta)}` : "",
    err.stack,
  );

  let statusCode = err.status || 500;
  let responseMessage = err.message || "An unexpected error occurred.";

  if (err.message === "Invalid credentials") {
    statusCode = 401;
    responseMessage = "Invalid email or password.";
  } else if (err.message === "User with this email already exists") {
    statusCode = 409;
    responseMessage = "An account with this email already exists.";
  } else if (
    err.message === "Invalid or expired token" ||
    err.message.includes("jwt") ||
    err.message === "Authentication required"
  ) {
    statusCode = 401;
    responseMessage =
      "Your session is invalid or has expired. Please log in again.";
  } else if (err.message === "Email already in use by another account.") {
    statusCode = 409;
    responseMessage =
      "This email address is already associated with another account.";
  } else if (err.message === "Invalid current password.") {
    statusCode = 400;
    responseMessage = "The current password you entered is incorrect.";
  } else if (
    err.message === "New password must be at least 6 characters long."
  ) {
    statusCode = 400;
    responseMessage = "The new password must be at least 6 characters long.";
  } else if (err.message.startsWith("User not found")) {
    statusCode = 404;
    responseMessage = "The specified user account could not be found.";
  } else if (err.message === "No update data provided.") {
    statusCode = 400;
    responseMessage = "Please provide the information you wish to update.";
  } else if (err.message === "Current and new password are required.") {
    statusCode = 400;
    responseMessage = "Both the current and new password fields are required.";
  } else if (err.message.startsWith("Invalid URL format")) {
    statusCode = 400;
    responseMessage =
      "The website URL provided is not valid. Please include http:// or https://";
  } else if (err.message.includes("already exists")) {
    statusCode = 409;
    responseMessage = "This website URL is already being monitored.";
  } else if (
    err.message.startsWith("Website with ID") &&
    err.message.includes("not found")
  ) {
    statusCode = 404;
    responseMessage = "The specified website could not be found.";
  } else if (err.message.startsWith("Failed to add website")) {
    statusCode = 500;
    responseMessage =
      "There was a problem adding the website. Please try again.";
  } else if (err.message === "Forbidden: User does not own this alert") {
    statusCode = 403;
    responseMessage = "You do not have permission to modify this alert.";
  } else if (err.message.startsWith("Failed to send email")) {
    console.error("Email sending failed:", err.message);
    statusCode = 500;
    responseMessage =
      "An internal error occurred while trying to send a notification.";
  }

  if (statusCode === 500 && process.env.NODE_ENV === "production") {
    responseMessage =
      "An internal server error occurred. Please try again later.";
  }

  res.status(statusCode).json({
    message: responseMessage,
  });
};

export default errorMiddleware;
