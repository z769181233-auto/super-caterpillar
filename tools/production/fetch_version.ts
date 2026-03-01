import axios from 'axios';
import * as path from 'path';

const repoRoot = process.cwd();
require('dotenv').config({ path: path.join(repoRoot, 'apps/api/.env') });

let apiToken = process.env.REPLICATE_API_TOKEN || '';
if (apiToken.startsWith('"') && apiToken.endsWith('"')) {
    apiToken = apiToken.slice(1, -1);
}

async function main() {
    try {
        const res = await axios.get("https://api.replicate.com/v1/models/fofr/sdxl-image-prompt", {
            headers: { "Authorization": `Token ${apiToken}` } 
        });
        console.log("fofr version:", res.data.latest_version.id);
    } catch(e) {
        console.error(e.response ? e.response.data : e);
    }
}
main();
