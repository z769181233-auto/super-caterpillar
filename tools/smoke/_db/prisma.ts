import { PrismaClient } from 'database';

// Singleton PrismaClient for smoke tools (assert_shot_exists, grant_admin, etc.)
export const prisma = new PrismaClient();


