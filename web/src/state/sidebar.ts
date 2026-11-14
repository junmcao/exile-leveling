import { persistentAtom } from ".";

export type SidebarTab = "tree" | "gems" | "gear" | "search";

export interface SidebarState {
  open: boolean;
  tab: SidebarTab;
}

const SIDEBAR_VERSION = 0;

export const sidebarAtom = persistentAtom<SidebarState>(
  "sidebar",
  { open: false, tab: "gems" },
  SIDEBAR_VERSION,
);
