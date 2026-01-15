const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'gate-test-jwt-secret-p0r0';
const payload = {
  id: 'user-p0r0-gate',
  email: 'p0r0-gate@test.com',
  orgId: 'org-p0r0-gate',
};

const token = jwt.sign(payload, secret, { expiresIn: '1h' });
console.log(token);
