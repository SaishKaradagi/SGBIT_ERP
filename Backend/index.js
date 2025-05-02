// index.js
import dotenv from "dotenv";
import app from "./src/app.js";
import { logger } from "./src/utils/logger.js";

// Load environment variables
dotenv.config();

// Define port
const PORT = process.env.PORT || 5000;

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error(`UNCAUGHT EXCEPTION: ${err.name}: ${err.message}`);
  logger.error(`Stack: ${err.stack}`);
  process.exit(1);
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(
    `Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
  );
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error(`UNHANDLED REJECTION: ${err.name}: ${err.message}`);
  logger.error(`Stack: ${err.stack}`);

  // Gracefully close server before exiting
  server.close(() => {
    process.exit(1);
  });
});

// Handle SIGTERM
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully.");
  server.close(() => {
    logger.info("Process terminated.");
  });
});
