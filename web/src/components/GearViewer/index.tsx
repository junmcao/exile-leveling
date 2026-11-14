import styles from "./styles.module.css";
import classNames from "classnames";
import { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import type { GearItem, GearSet } from "../../state/pob/gear";

interface GearViewerProps {
  gearSets: GearSet[];
  // Which of the sets to show
  index: number;
}

export function GearViewer({ gearSets, index }: GearViewerProps) {
  const gearSet = gearSets[index];

  if (gearSet === undefined || gearSet.items.length === 0)
    return (
      <p className={classNames(styles.empty)}>
        No gear saved for this level range.
      </p>
    );

  return (
    <ul className={classNames(styles.list)}>
      {gearSet.items.map((item) => (
        <GearRow key={item.slot} item={item} />
      ))}
    </ul>
  );
}

function GearRow({ item }: { item: GearItem }) {
  const [open, setOpen] = useState(false);

  const hasDetails =
    item.sockets !== undefined || item.implicits.length + item.mods.length > 0;

  return (
    <li className={classNames(styles.item)}>
      <button
        className={classNames(styles.row)}
        aria-expanded={hasDetails ? open : undefined}
        disabled={!hasDetails}
        onClick={() => setOpen(!open)}
      >
        <span className={classNames(styles.slot)}>{item.slot}</span>
        <span className={classNames(styles.title)}>
          <span
            className={classNames(
              styles.name,
              styles[item.rarity.toLowerCase()],
            )}
          >
            {item.name}
          </span>
          {item.base && (
            <span className={classNames(styles.base)}>{item.base}</span>
          )}
        </span>
        {hasDetails && (open ? <FiChevronUp /> : <FiChevronDown />)}
      </button>
      {open && (
        <div className={classNames(styles.details)}>
          {item.sockets && (
            <span className={classNames(styles.sockets)}>
              Sockets {item.sockets}
            </span>
          )}
          {item.implicits.map((mod, i) => (
            <span key={`i${i}`} className={classNames(styles.implicit)}>
              {mod}
            </span>
          ))}
          {item.mods.map((mod, i) => (
            <span key={`m${i}`}>{mod}</span>
          ))}
        </div>
      )}
    </li>
  );
}
