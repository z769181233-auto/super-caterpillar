import * as util from "util";

const db = require('../dist');

process.stdout.write(util.format('PrismaClient:', typeof db.PrismaClient) + "\n");
process.stdout.write(util.format('JobStatus keys:', Object.keys(db.JobStatus || {})) + "\n");
process.stdout.write(util.format('JobStatus.PENDING:', db.JobStatus?.PENDING) + "\n");
