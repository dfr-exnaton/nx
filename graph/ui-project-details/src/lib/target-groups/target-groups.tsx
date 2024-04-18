/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
import { Fragment, useEffect, useState } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { TargetGroup } from '../target-group/target-group';
import { groupTargets } from '../utils/group-targets';
import {
  mapDispatchToProps,
  mapDispatchToPropsType,
  mapStateToProps,
  mapStateToPropsType,
} from './target-groups.state';
import { connect } from 'react-redux';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline';

export type TargetGroupsProps = mapStateToPropsType &
  mapDispatchToPropsType & {
    className?: string;
    project: ProjectGraphProjectNode;
    variant?: 'default' | 'compact';
  };

export function TargetGroupsComponent({
  className,
  project,
  variant,
  selectedTargetGroup,
  selectTargetGroup,
}: TargetGroupsProps) {
  const [targetGroups, setTargetGroups] = useState<Record<string, string[]>>(
    {}
  );
  const isCompact = variant === 'compact';

  useEffect(() => {
    const groups = groupTargets(project);
    setTargetGroups(groups);
  }, [project]);

  if (!targetGroups || !Object.keys(targetGroups).length) {
    return null;
  }

  return (
    <>
      <div className="z-10 block w-full md:hidden">
        <TargetGroupsInSelectBox
          targetGroupNames={Object.keys(targetGroups)}
          selectTargetGroup={selectTargetGroup}
          selectedTargetGroup={selectedTargetGroup}
        />
      </div>
      <ul
        className={`hidden divide-y divide-slate-200 rounded-md border border-slate-200 dark:divide-slate-700/60 dark:border-slate-700/60 md:block ${className}`}
      >
        {Object.keys(targetGroups).map((targetGroup) => {
          return (
            <TargetGroup
              key={targetGroup}
              name={targetGroup}
              isCompact={isCompact}
              selected={selectedTargetGroup === targetGroup}
              onClick={() => selectTargetGroup(targetGroup)}
              technologies={project.data.metadata?.technologies}
            />
          );
        })}
      </ul>
    </>
  );
}

// example from https://headlessui.com/react/listbox
export function TargetGroupsInSelectBox({
  targetGroupNames,
  selectedTargetGroup,
  selectTargetGroup,
}: {
  targetGroupNames: string[];
  selectedTargetGroup: string;
  selectTargetGroup: (name: string) => void;
}) {
  return (
    <Listbox value={selectedTargetGroup} onChange={selectTargetGroup}>
      <div className="relative rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-800">
        <Listbox.Button className="relative w-full cursor-default rounded-lg py-2 pl-3 pr-10 text-left font-medium text-slate-600 shadow-sm dark:text-slate-300">
          <span className="block truncate">{selectedTargetGroup}</span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronUpDownIcon className="h-5 w-5" aria-hidden="true" />
          </span>
        </Listbox.Button>
        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base text-slate-500 shadow-lg dark:bg-slate-900 dark:text-slate-400">
            {targetGroupNames.map((targetGroupName, index) => (
              <Listbox.Option
                key={index}
                className={({ active }) =>
                  `relative cursor-default select-none py-2 pl-10 pr-4 ${
                    active
                      ? 'bg-slate-50 dark:border-slate-700/60 dark:border-slate-300/10 dark:bg-slate-800'
                      : 'text-slate-500 dark:text-slate-400 '
                  }`
                }
                value={targetGroupName}
              >
                {({ selected }) => (
                  <>
                    <span
                      className={`block truncate ${
                        selected ? 'font-medium' : 'font-normal'
                      }`}
                    >
                      {targetGroupName}
                    </span>
                    {selected ? (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <CheckIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
}

export const TargetGroups = connect(
  mapStateToProps,
  mapDispatchToProps
)(TargetGroupsComponent);
export default TargetGroups;