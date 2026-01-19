
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
      ? authHeader.slice(7) 
      : authHeader; // Fallback for backward compatibility

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Access denied. Invalid token format." });
    }

    // Verify token
    const decoded = jwt.verify(token, hash);
    
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
    console.error(err);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

export default verifyAdmin;