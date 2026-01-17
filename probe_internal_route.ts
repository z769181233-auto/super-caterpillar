import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const ENDPOINT = '/api/internal/events/cost-ledger';

async function probe() {
    console.log(`[PROBE] Checking ${ENDPOINT}...`);

    // 1. 无任何 Header 探测
    try {
        const res = await axios.post(`${BASE_URL}${ENDPOINT}`, {}, { validateStatus: () => true });
        console.log(`[PROBE] No Headers: HTTP ${res.status}`, res.data);
    } catch (e: any) {
        console.log(`[PROBE] No Headers Error: ${e.message}`);
    }

    // 2. 只有 Content-Type
    try {
        const res = await axios.post(`${BASE_URL}${ENDPOINT}`, {}, {
            headers: { 'Content-Type': 'application/json' },
            validateStatus: () => true
        });
        console.log(`[PROBE] JSON Only: HTTP ${res.status}`, res.data);
    } catch (e: any) {
        console.log(`[PROBE] JSON Only Error: ${e.message}`);
    }
}

probe();
