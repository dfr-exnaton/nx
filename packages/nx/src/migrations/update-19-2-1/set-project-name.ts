import { toProjectName } from '../../config/to-project-name';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { Tree } from '../../generators/tree';
import { readJson, writeJson } from '../../generators/utils/json';
import { getProjects } from '../../generators/utils/project-configuration';

export default function setProjectName(tree: Tree) {
  // We are explicitly looking for project.json files here, so getProjects is fine.
  const projects = getProjects(tree);

  for (const { root } of projects.values()) {
    if (!tree.exists(`${root}/project.json`)) {
      continue;
    }
    const projectJson: ProjectConfiguration = readJson(
      tree,
      `${root}/project.json`
    );
    // In Nx 19.1+, the way the project name is inferred is different.
    // For existing projects, if the name is not set, we can inline it
    // based on the existing logic. This makes sure folks aren't caught
    // off guard by the new behavior.
    if (!projectJson.name) {
      projectJson.name = toProjectName(root);
      writeJson(tree, `${root}/project.json`, projectJson);
    }
  }
}
