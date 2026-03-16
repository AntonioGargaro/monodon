import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import { tmpProjPath } from '@nx/plugin/testing';

/**
 * Creates a test project with create-nx-workspace and installs the plugin
 * @returns The directory where the test project was created
 */
export function createTestProject(testId = '') {
  const projectName = 'test-project-' + testId;
  const projectDirectory = tmpProjPath(projectName);

  // Ensure projectDirectory is empty
  rmSync(projectDirectory, {
    recursive: true,
    force: true,
  });

  // Initialize a standalone git repo in the parent directory so that
  // create-nx-workspace does not inherit the monorepo's .gitignore
  // (which ignores "tmp/").
  const parentDir = dirname(projectDirectory);
  mkdirSync(parentDir, { recursive: true });
  if (!existsSync(join(parentDir, '.git'))) {
    execSync('git init', { cwd: parentDir, stdio: 'inherit' });
  }

  execSync(
    `npx --yes create-nx-workspace@latest ${projectName} --preset apps --nxCloud=skip --no-interactive --packageManager yarn`,
    {
      cwd: dirname(projectDirectory),
      stdio: 'inherit',
      env: process.env,
    }
  );
  console.log(`Created test project in "${projectDirectory}"`);

  return projectDirectory;
}

export function runNxCommand(command: string, projectDir: string) {
  execSync(`npx nx ${command}`, { cwd: projectDir, stdio: 'inherit' });
}
