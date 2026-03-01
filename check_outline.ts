import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
dotenv.config({ path: './apps/api/.env' });

const secret = process.env.JWT_SECRET;

async function verify() {
  const payload = {
    sub: 'user_seal_test_001',
    email: 'seal@test.com',
    tier: 'Basic',
    orgId: 'org_seal_test_001',
  };
  const token = jwt.sign(payload, secret);

  const buildId = 'bf67cbdc-79a9-42be-b074-6239a2719064';
  const outlineRes = await fetch(`http://localhost:3000/api/builds/${buildId}/outline`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const outlineData = await outlineRes.json();
  console.log(JSON.stringify(outlineData, null, 2).substring(0, 1000));
}

verify().catch(console.error);
