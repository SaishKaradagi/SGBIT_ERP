// security.middleware.js
import express from "express";
import helmet from "helmet";
import cors from "cors";
import xss from "xss-clean";
import mongoSanitize from "express-mongo-sanitize";
import expressRateLimit from "express-rate-limit";
import hpp from "hpp";
import cookieParser from "cookie-parser";

/**
 * Configure all security middlewares
 * @param {Object} app - Express app
 */
export const configureSecurityMiddleware = (app) => {
  // Body parser
  app.use(express.json({ limit: "10kb" })); // Limit size of requests
  app.use(express.urlencoded({ extended: true, limit: "10kb" }));

  // Cookie parser
  app.use(cookieParser());

  // Set security HTTP headers with Helmet
  app.use(helmet());

  // Configure Content Security Policy (CSP)
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Customize based on your needs
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://yourerp.edu.in"], // Add your domains
        connectSrc: ["'self'"],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    }),
  );

  // Implement CORS
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "*", // Configure based on your needs
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      credentials: true,
      maxAge: 86400, // Cache preflight requests for 24 hours
    }),
  );

  // Handle preflight requests
  app.options("*", cors());

  // Clean XSS attacks from user inputs
  app.use(xss());

  // Sanitize data against NoSQL query injection
  app.use(mongoSanitize());

  // Prevent parameter pollution
  app.use(
    hpp({
      whitelist: [
        "sort",
        "page",
        "limit",
        "fields",
        "role",
        "status",
        // Add other parameters that can be duplicated in query string
      ],
    }),
  );

  // Global rate limiter - 100 requests per 15 minutes
  app.use(
    "/api",
    expressRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false,
      message:
        "Too many requests from this IP, please try again after 15 minutes",
    }),
  );

  // Prevent clickjacking
  app.use(helmet.frameguard({ action: "deny" }));

  // Add security headers
  app.use((req, res, next) => {
    // Cache Control
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Set Strict-Transport-Security header for HTTPS
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );

    // Prevent MIME type sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Cross-origin resource policy
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

    // Cross-origin embedder policy
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

    // Cross-origin opener policy
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

    next();
  });
};
