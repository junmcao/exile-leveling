import { atom, type Setter } from "jotai";
import { buildDataSelector } from "./build-data";
import { configSelector } from "./config";
import { requiredGemsSelector } from "./gem";
import { routeFilesSelector } from "./route-files";
import { routeProgressFamily } from "./route-progress";
import type { RouteData } from "common";
import { persistentAtom, transientAtomFamily } from ".";
import { RESET } from "jotai/utils";
import { atomEffect, observe } from "jotai-effect";

const baseRouteSelector = atom(async (get) => {
  const { initializeRouteState, parseRoute } = await import("common");

  const routeFiles = await get(routeFilesSelector);
  const buildData = await get(buildDataSelector);

  const routeState = initializeRouteState();

  if (buildData == null || buildData.leagueStart)
    routeState.preprocessorDefinitions.add("LEAGUE_START");

  if (buildData == null || buildData.library)
    routeState.preprocessorDefinitions.add("LIBRARY");

  const bandit = buildData?.bandit || "None";
  switch (bandit) {
    case "None":
      routeState.preprocessorDefinitions.add("BANDIT_KILL");
      break;
    case "Oak":
      routeState.preprocessorDefinitions.add("BANDIT_OAK");
      break;
    case "Kraityn":
      routeState.preprocessorDefinitions.add("BANDIT_KRAITYN");
      break;
    case "Alira":
      routeState.preprocessorDefinitions.add("BANDIT_ALIRA");
      break;
  }

  return parseRoute(routeFiles, routeState);
});

export const routeSelector = atom(async (get) => {
  const { buildGemSteps, findCharacterGems, Data } = await import("common");

  const baseRoute = await get(baseRouteSelector);
  const buildData = get(buildDataSelector);
  const settings = get(configSelector);
  const requiredGems = get(requiredGemsSelector);

  if (requiredGems.length == 0) return baseRoute;

  const route: RouteData.Route = { sections: [], edges: baseRoute.edges };
  const questGems: Set<number> = new Set();
  const vendorGems: Set<number> = new Set();

  findCharacterGems(buildData, requiredGems, questGems);

  for (const baseSection of baseRoute.sections) {
    const section: RouteData.Section = {
      name: baseSection.name,
      steps: [],
    };

    for (const baseStep of baseSection.steps) {
      const gemSteps: RouteData.GemStep[] = [];
      if (baseStep.type != "fragment_step") continue;

      for (const part of baseStep.parts) {
        if (typeof part !== "string" && part.type === "quest") {
          gemSteps.push(
            ...buildGemSteps(
              part,
              buildData,
              requiredGems,
              questGems,
              vendorGems,
            ),
          );
        }
      }

      const skipStep = settings.gemsOnly && gemSteps.length === 0;
      if (!skipStep) {
        const searchString = gemSteps
          .map((x) => Data.Gems[x.requiredGem.id].name)
          .join("|");

        let step;
        if (searchString !== "") {
          step = structuredClone(baseStep);
          step.parts.push({
            type: "copy",
            text: `"${searchString}"`,
            side: "tail",
          });
        } else {
          step = baseStep;
        }

        section.steps.push(step, ...gemSteps);
      }
    }

    if (section.steps.length > 0) route.sections.push(section);
  }

  return route;
});

const ACTIVE_EDGE_VERSION = 0;
const activeEdgeIndex = persistentAtom("active-edge", [0], ACTIVE_EDGE_VERSION);

export function edgeId(edgeIndex: number) {
  return `edge-${edgeIndex}`;
}

// How many edges ahead a log message may jump, e.g. when an area was skipped
const RESYNC_WINDOW = 3;

function findEdgeAhead(
  edges: RouteData.Route["edges"],
  current: number,
  areaId: string,
) {
  const last = Math.min(current + RESYNC_WINDOW, edges.length - 1);
  for (let i = current + 1; i <= last; i++) {
    if (edges[i] === areaId) return i;
  }

  return null;
}

// Marks the fragment steps that lead from edge `fromEdge` up to and including
// the step that enters edge `toEdge`
function completeStepsBetween(
  route: RouteData.Route,
  fromEdge: number,
  toEdge: number,
  set: Setter,
) {
  let inRange = false;
  for (let sectionIndex = 0; sectionIndex < route.sections.length; sectionIndex++) {
    const steps = route.sections[sectionIndex].steps;
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const step = steps[stepIndex];
      if (step.type !== "fragment_step") continue;

      if (step.edgeIndex !== null) {
        if (step.edgeIndex > toEdge) return;
        if (step.edgeIndex >= fromEdge) inRange = true;
      }

      if (inRange)
        set(routeProgressFamily([sectionIndex, stepIndex].toString()), true);

      if (step.edgeIndex === toEdge) return;
    }
  }
}

export const activeEdgeAtom = atom(
  (get) => get(activeEdgeIndex),
  async (get, set, value: string | typeof RESET) => {
    if (value === RESET) {
      set(activeEdgeIndex, RESET);
      return;
    }

    const matches = /Generating level \d+ area "(.*?)"/.exec(value);
    if (matches === null) return;

    const route = await get(routeSelector);
    const currentEdgeIndex = get(activeEdgeIndex)[0];
    const targetEdgeIndex = findEdgeAhead(
      route.edges,
      currentEdgeIndex,
      matches[1],
    );
    if (targetEdgeIndex === null) return;

    // Only an exact next area is trusted enough to check steps off, a skip
    // could also be an unplanned town portal
    if (targetEdgeIndex === currentEdgeIndex + 1)
      completeStepsBetween(route, currentEdgeIndex, targetEdgeIndex, set);

    set(activeEdgeIndex, [targetEdgeIndex]);
  },
);

export const nextEdgeAtom = transientAtomFamily((param: number | null) => {
  if (param === null) return atom(null, () => {});
  return atom(
    (get) => get(activeEdgeAtom)[0] + 1 == param,
    (_get, set) => {
      set(activeEdgeIndex, [param]);
    },
  );
});

const scrollBehaviour = atom<ScrollBehavior | null>("instant");
export const scrollToActiveEdgeEffect = atomEffect((get, set) => {
  const behavior = get(scrollBehaviour);
  if (behavior === null) {
    return;
  }

  const edgeIndex = get.peek(activeEdgeIndex);
  const element = document.getElementById(edgeId(edgeIndex[0]));

  if (element) {
    requestAnimationFrame(() => {
      element.scrollIntoView({
        behavior: behavior,
        block: "start",
        inline: "nearest",
      });
    });

    set(scrollBehaviour, null);
  }
});

observe((get, set) => {
  const behavior = get(activeEdgeIndex)[0] === 0 ? "instant" : "smooth";
  set(scrollBehaviour, (prev) => prev ?? behavior);
});
