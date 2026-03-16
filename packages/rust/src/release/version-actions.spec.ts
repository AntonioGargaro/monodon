import { ProjectGraph, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { ReleaseGroupWithName } from 'nx/src/command-line/release/config/filter-release-groups';
import type { FinalConfigForProject } from 'nx/src/command-line/release/utils/release-graph';
import { CargoToml } from '../models/cargo.toml';
import { parseCargoTomlWithTree } from '../utils/toml';
import CargoVersionActions, { afterAllProjectsVersioned } from './version-actions';
import { createWorkspaceWithPackageDependencies } from './test-utils/create-workspace-with-package-dependencies';

// Using the daemon in unit tests would cause jest to never exit
process.env.NX_DAEMON = 'false';

function getDepVersion(
  deps: CargoToml['dependencies'],
  name: string
): string | undefined {
  const dep = deps?.[name];
  if (!dep) return undefined;
  return typeof dep === 'string' ? dep : dep.version;
}

function createVersionActions(
  projectGraph: ProjectGraph,
  projectName: string
): CargoVersionActions {
  const projectNode = projectGraph.nodes[projectName];
  const releaseGroup: ReleaseGroupWithName = {
    name: 'myReleaseGroup',
    releaseTagPattern: '{projectName}@v{version}',
    projectsRelationship: 'independent',
    resolvedVersionPlans: false,
  } as ReleaseGroupWithName;
  const finalConfig: FinalConfigForProject = {
    specifierSource: 'prompt',
    currentVersionResolver: 'disk',
    currentVersionResolverMetadata: {},
    fallbackCurrentVersionResolver: 'disk',
    versionPrefix: 'auto',
    preserveLocalDependencyProtocols: false,
    preserveMatchingDependencyRanges: false,
    adjustSemverBumpsForZeroMajorVersion: false,
    versionActionsOptions: {},
    manifestRootsToUpdate: [],
    dockerOptions: {},
  } as FinalConfigForProject;
  return new CargoVersionActions(releaseGroup, projectNode, finalConfig);
}

describe('CargoVersionActions', () => {
  let tree: Tree;
  let projectGraph: ProjectGraph;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    projectGraph = createWorkspaceWithPackageDependencies(tree, {
      'my-lib': {
        projectRoot: 'libs/my-lib',
        packageName: 'my-lib',
        version: '0.0.1',
        cargoTomlPath: 'libs/my-lib/Cargo.toml',
        localDependencies: [],
      },
      'project-with-dependency-on-my-pkg': {
        projectRoot: 'libs/project-with-dependency-on-my-pkg',
        packageName: 'project-with-dependency-on-my-pkg',
        version: '0.0.1',
        cargoTomlPath: 'libs/project-with-dependency-on-my-pkg/Cargo.toml',
        localDependencies: [
          {
            projectName: 'my-lib',
            dependencyCollection: 'dependencies',
            version: '0.0.1',
          },
        ],
      },
      'project-with-devDependency-on-my-pkg': {
        projectRoot: 'libs/project-with-devDependency-on-my-pkg',
        packageName: 'project-with-devDependency-on-my-pkg',
        version: '0.0.1',
        cargoTomlPath: 'libs/project-with-devDependency-on-my-pkg/Cargo.toml',
        localDependencies: [
          {
            projectName: 'my-lib',
            dependencyCollection: 'dev-dependencies',
            version: '0.0.1',
          },
        ],
      },
    });
  });

  describe('readCurrentVersionFromSourceManifest', () => {
    it('should read the current version from Cargo.toml', async () => {
      const actions = createVersionActions(projectGraph, 'my-lib');
      const result = await actions.readCurrentVersionFromSourceManifest(tree);
      expect(result).toEqual({
        currentVersion: '0.0.1',
        manifestPath: 'libs/my-lib/Cargo.toml',
      });
    });

    it('should throw when Cargo.toml does not exist', async () => {
      tree.delete('libs/my-lib/Cargo.toml');
      const actions = createVersionActions(projectGraph, 'my-lib');
      await expect(
        actions.readCurrentVersionFromSourceManifest(tree)
      ).rejects.toThrow(
        /Unable to determine the current version for project "my-lib"/
      );
    });
  });

  describe('readCurrentVersionOfDependency', () => {
    it('should read a dependency version from dependencies section', async () => {
      const actions = createVersionActions(
        projectGraph,
        'project-with-dependency-on-my-pkg'
      );
      const result = await actions.readCurrentVersionOfDependency(
        tree,
        projectGraph,
        'my-lib'
      );
      expect(result.currentVersion).toEqual('0.0.1');
      expect(result.dependencyCollection).toEqual('dependencies');
    });

    it('should read a dependency version from dev-dependencies section', async () => {
      const actions = createVersionActions(
        projectGraph,
        'project-with-devDependency-on-my-pkg'
      );
      const result = await actions.readCurrentVersionOfDependency(
        tree,
        projectGraph,
        'my-lib'
      );
      expect(result.currentVersion).toEqual('0.0.1');
      expect(result.dependencyCollection).toEqual('dev-dependencies');
    });

    it('should return null for non-existent dependency', async () => {
      const actions = createVersionActions(projectGraph, 'my-lib');
      const result = await actions.readCurrentVersionOfDependency(
        tree,
        projectGraph,
        'non-existent-dep'
      );
      expect(result.currentVersion).toBeNull();
      expect(result.dependencyCollection).toBeNull();
    });
  });

  describe('updateProjectVersion', () => {
    it('should update the version in Cargo.toml', async () => {
      const actions = createVersionActions(projectGraph, 'my-lib');
      // Manually set manifestsToUpdate since init() would normally resolve these
      actions.manifestsToUpdate = [
        {
          manifestPath: 'libs/my-lib/Cargo.toml',
          preserveLocalDependencyProtocols: false,
        },
      ];

      const logs = await actions.updateProjectVersion(tree, '1.0.0');

      expect(logs.length).toBe(1);
      expect(logs[0]).toContain('1.0.0');
      expect(
        parseCargoTomlWithTree(tree, 'libs/my-lib', 'my-lib').package.version
      ).toEqual('1.0.0');
    });
  });

  describe('updateProjectDependencies', () => {
    it('should update dependency versions in Cargo.toml', async () => {
      const actions = createVersionActions(
        projectGraph,
        'project-with-dependency-on-my-pkg'
      );
      actions.manifestsToUpdate = [
        {
          manifestPath: 'libs/project-with-dependency-on-my-pkg/Cargo.toml',
          preserveLocalDependencyProtocols: false,
        },
      ];

      const logs = await actions.updateProjectDependencies(
        tree,
        projectGraph,
        { 'my-lib': '1.0.0' }
      );

      expect(logs.length).toBe(1);
      const cargoToml = parseCargoTomlWithTree(
        tree,
        'libs/project-with-dependency-on-my-pkg',
        'project-with-dependency-on-my-pkg'
      );
      expect(getDepVersion(cargoToml.dependencies, 'my-lib')).toEqual('1.0.0');
    });

    it('should preserve ~ prefix', async () => {
      // Set up a workspace with a ~ prefix
      projectGraph = createWorkspaceWithPackageDependencies(tree, {
        'my-lib': {
          projectRoot: 'libs/my-lib',
          packageName: 'my-lib',
          version: '0.0.1',
          cargoTomlPath: 'libs/my-lib/Cargo.toml',
          localDependencies: [],
        },
        'dep-project': {
          projectRoot: 'libs/dep-project',
          packageName: 'dep-project',
          version: '0.0.1',
          cargoTomlPath: 'libs/dep-project/Cargo.toml',
          localDependencies: [
            {
              projectName: 'my-lib',
              dependencyCollection: 'dependencies',
              version: '~0.0.1',
            },
          ],
        },
      });

      const actions = createVersionActions(projectGraph, 'dep-project');
      actions.manifestsToUpdate = [
        {
          manifestPath: 'libs/dep-project/Cargo.toml',
          preserveLocalDependencyProtocols: false,
        },
      ];

      await actions.updateProjectDependencies(tree, projectGraph, {
        'my-lib': '1.0.0',
      });

      const cargoToml = parseCargoTomlWithTree(
        tree,
        'libs/dep-project',
        'dep-project'
      );
      expect(getDepVersion(cargoToml.dependencies, 'my-lib')).toEqual('~1.0.0');
    });

    it('should preserve ^ prefix when explicitly written', async () => {
      projectGraph = createWorkspaceWithPackageDependencies(tree, {
        'my-lib': {
          projectRoot: 'libs/my-lib',
          packageName: 'my-lib',
          version: '0.0.1',
          cargoTomlPath: 'libs/my-lib/Cargo.toml',
          localDependencies: [],
        },
        'dep-project': {
          projectRoot: 'libs/dep-project',
          packageName: 'dep-project',
          version: '0.0.1',
          cargoTomlPath: 'libs/dep-project/Cargo.toml',
          localDependencies: [
            {
              projectName: 'my-lib',
              dependencyCollection: 'dependencies',
              version: '^0.0.1',
            },
          ],
        },
      });

      const actions = createVersionActions(projectGraph, 'dep-project');
      actions.manifestsToUpdate = [
        {
          manifestPath: 'libs/dep-project/Cargo.toml',
          preserveLocalDependencyProtocols: false,
        },
      ];

      await actions.updateProjectDependencies(tree, projectGraph, {
        'my-lib': '1.0.0',
      });

      const cargoToml = parseCargoTomlWithTree(
        tree,
        'libs/dep-project',
        'dep-project'
      );
      expect(getDepVersion(cargoToml.dependencies, 'my-lib')).toEqual('^1.0.0');
    });

    it('should return empty array when no dependencies to update', async () => {
      const actions = createVersionActions(projectGraph, 'my-lib');
      actions.manifestsToUpdate = [
        {
          manifestPath: 'libs/my-lib/Cargo.toml',
          preserveLocalDependencyProtocols: false,
        },
      ];

      const logs = await actions.updateProjectDependencies(
        tree,
        projectGraph,
        {}
      );
      expect(logs).toEqual([]);
    });
  });

  describe('readCurrentVersionFromRegistry', () => {
    it('should return null (not yet implemented)', async () => {
      const actions = createVersionActions(projectGraph, 'my-lib');
      const result = await actions.readCurrentVersionFromRegistry(tree, {});
      expect(result).toBeNull();
    });
  });
});
