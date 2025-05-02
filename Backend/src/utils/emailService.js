// emailService.js
import nodemailer from "nodemailer";
import Mailgen from "mailgen";

/**
 * Email sending service using Nodemailer and Mailgen
 */

// Set up Mailgen instance
const mailGenerator = new Mailgen({
  theme: "default",
  product: {
    name: "College ERP System",
    link: "/api/v1/",
    // logo: "https://yourerp.edu.in/logo.png", // Replace with your logo URL
  },
});

// Create email templates
const templates = {
  // Email verification template
  "email-verification": (data) => {
    return {
      body: {
        name: data.name,
        intro:
          "Welcome to our College ERP System! We're excited to have you on board.",
        action: {
          instructions:
            "To get started, please verify your email address by clicking the button below:",
          button: {
            color: "#22BC66", // Optional
            text: "Verify Your Email",
            link: data.verificationURL,
          },
        },
        outro:
          "If you did not create an account, you can safely ignore this email.",
      },
    };
  },

  // Password reset template
  "password-reset": (data) => {
    return {
      body: {
        name: data.name,
        intro:
          "You have received this email because a password reset request for your account was received.",
        action: {
          instructions:
            "Click the button below to reset your password. This reset link is only valid for the next " +
            data.expireTime +
            ":",
          button: {
            color: "#DC4D2F",
            text: "Reset Your Password",
            link: data.resetURL,
          },
        },
        outro:
          "If you did not request a password reset, you can safely ignore this email.",
      },
    };
  },

  // Password changed confirmation
  "password-changed": (data) => {
    return {
      body: {
        name: data.name,
        intro:
          "This is a confirmation that the password for your account has just been changed.",
        outro:
          "If you did not change your password, please contact the administrator immediately.",
      },
    };
  },

  // Password reset success confirmation
  "password-reset-success": (data) => {
    return {
      body: {
        name: data.name,
        intro: "Your password has been successfully reset.",
        outro:
          "You can now log in with your new password. If you did not reset your password, please contact the administrator immediately.",
      },
    };
  },
};

/**
 * Send email using Nodemailer and Mailgen
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Template name (must exist in templates object)
 * @param {Object} options.data - Data to populate the template
 * @returns {Promise} Promise with the result of the email sending
 */
export const sendEmail = async (options) => {
  try {
    // Configure transporter
    // For production, use your actual SMTP service
    // For development/testing, use Mailtrap or similar
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.mailtrap.io",
      port: process.env.EMAIL_PORT || 2525,
      auth: {
        user: process.env.EMAIL_USER || "c0648e12077711",
        pass: process.env.EMAIL_PASS || "99a3d500c274bf",
      },
    });

    // Generate email body using Mailgen and template
    const template = templates[options.template](options.data);
    const emailBody = mailGenerator.generate(template);
    const emailText = mailGenerator.generatePlaintext(template);

    // Configure mail options
    const mailOptions = {
      from: process.env.EMAIL_FROM || "noreply@yourerp.edu.in",
      to: options.email,
      subject: options.subject,
      text: emailText,
      html: emailBody,
    };

    // Send email
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
};
