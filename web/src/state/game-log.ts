import { atom } from "jotai";

// File System Access API, available in Chrome and Edge only. The permission
// methods are not part of the standard DOM typings.
interface LogFileHandle extends FileSystemFileHandle {
  queryPermission(descriptor: { mode: "read" }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: "read" }): Promise<PermissionState>;
}

type ShowOpenFilePicker = (options: {
  multiple: boolean;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<LogFileHandle[]>;

function filePicker() {
  return (window as unknown as { showOpenFilePicker?: ShowOpenFilePicker })
    .showOpenFilePicker;
}

export const isLogReadingSupported = typeof filePicker() === "function";

export type LogStatus =
  | "unsupported"
  | "disconnected"
  | "needs-permission"
  | "connected";

export const logStatusAtom = atom<LogStatus>(
  isLogReadingSupported ? "disconnected" : "unsupported",
);
export const logHandleAtom = atom<LogFileHandle | null>(null);

// Whether the companion app is connected over its WebSocket
export const companionConnectedAtom = atom(false);

const DB_NAME = "exile-leveling";
const STORE_NAME = "handles";
const HANDLE_KEY = "game-log";

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = fn(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

// Storage is only a convenience, the log still works for this session without it
const saveHandle = (handle: LogFileHandle) =>
  withStore("readwrite", (store) => store.put(handle, HANDLE_KEY)).catch(
    () => {},
  );
const loadHandle = () =>
  withStore<LogFileHandle | undefined>("readonly", (store) =>
    store.get(HANDLE_KEY),
  ).catch(() => undefined);
const clearHandle = () =>
  withStore("readwrite", (store) => store.delete(HANDLE_KEY)).catch(() => {});

export const attachLogHandleAtom = atom(
  null,
  async (_get, set, handle: LogFileHandle) => {
    await saveHandle(handle);
    set(logHandleAtom, handle);
    set(logStatusAtom, "connected");
  },
);

// Must run straight from a click, the picker needs a user gesture
export const chooseLogFileAtom = atom(null, async (_get, set) => {
  const [handle] = await filePicker()!({
    multiple: false,
    types: [{ description: "Client.txt", accept: { "text/plain": [".txt"] } }],
  });

  await set(attachLogHandleAtom, handle);
});

export const restoreLogAtom = atom(null, async (_get, set) => {
  if (!isLogReadingSupported) return;

  const handle = await loadHandle();
  if (handle === undefined) return;

  set(logHandleAtom, handle);
  const permission = await handle.queryPermission({ mode: "read" });
  set(logStatusAtom, permission === "granted" ? "connected" : "needs-permission");
});

// Must run straight from a click, asking for permission needs a user gesture
export const reconnectLogAtom = atom(null, async (get, set) => {
  const handle = get(logHandleAtom);
  if (handle === null) return;

  const permission = await handle.requestPermission({ mode: "read" });
  set(logStatusAtom, permission === "granted" ? "connected" : "needs-permission");
});

export const disconnectLogAtom = atom(null, async (_get, set) => {
  await clearHandle();
  set(logHandleAtom, null);
  set(
    logStatusAtom,
    isLogReadingSupported ? "disconnected" : "unsupported",
  );
});
