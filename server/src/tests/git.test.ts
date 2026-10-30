import { initDatabase } from '../db/connection.js';
import { ProjectService } from '../services/projectService.js';
import { FileService } from '../services/fileService.js';
import { GitService } from '../services/gitService.js';
import { UserRepository } from '../models/User.js';
import { ProjectRepository } from '../models/Project.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

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

async function runGitTestSuite() {
  console.log('\n=======================================================');
  console.log('🐙 Running Git Integration & Safety Test Suite');
  console.log('=======================================================\n');

  await initDatabase();

  const ownerId = `owner-git-${Date.now()}`;
  const viewerId = `viewer-git-${Date.now()}`;
  const passwordHash = await bcrypt.hash('secret123', 8);

  const owner = await UserRepository.create({
    id: ownerId,
    email: `owner_git_${Date.now()}@collabide.local`,
    username: 'GitOwner',
    passwordHash,
    avatarColor: '#3b82f6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const viewer = await UserRepository.create({
    id: viewerId,
    email: `viewer_git_${Date.now()}@collabide.local`,
    username: 'GitViewer',
    passwordHash,
    avatarColor: '#10b981',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Create uninitialized test project
  const project = await ProjectService.createProject(
    owner.id,
    'Git Test Workspace',
    'Testing local Git integration safely',
    'empty',
    false
  );
  const projectId = project.id;

  // Add viewer member
  await ProjectMemberRepository.addMember({
    id: `mem-${Date.now()}`,
    projectId,
    userId: viewer.id,
    role: 'viewer',
    joinedAt: new Date().toISOString(),
  });

  // 1. Test Git Binary Availability
  console.log('📦 1. Testing Git Binary Detection...');
  const gitCheck = await GitService.checkGitAvailable();
  assert(gitCheck.available === true, 'Git binary is installed and executable');
  assert(Boolean(gitCheck.version?.includes('git version')), `Detected Git version: ${gitCheck.version}`);

  // 2. Test Non-Repository Directory Handling
  console.log('\n📦 2. Testing Non-Repository Workspace Handling...');
  const initialIsRepo = await GitService.isGitRepo(projectId);
  assert(initialIsRepo === false, 'Fresh empty workspace is not a Git repo');

  const uninitStatus = await GitService.getStatus(projectId);
  assert(uninitStatus.isRepo === false, 'getStatus reports isRepo = false for uninitialized workspace');
  assert(uninitStatus.branch === 'uninitialized', 'getStatus reports branch = "uninitialized"');
  assert(uninitStatus.files.length === 0, 'No files reported for uninitialized workspace');

  // 3. Test Repository Initialization (.git and .gitignore)
  console.log('\n📦 3. Testing Repository Initialization...');
  await GitService.initRepo(projectId);
  const initializedIsRepo = await GitService.isGitRepo(projectId);
  assert(initializedIsRepo === true, 'initRepo successfully initialized Git repository');

  const projectDir = ProjectService.getProjectPath(projectId);
  const gitignorePath = path.join(projectDir, '.gitignore');
  assert(fs.existsSync(gitignorePath), 'initRepo created default .gitignore file');
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  assert(gitignoreContent.includes('.env'), '.gitignore automatically includes .env protection');

  // 4. Test Clean Repository Status
  console.log('\n📦 4. Testing Initial Clean State & Commit...');
  // Commit initial .gitignore so we have a clean HEAD
  await GitService.stageFile(projectId, '.gitignore');
  const initialCommit = await GitService.commit(projectId, 'chore: initialize repository', 'GitOwner', 'owner@collabide.local');
  assert(Boolean(initialCommit), 'Initial commit created successfully');

  const cleanStatus = await GitService.getStatus(projectId);
  assert(cleanStatus.isRepo === true, 'Status confirms repository is initialized');
  assert(cleanStatus.files.length === 0, 'Clean repository has 0 changed/untracked files');
  assert(cleanStatus.branch.length > 0, `Active branch detected: ${cleanStatus.branch}`);

  // 5. Test Untracked File Detection
  console.log('\n📦 5. Testing Untracked File Detection...');
  const sampleFile = await FileService.createFile(
    projectId,
    null,
    'hello.js',
    'console.log("Hello Git");\n'
  );
  assert(Boolean(sampleFile), 'Created sample file hello.js');

  const untrackedStatus = await GitService.getStatus(projectId);
  const untrackedItem = untrackedStatus.files.find((f) => f.path === 'hello.js');
  assert(Boolean(untrackedItem), 'hello.js detected in Git status');
  assert(untrackedItem?.status === 'untracked', 'hello.js marked as status: "untracked"');
  assert(untrackedItem?.staged === false, 'hello.js is initially unstaged');

  // 6. Test Staging and Unstaging
  console.log('\n📦 6. Testing Staging and Unstaging Changes...');
  await GitService.stageFile(projectId, 'hello.js');
  const stagedStatus = await GitService.getStatus(projectId);
  const stagedItem = stagedStatus.files.find((f) => f.path === 'hello.js');
  assert(stagedItem?.staged === true, 'hello.js is now marked as staged');
  assert(stagedItem?.status === 'added', 'hello.js status is "added" in index');

  // Unstage
  await GitService.unstageFile(projectId, 'hello.js');
  const unstageStatus = await GitService.getStatus(projectId);
  const unstagedItem = unstageStatus.files.find((f) => f.path === 'hello.js');
  assert(unstagedItem?.staged === false, 'hello.js successfully returned to unstaged');

  // 7. Test Modified File Detection & Diff Viewer
  console.log('\n📦 7. Testing Modified File Detection & Diff Computation...');
  // Stage and commit hello.js
  await GitService.stageFile(projectId, 'hello.js');
  await GitService.commit(projectId, 'feat: add hello.js', 'AliceDev', 'alice@collabide.local');

  // Now modify hello.js
  const updatedCode = 'console.log("Hello Git - Updated line");\nfunction extra() { return 42; }\n';
  await FileService.saveFileContent(projectId, sampleFile.id, updatedCode);

  const modStatus = await GitService.getStatus(projectId);
  const modItem = modStatus.files.find((f) => f.path === 'hello.js');
  assert(modItem?.status === 'modified', 'hello.js recognized as modified');
  assert(modItem?.staged === false, 'Modified hello.js is in working tree');

  // Check diff
  const diffOutput = await GitService.getDiff(projectId, 'hello.js');
  assert(diffOutput.includes('+console.log("Hello Git - Updated line");'), 'Diff contains added updated line');
  assert(diffOutput.includes('-console.log("Hello Git");'), 'Diff contains removed original line');

  // 8. Test Invalid Commit Message Handling
  console.log('\n📦 8. Testing Invalid Commit Message Validation...');
  let emptyMsgError = false;
  try {
    await GitService.commit(projectId, '   ');
  } catch (err: any) {
    emptyMsgError = true;
    assert(err.message.includes('Commit message cannot be empty'), 'Rejects empty/whitespace commit message');
  }
  assert(emptyMsgError, 'Empty commit message throws error');

  // 9. Test Valid Commit with Author Identity & History
  console.log('\n📦 9. Testing Valid Commit & Commit History...');
  await GitService.stageFile(projectId, 'hello.js');
  const commitRes = await GitService.commit(projectId, 'feat: update greeting logic', 'AliceDev', 'alice@collabide.local');
  assert(Boolean(commitRes), 'Commit succeeded with author attribution');

  const history = await GitService.getHistory(projectId, 10);
  assert(history.length >= 2, `History contains expected commits (actual: ${history.length})`);
  assert(history[0].message === 'feat: update greeting logic', 'Latest commit message matches');
  assert(history[0].author === 'AliceDev', 'Author identity correctly recorded');

  // 10. Test Secret File (.env) Protection
  console.log('\n📦 10. Testing Secret & .env File Protection...');
  // Create a secret .env file directly on disk
  const envPath = path.join(projectDir, '.env');
  fs.writeFileSync(envPath, 'DATABASE_PASSWORD=supersecret_pass123\n', 'utf-8');

  const envSubStatus = await GitService.getStatus(projectId);
  const foundEnv = envSubStatus.files.some((f) => f.path.includes('.env'));
  assert(foundEnv === false, '.env file is omitted from git status by default');

  let stageEnvBlocked = false;
  try {
    await GitService.stageFile(projectId, '.env');
  } catch (err: any) {
    stageEnvBlocked = true;
    assert(err.message.includes('Cannot stage sensitive secret file'), 'Direct staging of .env is blocked');
  }
  assert(stageEnvBlocked, 'Security check prevented staging sensitive .env file');

  // 11. Test Path Traversal Protection
  console.log('\n📦 11. Testing Path Traversal Defense...');
  let traversalBlocked = false;
  try {
    await GitService.stageFile(projectId, '../../package.json');
  } catch (err: any) {
    traversalBlocked = true;
    assert(err.message.includes('Path traversal is not permitted'), 'Path traversal with .. is strictly blocked');
  }
  assert(traversalBlocked, 'Path traversal attempt blocked successfully');

  // 12. Test Server-Side Permissions
  console.log('\n📦 12. Testing Workspace Role Permissions...');
  const ownerMembership = await ProjectMemberRepository.findMembership(projectId, owner.id);
  const viewerMembership = await ProjectMemberRepository.findMembership(projectId, viewer.id);
  assert(ownerMembership?.role === 'owner', 'Project owner has owner role');
  assert(viewerMembership?.role === 'viewer', 'Viewer member has viewer role');

  console.log('\n=======================================================');
  console.log(`📊 Git Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('=======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runGitTestSuite().catch((err) => {
  console.error('Git test runner fatal error:', err);
  process.exit(1);
});
