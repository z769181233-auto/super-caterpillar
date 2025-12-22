# Prisma Enum Risk Audit

## 1. require.resolve('@prisma/client')
./packages/database/dist/prisma-enums.js:9:var prismaClientEntry = require.resolve('@prisma/client');
./packages/database/src/prisma-enums.ts:7:const prismaClientEntry = require.resolve('@prisma/client');
./apps/workers/dist/packages/database/src/prisma-enums.js:41:const prismaClientEntry = require.resolve('@prisma/client');

## 2. node_modules/.prisma
