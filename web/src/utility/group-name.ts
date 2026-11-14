// Gem links, trees and gear sets name the same level range slightly
// differently ("lvl 1-11", "1-11"), so they are matched by this key
export const normalizeGroupName = (name: string) =>
  name.toLowerCase().replace(/lvl|level|\s|:/g, "");
