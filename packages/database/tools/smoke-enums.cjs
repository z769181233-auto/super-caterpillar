const db = require('../dist');

console.log('PrismaClient:', typeof db.PrismaClient);
console.log('JobStatus keys:', Object.keys(db.JobStatus || {}));
console.log('JobStatus.PENDING:', db.JobStatus?.PENDING);

