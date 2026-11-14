import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import {
  chooseLogFileAtom,
  companionConnectedAtom,
  disconnectLogAtom,
  isLogReadingSupported,
  logStatusAtom,
  reconnectLogAtom,
} from "../../state/game-log";
import { CopyToClipboard } from "../CopyToClipboard";
import { Modal } from "../Modal";
import styles from "./styles.module.css";
import classNames from "classnames";
import { toast } from "react-toastify";

const COMPANION_URL = "https://github.com/HeartofPhos/exile-log-api/releases";
const LINK_COMMAND =
  'mklink /H "C:\\Users\\Public\\Client.txt" "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile\\logs\\Client.txt"';

export function AutoProgressChip() {
  const status = useAtomValue(logStatusAtom);
  const companionConnected = useAtomValue(companionConnectedAtom);
  const chooseFile = useSetAtom(chooseLogFileAtom);
  const reconnect = useSetAtom(reconnectLogAtom);
  const disconnect = useSetAtom(disconnectLogAtom);
  const [isOpen, setIsOpen] = useState(false);

  const isOn = status === "connected" || companionConnected;

  async function onChooseFile() {
    try {
      await chooseFile();
      setIsOpen(false);
    } catch (e) {
      // Closing the picker is not an error
      if (!(e instanceof DOMException && e.name === "AbortError"))
        toast.error("Couldn't open that file");
    }
  }

  async function onChipClick() {
    if (status === "needs-permission" && !companionConnected) {
      try {
        await reconnect();
        return;
      } catch {
        // Falls through to the setup dialog
      }
    }

    setIsOpen(true);
  }

  let label = "Set up auto-progress";
  if (isOn) label = "Auto-progress on";
  else if (status === "needs-permission") label = "Reconnect game log";

  return (
    <>
      <button className={classNames(styles.chip)} onClick={onChipClick}>
        <span
          aria-hidden
          className={classNames(styles.dot, {
            [styles.on]: isOn,
            [styles.warn]: !isOn && status === "needs-permission",
          })}
        />
        {label}
      </button>
      <Modal
        size="large"
        isOpen={isOpen}
        onRequestClose={() => setIsOpen(false)}
        aria={{ labelledby: "auto-progress-title" }}
      >
        <div className={classNames(styles.dialog)}>
          <h2 id="auto-progress-title" className={classNames(styles.title)}>
            Auto-progress
          </h2>
          <p>
            Moves you along the route when you enter a new area. This page
            reads the Client.txt file from your computer, and nothing is
            uploaded.
          </p>

          {!isLogReadingSupported ? (
            <p className={classNames(styles.note)}>
              This browser can't read local files. Use Chrome or Edge, or get
              the companion app.
            </p>
          ) : (
            <>
              <h3 className={classNames(styles.heading)}>1. Find your log</h3>
              <p>
                Client.txt is in the logs folder of your Path of Exile install.
              </p>
              <div className={classNames(styles.note)}>
                <p>
                  Installed in Program Files? Chrome and Edge can't open files
                  there. Move the game with Steam (Properties, Installed Files,
                  Move install folder), or link the log to another folder by
                  running this in Command Prompt:
                </p>
                <p className={classNames(styles.code)}>
                  <code>{LINK_COMMAND}</code>
                  <CopyToClipboard text={LINK_COMMAND} />
                </p>
                <p>
                  Change the second path if your game is installed somewhere
                  else, then choose the linked file below.
                </p>
              </div>

              <h3 className={classNames(styles.heading)}>2. Choose the file</h3>
              {status === "connected" ? (
                <p>
                  Connected. Keep this tab open while you play.{" "}
                  <button
                    className={classNames(styles.link)}
                    onClick={() => disconnect()}
                  >
                    Disconnect
                  </button>
                </p>
              ) : (
                <div>
                  <button
                    className={classNames(styles.action)}
                    onClick={onChooseFile}
                  >
                    Choose Client.txt
                  </button>
                </div>
              )}
            </>
          )}

          <p className={classNames(styles.footer)}>
            Prefer an app that runs next to the game?{" "}
            <a href={COMPANION_URL} target="_blank" rel="noreferrer">
              Get the companion app
            </a>
          </p>
        </div>
      </Modal>
    </>
  );
}
