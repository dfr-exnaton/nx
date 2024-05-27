import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import * as glob from 'glob';

import { normalizePath, workspaceRoot } from '@nx/devkit';

import { execGradle } from './exec-gradle';

export const fileSeparator = process.platform.startsWith('win')
  ? 'file:///'
  : 'file://';

const newLineSeparator = process.platform.startsWith('win') ? '\r\n' : '\n';

export interface GradleReport {
  gradleFileToGradleProjectMap: Map<string, string>;
  buildFileToDepsMap: Map<string, string>;
  gradleFileToOutputDirsMap: Map<string, Map<string, string>>;
  gradleProjectToTasksTypeMap: Map<string, Map<string, string>>;
  gradleProjectToProjectName: Map<string, string>;
  dependenciesMap: Map<string, string>;
  subProjectToParentProjectMap: Map<string, string>;
  projectNames: Set<string>;
  projectNameToSettingsFileMap: Map<string, string>;
}

let gradleReportCache: GradleReport;

export function invalidateGradleReportCache() {
  gradleReportCache = undefined;
}

function initialGradleReport(): GradleReport {
  /**
   * Map of Gradle File path to Gradle Project Name
   */
  const gradleFileToGradleProjectMap = new Map<string, string>();
  /**
   * Map of Gradle Build File to tasks type map
   */
  const gradleProjectToTasksTypeMap = new Map<string, Map<string, string>>();
  const gradleProjectToProjectName = new Map<string, string>();
  /**
   * Map of buildFile to dependencies report path
   */
  const buildFileToDepsMap = new Map<string, string>();
  /**
   * Map fo possible output files of each gradle file
   * e.g. {build.gradle.kts: { projectReportDir: '' testReportDir: '' }}
   */
  const gradleFileToOutputDirsMap = new Map<string, Map<string, string>>();
  /**
   * Map of gradle project to dependencies report path
   */
  const dependenciesMap = new Map<string, string>();
  /**
   * Map of sub project to parent project
   */
  const subProjectToParentProjectMap = new Map<string, string>();
  /**
   * Set of all project names
   */
  const projectNames = new Set<string>();
  /**
   * Map of project name to settings file
   */
  const projectNameToSettingsFileMap = new Map<string, string>();

  return {
    gradleFileToGradleProjectMap,
    dependenciesMap,
    buildFileToDepsMap,
    gradleFileToOutputDirsMap,
    gradleProjectToTasksTypeMap,
    gradleProjectToProjectName,
    subProjectToParentProjectMap,
    projectNames,
    projectNameToSettingsFileMap,
  };
}

export function getGradleReport(): GradleReport {
  if (gradleReportCache) {
    return gradleReportCache;
  }

  const gradleProjectReportStart = performance.mark(
    'gradleProjectReport:start'
  );

  gradleReportCache = initialGradleReport();
  runProjectsForSettingsFiles(gradleReportCache);

  const gradleProjectReportEnd = performance.mark('gradleProjectReport:end');
  performance.measure(
    'gradleProjectReport',
    gradleProjectReportStart.name,
    gradleProjectReportEnd.name
  );
  return gradleReportCache;
}

function runProjectsForSettingsFiles(gradleReport: GradleReport) {
  const settingFiles: string[] = glob.sync('**/settings.{gradle.kts,gradle}');
  settingFiles.forEach((settingFile) => {
    const settingDir = dirname(settingFile);
    try {
      const projectReportLines = execGradle(['projectReport'], {
        cwd: settingDir,
      })
        .toString()
        .split(newLineSeparator);
      processProjectReports(projectReportLines, gradleReport);
    } catch (e) {
      console.error(
        `Error running projectReport for ${settingDir}. Please make sure the projectReport task is available in your build script.`,
        e
      );
    }

    try {
      const projectsLines = execGradle(['projects'], {
        cwd: settingDir,
      })
        .toString()
        .split(newLineSeparator);
      processProjects(projectsLines, settingFile, gradleReport);
    } catch (e) {
      console.error(
        `Error running projects for ${settingDir}. Please make sure the projects task is available in your build script.`,
        e
      );
    }
  });
}

export function processProjectReports(
  projectReportLines: string[],
  {
    dependenciesMap,
    buildFileToDepsMap,
    gradleFileToOutputDirsMap,
    gradleFileToGradleProjectMap,
    gradleProjectToTasksTypeMap,
    gradleProjectToProjectName,
  }: GradleReport
) {
  let index = 0;
  while (index < projectReportLines.length) {
    const line = projectReportLines[index].trim();
    if (line.startsWith('> Task ')) {
      if (line.endsWith(':dependencyReport')) {
        const gradleProject = line.substring(
          '> Task '.length,
          line.length - ':dependencyReport'.length
        );
        while (
          index < projectReportLines.length &&
          !projectReportLines[index].includes(fileSeparator)
        ) {
          index++;
        }
        const [_, file] = projectReportLines[index].split(fileSeparator);
        dependenciesMap.set(gradleProject, file);
      }
      if (line.endsWith('propertyReport')) {
        const gradleProject = line.substring(
          '> Task '.length,
          line.length - ':propertyReport'.length
        );
        while (
          index < projectReportLines.length &&
          !projectReportLines[index].includes(fileSeparator)
        ) {
          index++;
        }
        const [_, file] = projectReportLines[index].split(fileSeparator);
        const propertyReportLines = existsSync(file)
          ? readFileSync(file).toString().split(newLineSeparator)
          : [];

        let projectName: string,
          absBuildFilePath: string,
          absBuildDirPath: string;
        const outputDirMap = new Map<string, string>();
        for (const line of propertyReportLines) {
          if (line.startsWith('name: ')) {
            projectName = line.substring('name: '.length);
          }
          if (line.startsWith('buildFile: ')) {
            absBuildFilePath = line.substring('buildFile: '.length);
          }
          if (line.startsWith('buildDir: ')) {
            absBuildDirPath = line.substring('buildDir: '.length);
          }
          if (line.includes('Dir: ')) {
            const [dirName, dirPath] = line.split(': ');
            const taskName = dirName.replace('Dir', '');
            outputDirMap.set(
              taskName,
              `{workspaceRoot}/${relative(workspaceRoot, dirPath)}`
            );
          }
        }

        if (!projectName || !absBuildFilePath || !absBuildDirPath) {
          continue;
        }
        const buildFile = normalizePath(
          relative(workspaceRoot, absBuildFilePath)
        );
        const buildDir = relative(workspaceRoot, absBuildDirPath);
        buildFileToDepsMap.set(
          buildFile,
          dependenciesMap.get(gradleProject) as string
        );

        outputDirMap.set('build', `{workspaceRoot}/${buildDir}`);
        outputDirMap.set(
          'classes',
          `{workspaceRoot}/${join(buildDir, 'classes')}`
        );

        gradleFileToOutputDirsMap.set(buildFile, outputDirMap);
        gradleFileToGradleProjectMap.set(buildFile, gradleProject);
        gradleProjectToProjectName.set(gradleProject, projectName);
      }
      if (line.endsWith('taskReport')) {
        const gradleProject = line.substring(
          '> Task '.length,
          line.length - ':taskReport'.length
        );
        while (
          index < projectReportLines.length &&
          !projectReportLines[index].includes(fileSeparator)
        ) {
          index++;
        }
        const [_, file] = projectReportLines[index].split(fileSeparator);
        const taskTypeMap = new Map<string, string>();
        const tasksFileLines = existsSync(file)
          ? readFileSync(file).toString().split(newLineSeparator)
          : [];

        let i = 0;
        while (i < tasksFileLines.length) {
          const line = tasksFileLines[i];

          if (line.endsWith('tasks')) {
            const dashes = new Array(line.length + 1).join('-');
            if (tasksFileLines[i + 1] === dashes) {
              const type = line.substring(0, line.length - ' tasks'.length);
              i++;
              while (tasksFileLines[++i] !== '') {
                const [taskName] = tasksFileLines[i].split(' - ');
                taskTypeMap.set(taskName, type);
              }
            }
          }
          i++;
        }
        gradleProjectToTasksTypeMap.set(gradleProject, taskTypeMap);
      }
    }
    index++;
  }
}

export function processProjects(
  projectsLines: string[],
  settingsFile: string,
  {
    subProjectToParentProjectMap,
    projectNameToSettingsFileMap,
    projectNames,
  }: GradleReport
) {
  let projectName: string;
  for (const line of projectsLines) {
    if (line.startsWith('Root project')) {
      projectName = line
        .substring('Root project '.length)
        .replaceAll("'", '')
        .trim();
      projectNames.add(projectName);
      projectNameToSettingsFileMap.set(projectName, settingsFile);
      continue;
    }
    if (projectName) {
      const [indents, dep] = line.split('--- ');
      if (indents === '\\' || indents === '+') {
        let subProject;
        if (dep.startsWith('Included build ')) {
          subProject = dep.substring('Included build '.length);
        } else if (dep.startsWith('Project ')) {
          subProject = dep.substring('Project '.length);
        }
        if (subProject) {
          subProject = subProject
            .replace(/ \(n\)$/, '')
            .replaceAll("'", '')
            .trim();
          subProject = subProject.startsWith(':')
            ? subProject.substring(1)
            : subProject;
          projectNames.add(subProject);
          subProjectToParentProjectMap.set(subProject, projectName);
        }
      }
    }
  }
}
