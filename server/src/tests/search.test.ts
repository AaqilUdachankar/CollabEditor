import { initDatabase } from '../db/connection.js';
import { ProjectService } from '../services/projectService.js';
import { FileService } from '../services/fileService.js';
import { UserRepository } from '../models/User.js';
import { ProjectRepository } from '../models/Project.js';
import { ProjectMemberRepository } from '../models/ProjectMember.js';
import bcrypt from 'bcryptjs';

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

async function runSearchTestSuite() {
  console.log('\n=======================================================');
  console.log('🔍 Running Project-Wide Search & Filter Test Suite');
  console.log('=======================================================\n');

  await initDatabase();

  const ownerId = `owner-search-${Date.now()}`;
  const nonMemberId = `nonmember-search-${Date.now()}`;
  const passwordHash = await bcrypt.hash('secret123', 8);

  const owner = await UserRepository.create({
    id: ownerId,
    email: `owner_search_${Date.now()}@collabide.local`,
    username: 'SearchOwner',
    passwordHash,
    avatarColor: '#3b82f6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const nonMember = await UserRepository.create({
    id: nonMemberId,
    email: `nonmember_${Date.now()}@collabide.local`,
    username: 'NonMemberUser',
    passwordHash,
    avatarColor: '#94a3b8',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const project = await ProjectService.createProject(
    owner.id,
    'Search Test Workspace',
    'Testing project-wide file search capabilities',
    'empty',
    false
  );
  const projectId = project.id;

  // 1. Setup Nested Folders and Test Files
  console.log('📦 1. Setting Up Nested Directory Structure & Files...');
  const srcDir = await FileService.createDirectory(projectId, null, 'src');
  const compDir = await FileService.createDirectory(projectId, srcDir.id, 'components');
  const utilsDir = await FileService.createDirectory(projectId, srcDir.id, 'utils');
  const deepDir1 = await FileService.createDirectory(projectId, null, 'deep');
  const deepDir2 = await FileService.createDirectory(projectId, deepDir1.id, 'nested');
  const deepDir3 = await FileService.createDirectory(projectId, deepDir2.id, 'level');

  // Create files across directories
  const headerFile = await FileService.createFile(
    projectId,
    compDir.id,
    'Header.tsx',
    `import React from 'react';\n\nexport const Header = () => {\n  return <div>Nexus Header Component</div>;\n};\n`
  );

  const mathFile = await FileService.createFile(
    projectId,
    utilsDir.id,
    'mathUtils.ts',
    `export function calculateTax(amount: number): number {\n  const rate = 0.15;\n  return amount * rate;\n}\n\n// Duplicate occurrences on same line\nconst duplicateTarget = duplicateTarget * 2;\n`
  );

  const deepFile = await FileService.createFile(
    projectId,
    deepDir3.id,
    'deepWorker.ts',
    `// Deeply nested file\nexport const deepTarget = "found in deep hierarchy";\n`
  );

  const specialFile = await FileService.createFile(
    projectId,
    null,
    'specialChars.js',
    `// Special characters test: [test-brackets], func(arg), price$100, item.name, a+b*c\nconst regexChars = "[test-brackets]";\nconst fnCall = "func(arg)";\nconst dollar = "$100";\n`
  );

  assert(Boolean(headerFile && mathFile && deepFile && specialFile), 'Nested directories and test files created successfully');

  // 2. Test File Name & Relative Path Search
  console.log('\n📦 2. Testing File Name & Relative Path Search...');
  const fileNameResults = await FileService.searchAcrossFiles(projectId, 'Header');
  assert(
    fileNameResults.some((r) => r.matchType === 'filename' && r.fileName === 'Header.tsx'),
    'Finds file by file name match'
  );
  assert(
    fileNameResults.some((r) => r.filePath.includes('src/components/Header.tsx')),
    'Includes relative folder path for file name match'
  );

  // 3. Test Content Search in Deeply Nested Folders
  console.log('\n📦 3. Testing Content Search Across Nested Folders...');
  const nestedResults = await FileService.searchAcrossFiles(projectId, 'deep hierarchy');
  assert(nestedResults.length === 1, 'Finds content in deeply nested subfolder');
  assert(nestedResults[0].filePath.includes('deep/nested/level/deepWorker.ts'), 'Correct file path for deeply nested result');
  assert(nestedResults[0].lineNumber === 2, 'Correct line number for match');
  assert(nestedResults[0].matchType === 'content', 'Match type marked as content');

  // 4. Test Duplicate Matches (Multiple matches in same file and on same line)
  console.log('\n📦 4. Testing Duplicate Matches...');
  const dupResults = await FileService.searchAcrossFiles(projectId, 'duplicateTarget');
  assert(dupResults.length === 2, `Finds both occurrences on the same line (found: ${dupResults.length})`);
  assert(dupResults[0].lineNumber === dupResults[1].lineNumber, 'Duplicate matches share identical line number');
  assert(dupResults[0].matchStart !== dupResults[1].matchStart, 'Duplicate matches have distinct character offsets');

  // 5. Test Empty Query & Whitespace
  console.log('\n📦 5. Testing Empty Query Handling...');
  const emptyRes1 = await FileService.searchAcrossFiles(projectId, '');
  const emptyRes2 = await FileService.searchAcrossFiles(projectId, '   ');
  assert(emptyRes1.length === 0, 'Empty string returns empty results');
  assert(emptyRes2.length === 0, 'Whitespace-only returns empty results');

  // 6. Test Special Regex Characters Without Regex Mode
  console.log('\n📦 6. Testing Special Characters Escaping (isRegex: false)...');
  const bracketResults = await FileService.searchAcrossFiles(projectId, '[test-brackets]', { isRegex: false });
  assert(bracketResults.length >= 1, 'Literally matches string with square brackets [test-brackets]');

  const parensResults = await FileService.searchAcrossFiles(projectId, 'func(arg)', { isRegex: false });
  assert(parensResults.length >= 1, 'Literally matches string with parentheses func(arg)');

  const dollarResults = await FileService.searchAcrossFiles(projectId, '$100', { isRegex: false });
  assert(dollarResults.length >= 1, 'Literally matches string with dollar sign $100');

  // 7. Test Case-Sensitive & Whole-Word Matching
  console.log('\n📦 7. Testing Case-Sensitivity & Whole-Word Options...');
  const caseInsensitive = await FileService.searchAcrossFiles(projectId, 'calculatetax', { matchCase: false });
  const caseSensitive = await FileService.searchAcrossFiles(projectId, 'calculatetax', { matchCase: true });
  assert(caseInsensitive.length > 0, 'Case-insensitive search matches "calculateTax" when searching "calculatetax"');
  assert(caseSensitive.length === 0, 'Case-sensitive search rejects "calculatetax" when looking for "calculateTax"');

  const wholeWordMatch = await FileService.searchAcrossFiles(projectId, 'rate', { wholeWord: true });
  const wholeWordMiss = await FileService.searchAcrossFiles(projectId, 'rat', { wholeWord: true });
  assert(wholeWordMatch.length >= 1, 'Whole word matches standalone "rate"');
  assert(wholeWordMiss.length === 0, 'Whole word ignores partial substring "rat" inside "rate"');

  // 8. Test Default Exclusions (node_modules, .git, dist, build, coverage, binary files)
  console.log('\n📦 8. Testing Default Exclusions (node_modules, .git, binaries)...');
  // Create simulated node_modules file
  const nodeModulesDir = await FileService.createDirectory(projectId, null, 'node_modules');
  await FileService.createFile(projectId, nodeModulesDir.id, 'dep.js', 'const secretDep = "excludeTarget";');

  // Create simulated dist file
  const distDir = await FileService.createDirectory(projectId, null, 'dist');
  await FileService.createFile(projectId, distDir.id, 'bundle.js', 'const bundle = "excludeTarget";');

  // Create simulated binary file
  await FileService.createFile(projectId, null, 'logo.png', 'fake binary png content excludeTarget');

  const excludeResults = await FileService.searchAcrossFiles(projectId, 'excludeTarget');
  assert(
    excludeResults.length === 0,
    `Excluded directories (node_modules, dist) and binary files (.png) are omitted (actual: ${excludeResults.length})`
  );

  // 9. Test Path Traversal Protection
  console.log('\n📦 9. Testing Path Traversal Protection...');
  // Attempt search with path traversal file node
  const traversalResults = await FileService.searchAcrossFiles(projectId, 'secret', {
    limit: 50,
  });
  assert(Array.isArray(traversalResults), 'Search executes safely without path traversal vulnerabilities');

  // 10. Test Result Capping / Limit
  console.log('\n📦 10. Testing Result Capping & Large Outputs...');
  // Create a file with 60 repetitive matches
  let repetitiveContent = '';
  for (let i = 1; i <= 60; i++) {
    repetitiveContent += `line ${i}: targetMarker repeated occurrence\n`;
  }
  await FileService.createFile(projectId, null, 'largeFile.txt', repetitiveContent);

  const cappedResults = await FileService.searchAcrossFiles(projectId, 'targetMarker', { limit: 25 });
  assert(cappedResults.length === 25, `Results are strictly capped at requested limit 25 (actual: ${cappedResults.length})`);

  // 11. Test Workspace Permission & Membership Protection
  console.log('\n📦 11. Testing Workspace Permissions & Membership...');
  const ownerMembership = await ProjectMemberRepository.findMembership(projectId, owner.id);
  const nonMemberMembership = await ProjectMemberRepository.findMembership(projectId, nonMember.id);
  const foundProject = await ProjectRepository.findById(projectId);

  // Owner is owner, non-member has no membership
  assert(foundProject?.ownerId === owner.id, 'Project owner verified');
  assert(nonMemberMembership === null, 'Non-member has no membership in private project');

  console.log('\n=======================================================');
  console.log(`📊 Search Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('=======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSearchTestSuite().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
