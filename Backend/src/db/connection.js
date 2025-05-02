// connection.js
import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

/**
 * Connect to MongoDB database
 * @returns {Promise} Mongoose connection promise
 */
export const connectDB = async () => {
  try {
    const MONGODB_URI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/college_erp";

    const conn = await mongoose.connect(MONGODB_URI, {
      // These options are no longer needed in the newer versions of Mongoose,
      // but kept here for compatibility with different environments
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Event listeners for database connection
    mongoose.connection.on("error", (err) => {
      logger.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      logger.info("MongoDB connection closed due to app termination");
      process.exit(0);
    });

    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};
