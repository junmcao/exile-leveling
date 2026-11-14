// Stand-in for exile-log-api, for testing auto-progress without the game.
//
//   node tools/fake-log-server.mjs
//   curl "http://localhost:6755/area?id=1_1_town"
//
// Serves the same WebSocket the web app connects to (ws://localhost:6754) and
// broadcasts a Client.txt style "Generating level" line for each /area request.
import { createHash } from "node:crypto";
import { createServer } from "node:http";

const WS_PORT = 6754;
const CONTROL_PORT = 6755;
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

const clients = new Set();

function textFrame(text) {
  const payload = Buffer.from(text);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  }
  return Buffer.concat([header, payload]);
}

createServer((_req, res) => {
  res.writeHead(426).end();
})
  .on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    const accept = createHash("sha1")
      .update(key + WS_GUID)
      .digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );

    clients.add(socket);
    console.log(`client connected (${clients.size})`);
    socket.on("data", () => {});
    socket.on("error", () => {});
    socket.on("close", () => clients.delete(socket));
  })
  .listen(WS_PORT, () => console.log(`websocket on ws://localhost:${WS_PORT}`));

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${CONTROL_PORT}`);
  const id = url.searchParams.get("id");
  if (url.pathname !== "/area" || !id) {
    res.writeHead(400).end("usage: /area?id=<area id>\n");
    return;
  }

  const line = `2026/01/01 12:00:00 1 abc [INFO Client 1] Generating level 1 area "${id}" with seed 1`;
  for (const client of clients) client.write(textFrame(line));

  console.log(`sent ${id} to ${clients.size} client(s)`);
  res.end(`sent ${id} to ${clients.size} client(s)\n`);
}).listen(CONTROL_PORT, "127.0.0.1", () =>
  console.log(`control on http://localhost:${CONTROL_PORT}/area?id=<area id>`),
);
