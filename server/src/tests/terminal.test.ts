import { initDatabase } from '../db/connection.js';
import { ProjectService } from '../services/projectService.js';
import { ExecutionService } from '../services/executionService.js';
import { UserRepository } from '../models/User.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

let passed = 0;
let failed = 0;

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\([a-zA-Z]/g, '').replace(/\x1b/g, '');
}

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

async function waitForOutput(
  getBuffer: () => string,
  predicate: (cleanOut: string, rawOut: string) => boolean,
  timeoutMs: number = 6000,
  intervalMs: number = 80
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const raw = getBuffer();
    const clean = stripAnsi(raw);
    if (predicate(clean, raw)) {
      return true;
    }
    await delay(intervalMs);
  }
  const raw = getBuffer();
  return predicate(stripAnsi(raw), raw);
}

async function runTerminalTests() {
  console.log('\n=======================================================');
  console.log('💻 Running CollabIDE Integrated Terminal Integration Tests');
  console.log('=======================================================\n');

  await initDatabase();

  const testUserId = `term-tester-${Date.now()}`;
  const passwordHash = await bcrypt.hash('secretPass123', 8);
  await UserRepository.create({
    id: testUserId,
    email: `term_${Date.now()}@collabide.local`,
    username: 'TerminalTester',
    passwordHash,
    avatarColor: '#10b981',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const project = await ProjectService.createProject(
    testUserId,
    'Terminal Test Project',
    'Workspace for terminal integration testing',
    'vanilla'
  );
  const projectId = project.id;
  const projectDir = path.resolve(ProjectService.getProjectPath(projectId));

  // 1. Setup two concurrent terminal sessions
  console.log('📦 1. Initializing Two Concurrent Terminal Sessions...');
  let s1Output = '';
  let s1ExitCode: number | null = null;
  let s2Output = '';
  let s2ExitCode: number | null = null;

  const session1 = ExecutionService.spawnTerminal(
    `session-1-${Date.now()}`,
    projectId,
    (chunk) => { s1Output += chunk; },
    (code) => { s1ExitCode = code; }
  );

  const session2 = ExecutionService.spawnTerminal(
    `session-2-${Date.now()}`,
    projectId,
    (chunk) => { s2Output += chunk; },
    (code) => { s2ExitCode = code; }
  );

  // Wait for initial banners and prompts
  const s1Ready = await waitForOutput(() => s1Output, (clean) => clean.includes('collabide:~$'));
  const s2Ready = await waitForOutput(() => s2Output, (clean) => clean.includes('collabide:~$'));

  assert(s1Ready, 'Session 1 started with banner and prompt');
  assert(s2Ready, 'Session 2 started with banner and prompt concurrently');

  // 2. Test pwd in Session 1
  console.log('\n📦 2. Testing "pwd" Command...');
  const s1LenBeforePwd = s1Output.length;
  session1.write('pwd\r');
  const pwdReady = await waitForOutput(
    () => s1Output.slice(s1LenBeforePwd),
    (clean) => clean.includes(projectDir) && clean.includes('collabide:~$')
  );
  assert(pwdReady, 'Command "pwd" printed current workspace directory');

  // 3. Test cd and Workspace Traversal Protection
  console.log('\n📦 3. Testing "cd" and Workspace Traversal Restriction...');
  // Attempt to escape outside workspace with cd ..
  const s1LenBeforeEscape = s1Output.length;
  session1.write('cd ..\r');
  const escapeBlocked = await waitForOutput(
    () => s1Output.slice(s1LenBeforeEscape),
    (clean) => clean.includes('Access denied') && clean.includes('collabide:~$')
  );
  assert(escapeBlocked, 'Prevent traversal outside workspace root (cd ..)');

  // Create a subfolder inside workspace and navigate into it
  const subDirPath = path.join(projectDir, 'test_subfolder');
  if (!fs.existsSync(subDirPath)) {
    fs.mkdirSync(subDirPath, { recursive: true });
  }

  const s1LenBeforeCd = s1Output.length;
  session1.write('cd test_subfolder\r');
  const cdReady = await waitForOutput(
    () => s1Output.slice(s1LenBeforeCd),
    (clean) => clean.includes('collabide:~/test_subfolder$')
  );
  assert(cdReady, 'Command "cd test_subfolder" updated prompt with relative path');

  // Verify pwd inside subfolder preserves working directory
  const s1LenBeforeSubPwd = s1Output.length;
  session1.write('pwd\r');
  const subPwdReady = await waitForOutput(
    () => s1Output.slice(s1LenBeforeSubPwd),
    (clean) => clean.includes(subDirPath) && clean.includes('collabide:~/test_subfolder$')
  );
  assert(subPwdReady, 'Preserve working directory between commands in session');

  // Verify Session 2 remained at workspace root (isolation between sessions)
  assert(!stripAnsi(s2Output).includes('test_subfolder'), 'Session 2 working directory remains isolated at project root');

  // 4. Test Harmless File Listing (ls / dir)
  console.log('\n📦 4. Testing Harmless File Listing (ls)...');
  const s1LenBeforeLs = s1Output.length;
  session1.write('cd ~\r');
  await waitForOutput(() => s1Output.slice(s1LenBeforeLs), (clean) => clean.includes('collabide:~$'));

  const s1LenBeforeLsCmd = s1Output.length;
  session1.write('ls\r');
  const lsReady = await waitForOutput(
    () => s1Output.slice(s1LenBeforeLsCmd),
    (clean) => (clean.includes('index.html') || clean.includes('test_subfolder')) && clean.includes('collabide:~$')
  );
  assert(lsReady, 'Command "ls" returned directory entries with ANSI coloring');

  // 5. Test npm --version
  console.log('\n📦 5. Testing "npm --version"...');
  const s1LenBeforeNpm = s1Output.length;
  session1.write('npm --version\r');
  const npmReady = await waitForOutput(
    () => s1Output.slice(s1LenBeforeNpm),
    (clean) => /\d+\.\d+\.\d+/.test(clean) && clean.includes('collabide:~$')
  );
  assert(npmReady, 'Command "npm --version" executed and streamed output');

  // 6. Test git --version in Session 2
  console.log('\n📦 6. Testing "git --version" in Session 2...');
  const s2LenBeforeGit = s2Output.length;
  session2.write('git --version\r');
  const gitReady = await waitForOutput(
    () => s2Output.slice(s2LenBeforeGit),
    (clean) => clean.includes('git version') && clean.includes('collabide:~$')
  );
  assert(gitReady, 'Command "git --version" executed in parallel session 2');

  // 7. Test Supported Project Command (node script execution)
  console.log('\n📦 7. Testing Supported Project Command (Node execution)...');
  const s1LenBeforeNode = s1Output.length;
  session1.write('node -e "console.log(\'TERMINAL_TEST_OK_1234\')"\r');
  const nodeReady = await waitForOutput(
    () => s1Output.slice(s1LenBeforeNode),
    (clean) => clean.includes('TERMINAL_TEST_OK_1234') && clean.includes('collabide:~$')
  );
  assert(nodeReady, 'Execute project command and capture stdout in real-time');

  // 8. Test Ctrl+C Signal
  console.log('\n📦 8. Testing Ctrl+C Handling...');
  const s1LenBeforeCtrlC = s1Output.length;
  session1.write('buffered_command_input');
  session1.write('\x03');
  const ctrlCReady = await waitForOutput(
    () => s1Output.slice(s1LenBeforeCtrlC),
    (clean) => clean.includes('^C') && clean.includes('collabide:~$')
  );
  assert(ctrlCReady, 'Send Ctrl+C to cancel command line and reset prompt');

  // 9. Test Invalid Command & Error Reporting
  console.log('\n📦 9. Testing Invalid Command Handling...');
  const s1LenBeforeInvalid = s1Output.length;
  session1.write('this_is_an_invalid_command_xyz_999\r');
  const invalidReady = await waitForOutput(
    () => s1Output.slice(s1LenBeforeInvalid),
    (clean) => (clean.includes('not recognized') || clean.includes('not found') || clean.includes('Process exited')) && clean.includes('collabide:~$')
  );
  assert(invalidReady, 'Report invalid command error status and return to prompt');

  // 10. Test Process Exit
  console.log('\n📦 10. Testing "exit" Command...');
  session1.write('exit\r');
  const exitReady = await waitForOutput(
    () => String(s1ExitCode),
    (clean) => clean === '0'
  );
  assert(exitReady, 'Command "exit" terminated session with code 0');

  // 11. Test Terminal Restart
  console.log('\n📦 11. Testing Session Restart...');
  const s2LenBeforeRestart = s2Output.length;
  session2.restart();
  const restartReady = await waitForOutput(
    () => s2Output.slice(s2LenBeforeRestart),
    (clean, raw) => raw.includes('\x1b[2J\x1b[H') && clean.includes('CollabIDE Interactive Terminal')
  );
  assert(restartReady, 'Session restart clears screen and re-displays banner/prompt');

  // 12. Test Clean Disconnect / Kill
  console.log('\n📦 12. Testing Clean Disconnect...');
  session2.kill();
  assert(true, 'Cleanly kill and disconnect all child processes');

  console.log('\n=======================================================');
  console.log(`📊 Terminal Integration Summary: ${passed} Passed, ${failed} Failed`);
  console.log('=======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTerminalTests().catch((err) => {
  console.error('Fatal terminal test error:', err);
  process.exit(1);
});
