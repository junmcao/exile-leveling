import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { gemLinksSelector } from "../../state/gem-links";
import { currentGroupSelector, jumpToGroupAtom } from "../../state/progress";
import { activeEdgeAtom, nextEdgeAtom } from "../../state/route";
import { searchStringsSelector } from "../../state/search-strings";
import { sidebarAtom, type SidebarTab } from "../../state/sidebar";
import { urlTreesSelector, type UrlTree } from "../../state/tree/url-tree";
import { normalizeGroupName } from "../../utility/group-name";
import { gearSetsSelector, type GearSet } from "../../state/pob/gear";
import { GearViewer } from "../GearViewer";
import { GemLinkViewer } from "../GemLinkViewer";
import { SearchStrings } from "../SearchStrings";
import { SkillTreeViewer } from "../SkillTreeViewer";
import styles from "./styles.module.css";
import classNames from "classnames";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "react-toastify";
import { FaLink, FaShieldAlt } from "react-icons/fa";
import { FiChevronLeft, FiChevronRight, FiSearch, FiX } from "react-icons/fi";
import { TbHierarchy, TbLayoutSidebarRight } from "react-icons/tb";
import { useNavigate } from "react-router-dom";

interface Group {
  key: string;
  label: string;
}

interface Section {
  key: SidebarTab;
  label: string;
  icon: ReactNode;
  // Whether the content follows the selected level range
  grouped: boolean;
  content: ReactNode;
}

// Gems, trees and anything else saved per level range share one list of groups
function findGroups(
  gemLinks: { title: string }[],
  urlTrees: UrlTree.Data[],
  gearSets: GearSet[],
): Group[] {
  const groups: Group[] = [];
  const add = (label: string) => {
    const key = normalizeGroupName(label);
    if (!groups.some((x) => x.key === key)) groups.push({ key, label });
  };

  gemLinks.forEach((x) => add(x.title));
  urlTrees.forEach((x) => add(x.name));
  gearSets.forEach((x) => add(x.title));

  return groups;
}

// A range without its own tree or gear set keeps the one from the closest range before it
function findNearestIndex(
  names: string[],
  groups: Group[],
  groupKey: string | null,
) {
  const position = groups.findIndex((x) => x.key === groupKey);

  let best = 0;
  let bestPosition = -1;
  names.forEach((name, i) => {
    const namePosition = groups.findIndex(
      (x) => x.key === normalizeGroupName(name),
    );
    if (namePosition <= position && namePosition > bestPosition) {
      best = i;
      bestPosition = namePosition;
    }
  });

  return best;
}

export function Sidebar() {
  const [{ open, tab }, setSidebar] = useAtom(sidebarAtom);
  const searchStrings = useAtomValue(searchStringsSelector);
  const urlTrees = useAtomValue(urlTreesSelector);
  const gemLinks = useAtomValue(gemLinksSelector);
  const currentGroup = useAtomValue(currentGroupSelector);
  const navigate = useNavigate();

  const gearSets = useAtomValue(gearSetsSelector);

  const groups = useMemo(
    () => findGroups(gemLinks, urlTrees, gearSets),
    [gemLinks, urlTrees, gearSets],
  );

  // Follows the route by default, a pick holds until the route moves on
  const currentKey = currentGroup ? normalizeGroupName(currentGroup) : null;
  const activeEdge = useAtomValue(activeEdgeAtom)[0];
  const [pinned, setPinned] = useState<{ key: string; edge: number } | null>(
    null,
  );
  const pickedKey =
    pinned !== null && pinned.edge === activeEdge ? pinned.key : null;

  // Picking a range also moves the route there, which can be undone
  const jumpToGroup = useSetAtom(jumpToGroupAtom);
  const goBackTo = useAtomCallback(
    useCallback((_get, set, edge: number) => {
      set(nextEdgeAtom(edge));
    }, []),
  );
  async function onPickGroup(group: Group) {
    const moved = await jumpToGroup(group.key);

    // The pick holds until the route moves to another area
    setPinned({ key: group.key, edge: moved ? moved.to : activeEdge });
    if (moved === null) return;

    toast(
      ({ closeToast }) => (
        <span>
          Moved to {group.label}{" "}
          <button
            className={styles.undo}
            onClick={() => {
              goBackTo(moved.from);
              closeToast();
            }}
          >
            Undo
          </button>
        </span>
      ),
      { autoClose: 6000 },
    );
  }

  const activeKey =
    pickedKey ??
    (groups.some((x) => x.key === currentKey) ? currentKey : null) ??
    groups[0]?.key ??
    null;

  const activeIndex = groups.findIndex((x) => x.key === activeKey);

  const sections = useMemo(() => {
    const sections: Section[] = [];

    if (urlTrees.length > 0) {
      sections.push({
        key: "tree",
        label: "Tree",
        icon: <TbHierarchy aria-hidden />,
        grouped: true,
        content: (
          <SkillTreeViewer
            urlTrees={urlTrees}
            index={findNearestIndex(
              urlTrees.map((x) => x.name),
              groups,
              activeKey,
            )}
          />
        ),
      });
    }

    if (gearSets.some((x) => x.items.length > 0)) {
      sections.push({
        key: "gear",
        label: "Gear",
        icon: <FaShieldAlt aria-hidden />,
        grouped: true,
        content: (
          <GearViewer
            gearSets={gearSets}
            index={findNearestIndex(
              gearSets.map((x) => x.title),
              groups,
              activeKey,
            )}
          />
        ),
      });
    }

    if (gemLinks.length > 0) {
      sections.push({
        key: "gems",
        label: "Gems",
        icon: <FaLink aria-hidden />,
        grouped: true,
        content: <GemLinkViewer gemLinks={gemLinks} groupKey={activeKey} />,
      });
    }

    if (searchStrings !== null && searchStrings.length > 0) {
      sections.push({
        key: "search",
        label: "Search",
        icon: <FiSearch aria-hidden />,
        grouped: false,
        content: <SearchStrings values={searchStrings} />,
      });
    }

    return sections;
  }, [urlTrees, gemLinks, gearSets, searchStrings, groups, activeKey]);

  // The page leaves room for the panel while it is open
  useEffect(() => {
    document.documentElement.dataset.sidebar = open ? "open" : "closed";
    return () => {
      delete document.documentElement.dataset.sidebar;
    };
  }, [open]);

  if (!open) {
    return (
      <button
        className={styles.launcher}
        aria-label="Open build guide"
        onClick={() => setSidebar({ open: true, tab })}
      >
        <TbLayoutSidebarRight aria-hidden />
        Guide
      </button>
    );
  }

  const active = sections.find((x) => x.key === tab) ?? sections[0];

  return (
    <aside className={styles.panel} aria-label="Build guide">
      <div className={styles.header}>
        <div className={styles.tabs} role="tablist">
          {sections.map((section) => (
            <button
              key={section.key}
              role="tab"
              aria-selected={section === active}
              className={classNames(styles.tab, {
                [styles.active]: section === active,
              })}
              onClick={() => setSidebar({ open: true, tab: section.key })}
            >
              {section.icon}
              {section.label}
            </button>
          ))}
        </div>
        <button
          className={styles.close}
          aria-label="Close build guide"
          onClick={() => setSidebar({ open: false, tab })}
        >
          <FiX />
        </button>
      </div>
      {active?.grouped && groups.length > 1 && (
        <div className={styles.groups} role="group" aria-label="Level range">
          <button
            className={styles.step}
            aria-label="Previous level range"
            disabled={activeIndex <= 0}
            onClick={() => onPickGroup(groups[activeIndex - 1])}
          >
            <FiChevronLeft />
          </button>
          <select
            className={styles.select}
            aria-label="Level range"
            value={activeKey ?? ""}
            onChange={(e) =>
              onPickGroup(groups.find((x) => x.key === e.target.value)!)
            }
          >
            {groups.map((group) => (
              <option key={group.key} value={group.key}>
                {group.label}
                {group.key === currentKey ? " (current)" : ""}
              </option>
            ))}
          </select>
          <button
            className={styles.step}
            aria-label="Next level range"
            disabled={activeIndex >= groups.length - 1}
            onClick={() => onPickGroup(groups[activeIndex + 1])}
          >
            <FiChevronRight />
          </button>
          {pickedKey !== null && currentKey !== null && pickedKey !== currentKey && (
            <button className={styles.current} onClick={() => setPinned(null)}>
              Current
            </button>
          )}
        </div>
      )}
      <div className={styles.body}>
        {active ? (
          active.content
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No build imported yet</p>
            <p className={styles.emptyHint}>
              Import a Path of Building code to see your gems, passive tree and
              search strings here.
            </p>
            <button className={styles.action} onClick={() => navigate("/build")}>
              Import a build
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
