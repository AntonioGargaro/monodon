import { NxPlugin } from '@nx/devkit';
import { createDependencies, createNodes, createNodesV2 } from './graph';

const nxPlugin: NxPlugin = {
  name: '@antoniog/rust',
  createDependencies,
  createNodes,
  createNodesV2,
};

export = nxPlugin;
