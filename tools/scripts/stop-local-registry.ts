/**
 * This script stops the local registry for e2e testing purposes.
 * It is meant to be called in jest's globalTeardown.
 */
import { execSync } from 'node:child_process';

export default () => {
  if ((global as any).stopLocalRegistry) {
    (global as any).stopLocalRegistry();
  }
  // Restore the scoped registry to npmjs.org (overridden in start-local-registry)
  try {
    execSync('npm config set @antoniog:registry https://registry.npmjs.org/', {
      stdio: 'inherit',
    });
  } catch {
    // ignore cleanup errors
  }
};
