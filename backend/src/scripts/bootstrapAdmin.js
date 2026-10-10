require('dotenv').config();

async function run() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'OrbitAdmin2025!';
  const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET || 'classorbit-secure-bootstrap-key-2025';
  const port = process.env.PORT || 5000;
  const url = `http://127.0.0.1:${port}/api/auth/bootstrap`;

  console.log(`🚀 Provisioning In-Memory Admin Account via Server API...`);
  console.log(`Target URL: ${url}`);
  console.log(`Username: ${username}`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bootstrapSecret,
        username,
        password,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      console.log(`\n🎉 Admin credentials successfully configured in memory!`);
      console.log(`Username: ${username}`);
      console.log(`Password: ${password}`);
      process.exit(0);
    } else {
      console.error(`❌ Bootstrap error:`, data?.error?.message || data);
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Could not connect to running backend on port ${port}:`, err.message);
    console.log(`💡 Note: The default admin account ('admin' / 'OrbitAdmin2025!') is also auto-seeded in memory automatically when the backend starts.`);
    process.exit(0);
  }
}

run();
