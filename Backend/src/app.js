// app.js
import express from "express";
import { configureSecurityMiddleware } from "./middlewares/security.middleware.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import { ApiError } from "./utils/ApiError.js";
import { connectDB } from "./db/connection.js";
import net from "net";
import User from "./models/user.model.js";
import UserCreation from "./routes/UserCreation.routes.js";
import SuperAdmin from "./routes/SuperAdmin.routes.js";
// import { initializeSystem } from "./utils/initSuperAdmin.js";
// Create Express app
const app = express();

// Connect to MongoDB
connectDB();

// Apply security middlewares
configureSecurityMiddleware(app);

// API routes
app.use("/api/v1/auth", authRoutes);
// User creation routes
app.use("/api/v1/UserCreation", UserCreation);
//Department Creation
app.use("/api/v1/SuperAdmin/", SuperAdmin);

// Add other routes here as your application grows
// app.use("/api/v1/users", userRoutes);
// app.use("/api/v1/students", studentRoutes);
// app.use("/api/v1/faculty", facultyRoutes);
// etc.

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "ERP system is running",
    environment: process.env.NODE_ENV,
    timestamp: new Date(),
  });
});

// API documentation route
app.get("/api/v1/docs", (req, res) => {
  res.redirect(process.env.API_DOCS_URL || "https://yourerp.edu.in/api-docs");
});

// 404 handler
app.all("*", (req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// test-mailtrap-connection.js

const socket = net.createConnection(2525, "smtp.mailtrap.io");

socket.on("connect", () => {
  console.log("✅ Connected to Mailtrap");
  socket.end();
});

socket.on("error", (err) => {
  console.error("❌ Connection error:", err);
});

// Global error handler
app.use(errorHandler);

//initializeSystem();

export default app;
