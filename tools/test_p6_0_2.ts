import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const API_KEY = 'ak_worker_dev_0000000000000000';
const API_SECRET = 'super-caterpillar-dev-secret-64-chars-long-for-hmac-sha256-signing-12345678';
const BASE_URL = 'http://localhost:3000/api/storage/novels';

async function testSecurityLoop() {
  console.log('=== P6-0-2 Security Loop Test ===');

  // Case 1: Valid Upload (Strict Hash + Valid Signature)
  console.log('\n[Case 1] Valid Upload: Expect 200 OK');
  await runTest(true, true);

  // Case 2: SHA Mismatch (Valid Signature of Fake Hash, but Content Mismatch)
  // Guard should PASS (Signature OK), Controller should FAIL (SHA Mismatch)
  console.log('\n[Case 2] SHA Mismatch: Expect 401 SHA_MISMATCH from Controller');
  await runTest(true, false); // Valid Sig, Invalid Content Hash relation

  // Case 3: Invalid Signature (Valid Hash in header, but Signature wrong)
  // Guard should FAIL (Signature Mismatch)
  console.log('\n[Case 3] Invalid Signature: Expect 4003 from Guard');
  await runTest(false, true);
}

async function runTest(validSig: boolean, validHashContent: boolean) {
  const content = 'This is P6-0-2 Test Content ' + Date.now();
  const realSha = crypto.createHash('sha256').update(content).digest('hex');

  // Decide what SHA to put in header
  const headerSha = validHashContent
    ? realSha
    : crypto.createHash('sha256').update('FAKE').digest('hex');

  // Generate Signature based on HEADER SHA (Protocol: Sign Hash)
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Canonical: apiKey + nonce + timestamp + contentSha256
  const canonical = `${API_KEY}${nonce}${timestamp}${headerSha}`;
  const validSignature = crypto.createHmac('sha256', API_SECRET).update(canonical).digest('hex');
  const signature = validSig
    ? validSignature
    : 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

  try {
    const res = await axios.post(BASE_URL, content, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Api-Key': API_KEY,
        'X-Nonce': nonce,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'X-Content-SHA256': headerSha,
      },
      validateStatus: () => true, // capture all status
    });

    console.log(`Status: ${res.status}`);
    console.log('Body:', JSON.stringify(res.data));

    if (res.status === 200) {
      if (!validHashContent) console.error('❌ FAIL: Expected 401 SHA_MISMATCH, got 200');
      else if (!validSig) console.error('❌ FAIL: Expected 4003, got 200');
      else console.log('✅ PASS: 200 OK');
    } else if (res.status === 401) {
      if (validHashContent && validSig) console.error('❌ FAIL: Expected 200, got 401');
      else if (res.data.error === 'SHA_MISMATCH') console.log('✅ PASS: 401 SHA_MISMATCH');
      else console.log(`ℹ️ Got 401: ${res.data.error}`);
    } else if (res.status === 403 || res.data?.errorCode === '4003') {
      if (validSig) console.error('❌ FAIL: Expected Pass or Controller Fail, got Guard Fail');
      else console.log('✅ PASS: Guard Rejected (4003)');
    } else {
      console.error(`❌ FAIL: Unexpected Status ${res.status}`);
    }
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

testSecurityLoop();
