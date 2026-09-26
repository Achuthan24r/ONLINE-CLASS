const { v4: uuidv4 } = require('uuid');

/**
 * ClassOrbit In-Memory Store for Ephemeral Real-Time State
 * Holds:
 * - Active WebSocket connections & participant sessions
 * - Temporary live WebRTC permissions (mic, cam, screen)
 * - Temporary live permission review requests
 * - Live token cache
 *
 * Persistent records (Admin, Classroom, Attendance) are stored in MongoDB Atlas!
 */
class MemoryStore {
  constructor() {
    this.activeSessions = new Map(); // participantId -> session { participantId, classroomId, displayName, role, joinedAt, leaveTime }
    this.classroomSessions = new Map(); // classroomId -> Set<participantId>

    this.permissions = new Map(); // participantId -> { canPublishMic, canPublishCam, canPublishScreen, updatedAt }
    this.permissionRequests = new Map(); // requestId -> { id, classroomId, participantId, displayName, mediaType, status, requestedAt }
    this.classroomRequests = new Map(); // classroomId -> Set<requestId>

    this.codeCache = new Map(); // code -> { classroomId, tokenHash }
  }

  // --- RAW CODE / TOKEN HASH CACHE ---
  cacheCode(code, classroomId, tokenHash) {
    this.codeCache.set(code, { classroomId, tokenHash });
  }

  findCode(code) {
    return this.codeCache.get(code) || null;
  }

  revokeCode(code) {
    this.codeCache.delete(code);
  }

  // --- ACTIVE LIVE SESSIONS ---
  createActiveSession({ classroomId, participantId, displayName, role = 'STUDENT' }) {
    const session = {
      participantId,
      classroomId,
      displayName: displayName.trim(),
      role,
      joinedAt: new Date(),
      leaveTime: null,
      status: 'ADMITTED',
    };

    this.activeSessions.set(participantId, session);

    let set = this.classroomSessions.get(classroomId);
    if (!set) {
      set = new Set();
      this.classroomSessions.set(classroomId, set);
    }
    set.add(participantId);

    // Default permissions strictly false
    this.permissions.set(participantId, {
      canPublishMic: false,
      canPublishCam: false,
      canPublishScreen: false,
      updatedAt: new Date(),
    });

    return session;
  }

  getActiveSession(participantId) {
    return this.activeSessions.get(participantId) || null;
  }

  getActiveSessionsInClassroom(classroomId) {
    const set = this.classroomSessions.get(classroomId) || new Set();
    const list = [];
    for (const pId of set) {
      const s = this.activeSessions.get(pId);
      if (s) {
        const perm = this.permissions.get(pId) || {
          canPublishMic: false,
          canPublishCam: false,
          canPublishScreen: false,
        };
        list.push({ ...s, permission: perm });
      }
    }
    return list;
  }

  removeActiveSession(participantId) {
    const session = this.activeSessions.get(participantId);
    if (session) {
      session.status = 'LEFT';
      session.leaveTime = new Date();
      const set = this.classroomSessions.get(session.classroomId);
      if (set) set.delete(participantId);
    }
    this.permissions.delete(participantId);
    return session;
  }

  // --- PERMISSIONS ---
  getPermissions(participantId) {
    return this.permissions.get(participantId) || {
      canPublishMic: false,
      canPublishCam: false,
      canPublishScreen: false,
    };
  }

  updatePermissions(participantId, updates) {
    const current = this.getPermissions(participantId);
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date(),
    };
    this.permissions.set(participantId, updated);
    return updated;
  }

  // --- PERMISSION REQUESTS ---
  createPermissionRequest({ classroomId, participantId, displayName, mediaType }) {
    const id = uuidv4();
    const req = {
      id,
      classroomId,
      participantId,
      displayName,
      mediaType,
      status: 'PENDING',
      requestedAt: new Date(),
    };

    this.permissionRequests.set(id, req);

    let set = this.classroomRequests.get(classroomId);
    if (!set) {
      set = new Set();
      this.classroomRequests.set(classroomId, set);
    }
    set.add(id);

    return req;
  }

  getPermissionRequest(id) {
    return this.permissionRequests.get(id) || null;
  }

  getPendingRequestsInClassroom(classroomId) {
    const set = this.classroomRequests.get(classroomId) || new Set();
    const list = [];
    for (const id of set) {
      const r = this.permissionRequests.get(id);
      if (r && r.status === 'PENDING') list.push(r);
    }
    return list.sort((a, b) => a.requestedAt - b.requestedAt);
  }

  updatePermissionRequest(id, updates) {
    const req = this.permissionRequests.get(id);
    if (!req) return null;
    Object.assign(req, updates);
    return req;
  }

  revokePermissionRequests(classroomId, participantId, mediaType) {
    const set = this.classroomRequests.get(classroomId) || new Set();
    for (const id of set) {
      const r = this.permissionRequests.get(id);
      if (r && r.participantId === participantId && r.mediaType === mediaType) {
        r.status = 'REVOKED';
      }
    }
  }

  // --- EPHEMERAL CLEANUP ---
  clearClassroomEphemeralState(classroomId) {
    const participantIds = this.classroomSessions.get(classroomId) || new Set();
    for (const pId of participantIds) {
      this.activeSessions.delete(pId);
      this.permissions.delete(pId);
    }
    this.classroomSessions.delete(classroomId);

    const requestIds = this.classroomRequests.get(classroomId) || new Set();
    for (const rId of requestIds) {
      this.permissionRequests.delete(rId);
    }
    this.classroomRequests.delete(classroomId);

    // Clean code cache for this room
    for (const [code, val] of this.codeCache.entries()) {
      if (val.classroomId === classroomId) {
        this.codeCache.delete(code);
      }
    }
    console.log(`🧹 [MemoryStore] Cleared ephemeral state for classroom ${classroomId}`);
  }
}

const memoryStore = new MemoryStore();
module.exports = memoryStore;
