import {
  Tree,
  getProjects,
  updateProjectConfiguration,
  readNxJson,
  updateNxJson,
} from '@nx/devkit';

const OLD_GENERATOR = '@antoniog/rust:release-version';
const NEW_VERSION_ACTIONS = '@antoniog/rust/src/release/version-actions';

export default function updateToNx22(tree: Tree) {
  updateProjectConfigurations(tree);
  updateNxJsonConfig(tree);
}

function updateProjectConfigurations(tree: Tree) {
  const projects = getProjects(tree);

  for (const [projectName, projectConfig] of projects) {
    const releaseVersion = (projectConfig as any).release?.version;
    if (!releaseVersion) {
      continue;
    }

    let changed = false;

    // Migrate generator -> versionActions
    if (releaseVersion.generator === OLD_GENERATOR) {
      delete releaseVersion.generator;
      releaseVersion.versionActions = NEW_VERSION_ACTIONS;
      changed = true;
    }

    // Migrate generatorOptions -> versionActionsOptions
    if (releaseVersion.generatorOptions) {
      releaseVersion.versionActionsOptions = {
        ...releaseVersion.generatorOptions,
      };
      delete releaseVersion.generatorOptions;
      changed = true;
    }

    if (changed) {
      updateProjectConfiguration(tree, projectName, projectConfig);
    }
  }
}

function updateNxJsonConfig(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson?.release?.version) {
    return;
  }

  const versionConfig = nxJson.release.version as any;
  let changed = false;

  // Migrate generator -> versionActions
  if (versionConfig.generator === OLD_GENERATOR) {
    delete versionConfig.generator;
    versionConfig.versionActions = NEW_VERSION_ACTIONS;
    changed = true;
  }

  // Migrate generatorOptions -> versionActionsOptions
  if (versionConfig.generatorOptions) {
    versionConfig.versionActionsOptions = {
      ...versionConfig.generatorOptions,
    };
    delete versionConfig.generatorOptions;
    changed = true;
  }

  if (changed) {
    updateNxJson(tree, nxJson);
  }
}
