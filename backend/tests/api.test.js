const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');
const { connectDB, closeDB } = require('../src/db');
const { env } = require('../src/config');
const Admin = require('../src/models/Admin');
const Classroom = require('../src/models/Classroom');
const Attendance = require('../src/models/Attendance');
const { hashPassword } = require('../src/utils/password');
const { v4: uuidv4 } = require('uuid');

let server;
let baseUrl;

test.before(async () => {
  // Connect to MongoDB Atlas
  await connectDB(env.MONGODB_URI);

  // Pre-seed admin in MongoDB
  const defaultUser = 'admin';
  const defaultPass = 'OrbitAdmin2025!';
  let admin = await Admin.findOne({ username: defaultUser });
  if (!admin) {
    const passwordHash = await hashPassword(defaultPass);
    admin = await Admin.create({
      adminId: uuidv4(),
      username: defaultUser,
      passwordHash,
    });
  }

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeDB();
});

test('GET /api/health should return 200 OK with service details', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'ok');
  assert.strictEqual(data.service, 'ClassOrbit API');
});

test('Security: Unauthenticated access to protected admin route /api/classrooms should be rejected with 401', async () => {
  const res = await fetch(`${baseUrl}/api/classrooms`);
  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.strictEqual(data.success, false);
  assert.strictEqual(data.error.code, 'UNAUTHORIZED');
  assert.ok(data.error.requestId);
});

test('Security: Admin login with incorrect password returns 401 INVALID_CREDENTIALS', async () => {
  const res = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'WrongPassword999!',
    }),
  });
  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.strictEqual(data.success, false);
  assert.strictEqual(data.error.code, 'INVALID_CREDENTIALS');
});

test('Auth: Admin login with valid credentials succeeds and provides token (POST /api/admin/login)', async () => {
  const res = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'OrbitAdmin2025!',
    }),
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.ok(data.data.token);
  assert.strictEqual(data.data.admin.username, 'admin');
});

test('Auth: GET /api/admin/me returns authenticated admin details', async () => {
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'OrbitAdmin2025!' }),
  });
  const { data: { token } } = await loginRes.json();

  const meRes = await fetch(`${baseUrl}/api/admin/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(meRes.status, 200);
  const meData = await meRes.json();
  assert.strictEqual(meData.success, true);
  assert.strictEqual(meData.data.admin.username, 'admin');
});

test('End-to-End: ClassOrbit Lifecycle with MongoDB Atlas, CSV Attendance, and Cleanup', async () => {
  // 1. Admin Login
  const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'OrbitAdmin2025!',
    }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data.token;

  // 2. Create classroom in MongoDB Atlas (POST /api/classrooms)
  const createRes = await fetch(`${baseUrl}/api/classrooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: 'Atlas Orbital Mechanics 201',
      description: 'MongoDB Atlas integration and automated attendance workflows',
    }),
  });
  assert.strictEqual(createRes.status, 201);
  const createData = await createRes.json();
  assert.strictEqual(createData.success, true);
  const classroomId = createData.data.classroom.id;
  const inviteCode = createData.data.classroom.invitations[0].code;

  // Verify Classroom document exists in MongoDB Atlas
  const dbClassroom = await Classroom.findOne({ classroomId });
  assert.ok(dbClassroom, 'Classroom must be persisted in MongoDB Atlas');
  assert.strictEqual(dbClassroom.name, 'Atlas Orbital Mechanics 201');
  assert.notStrictEqual(dbClassroom.tokenHash, inviteCode, 'Plain invite code must never be saved in MongoDB');

  // 3. Admin generates new invite code (POST /api/classrooms/:id/invite)
  const inviteRes = await fetch(`${baseUrl}/api/classrooms/${classroomId}/invite`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(inviteRes.status, 200);
  const inviteData = await inviteRes.json();
  assert.strictEqual(inviteData.success, true);
  const activeCode = inviteData.data.code;

  // 4. Student joins classroom (POST /api/classrooms/:id/join)
  const joinRes = await fetch(`${baseUrl}/api/classrooms/${classroomId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: activeCode,
      displayName: 'Achu Abi',
    }),
  });
  assert.strictEqual(joinRes.status, 201);
  const joinData = await joinRes.json();
  assert.strictEqual(joinData.success, true);
  const participantId = joinData.data.participant.participantId;
  const participantToken = joinData.data.participantToken;
  assert.strictEqual(joinData.data.participant.displayName, 'Achu Abi');
  assert.strictEqual(joinData.data.participant.permission.canPublishMic, false);

  // 5. Verify Attendance document created in MongoDB Atlas
  const initialAtt = await Attendance.findOne({ classroomId, participantId });
  assert.ok(initialAtt, 'Attendance document must be recorded in MongoDB Atlas on join');
  assert.strictEqual(initialAtt.studentName, 'Achu Abi');
  assert.strictEqual(initialAtt.status, 'PRESENT');

  // 6. List participants (GET /api/classrooms/:id/participants)
  const partsRes = await fetch(`${baseUrl}/api/classrooms/${classroomId}/participants`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(partsRes.status, 200);
  const partsData = await partsRes.json();
  assert.strictEqual(partsData.data.count, 1);

  // 7. Student requests microphone permission (POST /api/classrooms/:id/permission-requests)
  const reqPermRes = await fetch(`${baseUrl}/api/classrooms/${classroomId}/permission-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participantId,
      mediaType: 'MIC',
    }),
  });
  assert.strictEqual(reqPermRes.status, 200);
  const reqPermData = await reqPermRes.json();
  assert.strictEqual(reqPermData.success, true);
  const requestId = reqPermData.data.request.id;

  // 8. Admin lists permission requests (GET /api/classrooms/:id/permission-requests)
  const getPermsRes = await fetch(`${baseUrl}/api/classrooms/${classroomId}/permission-requests`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(getPermsRes.status, 200);
  const getPermsData = await getPermsRes.json();
  assert.strictEqual(getPermsData.data.requests.length, 1);

  // 9. Admin approves permission (POST /api/classrooms/:id/permission-requests/:requestId/approve)
  const approveRes = await fetch(`${baseUrl}/api/classrooms/${classroomId}/permission-requests/${requestId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(approveRes.status, 200);
  const approveData = await approveRes.json();
  assert.strictEqual(approveData.data.permission.canPublishMic, true);

  // 10. Admin revokes permission (POST /api/classrooms/:id/permission-requests/:requestId/revoke)
  const revokeRes = await fetch(`${baseUrl}/api/classrooms/${classroomId}/permission-requests/${requestId}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(revokeRes.status, 200);
  const revokeData = await revokeRes.json();
  assert.strictEqual(revokeData.data.permission.canPublishMic, false);

  // 11. Student leaves classroom (POST /api/classrooms/:id/leave)
  const leaveRes = await fetch(`${baseUrl}/api/classrooms/${classroomId}/leave`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-participant-token': participantToken,
    },
    body: JSON.stringify({ participantId }),
  });
  assert.strictEqual(leaveRes.status, 200);

  // Verify leaveTime is updated
  const leftAtt = await Attendance.findOne({ classroomId, participantId });
  assert.ok(leftAtt.leaveTime, 'Leave time must be set when student leaves');

  // 12. Admin ends classroom (POST /api/classrooms/:id/end)
  const endRes = await fetch(`${baseUrl}/api/classrooms/${classroomId}/end`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(endRes.status, 200);
  const endData = await endRes.json();
  assert.strictEqual(endData.data.classroom.status, 'ENDED');

  // 13. Download Classroom Attendance CSV (GET /api/classrooms/:id/attendance.csv)
  const csvRes = await fetch(`${baseUrl}/api/classrooms/${classroomId}/attendance.csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(csvRes.status, 200);
  assert.ok(csvRes.headers.get('content-type').includes('text/csv'));
  const csvText = await csvRes.text();
  assert.ok(csvText.includes('Classroom Name,Classroom ID,Class Date,Student Name,Join Time,Leave Time,Duration Minutes'));
  assert.ok(csvText.includes('Achu Abi'));

  // Verify isAttendanceExported is true
  const exportedCls = await Classroom.findOne({ classroomId });
  assert.strictEqual(exportedCls.isAttendanceExported, true);

  // 14. Download Daily Combined CSV (GET /api/attendance/daily.csv)
  const dailyCsvRes = await fetch(`${baseUrl}/api/attendance/daily.csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(dailyCsvRes.status, 200);
  assert.ok(dailyCsvRes.headers.get('content-type').includes('text/csv'));
  const dailyCsvText = await dailyCsvRes.text();
  assert.ok(dailyCsvText.includes('Achu Abi'));

  // 15. Admin Acknowledges Attendance Download (POST /api/classrooms/:id/attendance/acknowledge)
  const ackRes = await fetch(`${baseUrl}/api/classrooms/${classroomId}/attendance/acknowledge`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(ackRes.status, 200);
  const ackData = await ackRes.json();
  assert.strictEqual(ackData.data.attendanceAcknowledged, true);

  // Verify classroom and attendance documents reflect acknowledgment in MongoDB
  const ackCls = await Classroom.findOne({ classroomId });
  assert.strictEqual(ackCls.attendanceAcknowledged, true);

  // 16. Storage Status Monitoring (GET /api/admin/storage-status)
  const storageRes = await fetch(`${baseUrl}/api/admin/storage-status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(storageRes.status, 200);
  const storageData = await storageRes.json();
  assert.strictEqual(storageData.success, true);
  assert.strictEqual(storageData.data.connected, true);
  assert.strictEqual(storageData.data.atlasFreeLimitMB, 500);
  assert.strictEqual(storageData.data.targetLimitMB, 100);

  // 17. Manual Cleanup Trigger (POST /api/admin/cleanup)
  const cleanupRes = await fetch(`${baseUrl}/api/admin/cleanup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(cleanupRes.status, 200);
  const cleanupData = await cleanupRes.json();
  assert.strictEqual(cleanupData.success, true);

  // Clean up this test classroom from MongoDB
  await Classroom.deleteOne({ classroomId });
  await Attendance.deleteMany({ classroomId });
});
