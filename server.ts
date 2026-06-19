import { createServer } from "node:http";
import next from "next";
import { createSocketServer } from "./server/socket";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

async function main() {
  const app = next({ dev, hostname, port });
  const handler = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer((request, response) => {
    handler(request, response);
  });

  createSocketServer(httpServer);

  httpServer.listen(port, hostname, () => {
    console.info(`PureChat is ready at http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
