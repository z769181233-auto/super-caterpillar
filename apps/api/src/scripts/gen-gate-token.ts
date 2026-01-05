import * as jwt from 'jsonwebtoken';

async function main() {
  const userId = process.argv[2];
  const role = process.argv[3];
  const orgId = process.argv[4] || 'org-stage5-test';
  const secret = process.env.JWT_SECRET || 'secret';
  console.error(
    `[DEBUG] gen-gate-token using secret: ${secret.substring(0, 10)}... (len=${secret.length})`
  );

  if (!userId || !role) {
    process.exit(1);
  }

  // NOTE: JwtStrategy 期望 orgId 字段 (第 58 行)
  const token = jwt.sign(
    {
      sub: userId,
      email: 'test@example.com',
      role: role,
      orgId: orgId,
    },
    secret
  );

  process.stdout.write(token);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
