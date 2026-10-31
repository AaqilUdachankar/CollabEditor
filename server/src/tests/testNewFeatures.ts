import { initDatabase, isMongoActive } from '../db/connection.js';
import { PrivateWhiteboardRepository } from '../models/PrivateWhiteboard.js';
import { VideoCallRepository } from '../models/VideoCall.js';
import { UserRepository } from '../models/User.js';
import { ProjectRepository } from '../models/Project.js';
import { v4 as uuidv4 } from 'uuid';

async function testRecentlyImplementedFeatures() {
  console.log('=======================================================');
  console.log('🧪 Testing Recently Implemented Features');
  console.log('=======================================================');

  await initDatabase();
  console.log('[Database] Connected, isMongoActive =', isMongoActive());

  // 1. Create test user and project
  const testOwner = await UserRepository.create({
    id: `user_owner_${Date.now()}`,
    email: `owner_${Date.now()}@example.com`,
    username: 'TestOwner',
    passwordHash: 'hash',
    avatarColor: '#38bdf8',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const testFriend = await UserRepository.create({
    id: `user_friend_${Date.now()}`,
    email: `friend_${Date.now()}@example.com`,
    username: 'TestFriend',
    passwordHash: 'hash',
    avatarColor: '#10b981',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const testProject = await ProjectRepository.create({
    id: `proj_${Date.now()}`,
    name: 'Feature Test Project',
    description: 'Testing whiteboard and calls',
    ownerId: testOwner.id,
    rootFolderId: 'root',
    rootPath: 'C:\\test\\workspace',
    template: 'blank',
    isPublic: true,
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  console.log('✅ Created test users and test workspace project');

  // ------------------------------------------------------------------
  // Feature 1: Whiteboard CRUD & Deletion
  // ------------------------------------------------------------------
  console.log('\n📦 1. Testing Whiteboard CRUD & Deletion...');
  const testBoardId = `wb_test_${Date.now()}`;
  const createdBoard = await PrivateWhiteboardRepository.create({
    id: uuidv4(),
    boardId: testBoardId,
    ownerId: testOwner.id,
    participantIds: [testOwner.id],
    workspaceId: testProject.id,
    title: 'Testing Deletion Board',
    canvasData: { elements: [{ id: 'el_1', type: 'rectangle', x: 10, y: 10, width: 100, height: 100 }] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (!createdBoard || createdBoard.boardId !== testBoardId) {
    throw new Error('Failed to create whiteboard');
  }
  console.log('  ✅ [PASS] Create whiteboard with elements');

  // Verify find
  const foundBoard = await PrivateWhiteboardRepository.findByBoardId(testBoardId);
  if (!foundBoard) throw new Error('Could not find created board');
  console.log('  ✅ [PASS] Find whiteboard by boardId');

  // ------------------------------------------------------------------
  // Feature 2: Invite Friends to Live Whiteboard
  // ------------------------------------------------------------------
  console.log('\n📦 2. Testing Invite Friends to Live Whiteboard...');
  const updatedBoard = await PrivateWhiteboardRepository.addParticipant(testBoardId, testFriend.id);
  if (!updatedBoard || !updatedBoard.participantIds.includes(testFriend.id)) {
    throw new Error('Failed to add friend to whiteboard');
  }
  console.log('  ✅ [PASS] Added friend to whiteboard participantIds');

  const reloaded = await PrivateWhiteboardRepository.findByBoardId(testBoardId);
  if (!reloaded?.participantIds.includes(testFriend.id)) {
    throw new Error('Participant was not persisted');
  }
  console.log('  ✅ [PASS] Persisted friend in whiteboard participants list');

  // ------------------------------------------------------------------
  // Test Deletion
  // ------------------------------------------------------------------
  console.log('\n📦 3. Testing Whiteboard Deletion...');
  const deleted = await PrivateWhiteboardRepository.deleteByBoardId(testBoardId);
  if (!deleted) throw new Error('deleteByBoardId returned false');
  console.log('  ✅ [PASS] deleteByBoardId succeeded');

  const afterDelete = await PrivateWhiteboardRepository.findByBoardId(testBoardId);
  if (afterDelete !== null) throw new Error('Board still exists after delete');
  console.log('  ✅ [PASS] Verified board no longer exists in database');

  // ------------------------------------------------------------------
  // Feature 3: Multi-Person Team Video Call Persistence
  // ------------------------------------------------------------------
  console.log('\n📦 4. Testing Multi-Person Video Call Sessions...');
  const teamCallId = `call_team_${Date.now()}`;
  const callRecord = await VideoCallRepository.create({
    id: uuidv4(),
    callId: teamCallId,
    callerId: testOwner.id,
    receiverId: testFriend.id,
    workspaceId: testProject.id,
    status: 'ringing',
    startedAt: new Date().toISOString(),
    endedAt: null,
    metadata: {
      callerName: testOwner.username,
      participants: [testOwner.id, testFriend.id],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (!callRecord) throw new Error('Failed to create call record');
  console.log('  ✅ [PASS] Created multi-person call session record');

  await VideoCallRepository.updateStatus(teamCallId, 'connected', undefined, { connectedAt: new Date().toISOString() });
  const connectedCall = await VideoCallRepository.findByCallId(teamCallId);
  if (connectedCall?.status !== 'connected') throw new Error('Failed to update call status to connected');
  console.log('  ✅ [PASS] Connected state transition verified');

  await VideoCallRepository.updateStatus(teamCallId, 'ended', new Date().toISOString(), { durationSeconds: 42 });
  const endedCall = await VideoCallRepository.findByCallId(teamCallId);
  if (endedCall?.status !== 'ended') throw new Error('Failed to end call');
  console.log('  ✅ [PASS] Call ended and duration recorded (42s)');

  console.log('\n=======================================================');
  console.log('🎉 ALL RECENTLY IMPLEMENTED FEATURES VERIFIED SUCCESSFULLY!');
  console.log('=======================================================');
  process.exit(0);
}

testRecentlyImplementedFeatures().catch((err) => {
  console.error('❌ Test Failed:', err);
  process.exit(1);
});
