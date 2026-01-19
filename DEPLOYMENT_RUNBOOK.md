# Deployment Runbook - HR Backend

This document contains step-by-step instructions for deploying the HR Backend application, including database migrations and configuration.

---

## 📋 Pre-Deployment Checklist

- [ ] Backup existing database
- [ ] Review all environment variables
- [ ] Test locally before deploying
- [ ] Review recent code changes

---

## 🗄️ Database Migration Steps

### Step 1: Update CV Collection Indexes

**Why?** The CV collection previously had a unique index on `email` only, which prevented users from applying to multiple jobs. We've updated it to use a compound unique index on `email + jobId` to allow multiple applications while preventing duplicates for the same job.

**Action Required:**

1. **Connect to your MongoDB instance** (local or Atlas)

2. **Run the migration script:**
   ```bash
   cd hr-backend
   node scripts/migrateCVIndex.js
   ```

   **OR manually in MongoDB shell/Compass:**
   ```javascript
   // Connect to your database
   use test;  // or your database name

   // Check existing indexes
   db.cvs.getIndexes();

   // Drop old unique index on email (if it exists)
   db.cvs.dropIndex("email_1");

   // Create new compound unique index
   db.cvs.createIndex(
     { email: 1, jobId: 1 },
     { unique: true, name: "email_1_jobId_1" }
   );

   // Verify the new index
   db.cvs.getIndexes();
   ```

3. **Verify the migration:**
   - Check that `email_1` index is removed
   - Check that `email_1_jobId_1` compound index exists
   - Test that you can create multiple CVs with same email but different jobId

---

## 🔧 Environment Variables Setup

### Required Environment Variables

Create or update `.env` file in the `hr-backend` directory:

```env
# Database
URI=mongodb://localhost:27017/test
# OR for MongoDB Atlas:
# URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Server
PORT=4000

# Frontend & Admin URLs (for CORS)
FRONTEND_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001

# For production, use actual URLs:
# FRONTEND_URL=https://your-frontend-domain.com
# ADMIN_URL=https://your-admin-domain.com

# Admin Credentials
ADMINNAME=your_admin_username
PASSWORD=your_admin_password

# JWT Secret Key (use a strong random string)
hash=your_jwt_secret_key_here
```

### Production Environment Variables

For production deployment (Render, Railway, etc.):

1. Set all environment variables in your hosting platform's dashboard
2. **Never commit `.env` file to git**
3. Use strong, unique values for:
   - `hash` (JWT secret)
   - `ADMINNAME` and `PASSWORD`
   - MongoDB connection string with proper credentials

---

## 🚀 Deployment Steps

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run database migration:**
   ```bash
   node scripts/migrateCVIndex.js
   ```

3. **Start the server:**
   ```bash
   npm start
   # or
   node server.js
   ```

### Production Deployment (Render/Railway/etc.)

1. **Connect your repository** to the hosting platform

2. **Set environment variables** in the platform dashboard:
   - `URI` - MongoDB connection string
   - `PORT` - Server port (usually auto-set by platform)
   - `FRONTEND_URL` - Your frontend domain
   - `ADMIN_URL` - Your admin panel domain
   - `ADMINNAME` - Admin username
   - `PASSWORD` - Admin password
   - `hash` - JWT secret key

3. **Set build command** (if needed):
   ```bash
   npm install
   ```

4. **Set start command:**
   ```bash
   node server.js
   ```

5. **Before first deployment, run migration:**
   - Connect to your MongoDB instance
   - Run the migration script manually or via MongoDB shell

6. **Deploy and monitor logs** for any errors

---

## 🔍 Post-Deployment Verification

### 1. Health Check
```bash
curl https://your-backend-url.com/
# Should return: "API Working"
```

### 2. Test API Endpoints
```bash
# Test public endpoints
curl https://your-backend-url.com/api/vacancy/list
curl https://your-backend-url.com/api/industry/list
curl https://your-backend-url.com/api/service/list

# Test admin login
curl -X POST https://your-backend-url.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_admin_username","password":"your_admin_password"}'
```

### 3. Test Application Submission
- Submit a test application through the frontend
- Verify it's stored in the database
- Verify duplicate prevention works (try submitting same email + jobId twice)

### 4. Check Logs
- Monitor application logs for errors
- Check for rate limiting issues
- Verify CORS is working correctly

---

## 🐛 Troubleshooting

### Issue: "E11000 duplicate key error collection: test.cvs index: email_1"

**Cause:** Old unique index on `email` still exists

**Solution:**
```bash
# Run the migration script
node scripts/migrateCVIndex.js

# OR manually drop the index
# In MongoDB shell/Compass:
db.cvs.dropIndex("email_1");
```

### Issue: "Cannot connect to MongoDB"

**Solutions:**
- Check `URI` environment variable is correct
- Verify MongoDB instance is running
- Check network/firewall settings
- For Atlas: Verify IP whitelist includes your server IP

### Issue: CORS errors

**Solutions:**
- Verify `FRONTEND_URL` and `ADMIN_URL` are set correctly
- Check that URLs match exactly (including protocol http/https)
- For development, ensure localhost ports match

### Issue: "Rate limit exceeded"

**Solutions:**
- This is expected behavior for DDoS protection
- Wait for the rate limit window to reset
- Adjust limits in `middleware/ddosProtection.js` if needed

---

## 📝 Database Indexes Reference

### CV Collection Indexes

**Before Migration:**
- `email_1` (unique) - ❌ Prevents multiple applications with same email

**After Migration:**
- `email_1_jobId_1` (compound unique) - ✅ Allows same email for different jobs, prevents duplicates for same job

### Vacancy Collection Indexes

- `jobId_1` (unique)
- `industry_1_status_1_createdAt_-1` (compound)
- `location.city_1_status_1` (compound)
- `employmentType_1_status_1` (compound)
- `experienceLevel_1_status_1` (compound)
- `status_1_createdAt_-1` (compound)

---

## 🔐 Security Checklist

- [ ] Strong JWT secret (`hash`) is set
- [ ] Admin credentials are strong and unique
- [ ] MongoDB connection string uses authentication
- [ ] CORS is configured correctly (not allowing all origins)
- [ ] Rate limiting is enabled
- [ ] Environment variables are not committed to git
- [ ] `.env` file is in `.gitignore`

---

## 📞 Support

If you encounter issues during deployment:

1. Check the logs for specific error messages
2. Verify all environment variables are set correctly
3. Ensure database migration has been completed
4. Review the troubleshooting section above

---

## 📅 Change Log

### 2026-01-19 - CV Index Migration
- **Changed:** CV collection index from `email` (unique) to `email + jobId` (compound unique)
- **Reason:** Allow users to apply to multiple jobs with same email
- **Migration Required:** Yes - Run `scripts/migrateCVIndex.js`

---

**Last Updated:** 2026-01-19
