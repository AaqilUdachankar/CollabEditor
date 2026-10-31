import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { initDatabase } from '../db/connection.js';
import { UserRepository, IUser } from '../models/User.js';
import { ProjectRepository, IProject } from '../models/Project.js';
import { FileNodeRepository } from '../models/FileNode.js';
import { ProjectService } from '../services/projectService.js';
import { ExecutionService } from '../services/executionService.js';
import { FileService } from '../services/fileService.js';
import { TEMPLATE_DEFINITIONS, getDefaultEntryFile, resolveTemplateKey } from '../services/templates.js';

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

async function runTestSuite() {
  console.log('\n=======================================================');
  console.log('🧪 Running Language-Aware Templates & Execution Test Suite');
  console.log('=======================================================\n');

  await initDatabase();

  const timestamp = Date.now();
  const testUser: IUser = {
    id: `test-user-${timestamp}`,
    email: `dev_${timestamp}@collabide.local`,
    username: 'TemplateTester',
    passwordHash: 'dummy',
    avatarColor: '#3b82f6',
    role: 'user',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await UserRepository.create(testUser);

  // 1. Template Resolution & Entry Files
  console.log('📦 1. Testing Template Normalization & Sensible Entry Files...');
  assert(resolveTemplateKey('cpp') === 'cpp', 'Resolves cpp template');
  assert(resolveTemplateKey('c++') === 'cpp', 'Resolves c++ alias to cpp');
  assert(resolveTemplateKey('c') === 'c', 'Resolves c template');
  assert(resolveTemplateKey('java') === 'java', 'Resolves java template');
  assert(resolveTemplateKey('typescript') === 'typescript', 'Resolves typescript template');
  assert(resolveTemplateKey('ts') === 'typescript', 'Resolves ts alias to typescript');
  assert(resolveTemplateKey('javascript') === 'javascript', 'Resolves javascript template');
  assert(resolveTemplateKey('js') === 'javascript', 'Resolves js alias to javascript');
  assert(resolveTemplateKey('python') === 'python', 'Resolves python template');
  assert(resolveTemplateKey('py') === 'python', 'Resolves py alias to python');

  assert(getDefaultEntryFile('python') === 'src/main.py', 'Python default entry file is src/main.py');
  assert(getDefaultEntryFile('java') === 'src/main/java/Main.java', 'Java default entry file is src/main/java/Main.java');
  assert(getDefaultEntryFile('cpp') === 'src/main.cpp', 'C++ default entry file is src/main.cpp');
  assert(getDefaultEntryFile('c') === 'src/main.c', 'C default entry file is src/main.c');
  assert(getDefaultEntryFile('typescript') === 'src/index.ts', 'TypeScript default entry file is src/index.ts');
  assert(getDefaultEntryFile('javascript') === 'src/index.js', 'JavaScript default entry file is src/index.js');

  // 2. Python Language-Aware Project Creation
  console.log('\n📦 2. Testing Python Project Template (src/, requirements.txt, pyproject.toml)...');
  const pyProject = await ProjectService.createProject(
    testUser.id,
    `Python App ${timestamp}`,
    'Python workspace with src convention',
    'python'
  );
  assert(pyProject.entryFile === 'src/main.py', 'Python project stores entryFile in project record');

  const pyFiles = await FileNodeRepository.findByProject(pyProject.id);
  const pyMain = pyFiles.find((f) => f.path.replace(/\\/g, '/') === 'src/main.py');
  const pyUtils = pyFiles.find((f) => f.path.replace(/\\/g, '/') === 'src/utils.py');
  const pyReqs = pyFiles.find((f) => f.name === 'requirements.txt');
  const pyProjectToml = pyFiles.find((f) => f.name === 'pyproject.toml');
  const pySrcDir = pyFiles.find((f) => f.type === 'directory' && f.name === 'src');

  assert(pySrcDir !== undefined, 'Python project creates src/ directory node');
  assert(pyMain !== undefined && pyMain.type === 'file', 'Python project creates src/main.py file node');
  assert(pyUtils !== undefined, 'Python project creates src/utils.py file node');
  assert(pyReqs !== undefined, 'Python project creates requirements.txt');
  assert(pyProjectToml !== undefined, 'Python project creates pyproject.toml');

  // Verify persistence on disk
  const pyDiskMain = path.join(ProjectService.getProjectPath(pyProject.id), 'src', 'main.py');
  assert(fs.existsSync(pyDiskMain), 'Persisted src/main.py to filesystem disk');

  // 3. Java Language-Aware Project Creation
  console.log('\n📦 3. Testing Java Project Template (src/main/java, Main.java public class, pom.xml)...');
  const javaProject = await ProjectService.createProject(
    testUser.id,
    `Java App ${timestamp}`,
    'Java workspace with src/main/java convention',
    'java'
  );
  assert(javaProject.entryFile === 'src/main/java/Main.java', 'Java project stores entryFile in project record');

  const javaFiles = await FileNodeRepository.findByProject(javaProject.id);
  const javaMain = javaFiles.find((f) => f.path.replace(/\\/g, '/') === 'src/main/java/Main.java');
  const javaPom = javaFiles.find((f) => f.name === 'pom.xml');
  const javaDir = javaFiles.find((f) => f.type === 'directory' && f.name === 'java');

  assert(javaDir !== undefined, 'Java project creates java directory under src/main');
  assert(javaMain !== undefined, 'Java project creates src/main/java/Main.java');
  assert(javaPom !== undefined, 'Java project creates pom.xml');
  assert(javaMain?.content?.includes('public class Main') === true, 'Main.java declares matching public class Main');

  // 4. C/C++ Project Creation
  console.log('\n📦 4. Testing C and C++ Project Templates (src/include, main.cpp, main.c, Makefile)...');
  const cppProject = await ProjectService.createProject(
    testUser.id,
    `C++ App ${timestamp}`,
    'C++ workspace with include conventions',
    'cpp'
  );
  assert(cppProject.entryFile === 'src/main.cpp', 'C++ project stores entryFile');

  const cppFiles = await FileNodeRepository.findByProject(cppProject.id);
  const cppMain = cppFiles.find((f) => f.path.replace(/\\/g, '/') === 'src/main.cpp');
  const cppIncHpp = cppFiles.find((f) => f.path.replace(/\\/g, '/') === 'src/include/calculator.hpp');
  const cppIncCommon = cppFiles.find((f) => f.path.replace(/\\/g, '/') === 'include/common.h');
  const cppMakefile = cppFiles.find((f) => f.name === 'Makefile');

  assert(cppMain !== undefined, 'C++ project creates src/main.cpp');
  assert(cppIncHpp !== undefined, 'C++ project creates src/include/calculator.hpp');
  assert(cppIncCommon !== undefined, 'C++ project creates include/common.h');
  assert(cppMakefile !== undefined, 'C++ project creates Makefile');

  const cProject = await ProjectService.createProject(
    testUser.id,
    `C App ${timestamp}`,
    'C workspace with include conventions',
    'c'
  );
  assert(cProject.entryFile === 'src/main.c', 'C project stores entryFile');

  const cFiles = await FileNodeRepository.findByProject(cProject.id);
  const cMain = cFiles.find((f) => f.path.replace(/\\/g, '/') === 'src/main.c');
  const cIncHeader = cFiles.find((f) => f.path.replace(/\\/g, '/') === 'src/include/utils.h');
  assert(cMain !== undefined, 'C project creates src/main.c');
  assert(cIncHeader !== undefined, 'C project creates src/include/utils.h');

  // 5. JavaScript & TypeScript Project Creation
  console.log('\n📦 5. Testing JS and TS Project Templates (package.json and src)...');
  const tsProject = await ProjectService.createProject(
    testUser.id,
    `TS App ${timestamp}`,
    'TypeScript workspace with package.json and src',
    'typescript'
  );
  const tsFiles = await FileNodeRepository.findByProject(tsProject.id);
  const tsIndex = tsFiles.find((f) => f.path.replace(/\\/g, '/') === 'src/index.ts');
  const tsConfig = tsFiles.find((f) => f.name === 'tsconfig.json');
  const tsPkg = tsFiles.find((f) => f.name === 'package.json');
  assert(tsIndex !== undefined, 'TypeScript project creates src/index.ts');
  assert(tsConfig !== undefined, 'TypeScript project creates tsconfig.json');
  assert(tsPkg !== undefined, 'TypeScript project creates package.json');

  const jsProject = await ProjectService.createProject(
    testUser.id,
    `JS App ${timestamp}`,
    'JavaScript workspace with package.json and src',
    'javascript'
  );
  const jsFiles = await FileNodeRepository.findByProject(jsProject.id);
  const jsIndex = jsFiles.find((f) => f.path.replace(/\\/g, '/') === 'src/index.js');
  const jsPkg = jsFiles.find((f) => f.name === 'package.json');
  assert(jsIndex !== undefined, 'JavaScript project creates src/index.js');
  assert(jsPkg !== undefined, 'JavaScript project creates package.json');

  // 6. Toolchains and Execution Capabilities
  console.log('\n📦 6. Testing Toolchain Detection & Execution Capabilities...');
  const toolchains = ExecutionService.getAvailableToolchains();
  assert(typeof toolchains.node === 'object' && toolchains.node.installed === true, 'Node toolchain is detected');
  assert(typeof toolchains.python === 'object', 'Python toolchain probe completes');
  assert(typeof toolchains.java === 'object', 'Java toolchain probe completes');
  assert(typeof toolchains.gpp === 'object', 'G++ toolchain probe completes');
  assert(typeof toolchains.gcc === 'object', 'GCC toolchain probe completes');

  // 7. Execution of Python Workspace
  console.log('\n📦 7. Testing Python Execution (src/main.py with src/ module import)...');
  if (toolchains.python.installed && pyMain) {
    const pyResult = await ExecutionService.runFile(pyProject.id, pyMain.id);
    assert(pyResult.exitCode === 0, 'Python execution exits with code 0');
    assert(
      pyResult.stdout.includes('Running Python application') || pyResult.stdout.includes('Fibonacci'),
      'Python output captures standard output with imported utils module'
    );
  } else {
    console.log('  ⚠️ Skipping Python live execution (python not detected in system PATH)');
  }

  // 8. Execution of TypeScript & JavaScript Workspaces
  console.log('\n📦 8. Testing TypeScript and JavaScript Execution...');
  if (tsIndex) {
    const tsResult = await ExecutionService.runFile(tsProject.id, tsIndex.id);
    assert(tsResult.exitCode === 0, 'TypeScript execution exits with code 0');
    assert(
      tsResult.stdout.includes('TypeScript Workspace') || tsResult.stdout.includes('Array Sum'),
      'TypeScript output captures typed execution output'
    );
  }

  if (jsIndex) {
    const jsResult = await ExecutionService.runFile(jsProject.id, jsIndex.id);
    assert(jsResult.exitCode === 0, 'JavaScript execution exits with code 0');
    assert(
      jsResult.stdout.includes('JavaScript Workspace') || jsResult.stdout.includes('Fibonacci'),
      'JavaScript output captures module execution output'
    );
  }

  // 9. Execution of Java Workspace
  console.log('\n📦 9. Testing Java Execution (src/main/java/Main.java)...');
  if (toolchains.java.installed && javaMain) {
    const javaResult = await ExecutionService.runFile(javaProject.id, javaMain.id);
    assert(javaResult.exitCode === 0, 'Java execution exits with code 0');
    assert(
      javaResult.stdout.includes('Java Application') || javaResult.stdout.includes('public class Main'),
      'Java output captures standard output from public class Main'
    );
  } else {
    console.log('  ⚠️ Skipping Java live execution (java not detected in system PATH)');
  }

  // 10. Execution of C and C++ Workspaces
  console.log('\n📦 10. Testing C++ and C Compilation and Execution (Include Headers & Runner)...');
  if (toolchains.gpp.installed && cppMain) {
    const cppResult = await ExecutionService.runFile(cppProject.id, cppMain.id);
    assert(cppResult.exitCode === 0, 'C++ compilation and execution exits with code 0');
    assert(
      cppResult.stdout.includes('CollabIDE C++ Workspace') || cppResult.stdout.includes('Vector Total Sum'),
      'C++ output captures compiled execution using src/include headers'
    );
  } else {
    console.log('  ⚠️ Skipping C++ live execution (g++ not detected in system PATH)');
  }

  if (toolchains.gcc.installed && cMain) {
    const cResult = await ExecutionService.runFile(cProject.id, cMain.id);
    assert(cResult.exitCode === 0, 'C compilation and execution exits with code 0');
    assert(
      cResult.stdout.includes('CollabIDE C Workspace') || cResult.stdout.includes('Collaborative Developer'),
      'C output captures compiled execution using src/include headers'
    );
  } else {
    console.log('  ⚠️ Skipping C live execution (gcc not detected in system PATH)');
  }

  // 11. Testing Project Entry Runner (runEntryFile)
  console.log('\n📦 11. Testing Automatic Sensible Entry Target Execution...');
  const entryPyResult = await ExecutionService.runEntryFile(pyProject.id);
  assert(entryPyResult.exitCode === 0, 'runEntryFile executes configured sensible entry file (src/main.py)');

  // 12. Testing Missing Toolchain Detection & Friendly Error Formatting
  console.log('\n📦 12. Testing Missing Tool Diagnostics (No Hardcoded OS Paths)...');
  const missingErrorMsg = ExecutionService.formatToolMissingError(
    'nonexistent_compiler',
    'CustomLang',
    'Install CustomLang via package manager.',
    'src/main.custom'
  );
  assert(missingErrorMsg.includes('[CollabIDE Toolchain Error]'), 'Formats standardized toolchain error header');
  assert(missingErrorMsg.includes('nonexistent_compiler'), 'Identifies missing tool name');
  assert(missingErrorMsg.includes('Operating system:'), 'Identifies operating system dynamically without hardcoding paths');
  assert(missingErrorMsg.includes('Resolution: Install CustomLang'), 'Provides clear actionable install guidance');

  // 13. Arbitrary File & Folder Creation Continues Unrestricted
  console.log('\n📦 13. Testing Unrestricted Arbitrary Custom Folder & File Creation...');
  // Create custom top-level folder
  const customFolder1 = await FileService.createDirectory(pyProject.id, null, 'my_custom_experiments');
  assert(customFolder1 !== undefined && customFolder1.name === 'my_custom_experiments', 'Creates arbitrary custom folder');

  // Create custom nested subfolder
  const customSubFolder = await FileService.createDirectory(pyProject.id, customFolder1.id, 'nested_sub_package');
  assert(customSubFolder !== undefined && customSubFolder.parentId === customFolder1.id, 'Creates arbitrary nested subfolder');

  // Create custom file in nested folder
  const customFile = await FileService.createFile(
    pyProject.id,
    customSubFolder.id,
    'custom_data_processor.py',
    'print("Custom arbitrary file works!")\n'
  );
  assert(customFile !== undefined && customFile.name === 'custom_data_processor.py', 'Creates arbitrary custom file in custom folder');

  // Read file from disk
  const customFileDisk = path.join(ProjectService.getProjectPath(pyProject.id), customFile.path);
  assert(fs.existsSync(customFileDisk), 'Persists arbitrary custom file to disk');

  // Rename custom file
  const renamedFile = await FileService.renameNode(pyProject.id, customFile.id, 'renamed_processor.py');
  assert(renamedFile.name === 'renamed_processor.py', 'Renames custom file without restriction');

  // Duplicate custom file
  const dupFile = await FileService.duplicateNode(pyProject.id, customFile.id);
  assert(dupFile.name.includes('copy'), 'Duplicates custom file with unique copy name');

  // Delete duplicate
  await FileService.deleteNode(pyProject.id, dupFile.id);
  const deletedCheck = await FileNodeRepository.findById(dupFile.id);
  assert(deletedCheck === null, 'Deletes arbitrary file node cleanly');

  console.log('\n=======================================================');
  console.log(`📊 Language Templates & Execution Summary: ${passed} Passed, ${failed} Failed`);
  console.log('=======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
