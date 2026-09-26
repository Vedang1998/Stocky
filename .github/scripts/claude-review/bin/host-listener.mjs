#!/usr/bin/env node
import fs from "node:fs";
import net from "node:net";

const portFile = process.argv[2];
const acceptFile = process.argv[3];
if (!portFile || !acceptFile) {
  process.stderr.write("usage: host-listener.mjs PORT_FILE ACCEPT_FILE\n");
  process.exit(2);
}
fs.writeFileSync(acceptFile, "");
const server = net.createServer((socket) => {
  const ra = socket.remoteAddress || "";
  fs.appendFileSync(acceptFile, `${Date.now()} ${ra}\n`);
  socket.end("host-canary");
});
server.listen(0, "0.0.0.0", () => {
  fs.writeFileSync(portFile, String(server.address().port));
});
function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
