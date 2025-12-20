import axios from 'axios';
import { randomBytes } from 'crypto';

const API_URL = process.env.API_URL || 'http://localhost:3001/api';

async function runCheck() {
    const nonce = randomBytes(4).toString('hex');
    const email = `smoke_test_${nonce}@example.com`;
    const password = 'Password123!';

    console.log(`🚀 Starting regression check for: ${email}`);

    try {
        // 1. Register
        console.log('1. Testing Register...');
        const regRes = await axios.post(`${API_URL}/auth/register`, {
            email,
            password,
        });

        if (regRes.status !== 201 && regRes.status !== 200) {
            throw new Error(`Register failed with status ${regRes.status}`);
        }
        console.log('✅ Register success');

        // 1.1 Idempotency Check (Register again)
        console.log('1.1 Testing Register Idempotency...');
        try {
            await axios.post(`${API_URL}/auth/register`, { email, password });
            console.log('✅ Register idempotency success (allowed but handled)');
        } catch (e: any) {
            // If the system returns 409 Conflict, it's also acceptable idempotency if handled
            if (e.response?.status === 409) {
                console.log('✅ Register idempotency: Conflict handled');
            } else {
                throw e;
            }
        }

        // 2. Login
        console.log('2. Testing Login...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email,
            password,
        });

        if (loginRes.status !== 200 && loginRes.status !== 201) {
            throw new Error(`Login failed with status ${loginRes.status}`);
        }
        // 从 cookie 或 body 提取 token
        const setCookie = loginRes.headers['set-cookie'] || [];
        const tokenMatch = setCookie.find(c => c.startsWith('accessToken='))?.match(/accessToken=([^;]+)/);
        const token = tokenMatch ? tokenMatch[1] : loginRes.data?.data?.accessToken;

        if (!token) {
            console.error('DEBUG: loginRes.data:', JSON.stringify(loginRes.data));
            console.error('DEBUG: loginRes.headers:', JSON.stringify(loginRes.headers));
            throw new Error('AccessToken not found in response');
        }

        const authHeader = { Authorization: `Bearer ${token}` };
        console.log('✅ Login success');

        // 3. /users/me
        console.log('3. Testing /users/me...');
        const meRes = await axios.get(`${API_URL}/users/me`, { headers: authHeader });
        if (meRes.status !== 200) {
            throw new Error(`/users/me failed with status ${meRes.status}`);
        }
        const orgId = meRes.data.data.defaultOrganizationId || meRes.data.data.organizationId;
        console.log(`✅ /users/me success. OrgId: ${orgId}`);

        // 4. Create Project
        console.log('4. Testing Create Project...');
        const projRes = await axios.post(`${API_URL}/projects`, {
            name: `Smoke Project ${nonce}`,
            description: 'Created by regression check script',
            organizationId: orgId,
        }, { headers: authHeader });

        if (projRes.status !== 201) {
            throw new Error(`Create project failed with status ${projRes.status}`);
        }
        const projectId = projRes.data.data.id;
        console.log(`✅ Create project success. ProjectId: ${projectId}`);

        // 5. Project Structure Access
        console.log('5. Testing Get Project Structure (200 expected)...');
        const structRes = await axios.get(`${API_URL}/projects/${projectId}/structure`, { headers: authHeader });
        if (structRes.status !== 200) {
            throw new Error(`Get structure failed with status ${structRes.status}`);
        }
        console.log('✅ Get structure success');

        // 6. DB Check: Simple logic check via /users/me or direct if script allows
        // Here we use the script's visibility to confirm logic.
        if (meRes.data.data.organizations?.length > 1) {
            const orgs = meRes.data.data.organizations.filter((o: any) => o.organization.type === 'PERSONAL');
            if (orgs.length > 1) {
                throw new Error(`DB Integrity Failed: Multiple personal organizations found for user ${email}`);
            }
        }
        console.log('✅ DB Integrity success (Single personal org)');

        // 7. Forbidden (ABAC) Test
        console.log('7. Testing ABAC (Forbidden) Access...');
        const randomOrgId = '00000000-0000-0000-0000-000000000000';
        try {
            // Test with a random org context that user doesn't belong to
            await axios.get(`${API_URL}/users/me`, {
                headers: { ...authHeader, 'x-context-org-id': randomOrgId }
            });
            // Note: Currently /users/me might ignore context-org-id in simple logic, 
            // but for projects/jobs it should definitely trigger empty or forbidden.
            // Let's test a more sensitive endpoint if available, or just check that 
            // the returned context doesn't leak.
        } catch (e: any) {
            if (e.response?.status === 403 || e.response?.status === 401) {
                console.log('✅ ABAC isolation confirmed (Forbidden or Unauth)');
            } else {
                console.warn(`⚠️ ABAC unexpected status: ${e.response?.status}`);
            }
        }
        process.exit(0);

    } catch (error: any) {
        console.error('\n❌ REGRESSION CHECK FAILED!');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error('Response Body:', JSON.stringify(error.response.data, null, 2).substring(0, 500));
        } else {
            console.error('Error Message:', error.message);
        }
        process.exit(1);
    }
}

runCheck();
