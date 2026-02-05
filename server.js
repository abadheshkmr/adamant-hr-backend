import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '.env');
const loaded = dotenv.config({ path: envPath });
if (loaded.error) {
  console.warn('[dotenv] Could not load .env from', envPath, loaded.error.message);
} else {
  console.log('[dotenv] Loaded .env from', envPath);
}

import express from "express"
import cors from "cors"
import helmet from "helmet"
import serviceRouter from "./routes/serviceRoute.js";
import industryRouter from "./routes/industryRoute.js";
import connectDB from "./config/db.js";
import cvRouter from "./routes/cvRoute.js";
import adminRouter from "./routes/adminRoute.js";
import vacancyRouter from "./routes/vacancyRoute.js";
import clientRouter from "./routes/clientRoute.js";
import companyRouter from "./routes/companyRoute.js";
import candidateRouter from "./routes/candidateRoute.js";
import jobAlertRouter from "./routes/jobAlertRoute.js";
import contactRouter from "./routes/contactRoute.js";
import settingsRouter from "./routes/settingsRoute.js";
import { apiLimiter, speedLimiter, suspiciousActivityTracker } from "./middleware/ddosProtection.js";
import { processScheduledAlerts } from "./services/jobAlertService.js";

// app config

const app = express();
const port = process.env.PORT || 4000

// Security Headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding if needed
}));

// Trust proxy (important for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Standard middleware (body parsing first so CORS can run before limiters)
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS: allowed origins from env only (no hardcoded production URLs)
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  process.env.ADMIN_URL || 'http://localhost:3001',
  ...(process.env.CANDIDATE_PORTAL_URL
    ? process.env.CANDIDATE_PORTAL_URL.split(',').map((u) => u.trim()).filter(Boolean)
    : []),
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    if (process.env.NODE_ENV === 'development') return callback(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
}));

// DDoS Protection Middleware (after CORS so responses still get CORS headers)
app.use(suspiciousActivityTracker);
app.use(speedLimiter);
app.use(apiLimiter);

// db connection

connectDB();

// Job alerts cron: run scheduled alerts (daily/weekly) every hour
const CRON_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
setInterval(() => {
  processScheduledAlerts().catch((err) =>
    console.error('[jobAlert cron]', err?.message)
  );
}, CRON_INTERVAL_MS);
// Run once shortly after startup (after DB is ready)
setTimeout(() => {
  processScheduledAlerts().catch((err) =>
    console.error('[jobAlert cron]', err?.message)
  );
}, 30 * 1000);

// api endpoints
app.use("/images",express.static('uploads'))
app.use("/uploads/resumes", express.static("uploads/resumes"));
app.use("/uploads/coverLetters", express.static("uploads/coverLetters"));
app.use("/api/service",serviceRouter);
app.use("/api/industry", industryRouter);
app.use("/api/cv", cvRouter);
app.use("/api/admin", adminRouter);
app.use("/api/vacancy", vacancyRouter);
app.use("/api/client", clientRouter);
app.use("/api/company", companyRouter);
app.use("/api/candidate", candidateRouter);
app.use("/api/job-alert", jobAlertRouter);
app.use("/api/contact", contactRouter);
app.use("/api/settings", settingsRouter);

app.get("/" , (req , res)=>{
    res.send("API Working")
})

// Global error handler (must be last)
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] Unhandled Error:`, err);
    console.error('Error stack:', err.stack);
    
    // Don't send error details in production
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message;
    
    res.status(err.status || 500).json({
        success: false,
        message: message
    });
});

app.listen(port, ()=>{
    console.log(`server started on http://localhost:${port}`);
})

