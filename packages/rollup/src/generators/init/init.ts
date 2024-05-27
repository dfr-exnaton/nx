import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  GeneratorCallback,
  Tree,
} from '@nx/devkit';
import { nxVersion, rollupVersion } from '../../utils/versions';
import { Schema } from './schema';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { createNodes } from '../../plugins/plugin';

export async function rollupInitGenerator(tree: Tree, schema: Schema) {
  let task: GeneratorCallback = () => {};
  schema.addPlugin ??= process.env.NX_ADD_PLUGINS !== 'false';

  if (!schema.skipPackageJson) {
    const devDependencies = { '@nx/rollup': nxVersion };
    if (schema.addPlugin) {
      // Ensure user can run Rollup CLI.
      devDependencies['rollup'] = rollupVersion;
    }
    task = addDependenciesToPackageJson(
      tree,
      {},
      devDependencies,
      undefined,
      schema.keepExistingVersions
    );
  }

  if (schema.addPlugin) {
    await addPlugin(
      tree,
      await createProjectGraphAsync(),
      '@nx/rollup/plugin',
      createNodes,
      {
        buildTargetName: ['build', 'rollup:build', 'rollup-build'],
      },
      schema.updatePackageScripts
    );
  }

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return task;
}

export default rollupInitGenerator;
