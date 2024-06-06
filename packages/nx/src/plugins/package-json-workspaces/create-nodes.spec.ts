import * as memfs from 'memfs';

import '../../internal-testing-utils/mock-fs';
import { createNodeFromPackageJson } from './create-nodes';

describe('nx package.json workspaces plugin', () => {
  it('should build projects from package.json files', () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'root',
          scripts: { echo: 'echo root project' },
        }),
        'packages/lib-a/package.json': JSON.stringify({
          name: 'lib-a',
          scripts: { test: 'jest' },
        }),
        'packages/lib-b/package.json': JSON.stringify({
          name: 'lib-b',
          scripts: {
            build: 'tsc',
            test: 'jest',
            nonNxOperation: 'rm -rf .',
          },
          nx: {
            implicitDependencies: ['lib-a'],
            includedScripts: ['build', 'test'],
            targets: {
              build: {
                outputs: ['{projectRoot}/dist'],
              },
            },
          },
        }),
      },
      '/root'
    );

    expect(createNodeFromPackageJson('package.json', '/root'))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "metadata": {
              "targetGroups": {
                "NPM Scripts": [
                  "echo",
                ],
              },
            },
            "name": "root",
            "root": ".",
            "sourceRoot": ".",
            "targets": {
              "echo": {
                "executor": "nx:run-script",
                "metadata": {
                  "runCommand": "npm run echo",
                  "scriptContent": "echo root project",
                },
                "options": {
                  "script": "echo",
                },
              },
              "nx-release-publish": {
                "dependsOn": [
                  "^nx-release-publish",
                ],
                "executor": "@nx/js:release-publish",
                "options": {},
              },
            },
          },
        },
      }
    `);
    expect(createNodeFromPackageJson('packages/lib-a/package.json', '/root'))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          "packages/lib-a": {
            "metadata": {
              "targetGroups": {
                "NPM Scripts": [
                  "test",
                ],
              },
            },
            "name": "lib-a",
            "root": "packages/lib-a",
            "sourceRoot": "packages/lib-a",
            "targets": {
              "nx-release-publish": {
                "dependsOn": [
                  "^nx-release-publish",
                ],
                "executor": "@nx/js:release-publish",
                "options": {},
              },
              "test": {
                "executor": "nx:run-script",
                "metadata": {
                  "runCommand": "npm run test",
                  "scriptContent": "jest",
                },
                "options": {
                  "script": "test",
                },
              },
            },
          },
        },
      }
    `);
    expect(createNodeFromPackageJson('packages/lib-b/package.json', '/root'))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          "packages/lib-b": {
            "implicitDependencies": [
              "lib-a",
            ],
            "includedScripts": [
              "build",
              "test",
            ],
            "metadata": {
              "targetGroups": {
                "NPM Scripts": [
                  "build",
                  "test",
                ],
              },
            },
            "name": "lib-b",
            "root": "packages/lib-b",
            "sourceRoot": "packages/lib-b",
            "targets": {
              "build": {
                "executor": "nx:run-script",
                "metadata": {
                  "runCommand": "npm run build",
                  "scriptContent": "tsc",
                },
                "options": {
                  "script": "build",
                },
                "outputs": [
                  "{projectRoot}/dist",
                ],
              },
              "nx-release-publish": {
                "dependsOn": [
                  "^nx-release-publish",
                ],
                "executor": "@nx/js:release-publish",
                "options": {},
              },
              "test": {
                "executor": "nx:run-script",
                "metadata": {
                  "runCommand": "npm run test",
                  "scriptContent": "jest",
                },
                "options": {
                  "script": "test",
                },
              },
            },
          },
        },
      }
    `);
  });

  it('should infer library and application project types from appsDir and libsDir', () => {
    memfs.vol.fromJSON(
      {
        'nx.json': JSON.stringify({
          workspaceLayout: {
            appsDir: 'apps',
            libsDir: 'packages',
          },
        }),
        'apps/myapp/package.json': JSON.stringify({
          name: 'myapp',
          scripts: { test: 'jest' },
        }),
        'packages/mylib/package.json': JSON.stringify({
          name: 'mylib',
          scripts: { test: 'jest' },
        }),
      },
      '/root'
    );

    expect(
      createNodeFromPackageJson('apps/myapp/package.json', '/root').projects[
        'apps/myapp'
      ].projectType
    ).toEqual('application');

    expect(
      createNodeFromPackageJson('packages/mylib/package.json', '/root')
        .projects['packages/mylib'].projectType
    ).toEqual('library');
  });

  it('should infer library types for root library project if both appsDir and libsDir are set to empty string', () => {
    memfs.vol.fromJSON(
      {
        'nx.json': JSON.stringify({
          workspaceLayout: {
            appsDir: '',
            libsDir: '',
          },
        }),
        'package.json': JSON.stringify({
          name: 'mylib',
          scripts: { test: 'jest' },
        }),
      },
      '/root'
    );

    expect(
      createNodeFromPackageJson('package.json', '/root').projects['.']
        .projectType
    ).toEqual('library');
  });

  it('should infer library project type if only libsDir is set', () => {
    memfs.vol.fromJSON(
      {
        'nx.json': JSON.stringify({
          workspaceLayout: {
            libsDir: 'packages',
          },
        }),
        'packages/mylib/package.json': JSON.stringify({
          name: 'mylib',
          scripts: { test: 'jest' },
        }),
      },
      '/root'
    );

    expect(
      createNodeFromPackageJson('packages/mylib/package.json', '/root')
        .projects['packages/mylib'].projectType
    ).toEqual('library');
  });

  it('should infer library project type if only libsDir is set', () => {
    memfs.vol.fromJSON(
      {
        'nx.json': JSON.stringify({
          workspaceLayout: {
            libsDir: 'packages',
          },
        }),
        'example/package.json': JSON.stringify({
          name: 'example',
          scripts: { test: 'jest' },
        }),
        'packages/mylib/package.json': JSON.stringify({
          name: 'mylib',
          scripts: { test: 'jest' },
        }),
      },
      '/root'
    );

    expect(
      createNodeFromPackageJson('packages/mylib/package.json', '/root')
        .projects['packages/mylib'].projectType
    ).toEqual('library');
    expect(
      createNodeFromPackageJson('example/package.json', '/root').projects[
        'example'
      ].projectType
    ).toBeUndefined();
  });
});
