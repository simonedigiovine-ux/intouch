/* =========================================================================
   INTOUCH — server WebSocket (ponte broadcast)
   - Assegna un id univoco a ogni connessione
   - Inoltra ogni messaggio ricevuto a TUTTI gli altri client, aggiungendo
     l'id del mittente
   - Quando un client si disconnette, avvisa gli altri ("end") così possono
     rimuovere l'impronta rimasta appesa
   ========================================================================= */

const http = require("http");
const { WebSocketServer } = require("ws");

// Render (e molti host) forniscono la porta via variabile d'ambiente
const PORT = process.env.PORT || 3000;

// Server HTTP minimale: serve solo per l'health-check di Render e per
// agganciarci sopra il WebSocket server.
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Intouch WebSocket server attivo\n");
});

const wss = new WebSocketServer({ server });

let nextId = 1;

wss.on("connection", (socket) => {
  // id univoco per questa connessione (= un dispositivo)
  socket.id = String(nextId++);
  console.log(`Client connesso: ${socket.id} (totale: ${wss.clients.size})`);

  // Comunica al client il proprio id (non indispensabile lato client, utile per debug)
  socket.send(JSON.stringify({ t: "welcome", id: socket.id }));

  socket.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch (_) { return; }

    // Inoltra a tutti GLI ALTRI client, aggiungendo l'id del mittente
    const payload = JSON.stringify({ t: msg.t, id: socket.id, x: msg.x, y: msg.y });
    for (const client of wss.clients) {
      if (client !== socket && client.readyState === 1 /* OPEN */) {
        client.send(payload);
      }
    }
  });

  socket.on("close", () => {
    console.log(`Client disconnesso: ${socket.id} (totale: ${wss.clients.size})`);
    // Avvisa gli altri di rimuovere l'eventuale impronta di questo client
    const payload = JSON.stringify({ t: "end", id: socket.id });
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(payload);
    }
  });

  socket.on("error", () => { /* ignora errori di socket singoli */ });
});

server.listen(PORT, () => {
  console.log(`Intouch server in ascolto sulla porta ${PORT}`);
});
