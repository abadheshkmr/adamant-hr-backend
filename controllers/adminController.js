import jwt from 'jsonwebtoken';

const admin_username = process.env.ADMINNAME;
const admin_password = process.env.PASSWORD;
const hash = process.env.hash;

const loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Log incoming request (without password for security)
    console.log('=== ADMIN LOGIN ATTEMPT ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Username received:', username);
    console.log('Password received:', password ? '***' : 'MISSING');
    console.log('Expected username:', admin_username);
    console.log('Expected password:', admin_password ? '***' : 'MISSING');
    console.log('Hash configured:', hash ? 'YES' : 'NO');
    
    // Check if credentials are configured
    if (!admin_username || !admin_password) {
      console.error('ERROR: Admin credentials not configured in .env file');
      return res.json({ success: false, message: 'Server configuration error' });
    }
    
    if (!hash) {
      console.error('ERROR: JWT hash not configured in .env file');
      return res.json({ success: false, message: 'Server configuration error' });
    }

    // Compare credentials
    const usernameMatch = username === admin_username;
    const passwordMatch = password === admin_password;
    
    console.log('Username match:', usernameMatch);
    console.log('Password match:', passwordMatch);
    
    if (usernameMatch && passwordMatch) {
      console.log('✅ Login successful');
      const token = jwt.sign({ user: { id: username, password } }, hash, { expiresIn: '30d' });
      console.log('Token generated:', token.substring(0, 20) + '...');
      res.json({ success: true, token });
    } else {
      console.log('❌ Login failed - Invalid credentials');
      console.log('Username match:', usernameMatch, '| Expected:', admin_username, '| Received:', username);
      console.log('Password match:', passwordMatch);
      res.json({ success: false, message: 'Invalid credentials' });
    }
    console.log('=== END LOGIN ATTEMPT ===\n');
  } catch (error) {
    console.error('=== LOGIN ERROR ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=== END ERROR ===\n');
    res.json({ success: false, message: 'Server error' });
  }
};

export { loginAdmin };
