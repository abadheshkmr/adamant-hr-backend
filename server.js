import express from "express"
import cors from "cors"
import helmet from "helmet"
import 'dotenv/config';
import serviceRouter from "./routes/serviceRoute.js";
import industryRouter from "./routes/industryRoute.js";
import connectDB from "./config/db.js";
import cvRouter from "./routes/cvRoute.js";
import adminRouter from "./routes/adminRoute.js";
import vacancyRouter from "./routes/vacancyRoute.js";
import { apiLimiter, speedLimiter, suspiciousActivityTracker } from "./middleware/ddosProtection.js";

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

// DDoS Protection Middleware (apply before other middleware)
app.use(suspiciousActivityTracker);
app.use(speedLimiter);
app.use(apiLimiter);

// Standard middleware
app.use(express.json({ limit: '10mb' })) // Limit JSON payload size

// CORS configuration - allow both frontend and admin panel
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  process.env.ADMIN_URL || 'http://localhost:3001',
  'http://localhost:3000',
  'http://localhost:3001'
].filter(Boolean); // Remove any undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}))
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Limit URL-encoded payload size

// db connection

connectDB();



// api endpoints
app.use("/images",express.static('uploads'))
app.use("/uploads/resumes", express.static("uploads/resumes"));
app.use("/api/service",serviceRouter);
app.use("/api/industry", industryRouter);
app.use("/api/cv", cvRouter);
app.use("/api/admin", adminRouter);
app.use("/api/vacancy", vacancyRouter);

app.get("/" , (req , res)=>{
    res.send("API Working")
})

app.listen(port, ()=>{
    console.log(`server started on http://localhost:${port}`);
})

