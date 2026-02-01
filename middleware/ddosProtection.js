import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

/**
 * General API Rate Limiter
 * Limits requests from same IP to prevent DDoS
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for successful requests (optional)
  skipSuccessfulRequests: false,
  // Skip rate limiting for failed requests (optional)
  skipFailedRequests: false,
  // Skip rate limiting for public read-only endpoints and CORS preflight
  skip: (req) => {
    if (req.method === 'OPTIONS') return true; // CORS preflight must not be rate-limited
    const path = req.path || req.originalUrl || '';
    return path.includes('/api/industry/list') ||
           path.includes('/api/service/list') ||
           path.includes('/api/vacancy/list');
  }
});

/**
 * Strict Rate Limiter for Authentication Endpoints
 * More restrictive for login/admin endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * File Upload Rate Limiter
 * Stricter limits for file uploads
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 uploads per hour
  message: {
    error: 'Too many file uploads, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Slow Down Middleware
 * Gradually slows down responses after multiple requests
 */
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per 15 minutes at full speed
  delayMs: (used, req) => {
    // Calculate delay based on how many requests over the limit
    const delayAfter = req.slowDown.limit || 50;
    return (used - delayAfter) * 100; // 100ms per request over limit
  },
  maxDelayMs: 2000, // Maximum delay of 2 seconds
  validate: {
    delayMs: false // Disable validation warning
  }
});

/**
 * IP-based Request Tracking
 * Tracks suspicious activity patterns
 */
const requestTracker = new Map();

export const suspiciousActivityTracker = (req, res, next) => {
  // Skip tracking for public read-only endpoints (they're expected to be called frequently)
  const publicReadOnlyPaths = ['/api/industry/list', '/api/service/list', '/api/vacancy/list'];
  if (publicReadOnlyPaths.some(path => req.path.includes(path) || req.originalUrl.includes(path))) {
    return next(); // Skip tracking for these endpoints
  }

  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  
  if (!requestTracker.has(ip)) {
    requestTracker.set(ip, []);
  }
  
  const requests = requestTracker.get(ip);
  
  // Remove requests older than 1 minute
  const recentRequests = requests.filter(timestamp => now - timestamp < windowMs);
  
  // Check for suspicious pattern (more than 60 requests per minute)
  if (recentRequests.length > 60) {
    console.warn(`Suspicious activity detected from IP: ${ip} - ${recentRequests.length} requests in 1 minute`);
    return res.status(429).json({
      error: 'Suspicious activity detected. Access temporarily blocked.',
      retryAfter: '1 minute'
    });
  }
  
  // Add current request timestamp
  recentRequests.push(now);
  requestTracker.set(ip, recentRequests);
  
  // Clean up old entries periodically (every 5 minutes)
  if (Math.random() < 0.01) { // 1% chance on each request
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    for (const [key, timestamps] of requestTracker.entries()) {
      const filtered = timestamps.filter(ts => ts > fiveMinutesAgo);
      if (filtered.length === 0) {
        requestTracker.delete(key);
      } else {
        requestTracker.set(key, filtered);
      }
    }
  }
  
  next();
};

