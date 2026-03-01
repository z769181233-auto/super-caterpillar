async function test() {
  try {
    console.log('Fetching http://127.0.0.1:3000/api/health...');
    const res = await fetch('http://127.0.0.1:3000/api/health'); // Global fetch
    console.log('Status:', res.status);
    console.log('Body:', await res.text());
  } catch (e) {
    console.error('Fetch failed:', e);
  }
}

test();
