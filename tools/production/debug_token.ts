import * as path from 'path';
const repoRoot = process.cwd();
require('dotenv').config({ path: path.join(repoRoot, 'apps/api/.env') });
require('dotenv').config({ path: path.join(repoRoot, '.env.local') });

let apiToken = process.env.REPLICATE_API_TOKEN || '';
if (apiToken.startsWith('"') && apiToken.endsWith('"')) {
    apiToken = apiToken.slice(1, -1);
}
console.log("Token length:", apiToken.length);
console.log("Token starts with:", apiToken.substring(0, 5));
