import { atom, type Getter, type WritableAtom } from "jotai";
import { Data, type RouteData } from "common";
import { gemProgressFamily } from "./gem-progress";
import { activeEdgeAtom, nextEdgeAtom, routeSelector } from "./route";
import { routeProgressFamily } from "./route-progress";
import { groupStartLevel, normalizeGroupName } from "../utility/group-name";

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

// The first area outside of town that is at or above a level, which is roughly
// where a character of that level is
async function findEdgeForLevel(get: Getter, level: number | null) {
  if (level === null) return null;

  const { edges } = await get(routeSelector);
  const edge = edges.findIndex((areaId) => {
    const area = Data.Areas[areaId];
    return area !== undefined && !area.is_town_area && area.level >= level;
  });

  return edge >= 0 ? edge : null;
}

// The level of the area you are in, or of the last one outside of town while
// you are in town. Null when the route has no area levels to go by.
export const currentAreaLevelSelector = atom(async (get) => {
  const { edges } = await get(routeSelector);

  for (let i = Math.min(get(activeEdgeAtom)[0], edges.length - 1); i >= 0; i--) {
    const area = Data.Areas[edges[i]];
    if (area !== undefined && !area.is_town_area) return area.level;
  }

  return null;
});

// Moves the route to where a level range starts: where a character of its
// starting level would be, or for ranges that aren't level based the area of
// their first gem. Returns the areas moved from and to, or null when there is
// nowhere to go. Steps passed are left as they were.
export const jumpToGroupAtom = atom(
  null,
  async (get, set, group: { key: string; label: string }) => {
    let edge = await findEdgeForLevel(get, groupStartLevel(group.label));

    // Ranges that aren't level based go to where their first gem is available
    if (edge === null) {
      const tasks = await get(tasksSelector);

      const target = tasks.findIndex(
        (task) =>
          task.step.type === "gem_step" &&
          task.step.requiredGem.note !== undefined &&
          normalizeGroupName(task.step.requiredGem.note) === group.key,
      );
      if (target < 0) return null;

      for (let i = target; i >= 0 && edge === null; i--)
        edge = tasks[i].edgeIndex;
      if (edge === null) return null;
    }

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
