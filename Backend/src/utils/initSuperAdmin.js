import mongoose from "mongoose";
import dotenv from "dotenv";
import { initializeSuperAdmin } from "../controllers/auth.Controllers.js";

dotenv.config();

export const initializeSystem = async () => {
  try {
    // ✅ Await database connection assumed to be already established
    console.log("✅ Connected to MongoDB");

    // Super Admin Details
    const superAdminDetails = {
      firstName: process.env.SUPER_ADMIN_FIRST_NAME || "System",
      lastName: process.env.SUPER_ADMIN_LAST_NAME || "Admin",
      email: process.env.SUPER_ADMIN_EMAIL || "admin@example.com",
      password: process.env.SUPER_ADMIN_PASSWORD || "ChangeMe123!",
      dob: process.env.SUPER_ADMIN_DOB || "1990-01-01",
      gender: process.env.SUPER_ADMIN_GENDER || "preferNotToSay",
      phone: process.env.SUPER_ADMIN_PHONE || "",
      designation: process.env.SUPER_ADMIN_DESIGNATION || "Super Admin",
    };

    const result = await initializeSuperAdmin(superAdminDetails);

    if (result.success) {
      console.log(`✅ ${result.message}`);
      if (result.user) {
        console.log(`✅ Super Admin created with email: ${result.user.email}`);
      }
    } else {
      console.error(`❌ ${result.message}`);
    }

    // If this is a one-time initialization script, uncomment these lines:
    // await mongoose.disconnect();
    // console.log("✅ Disconnected from MongoDB");
    // process.exit(0);
  } catch (error) {
    console.error("❌ Initialization error:", error);
    // process.exit(1);
  }
};
