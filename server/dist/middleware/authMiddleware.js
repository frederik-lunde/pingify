"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const authService_1 = require("../services/authService"); // verifyToken now returns { userId: string }
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // Send response and return to stop execution
      res
        .status(401)
        .json({
          message:
            "Authentication required: Missing or invalid Authorization header",
        });
      return;
    }
    const token = authHeader.split(" ")[1];
    // verifyToken now returns an object { userId: string }
    const { userId } = (0, authService_1.verifyToken)(token); // userId is now a string
    // Add user ID (string) to request object. This now matches the updated type definition.
    req.user = { id: userId };
    next(); // Proceed to the next middleware/route handler
  } catch (error) {
    // Catch potential errors from verifyToken (invalid, expired)
    // Log the error for debugging, but send a generic message to the client
    console.error("Authentication error:", error.message);
    // Send response and return to stop execution
    res
      .status(401)
      .json({ message: error.message || "Invalid or expired token" }); // Use error message if available
    return;
  }
};
exports.authenticate = authenticate;
