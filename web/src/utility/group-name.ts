// Gem links, trees and gear sets name the same level range slightly
// differently ("lvl 1-11", "1-11"), so they are matched by this key
export const normalizeGroupName = (name: string) =>
  name.toLowerCase().replace(/lvl|level|\s|:/g, "");

// First level of a range titled like "lvl 1-11", "12-17" or "61 Crit Swap",
// or null for names that don't start with a level, like "Midgame" or "Act 2"
export function groupStartLevel(name: string) {
  const match = /^\s*(?:lvl|level)?\s*(\d{1,3})\b/i.exec(name);
  return match ? Number(match[1]) : null;
}

// The range that applies at a level: the one starting latest without being
// past it. Null when none is level based or the level is below all of them.
export function groupForLevel(
  groups: { key: string; label: string }[],
  level: number,
) {
  let best: string | null = null;
  let bestStart = -1;

  for (const group of groups) {
    const start = groupStartLevel(group.label);
    if (start !== null && start <= level && start >= bestStart) {
      best = group.key;
      bestStart = start;
    }
  }

  return best;
}
