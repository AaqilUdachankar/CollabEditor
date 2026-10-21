import { initDatabase } from '../db/connection.js';
import { UserRepository } from '../models/User.js';
import { ProjectRepository } from '../models/Project.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';
import { FileNodeRepository } from '../models/FileNode.js';
import { ProjectService } from '../services/projectService.js';
import { FileService } from '../services/fileService.js';
import { GitService } from '../services/gitService.js';
import { ExecutionService } from '../services/executionService.js';
import { YjsPersistenceService } from '../services/yjsPersistenceService.js';
import * as Y from 'yjs';
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

async function runSuite() {
  console.log('\n=======================================================');
  console.log('🧪 Running Nexus IDE Automated Test Suite');
  console.log('=======================================================\n');

  await initDatabase();

  const testUserId = `test-user-${Date.now()}`;
  const testUserEmail = `dev_${Date.now()}@nexus-ide.local`;

  // 1. Test Authentication & User Repository
  console.log('📦 1. Testing Authentication & User Repository...');
  try {
    const passwordHash = await bcrypt.hash('secretPass123', 8);
    const user = await UserRepository.create({
      id: testUserId,
      email: testUserEmail,
      username: 'NexusTester',
      passwordHash,
      avatarColor: '#3b82f6',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    assert(user.email === testUserEmail, 'Create user account');

    const found = await UserRepository.findByEmail(testUserEmail);
    assert(found !== null && found.username === 'NexusTester', 'Find user by email');

    const match = await bcrypt.compare('secretPass123', found!.passwordHash);
    assert(match, 'Verify password hash');
  } catch (err: any) {
    assert(false, 'User tests failed', err.message);
  }

  // 2. Test Project Creation & Templates
  console.log('\n📦 2. Testing Project Creation & Templates...');
  let testProjectId = '';
  try {
    const project = await ProjectService.createProject(
      testUserId,
      'Test Vanilla Project',
      'A testing workspace for collaborative IDE',
      'vanilla'
    );
    testProjectId = project.id;
    assert(project.name === 'Test Vanilla Project', 'Create project with template');

    const membership = await ProjectMemberRepository.findMembership(testProjectId, testUserId);
    assert(membership !== null && membership.role === 'owner', 'Assign project owner role');

    const files = await FileNodeRepository.findByProject(testProjectId);
    assert(files.length >= 3, 'Seed template files (HTML, CSS, JS, README)');
  } catch (err: any) {
    assert(false, 'Project creation tests failed', err.message);
  }

  // 3. Test File & Folder Operations
  console.log('\n📦 3. Testing File & Folder Operations...');
  let createdFileId = '';
  try {
    const folder = await FileService.createDirectory(testProjectId, null, 'components');
    assert(folder.type === 'directory' && folder.name === 'components', 'Create folder');

    const file = await FileService.createFile(
      testProjectId,
      folder.id,
      'Button.js',
      'export function Button() { return "<button>Click</button>"; }'
    );
    createdFileId = file.id;
    assert(file.path === 'components/Button.js', 'Create file in folder');

    const saved = await FileService.saveFileContent(
      testProjectId,
      createdFileId,
      'export function Button() { return "<button>Updated</button>"; }'
    );
    assert(saved.content?.includes('Updated'), 'Update and save file content');

    const duplicate = await FileService.duplicateNode(testProjectId, createdFileId);
    assert(duplicate.name.includes('copy'), 'Duplicate file with unique copy name');

    const renamed = await FileService.renameNode(testProjectId, createdFileId, 'PrimaryButton.js');
    assert(renamed.name === 'PrimaryButton.js', 'Rename file');

    const searchResults = await FileService.searchAcrossFiles(testProjectId, 'Updated');
    assert(searchResults.length >= 1, 'Search across project files');
  } catch (err: any) {
    assert(false, 'File operations failed', err.message);
  }

  // 4. Test Git Service
  console.log('\n📦 4. Testing Git Repository Management...');
  try {
    await GitService.initRepo(testProjectId);
    const isRepo = await GitService.isGitRepo(testProjectId);
    assert(isRepo, 'Initialize Git repository in project directory');

    await GitService.stageFile(testProjectId, '.');
    const status = await GitService.getStatus(testProjectId);
    assert(status.files.some(f => f.staged), 'Stage all files for commit');

    const commitOutput = await GitService.commit(testProjectId, 'Initial automated commit');
    assert(commitOutput.length > 0, 'Commit staged files to Git');

    const history = await GitService.getHistory(testProjectId);
    assert(history.length >= 1 && history[0].message === 'Initial automated commit', 'Retrieve Git commit history');
  } catch (err: any) {
    assert(false, 'Git operations failed', err.message);
  }

  // 5. Test Code Execution Engine
  console.log('\n📦 5. Testing Code Execution Service...');
  try {
    const pyProject = await ProjectService.createProject(
      testUserId,
      'Python Test Project',
      'For testing execution engine',
      'python'
    );
    const files = await FileNodeRepository.findByProject(pyProject.id);
    const mainPy = files.find(f => f.name === 'main.py');

    if (mainPy) {
      const result = await ExecutionService.runFile(pyProject.id, mainPy.id);
      assert(result.exitCode === 0, 'Execute Python file inside project workspace');
      assert(result.stdout.includes('Fibonacci') || result.stdout.includes('Python'), 'Capture process standard output');
    } else {
      assert(false, 'main.py not found in Python template');
    }
  } catch (err: any) {
    assert(false, 'Code execution failed', err.message);
  }

  // 6. Test Real-Time Yjs CRDT Collaboration & Persistence
  console.log('\n📦 6. Testing Yjs CRDT Synchronization & Persistence...');
  try {
    const docName = `${testProjectId}::${createdFileId}`;
    const doc1 = await YjsPersistenceService.getOrCreateDoc(docName);
    const ytext1 = doc1.getText('monaco');

    // User A types
    doc1.transact(() => {
      ytext1.insert(0, '// Nexus Collaborative IDE Header\n');
    });

    // User B joins with separate doc and receives updates
    const doc2 = new Y.Doc();
    const updateFrom1 = Y.encodeStateAsUpdate(doc1);
    Y.applyUpdate(doc2, updateFrom1);

    const ytext2 = doc2.getText('monaco');
    assert(ytext2.toString() === ytext1.toString(), 'Synchronize CRDT state between independent docs');

    // Concurrent editing test: User A types at beginning, User B types at end
    doc1.transact(() => {
      ytext1.insert(0, '/* Top Comment */\n');
    });
    doc2.transact(() => {
      ytext2.insert(ytext2.length, '\n// Bottom Comment');
    });

    // Cross-merge
    const updateA = Y.encodeStateAsUpdate(doc1);
    const updateB = Y.encodeStateAsUpdate(doc2);
    Y.applyUpdate(doc2, updateA);
    Y.applyUpdate(doc1, updateB);

    assert(ytext1.toString() === ytext2.toString(), 'Concurrent edits merge conflict-free (CRDT convergence)');
    assert(
      ytext1.toString().includes('Top Comment') && ytext1.toString().includes('Bottom Comment'),
      'Preserve concurrent edits from both users'
    );
  } catch (err: any) {
    assert(false, 'Collaboration tests failed', err.message);
  }

  console.log('\n=======================================================');
  console.log(`📊 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('=======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
