
import jwt from 'jsonwebtoken';

const admin_username = process.env.ADMINNAME;
const admin_password = process.env.PASSWORD;
const hash = process.env.hash;




const verifyAdmin = async (req, res, next) => {
  try {
    // Get token from Authorization header (Bearer token format)
    const authHeader = req.header("Authorization");
    
    if (!authHeader) {
      return res
        .status(401)
        .json({ success: false, message: "Access denied. No token provided." });
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.startsWith("Bearer ") 
      ? authHeader.slice(7).trim() 
      : authHeader.trim(); // Fallback for backward compatibility

    // Validate token format (basic check - JWT should have 3 parts separated by dots)
    if (!token || token === "null" || token === "undefined" || token.length < 10) {
      return res
        .status(401)
        .json({ success: false, message: "Access denied. Invalid token format." });
    }

    // Check if token looks like a JWT (has 3 parts separated by dots)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      return res
        .status(401)
        .json({ success: false, message: "Access denied. Malformed token." });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, hash);
    } catch (jwtError) {
      // Handle specific JWT errors
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          success: false, 
          message: "Access denied. Invalid token signature." 
        });
      } else if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          message: "Access denied. Token has expired. Please login again." 
        });
      } else {
        return res.status(401).json({ 
          success: false, 
          message: "Access denied. Token verification failed." 
        });
      }
    }
    
    // Validate decoded token structure
    if (!decoded || !decoded.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Access denied. Invalid token structure." 
      });
    }
    
    const { id: email, password } = decoded.user;
    if (email === admin_username && password === admin_password) {
      // Pass user info to next middleware or route
      req.admin = decoded.user;
      return next();
    } else {
      return res.status(403).json({
        success: false,
        message: "Forbidden. You are not authorized as admin.",
      });
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] verifyAdmin Error:`, err);
    return res.status(401).json({ 
      success: false, 
      message: "Access denied. Authentication failed." 
    });
  }
};

export default verifyAdmin;