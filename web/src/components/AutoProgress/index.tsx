import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket-lite";
import {
  attachLogHandleAtom,
  companionConnectedAtom,
  logHandleAtom,
  logStatusAtom,
  restoreLogAtom,
} from "../../state/game-log";
import { activeEdgeAtom } from "../../state/route";

const COMPANION_URL = "ws://localhost:6754";
const POLL_INTERVAL_MS = 1000;
const MAX_READ_FAILURES = 3;

// Moves the route along from the game's Client.txt, read either directly in
// the browser or through the companion app's WebSocket
export function useAutoProgress() {
  const write = useSetAtom(activeEdgeAtom);
  const [status, setStatus] = useAtom(logStatusAtom);
  const handle = useAtomValue(logHandleAtom);
  const restore = useSetAtom(restoreLogAtom);
  const attach = useSetAtom(attachLogHandleAtom);
  const setCompanionConnected = useSetAtom(companionConnectedAtom);

  // The file takes over when both are connected, otherwise each line is seen twice
  const fileConnected = useRef(false);
  fileConnected.current = status === "connected";

  useEffect(() => {
    restore();

    // Lets tests attach a handle without the file picker
    if (import.meta.env.DEV)
      (window as unknown as { __attachLog: typeof attach }).__attachLog = attach;
  }, []);

  const { readyState } = useWebSocket({
    url: COMPANION_URL,
    shouldReconnect: true,
    reconnectInterval: 5000,
    onMessage(event) {
      if (typeof event.data === "string" && !fileConnected.current)
        write(event.data);
    },
  });

  useEffect(() => {
    setCompanionConnected(readyState === ReadyState.OPEN);
  }, [readyState]);

  useEffect(() => {
    if (status !== "connected" || handle === null) return;

    let stopped = false;
    let busy = false;
    let failures = 0;
    let offset: number | null = null;
    let pending = "";

    async function poll() {
      if (busy || handle === null) return;
      busy = true;

      try {
        const file = await handle.getFile();

        // Only new lines matter, so a fresh connection starts at the end
        if (offset === null) {
          offset = file.size;
          return;
        }

        if (file.size < offset) {
          offset = 0;
          pending = "";
        }
        if (file.size === offset) return;

        const chunk = await file.slice(offset, file.size).text();
        offset = file.size;

        const lines = (pending + chunk).split("\n");
        pending = lines.pop() ?? "";

        for (const line of lines) {
          if (line.includes("Generating level")) await write(line);
        }

        failures = 0;
      } catch {
        // The game can append between getFile and the read, which fails once
        // and works on the next poll. Repeated failures mean access was lost.
        if (!stopped && ++failures >= MAX_READ_FAILURES)
          setStatus("needs-permission");
      } finally {
        busy = false;
      }
    }

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [status, handle]);
}
