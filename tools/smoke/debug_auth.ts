import { PrismaClient } from 'database';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient({});

async function main() {
  const email = 'smoke_admin@scu.local';
  const password = 'smoke-dev-password';
  const hardcodedHash = '$2a$10$nqOlsY8A4rwqENUT3ef5ruv4cLoT.vwZKqSu//xTNKoZXOcOu9QNS';

  console.log(`[debug] Checking auth for ${email}...`);

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.error(`[debug] User ${email} NOT FOUND in DB!`);
    return;
  }

  console.log(`[debug] User found: ID=${user.id}`);
  console.log(`[debug] Stored Hash: ${user.passwordHash}`);

  const isMatchDB = bcrypt.compareSync(password, user.passwordHash);
  console.log(`[debug] bcrypt.compare(password, dbHash) = ${isMatchDB}`);

  const isMatchHardcoded = bcrypt.compareSync(password, hardcodedHash);
  console.log(`[debug] bcrypt.compare(password, hardcodedHash) = ${isMatchHardcoded}`);

  if (isMatchDB) {
    console.log(
      '[debug] CREDENTIALS SHOULD WORK. If API returns 401, check API environment/DB connection misalignment.'
    );
  } else {
    console.log('[debug] CREDENTIALS MISMATCH. The hash in DB is invalid for this password.');
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
