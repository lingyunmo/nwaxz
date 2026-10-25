import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = createApp({
  distDir: path.join(root, "dist"),
  revision: process.env.APP_REVISION,
});
const server = app.listen(
  Number(process.env.PORT ?? 3000),
  process.env.HOST ?? "127.0.0.1",
  () => console.log("nwaxz server ready"),
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  app.locals.coop?.shutdown();
  const deadline = setTimeout(() => {
    server.closeAllConnections();
    process.exit(1);
  }, 10000);
  deadline.unref();
  server.close(() => {
    clearTimeout(deadline);
    process.exit(0);
  });
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
