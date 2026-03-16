/**
 * This script starts a local registry for e2e testing purposes.
 * It is meant to be called in jest's globalSetup.
 */
import { startLocalRegistry } from '@nx/js/plugins/jest/local-registry';
import { releasePublish, releaseVersion } from 'nx/release';
import { execSync } from 'node:child_process';

export default async () => {
  // local registry target to run
  const localRegistryTarget = 'monodon:local-registry';
  // storage folder for the local registry
  const storage = './tmp/local-registry/storage';

  (global as any).stopLocalRegistry = await startLocalRegistry({
    localRegistryTarget,
    storage,
    verbose: true,
  });

  await releaseVersion({
    specifier: '0.0.0-e2e',
    gitCommit: false,
    gitTag: false,
    stageChanges: false,
    verbose: true,
  });
  // Override any scoped registry config (e.g. @antoniog:registry in ~/.npmrc)
  // so that npm publish targets the local verdaccio instead of npmjs.org.
  execSync('npm config set @antoniog:registry http://localhost:3889/', {
    stdio: 'inherit',
  });

  await releasePublish({
    tag: 'e2e',
    firstRelease: true,
    verbose: true,
  });
};
