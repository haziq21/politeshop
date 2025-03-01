import express from "express";
import cors from "cors";
import { PORT } from "./config";

const app = express();
app.use(cors());

let clients: { id: number; res: express.Response }[] = [];

// SSE endpoint: clients connect to this to receive events
app.get("/sse", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("\n");

  const clientId = Date.now();
  clients.push({ id: clientId, res });
  console.log(`Client ${clientId} connected`);

  req.on("close", () => {
    console.log(`Client ${clientId} disconnected`);
    clients = clients.filter((client) => client.id !== clientId);
  });
});

app.post("/broadcast", () => {
  console.log("Broadcasting reload event");

  clients.forEach((client) => {
    client.res.write("data: reload\n\n");
  });
});

app.listen(PORT, () => {
  console.log(`SSE server listening on http://localhost:${PORT}`);
});
