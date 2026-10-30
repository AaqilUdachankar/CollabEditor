import { initDatabase } from '../db/connection.js';
import { ProjectService } from '../services/projectService.js';
import { FileService } from '../services/fileService.js';
import { HistoryService } from '../services/historyService.js';
import { YjsPersistenceService } from '../services/yjsPersistenceService.js';
import { UserRepository } from '../models/User.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';
import { FileVersionRepository } from '../models/FileVersion.js';
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runHistoryTestSuite() {
  console.log('\n=======================================================');
  console.log('📜 Running File History & Diff Viewer Integration Tests');
  console.log('=======================================================\n');

  await initDatabase();

  const ownerId = `owner-${Date.now()}`;
  const editorId = `editor-${Date.now()}`;
  const viewerId = `viewer-${Date.now()}`;
  const passwordHash = await bcrypt.hash('secret123', 8);

  const owner = await UserRepository.create({
    id: ownerId,
    email: `owner_${Date.now()}@collabide.local`,
    username: 'ProjectOwner',
    passwordHash,
    avatarColor: '#3b82f6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const editor = await UserRepository.create({
    id: editorId,
    email: `editor_${Date.now()}@collabide.local`,
    username: 'AliceEditor',
    passwordHash,
    avatarColor: '#10b981',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const viewer = await UserRepository.create({
    id: viewerId,
    email: `viewer_${Date.now()}@collabide.local`,
    username: 'BobViewer',
    passwordHash,
    avatarColor: '#f59e0b',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const project = await ProjectService.createProject(
    ownerId,
    'History Test Workspace',
    'For testing file snapshots, diffs, and restore',
    'vanilla'
  );
  const projectId = project.id;

  // Add memberships
  await ProjectMemberRepository.addMember({
    id: uuidv4(),
    projectId,
    userId: editorId,
    role: 'editor',
    joinedAt: new Date().toISOString(),
  });

  await ProjectMemberRepository.addMember({
    id: uuidv4(),
    projectId,
    userId: viewerId,
    role: 'viewer',
    joinedAt: new Date().toISOString(),
  });

  // 1. Create File & Initial Version Snapshot
  console.log('📦 1. Testing File Creation & Initial Snapshot...');
  const initialContent = `// Header v1\nfunction hello() {\n  return "v1";\n}\n`;
  const file = await FileService.createFile(projectId, null, 'app.js', initialContent);

  const v1 = await HistoryService.createSnapshot(
    projectId,
    file.id,
    initialContent,
    { id: owner.id, username: owner.username },
    'Initial version',
    true
  );

  assert(v1.versionNumber === 1, 'Initial version has versionNumber = 1');
  assert(v1.content === initialContent, 'Initial version preserves file content');
  assert(v1.authorName === 'ProjectOwner', 'Initial version tracks author');

  // 2. Edit & Save: Create Second Version Snapshot
  console.log('\n📦 2. Testing File Edit & Save Versioning...');
  const updatedContentV2 = `// Header v1\n// Added in v2\nfunction hello() {\n  return "v2-updated";\n}\n`;
  await FileService.saveFileContent(projectId, file.id, updatedContentV2);

  const v2 = await HistoryService.createSnapshot(
    projectId,
    file.id,
    updatedContentV2,
    { id: editor.id, username: editor.username },
    'Refactored return string',
    true // Force new version
  );

  assert(v2.versionNumber === 2, 'Second version has versionNumber = 2');
  assert(v2.content === updatedContentV2, 'Second version preserves updated content');
  assert(v2.authorName === 'AliceEditor', 'Second version records editor author');

  // 3. Debouncing: Rapid collaborative edits
  console.log('\n📦 3. Testing Collaborative Debouncing...');
  const debouncedContent1 = `// Rapid edit 1\n`;
  const debouncedContent2 = `// Rapid edit 2 (within 15s debounce window)\n`;

  const deb1 = await HistoryService.createSnapshot(
    projectId,
    file.id,
    debouncedContent1,
    { id: editor.id, username: editor.username },
    'Rapid edit 1',
    true
  );

  // Immediate second edit by same author
  const deb2 = await HistoryService.createSnapshot(
    projectId,
    file.id,
    debouncedContent2,
    { id: editor.id, username: editor.username },
    'Rapid edit 2',
    false
  );

  assert(deb1.id === deb2.id, 'Rapid collaborative edits update the latest snapshot instead of creating duplicates');
  assert(deb2.content === debouncedContent2, 'Debounced snapshot updates content correctly');

  // 4. Test History Listing & Pagination
  console.log('\n📦 4. Testing History Listing & Pagination...');
  const historyData = await HistoryService.getHistory(projectId, file.id, 10, 0);
  assert(historyData.total >= 3, `History total count >= 3 (actual: ${historyData.total})`);
  assert(historyData.versions[0].versionNumber > historyData.versions[1].versionNumber, 'Versions sorted in descending order (newest first)');

  // 5. Test Diff Computation
  console.log('\n📦 5. Testing Line-by-Line Diff Computation...');
  const diffResult = HistoryService.computeDiff(v1.content, v2.content);
  assert(diffResult.addedCount > 0, `Diff detected added lines: +${diffResult.addedCount}`);
  assert(diffResult.removedCount > 0, `Diff detected removed lines: -${diffResult.removedCount}`);
  assert(diffResult.lines.some((l) => l.type === 'added' && l.content.includes('Added in v2')), 'Diff correctly flags added content');
  assert(diffResult.lines.some((l) => l.type === 'removed' && l.content.includes('return "v1"')), 'Diff correctly flags removed content');

  // 6. Test Version Restore & History Preservation
  console.log('\n📦 6. Testing Version Restore & History Audit Trail...');
  // Initialize Yjs document to simulate active collaborative session
  const docName = `${projectId}::${file.id}`;
  const ydoc = await YjsPersistenceService.getOrCreateDoc(docName);
  assert(ydoc !== null, 'Yjs collaborative document initialized');

  // Restore back to Version 1
  const restoreRes = await HistoryService.restoreVersion(
    projectId,
    file.id,
    v1.id,
    { id: owner.id, username: owner.username }
  );

  assert(restoreRes.file.content === v1.content, 'Active file content matches restored target Version 1');
  assert(restoreRes.newVersion.summary?.includes('Restored from Version 1'), 'Restore creates a new version tracking the restore action');
  assert(restoreRes.newVersion.versionNumber > v2.versionNumber, 'Restore increments version number without deleting history');

  // Verify Yjs document received the restored content in real-time
  const ytext = ydoc.getText('monaco');
  assert(ytext.toString() === v1.content, 'Active Yjs document synchronized with restored document for other collaborators');

  // 7. Test Workspace Membership Security
  console.log('\n📦 7. Testing Workspace Role Permissions...');
  // Owner is owner
  const ownerMem = await ProjectMemberRepository.findMembership(projectId, ownerId);
  assert(ownerMem?.role === 'owner', 'Owner has owner role');

  // Editor is editor
  const editorMem = await ProjectMemberRepository.findMembership(projectId, editorId);
  assert(editorMem?.role === 'editor', 'Editor has editor role');

  // Viewer is viewer
  const viewerMem = await ProjectMemberRepository.findMembership(projectId, viewerId);
  assert(viewerMem?.role === 'viewer', 'Viewer has viewer role');

  // Non-member
  const nonMember = await ProjectMemberRepository.findMembership(projectId, 'unknown-user-id');
  assert(nonMember === null, 'Non-member has no project membership');

  console.log('\n=======================================================');
  console.log(`📊 File History Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('=======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runHistoryTestSuite().catch((err) => {
  console.error('Fatal history test error:', err);
  process.exit(1);
});
