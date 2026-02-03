const loginAdmin = async (req, res) => {
  try {
    return res.status(400).json({
      success: false,
      message: 'Admin login is via Firebase only. Sign in through the admin portal with your Firebase account, or use POST /api/admin/auth/verify with a Firebase ID token (Authorization: Bearer <token>).',
    });
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
