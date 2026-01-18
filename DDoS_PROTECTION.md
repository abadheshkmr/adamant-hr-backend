# DDoS Protection Implementation

## Overview
This backend API is now protected against DDoS (Distributed Denial of Service) attacks using multiple layers of protection.

## Protection Layers Implemented

### 1. **Rate Limiting** (`express-rate-limit`)
- **General API**: 100 requests per 15 minutes per IP
- **Authentication Endpoints**: 5 login attempts per 15 minutes per IP
- **File Upload Endpoints**: 10 uploads per hour per IP

### 2. **Speed Limiting** (`express-slow-down`)
- After 50 requests in 15 minutes, responses are gradually slowed down
- Adds 100ms delay per request, up to a maximum of 2 seconds
- Prevents rapid-fire attacks while allowing legitimate traffic

### 3. **Suspicious Activity Tracker**
- Monitors requests per IP address
- Blocks IPs making more than 60 requests per minute
- Automatically cleans up old tracking data

### 4. **Security Headers** (`helmet`)
- Sets secure HTTP headers
- Prevents common web vulnerabilities
- Configures Content Security Policy

### 5. **Request Size Limits**
- JSON payloads limited to 10MB
- URL-encoded payloads limited to 10MB
- Prevents large payload attacks

## Configuration

### Environment Variables
Add to your `.env` file:
```env
PORT=4000
URI=your_mongodb_connection_string
FRONTEND_URL=https://adamanthr.com  # Optional: restrict CORS to specific origin
```

### Rate Limit Settings
You can adjust rate limits in `middleware/ddosProtection.js`:

```javascript
// General API - adjust max requests
max: 100, // Change this number

// Authentication - adjust max login attempts
max: 5, // Change this number

// File Uploads - adjust max uploads
max: 10, // Change this number
```

## How It Works

1. **Request arrives** → Suspicious activity tracker checks IP
2. **Speed limiter** → Adds delay if too many requests
3. **Rate limiter** → Blocks if limit exceeded
4. **Helmet** → Adds security headers
5. **Request processed** → Normal flow continues

## Testing

### Test Rate Limiting
```bash
# Make 101 requests quickly
for i in {1..101}; do curl http://localhost:4000/api/service/list; done
# Should see rate limit error after 100 requests
```

### Test Authentication Rate Limiting
```bash
# Try to login 6 times
for i in {1..6}; do curl -X POST http://localhost:4000/api/admin/login -d '{"email":"test","password":"test"}'; done
# Should see rate limit error after 5 attempts
```

## Monitoring

The suspicious activity tracker logs warnings to console:
```
Suspicious activity detected from IP: 192.168.1.1 - 65 requests in 1 minute
```

## Additional Recommendations

### For Production:
1. **Use a Reverse Proxy** (Nginx/Cloudflare)
   - Provides additional DDoS protection
   - Can handle SSL/TLS termination
   - Offers caching and load balancing

2. **Enable Cloudflare** (if using)
   - Free DDoS protection
   - CDN for static assets
   - Bot protection

3. **Monitor Logs**
   - Set up logging service (Winston, Morgan)
   - Monitor for patterns
   - Alert on suspicious activity

4. **IP Whitelisting** (for admin endpoints)
   - Add IP whitelist for admin routes
   - Only allow known IPs to access admin panel

5. **Use Redis for Rate Limiting** (for distributed systems)
   - If running multiple server instances
   - Share rate limit data across servers

## Current Protection Status

✅ Rate limiting enabled
✅ Speed limiting enabled
✅ Suspicious activity tracking enabled
✅ Security headers enabled
✅ Request size limits enabled
✅ Authentication endpoints protected
✅ File upload endpoints protected

## Notes

- Rate limits are per IP address
- Behind a reverse proxy, ensure `trust proxy` is set (already configured)
- Rate limit data is stored in memory (resets on server restart)
- For production with multiple servers, consider Redis-based rate limiting

