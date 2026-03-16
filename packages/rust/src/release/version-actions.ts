import { ProjectGraph, Tree, joinPathFragments } from '@nx/devkit';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { AfterAllProjectsVersioned, VersionActions } from 'nx/release';
import type { NxReleaseVersionConfiguration } from 'nx/src/config/nx-json';
import {
  modifyCargoTable,
  parseCargoToml,
  parseCargoTomlWithTree,
  stringifyCargoToml,
} from '../utils/toml';

export const afterAllProjectsVersioned: AfterAllProjectsVersioned = async (
  cwd,
  { rootVersionActionsOptions, dryRun }
) => {
  if (rootVersionActionsOptions?.skipLockFileUpdate) {
    return { changedFiles: [], deletedFiles: [] };
  }
  if (dryRun) {
    return { changedFiles: [], deletedFiles: [] };
  }
  try {
    execSync('cargo update', { cwd, maxBuffer: 1024 * 1024 * 1024 });
    const result = execSync('git diff --name-only Cargo.lock', { cwd })
      .toString()
      .trim();
    return {
      changedFiles: result === 'Cargo.lock' ? ['Cargo.lock'] : [],
      deletedFiles: [],
    };
  } catch {
    return { changedFiles: [], deletedFiles: [] };
  }
};

export default class CargoVersionActions extends VersionActions {
  validManifestFilenames = ['Cargo.toml'];

  async readCurrentVersionFromSourceManifest(tree: Tree): Promise<{
    currentVersion: string;
    manifestPath: string;
  }> {
    const sourceManifestPath = join(
      this.projectGraphNode.data.root,
      'Cargo.toml'
    );
    try {
      const contents = tree.read(sourceManifestPath)?.toString('utf-8');
      if (!contents) {
        throw new Error('File not found');
      }
      const data = parseCargoToml(contents);
      return {
        manifestPath: sourceManifestPath,
        currentVersion: data.package.version,
      };
    } catch {
      throw new Error(
        `Unable to determine the current version for project "${this.projectGraphNode.name}" from ${sourceManifestPath}, please ensure that the "version" field is set within the Cargo.toml file`
      );
    }
  }

  async readCurrentVersionFromRegistry(
    _tree: Tree,
    _currentVersionResolverMetadata: NxReleaseVersionConfiguration['currentVersionResolverMetadata']
  ): Promise<{
    currentVersion: string | null;
    logText: string;
  } | null> {
    // TODO: Implement crates.io registry lookup via `cargo search` or crates.io API
    return null;
  }

  async readCurrentVersionOfDependency(
    tree: Tree,
    _projectGraph: ProjectGraph,
    dependencyProjectName: string
  ): Promise<{
    currentVersion: string | null;
    dependencyCollection: string | null;
  }> {
    const cargoToml = parseCargoTomlWithTree(
      tree,
      this.projectGraphNode.data.root,
      this.projectGraphNode.name
    );
    const depCollections = ['dependencies', 'dev-dependencies'] as const;
    for (const collection of depCollections) {
      const deps = cargoToml[collection];
      if (deps && deps[dependencyProjectName]) {
        const depData = deps[dependencyProjectName];
        const version =
          typeof depData === 'string' ? depData : depData.version;
        return {
          currentVersion: version ?? null,
          dependencyCollection: collection,
        };
      }
    }
    return { currentVersion: null, dependencyCollection: null };
  }

  async updateProjectVersion(
    tree: Tree,
    newVersion: string
  ): Promise<string[]> {
    const logMessages: string[] = [];
    for (const manifestToUpdate of this.manifestsToUpdate) {
      const contents = tree
        .read(manifestToUpdate.manifestPath)
        ?.toString('utf-8');
      if (!contents) {
        continue;
      }
      const data = parseCargoToml(contents);
      data.package.version = newVersion;
      tree.write(manifestToUpdate.manifestPath, stringifyCargoToml(data));
      logMessages.push(
        `✍️  New version ${newVersion} written to ${manifestToUpdate.manifestPath}`
      );
    }
    return logMessages;
  }

  async updateProjectDependencies(
    tree: Tree,
    _projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>
  ): Promise<string[]> {
    if (Object.keys(dependenciesToUpdate).length === 0) {
      return [];
    }

    const logMessages: string[] = [];

    for (const manifestToUpdate of this.manifestsToUpdate) {
      const contents = tree
        .read(manifestToUpdate.manifestPath)
        ?.toString('utf-8');
      if (!contents) {
        continue;
      }
      const data = parseCargoToml(contents);
      let updated = 0;

      for (const [depName, newVersion] of Object.entries(
        dependenciesToUpdate
      )) {
        for (const collection of [
          'dependencies',
          'dev-dependencies',
        ] as const) {
          if (!data[collection]?.[depName]) {
            continue;
          }
          const depData = data[collection][depName];

          // Preserve existing version prefix.
          // In Cargo, no-prefix is semantically equivalent to ^, so we only
          // preserve an explicit prefix if it was actually written by the user.
          const existingVersion =
            typeof depData === 'string' ? depData : depData.version;
          const prefixMatch = existingVersion?.match(/^[~^=]/);
          let prefix = prefixMatch ? prefixMatch[0] : '';

          // Cargo treats no-prefix as ^. If the resolved prefix is ^ but
          // the original version string didn't start with ^, the user wrote
          // it without a prefix so we should keep it that way.
          if (prefix === '^' && !existingVersion?.startsWith('^')) {
            prefix = '';
          }

          const newVersionWithPrefix = `${prefix}${newVersion}`;
          const updatedDependencyData =
            typeof depData === 'string'
              ? newVersionWithPrefix
              : { ...depData, version: newVersionWithPrefix };

          modifyCargoTable(
            data,
            collection,
            depName,
            updatedDependencyData
          );
          updated++;
        }
      }

      if (updated > 0) {
        tree.write(manifestToUpdate.manifestPath, stringifyCargoToml(data));
        const depText = updated === 1 ? 'dependency' : 'dependencies';
        logMessages.push(
          `✍️  Updated ${updated} ${depText} in ${manifestToUpdate.manifestPath}`
        );
      }
    }

    return logMessages;
  }
}
