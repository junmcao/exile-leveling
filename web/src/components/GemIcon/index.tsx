import styles from "./styles.module.css";
import classNames from "classnames";
import { Data } from "common";
import { useEffect, useState } from "react";
import { MdCircle } from "react-icons/md";

type Gem = (typeof Data.Gems)[string];

// Maps gem id to icon file, produced by tools/seed-gem-icons.mjs
let manifestPromise: Promise<Record<string, string>> | undefined;
function loadManifest() {
  manifestPromise ??= fetch(`${import.meta.env.BASE_URL}gem-icons/index.json`)
    .then((response) => (response.ok ? response.json() : {}))
    .catch(() => ({}));

  return manifestPromise;
}

interface GemIconProps {
  gem: Gem;
  // Any CSS length, defaults to a bit larger than the text
  size?: string;
}

export function GemIcon({ gem, size }: GemIconProps) {
  const [manifest, setManifest] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadManifest().then((value) => {
      if (!cancelled) setManifest(value);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const style = size ? { width: size, height: size } : undefined;

  // Keeps the row from shifting once the manifest arrives
  if (manifest === null)
    return <span className={classNames(styles.icon)} style={style} />;

  const file = manifest[gem.id];
  if (file === undefined)
    return (
      <span className={classNames(styles.icon)} style={style}>
        <MdCircle
          color={Data.GemColours[gem.primary_attribute]}
          className={classNames(styles.dot)}
        />
      </span>
    );

  return (
    <img
      className={classNames(styles.icon)}
      style={style}
      src={`${import.meta.env.BASE_URL}gem-icons/${file}`}
      alt=""
      width={78}
      height={78}
      loading="lazy"
      draggable={false}
    />
  );
}
