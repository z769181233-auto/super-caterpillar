import jwt from 'jsonwebtoken';

const USER_ID = process.argv[2];
const SECRET = process.env.JWT_SECRET || 'dev-secret';

if (!USER_ID) {
  console.error('Usage: tsx tools/gate/scripts/s2-gen-token.ts <USER_ID>');
  process.exit(1);
}

const payload = {
  sub: USER_ID,
  email: 'mock-s2@example.com',
  // tier/role might be required by JwtStrategy return object structure but usually optional in payload unless enforced by strategy extracting them?
  // JwtStrategy extracts `sub`, `email`, `tier`, `orgId`.
  // But validate function queries DB using `sub`.
  // So minimally we need `sub`.
  tier: 'Free', // standard
};

const token = jwt.sign(payload, SECRET, { expiresIn: '1h' });
console.log(token);
