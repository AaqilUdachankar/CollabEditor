import WebSocket from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { initDatabase } from '../db/connection.js';
import { UserRepository } from '../models/User.js';
import { ProjectService } from '../services/projectService.js';
import { FileNodeRepository } from '../models/FileNode.js';
import { InvitationRepository } from '../models/Invitation.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail: string = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}: ${detail}`);
    failed++;
  }
}

async function runMultiplayerWireTest() {
  console.log('\n=======================================================');
  console.log('👥 Running Nexus Real-Time Multiplayer Wire Collaboration Test');
  console.log('=======================================================\n');

  await initDatabase();

  const timestamp = Date.now();
  const passwordHash = await bcrypt.hash('secretPass123', 8);

  // 1. Create User A (Alice)
  const userA = await UserRepository.create({
    id: `user-a-${timestamp}`,
    email: `alice_${timestamp}@nexus.test`,
    username: 'Alice',
    passwordHash,
    avatarColor: '#ec4899',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const tokenA = jwt.sign({ id: userA.id, email: userA.email, username: userA.username }, config.jwtSecret);

  // 2. Create User B (Bob)
  const userB = await UserRepository.create({
    id: `user-b-${timestamp}`,
    email: `bob_${timestamp}@nexus.test`,
    username: 'Bob',
    passwordHash,
    avatarColor: '#3b82f6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const tokenB = jwt.sign({ id: userB.id, email: userB.email, username: userB.username }, config.jwtSecret);

  // 3. User A creates project
  const project = await ProjectService.createProject(
    userA.id,
    'Multiplayer Wire Project',
    'Wire protocol validation',
    'vanilla'
  );
  assert(project !== null, 'User A creates project');

  // 4. User B joins via invitation
  await ProjectMemberRepository.addMember({
    id: uuidv4(),
    projectId: project.id,
    userId: userB.id,
    role: 'editor',
    joinedAt: new Date().toISOString(),
  });
  const memberB = await ProjectMemberRepository.findMembership(project.id, userB.id);
  assert(memberB !== null && memberB.role === 'editor', 'User B joins project with Editor role');

  const files = await FileNodeRepository.findByProject(project.id);
  const targetFile = files.find((f) => f.name === 'main.js') || files[0];
  const docName = `${project.id}::${targetFile.id}`;

  const docA = new Y.Doc();
  const docB = new Y.Doc();

  // Helper to establish wire sync
  function connectClient(token: string, doc: Y.Doc): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:5000/yjs?room=${docName}&token=${token}`);

      ws.on('open', () => {
        // Send initial SyncStep1
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 0); // messageSync
        syncProtocol.writeSyncStep1(encoder, doc);
        ws.send(encoding.toUint8Array(encoder));
        resolve(ws);
      });

      ws.on('message', (data: Buffer) => {
        const decoder = decoding.createDecoder(new Uint8Array(data));
        const messageType = decoding.readVarUint(decoder);
        if (messageType === 0) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, 0);
          syncProtocol.readSyncMessage(decoder, encoder, doc, null);
          if (encoding.length(encoder) > 1) {
            ws.send(encoding.toUint8Array(encoder));
          }
        }
      });

      // Broadcast local doc updates to server
      doc.on('update', (update: Uint8Array, origin: any) => {
        if (origin !== null && ws.readyState === WebSocket.OPEN) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, 0);
          syncProtocol.writeUpdate(encoder, update);
          ws.send(encoding.toUint8Array(encoder));
        }
      });

      ws.on('error', reject);
    });
  }

  // 5. Connect User A and User B over WebSocket
  const wsA = await connectClient(tokenA, docA);
  const wsB = await connectClient(tokenB, docB);

  await new Promise((resolve) => setTimeout(resolve, 600));

  assert(wsA.readyState === WebSocket.OPEN && wsB.readyState === WebSocket.OPEN, 'Both users connect to /yjs WebSocket endpoint');

  // 6. Test User A edits and User B receives update
  const ytextA = docA.getText('monaco');
  const ytextB = docB.getText('monaco');

  const updateMessage = `// Live update from Alice at ${timestamp}\n`;
  docA.transact(() => {
    ytextA.insert(0, updateMessage);
  }, 'alice');

  await new Promise((resolve) => setTimeout(resolve, 600));
  assert(ytextB.toString().includes(updateMessage), 'User A edit propagates over WebSocket to User B');

  // 7. Concurrent edits from both users simultaneously
  docA.transact(() => {
    ytextA.insert(0, '/* Top Alice Comment */\n');
  }, 'alice');

  docB.transact(() => {
    ytextB.insert(ytextB.length, '\n// Bottom Bob Comment');
  }, 'bob');

  await new Promise((resolve) => setTimeout(resolve, 600));

  const textA = ytextA.toString();
  const textB = ytextB.toString();

  assert(textA === textB, 'Concurrent edits converge to identical text on both clients');
  assert(textA.includes('Top Alice Comment') && textA.includes('Bottom Bob Comment'), 'Both concurrent edits preserved without data loss');

  // 8. Test unauthorized connection rejection
  let unauthorizedRejected = false;
  const badWs = new WebSocket(`ws://localhost:5000/yjs?room=${docName}&token=fake_invalid_token`);
  badWs.on('close', (code) => {
    if (code === 4001 || code === 4003 || code === 1006) {
      unauthorizedRejected = true;
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 500));
  assert(unauthorizedRejected, 'Unauthorized connection with invalid token is rejected by server');

  wsA.close();
  wsB.close();
  badWs.close();

  console.log('\n=======================================================');
  console.log(`📊 Wire Multiplayer Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('=======================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runMultiplayerWireTest().catch((err) => {
  console.error('Fatal wire test failure:', err);
  process.exit(1);
});
