import {
  CreateNodes,
  CreateNodesContext,
  ProjectConfiguration,
  TargetConfiguration,
  readJsonFile,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';

import { getGradleExecFile } from '../utils/exec-gradle';
import { getGradleReport } from '../utils/get-gradle-report';

const cacheableTaskType = new Set(['Build', 'Verification']);
const dependsOnMap = {
  build: ['^build', 'classes'],
  test: ['classes'],
  classes: ['^classes'],
};

interface GradleTask {
  type: string;
  name: string;
}

export interface GradlePluginOptions {
  testTargetName?: string;
  classesTargetName?: string;
  buildTargetName?: string;
  [taskTargetName: string]: string | undefined;
}

const cachePath = join(projectGraphCacheDirectory, 'gradle.hash');
const targetsCache = readTargetsCache();
type GradleTargets = Record<
  string,
  {
    name: string;
    targets: Record<string, TargetConfiguration>;
    metadata: ProjectConfiguration['metadata'];
  }
>;

function readTargetsCache(): {
  project?: GradleTargets;
  parentProject?: GradleTargets;
} {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

export function writeTargetsToCache() {
  const oldCache = readTargetsCache();
  writeJsonFile(cachePath, {
    ...oldCache,
    ...targetsCache,
  });
}

export const createNodes: CreateNodes<GradlePluginOptions> = [
  '**/build.{gradle.kts,gradle}',
  (
    gradleFilePath,
    options: GradlePluginOptions | undefined,
    context: CreateNodesContext
  ) => {
    const projectRoot = dirname(gradleFilePath);

    const hash = calculateHashForCreateNodes(
      projectRoot,
      options ?? {},
      context
    );
    targetsCache[hash] ??= createGradleProject(
      gradleFilePath,
      options,
      context
    );
    const { project, parentProject, parentProjectRoot } = targetsCache[hash];
    if (!project) {
      return {};
    }
    return {
      projects: {
        [projectRoot]: project,
        ...(parentProject && parentProjectRoot
          ? { [parentProjectRoot]: parentProject }
          : {}),
      },
    };
  },
];

function createGradleProject(
  gradleFilePath: string,
  options: GradlePluginOptions | undefined,
  context: CreateNodesContext
) {
  try {
    const {
      gradleProjectToTasksTypeMap,
      gradleFileToOutputDirsMap,
      gradleFileToGradleProjectMap,
      gradleProjectToProjectName,
      subProjectToParentProjectMap,
      projectNameToSettingsFileMap,
    } = getGradleReport();

    const gradleProject = gradleFileToGradleProjectMap.get(
      gradleFilePath
    ) as string;
    const projectName = gradleProjectToProjectName.get(gradleProject);
    if (!projectName) {
      return;
    }

    const tasksTypeMap = gradleProjectToTasksTypeMap.get(gradleProject) as Map<
      string,
      string
    >;
    let tasks: GradleTask[] = [];
    for (let [taskName, taskType] of tasksTypeMap?.entries() ?? []) {
      tasks.push({
        type: taskType,
        name: taskName,
      });
    }

    const outputDirs = gradleFileToOutputDirsMap.get(gradleFilePath) as Map<
      string,
      string
    >;

    const { targets, targetGroups } = createGradleTargets(
      tasks,
      options,
      context,
      outputDirs,
      gradleProject
    );
    const project = {
      name: projectName,
      targets,
      metadata: {
        targetGroups,
        technologies: ['gradle'],
      },
    };
    const parentProjectName = subProjectToParentProjectMap.get(projectName);
    let parentProject, parentProjectRoot;
    if (
      parentProjectName &&
      !Array.from(gradleProjectToProjectName.values()).includes(
        parentProjectName
      )
    ) {
      parentProject = {
        name: parentProjectName,
        targets: {},
        metadata: {
          technologies: ['gradle'],
        },
      };
      const settingsFile = projectNameToSettingsFileMap.get(parentProjectName);
      if (settingsFile) {
        parentProjectRoot = dirname(settingsFile);
      }
    }

    return {
      project,
      parentProject,
      parentProjectRoot,
    };
  } catch (e) {
    console.error(e);
    return undefined;
  }
}

function createGradleTargets(
  tasks: GradleTask[],
  options: GradlePluginOptions | undefined,
  context: CreateNodesContext,
  outputDirs: Map<string, string>,
  gradleProject: string
): {
  targetGroups: Record<string, string[]>;
  targets: Record<string, TargetConfiguration>;
} {
  const inputsMap = createInputsMap(context);

  const targets: Record<string, TargetConfiguration> = {};
  const targetGroups: Record<string, string[]> = {};
  for (const task of tasks) {
    const targetName = options?.[`${task.name}TargetName`] ?? task.name;

    const outputs = outputDirs.get(task.name);
    targets[targetName] = {
      command: `${getGradleExecFile()} ${
        gradleProject ? gradleProject + ':' : ''
      }${task.name}`,
      cache: cacheableTaskType.has(task.type),
      inputs: inputsMap[task.name],
      outputs: outputs ? [outputs] : undefined,
      dependsOn: dependsOnMap[task.name],
      metadata: {
        technologies: ['gradle'],
      },
    };
    if (!targetGroups[task.type]) {
      targetGroups[task.type] = [];
    }
    targetGroups[task.type].push(task.name);
  }
  return { targetGroups, targets };
}

function createInputsMap(
  context: CreateNodesContext
): Record<string, TargetConfiguration['inputs']> {
  const namedInputs = context.nxJsonConfiguration.namedInputs;
  return {
    build: namedInputs?.production
      ? ['production', '^production']
      : ['default', '^default'],
    test: ['default', namedInputs?.production ? '^production' : '^default'],
    classes: namedInputs?.production
      ? ['production', '^production']
      : ['default', '^default'],
  };
}
