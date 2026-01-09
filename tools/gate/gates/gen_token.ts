import * as jwt from 'jsonwebtoken';
const args = process.argv.slice(2);
const payload = JSON.parse(args[0]);
const secret = args[1] || 'test-secret';
console.log(jwt.sign(payload, secret));
