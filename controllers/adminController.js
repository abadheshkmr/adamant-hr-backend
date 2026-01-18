import jwt from 'jsonwebtoken';

const admin_username = process.env.ADMINNAME;
const admin_password = process.env.PASSWORD;
const hash = process.env.hash;

const loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;
    

    if (username === admin_username && password === admin_password) {
      const token = jwt.sign({ user: { id: username, password } }, hash, { expiresIn: '30d' });
      res.json({ success: true, token });
    } else {
      res.json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Server error' });
  }
};

export { loginAdmin };
