import { atom, type WritableAtom } from "jotai";
import type { RouteData } from "common";
import { gemProgressFamily } from "./gem-progress";
import { activeEdgeAtom, nextEdgeAtom, routeSelector } from "./route";
import { routeProgressFamily } from "./route-progress";
import { normalizeGroupName } from "../utility/group-name";

export interface Task {
  sectionName: string;
  step: RouteData.FragmentStep | RouteData.GemStep;
  edgeIndex: number | null;
  completed: WritableAtom<boolean, [boolean], void>;
}

export const tasksSelector = atom(async (get) => {
  const route = await get(routeSelector);

  const tasks: Task[] = [];
  route.sections.forEach((section, sectionIndex) => {
    section.steps.forEach((step, stepIndex) => {
      if (step.type === "fragment_step")
        tasks.push({
          sectionName: section.name,
          step,
          edgeIndex: step.edgeIndex,
          completed: routeProgressFamily([sectionIndex, stepIndex].toString()),
        });
      else
        tasks.push({
          sectionName: section.name,
          step,
          edgeIndex: null,
          completed: gemProgressFamily(step.requiredGem.id),
        });
    });
  });

  return tasks;
});

export const completedSelector = atom(async (get) => {
  const tasks = await get(tasksSelector);
  return tasks.map((task) => get(task.completed));
});

// The step that enters the active area is already done, so the current task
// is the first unfinished one after it
export function findCurrentIndex(
  tasks: Task[],
  completed: boolean[],
  activeEdge: number,
) {
  let start = 0;
  if (activeEdge > 0) {
    const arrival = tasks.findIndex(
      (task) => task.edgeIndex !== null && task.edgeIndex >= activeEdge,
    );
    if (arrival >= 0)
      start = tasks[arrival].edgeIndex === activeEdge ? arrival + 1 : arrival;
  }

  for (let i = start; i < tasks.length; i++) {
    if (!completed[i]) return i;
  }

  return tasks.length;
}

export const currentIndexSelector = atom(async (get) => {
  const tasks = await get(tasksSelector);
  const completed = await get(completedSelector);
  return findCurrentIndex(tasks, completed, get(activeEdgeAtom)[0]);
});

// Moves the route to where a level range starts, the first gem step of that
// range in the area it takes place in. Returns the areas moved from and to, or
// null when the range has no step to go to. Steps passed are left as they were.
export const jumpToGroupAtom = atom(
  null,
  async (get, set, groupKey: string) => {
    const tasks = await get(tasksSelector);

    const target = tasks.findIndex(
      (task) =>
        task.step.type === "gem_step" &&
        task.step.requiredGem.note !== undefined &&
        normalizeGroupName(task.step.requiredGem.note) === groupKey,
    );
    if (target < 0) return null;

    let edge: number | null = null;
    for (let i = target; i >= 0 && edge === null; i--) edge = tasks[i].edgeIndex;
    if (edge === null) return null;

    const from = get(activeEdgeAtom)[0];
    if (edge === from) return null;

    set(nextEdgeAtom(edge));
    return { from, to: edge };
  },
);

// Gem and tree groups are titled by level range, which gem steps carry as
// their note, so the next gem step says which group applies right now
export const currentGroupSelector = atom(async (get) => {
  const tasks = await get(tasksSelector);
  const index = await get(currentIndexSelector);

  const noteOf = (task: Task) =>
    task.step.type === "gem_step" ? task.step.requiredGem.note : undefined;

  for (let i = index; i < tasks.length; i++) {
    const note = noteOf(tasks[i]);
    if (note) return note;
  }

  for (let i = Math.min(index, tasks.length) - 1; i >= 0; i--) {
    const note = noteOf(tasks[i]);
    if (note) return note;
  }

  return null;
});
