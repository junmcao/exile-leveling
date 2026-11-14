import { GemIcon } from "../GemIcon";
import styles from "./styles.module.css";
import classNames from "classnames";
import { Data, type RouteData } from "common";
import { useAtomValue } from "jotai";
import { FaCheck } from "react-icons/fa";
import { gemProgressFamily } from "../../state/gem-progress";
import { normalizeGroupName } from "../../utility/group-name";

interface GemLinkViewerProps {
  gemLinks: RouteData.GemLinkGroup[];
  // Normalized name of the group to show
  groupKey: string | null;
}

export function GemLinkViewer({ gemLinks, groupKey }: GemLinkViewerProps) {
  const activeGemLinks = gemLinks.filter(
    (link) => normalizeGroupName(link.title) === groupKey,
  );

  if (activeGemLinks.length === 0)
    return (
      <p className={classNames(styles.empty)}>
        No gem links saved for this level range.
      </p>
    );

  return (
    <div className={classNames(styles.cards)}>
      {activeGemLinks.map(({ primaryGems, secondaryGems }, i) => (
        <div key={i} className={classNames(styles.card)}>
          {primaryGems.map((gem) => (
            <GemRow key={gem.id} gemLink={gem} isPrimary />
          ))}
          {secondaryGems.length > 0 && (
            <div className={classNames(styles.supports)}>
              {secondaryGems.map((gem) => (
                <GemRow key={gem.id} gemLink={gem} isPrimary={false} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Where the gem comes from, so it doesn't need a hover to find out
function sourceText(gemLink: RouteData.GemLink) {
  const [first, ...others] = gemLink.quests;
  if (first === undefined) return null;

  const gem = Data.Gems[gemLink.id];
  const quest = Data.Quests[first.questId];
  const npc = quest.reward_offers[first.rewardOfferId]?.vendor[gem.id]?.npc;

  const parts = [`Act ${quest.act}`, quest.name];
  if (npc) parts.push(npc);

  const text = parts.join(" · ");
  return others.length > 0 ? `${text} (+${others.length} more)` : text;
}

function GemRow({
  gemLink,
  isPrimary,
}: {
  gemLink: RouteData.GemLink;
  isPrimary: boolean;
}) {
  const gem = Data.Gems[gemLink.id];
  const taken = useAtomValue(gemProgressFamily(gemLink.id));
  const source = sourceText(gemLink);

  return (
    <div className={classNames(styles.gem, { [styles.taken]: taken })}>
      <GemIcon gem={gem} size={isPrimary ? "2.25em" : "1.75em"} />
      <div className={classNames(styles.gemText)}>
        <span
          className={classNames(
            isPrimary ? styles.gemPrimary : styles.gemSecondary,
          )}
        >
          {gem.name}
          {taken && <FaCheck className={classNames(styles.check)} aria-label="Taken" />}
        </span>
        {source && <span className={classNames(styles.source)}>{source}</span>}
      </div>
    </div>
  );
}
