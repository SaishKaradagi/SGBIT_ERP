// errorHandler.middleware.js
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";

/**
 * Error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  let error = err;

  // Log error for debugging
  console.error("Error:", {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  // Handle Mongoose validation errors
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((val) => val.message);
    error = new ApiError(400, "Validation Error", errors);
  }

  // Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    error = new ApiError(
      409,
      `Duplicate field value: ${field}. ${field} '${value}' already exists.`,
      [{ field, value, message: `${field} already exists` }],
    );
  }

  // Handle Mongoose cast errors
  if (err instanceof mongoose.Error.CastError) {
    error = new ApiError(400, `Invalid ${err.path}: ${err.value}`, [
      { field: err.path, value: err.value, message: "Invalid value" },
    ]);
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    error = new ApiError(401, "Invalid token");
  }

  if (err.name === "TokenExpiredError") {
    error = new ApiError(401, "Token has expired");
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = error.message || "Something went wrong";
  const errors = error.errors || [];

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};
