const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { env } = require('../config');

function generateSecureToken(byteLength = 16) {
  return crypto.randomBytes(byteLength).toString('hex');
}

function generateInvitationCode() {
  // Human readable yet unguessable code, e.g. "orb-8f2a-9e1b"
  const part1 = crypto.randomBytes(3).toString('hex');
  const part2 = crypto.randomBytes(3).toString('hex');
  return `orb-${part1}-${part2}`;
}

function signAdminToken(admin) {
  return jwt.sign(
    {
      id: admin.id,
      username: admin.username,
      role: 'ADMIN',
    },
    env.SESSION_SECRET,
    { expiresIn: '24h' }
  );
}

function verifyAdminToken(token) {
  try {
    return jwt.verify(token, env.SESSION_SECRET);
  } catch {
    return null;
  }
}

function signParticipantToken(payload) {
  return jwt.sign(
    {
      ...payload,
      role: payload.role || 'STUDENT',
    },
    env.SESSION_SECRET,
    { expiresIn: '12h' }
  );
}

function verifyParticipantToken(token) {
  try {
    return jwt.verify(token, env.SESSION_SECRET);
  } catch {
    return null;
  }
}

function hashInvitationToken(token) {
  return crypto.createHash('sha256').update(String(token).trim()).digest('hex');
}

module.exports = {
  generateSecureToken,
  generateInvitationCode,
  hashInvitationToken,
  signAdminToken,
  verifyAdminToken,
  signParticipantToken,
  verifyParticipantToken,
};
