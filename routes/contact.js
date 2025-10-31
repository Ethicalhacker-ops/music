// File: routes/contact.js
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const fetch = require('node-fetch'); // for captcha verification

// Rate limiter (example)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max requests per IP per minute
});

// Department email map
const DEPARTMENT_EMAILS = {
  technical: 'it@jayprasad.com.np',
  admin: 'admin@jayprasad.com.np',
  general: 'contact@jayprasad.com.np',
  info: 'info@jayprasad.com.np',
};

// Configure nodemailer transport using SMTP (env vars)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helper: verify captcha (reCAPTCHA v2/v3)
async function verifyCaptcha(token) {
  if (!process.env.RECAPTCHA_SECRET) return true; // dev mode; set to false in production
  const resp = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(process.env.RECAPTCHA_SECRET)}&response=${encodeURIComponent(token)}`,
  });
  const data = await resp.json();
  return data.success && (data.score ? data.score >= 0.3 : true); // tune thresholds for v3
}

router.post(
  '/',
  limiter,
  [
    body('name').isLength({ min: 1 }).trim().escape(),
    body('email').isEmail().normalizeEmail(),
    body('department').isIn(['technical', 'admin', 'general', 'info']),
    body('subject').isLength({ min: 1 }).trim().escape(),
    body('message').isLength({ min: 1 }).trim().escape(),
    body('captchaToken').optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, department, subject, message, captchaToken } = req.body;

    try {
      // Verify CAPTCHA
      const captchaOk = await verifyCaptcha(captchaToken);
      if (!captchaOk) return res.status(400).json({ error: 'Captcha verification failed' });

      const to = DEPARTMENT_EMAILS[department] || DEPARTMENT_EMAILS.general;

      // Prepare email
      const mailOptions = {
        from: `"Website Contact" <${process.env.SMTP_FROM || 'no-reply@jayprasad.com.np'}>`,
        to,
        replyTo: email,
        subject: `[Contact Form] ${subject} — ${name}`,
        text: `Department: ${department}\nFrom: ${name} <${email}>\n\n${message}`,
        html: `
          <p><strong>Department:</strong> ${department}</p>
          <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <hr/>
          <p>${message.replace(/\n/g, '<br/>')}</p>
        `,
      };

      // Send email
      const info = await transporter.sendMail(mailOptions);

      // Optionally: save submission to DB for admin review
      // await db.query('INSERT INTO contact_submissions (...) VALUES (...)', [ ... ]);

      return res.json({ ok: true, messageId: info.messageId });
    } catch (err) {
      console.error('Contact send error', err);
      return res.status(500).json({ error: 'Unable to send message' });
    }
  }
);

module.exports = router;
