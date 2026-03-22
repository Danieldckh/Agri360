const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET } = require('../config');

const router = Router();
const SALT_ROUNDS = 10;

// POST /signup
router.post('/signup', async (req, res) => {
  const { firstName, lastName, username, password, securityQuestion, securityAnswer } = req.body;

  if (!firstName || !lastName || !username || !password || !securityQuestion || !securityAnswer) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const answerHash = await bcrypt.hash(securityAnswer.toLowerCase(), SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO employees (first_name, last_name, username, password_hash, security_question, security_answer_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, first_name, last_name, username, role, status, created_at`,
      [firstName, lastName, username, passwordHash, securityQuestion, answerHash]
    );

    res.status(201).json({ message: 'Account created. Awaiting admin approval.', employee: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM employees WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const employee = result.rows[0];
    const valid = await bcrypt.compare(password, employee.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (employee.status !== 'approved') {
      return res.status(403).json({ error: `Account is ${employee.status}. Please contact an admin.` });
    }

    const payload = {
      id: employee.id,
      username: employee.username,
      role: employee.role,
      firstName: employee.first_name,
      lastName: employee.last_name,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    res.json({
      token,
      user: {
        id: employee.id,
        firstName: employee.first_name,
        lastName: employee.last_name,
        username: employee.username,
        role: employee.role,
        status: employee.status,
        photoUrl: employee.photo_url,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /forgot/verify-username
router.post('/forgot/verify-username', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const result = await pool.query('SELECT security_question FROM employees WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Username not found' });
    }

    res.json({ securityQuestion: result.rows[0].security_question });
  } catch (err) {
    console.error('Verify username error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /forgot/reset
router.post('/forgot/reset', async (req, res) => {
  const { username, securityAnswer, newPassword } = req.body;

  if (!username || !securityAnswer || !newPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const result = await pool.query('SELECT security_answer_hash FROM employees WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Username not found' });
    }

    const valid = await bcrypt.compare(securityAnswer.toLowerCase(), result.rows[0].security_answer_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect security answer' });
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE employees SET password_hash = $1 WHERE username = $2', [passwordHash, username]);

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Password reset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
