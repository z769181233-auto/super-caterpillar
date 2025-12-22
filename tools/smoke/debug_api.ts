
import axios from 'axios';
import { readFileSync } from 'fs';
import path from 'path';

async function run() {
    const API_BASE = 'http://localhost:3000';
    const email = 'ad@test.com';
    // We updated DB so this user now has smoke_admin's password
    const password = 'smoke-dev-password';

    try {
        console.log(`Logging in as ${email}...`);
        const loginRes = await axios.post(`${API_BASE}/api/auth/login`, {
            email,
            password
        });

        // Extract cookies
        const cookies = loginRes.headers['set-cookie'];
        if (!cookies) throw new Error('No cookies returned');
        // Important: Join with '; '
        const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

        console.log('Login successful.');

        const projectId = '1af90dd0-1d08-40e2-b335-2f0ddf3a03c4';

        // 1. Check Structure
        console.log(`\n--- CHECKING STRUCTURE (${projectId}) ---`);
        try {
            const structRes = await axios.get(`${API_BASE}/api/projects/${projectId}/structure`, {
                headers: { Cookie: cookieHeader }
            });
            console.log(`Status: ${structRes.status}`);
            console.log('Analysis Status:', structRes.data?.data?.analysisStatus);
        } catch (e: any) {
            console.log('Structure Error:', e.response?.status, e.response?.data);
        }

        // 2. Check Overview
        console.log(`\n--- CHECKING OVERVIEW (${projectId}) ---`);
        try {
            const overviewRes = await axios.get(`${API_BASE}/api/projects/${projectId}/overview`, {
                headers: { Cookie: cookieHeader }
            });
            console.log(`Status: ${overviewRes.status}`);
            // Check Flow Node status
            const nodes = overviewRes.data?.data?.flow?.nodes || [];
            const structureNode = nodes.find((n: any) => n.key === 'STRUCTURE_ANALYSIS');
            console.log('Structure Flow Status:', structureNode?.status);
            console.log('Stats:', JSON.stringify(overviewRes.data?.data?.stats));
        } catch (e: any) {
            console.log('Overview Error:', e.response?.status, e.response?.data);
        }

    } catch (err: any) {
        console.error('Fatal Error:', err.message);
        if (err.response) {
            // console.error('Data:', err.response.data);
        }
    }
}

run();
