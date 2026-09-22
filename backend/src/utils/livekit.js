const { AccessToken, RoomServiceClient, TrackSource } = require('livekit-server-sdk');
const { env } = require('../config');

let roomServiceClient = null;
try {
  roomServiceClient = new RoomServiceClient(env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
} catch (err) {
  console.warn('⚠️ LiveKit RoomServiceClient initialization warning:', err.message);
}

/**
 * Generate a cryptographically signed LiveKit Access Token
 * strictly enforcing the student's or admin's approved publish capabilities.
 */
async function generateLiveKitToken({
  roomName,
  participantId,
  displayName,
  isAdmin = false,
  permissions = { canPublishMic: false, canPublishCam: false, canPublishScreen: false },
}) {
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: participantId,
    name: displayName,
    ttl: '6h',
  });

  if (isAdmin) {
    // Admin has full publishing & room admin rights
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      roomAdmin: true,
    });
  } else {
    // Student: DENIED by default, strictly mapped to granted permissions
    const sources = [];
    if (permissions.canPublishMic) sources.push(TrackSource.MICROPHONE);
    if (permissions.canPublishCam) sources.push(TrackSource.CAMERA);
    if (permissions.canPublishScreen) sources.push(TrackSource.SCREEN_SHARE);

    const canPublish = sources.length > 0;

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: canPublish,
      canPublishSources: sources,
      canPublishData: true,
      canSubscribe: true,
      roomAdmin: false,
    });
  }

  return await at.toJwt();
}

/**
 * Server-side update of participant permissions in active LiveKit room
 */
async function updateLiveKitParticipantPermissions(roomName, participantId, permissions) {
  if (!roomServiceClient) return;
  try {
    const sources = [];
    if (permissions.canPublishMic) sources.push(TrackSource.MICROPHONE);
    if (permissions.canPublishCam) sources.push(TrackSource.CAMERA);
    if (permissions.canPublishScreen) sources.push(TrackSource.SCREEN_SHARE);

    await roomServiceClient.updateParticipant(roomName, participantId, undefined, {
      canPublish: sources.length > 0,
      canPublishSources: sources,
      canSubscribe: true,
      canPublishData: true,
    });
    console.log(`[LiveKit] Updated permissions for ${participantId} in room ${roomName}`);
  } catch (err) {
    console.warn(`[LiveKit Server warning] Could not update participant live permissions (LiveKit server might be offline):`, err.message);
  }
}

/**
 * Server-side removal of participant from active LiveKit room
 */
async function removeLiveKitParticipant(roomName, participantId) {
  if (!roomServiceClient) return;
  try {
    await roomServiceClient.removeParticipant(roomName, participantId);
    console.log(`[LiveKit] Removed participant ${participantId} from room ${roomName}`);
  } catch (err) {
    console.warn(`[LiveKit Server warning] Could not remove participant (LiveKit server might be offline):`, err.message);
  }
}

module.exports = {
  generateLiveKitToken,
  updateLiveKitParticipantPermissions,
  removeLiveKitParticipant,
  roomServiceClient,
};
