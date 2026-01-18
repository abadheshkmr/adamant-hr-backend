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
app.use(cors({
  origin: process.env.FRONTEND_URL || '*', // Configure allowed origins
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

