const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

const EVENT_CODES = {
  salida: 'DEPARTURE',
  trasbordo: 'TRANSSHIPMENT',
  destino: 'ARRIVAL',
  retiro: 'EMPTY_OUT'
};

function getLastState() {
  try {
    return JSON.parse(fs.readFileSync('estado.json', 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync('estado.json', JSON.stringify(state, null, 2));
}

async function consultarEvento(container, tipo) {
  const url = `https://api.hapag-lloyd.com/track-and-trace/v2/events?equipmentReference=${container}`;
  const headers = {
    'X-IBM-Client-ID': CLIENT_ID,
    'X-IBM-Client-Secret': CLIENT_SECRET,
    'Accept': 'application/json'
  };

  const res = await fetch(url, { headers });
  const data = await res.json();

  const eventoBuscado = data.events.find(e => e.eventTypeCode === EVENT_CODES[tipo]);
  if (!eventoBuscado) return { evento: null, alerta: false };

  const fechaActual = eventoBuscado.eventDateTime;
  const estadoPrevio = getLastState();
  const clave = `${container}_${tipo}`;
  const fechaAnterior = estadoPrevio[clave];

  const cambio = fechaAnterior && fechaAnterior !== fechaActual;
  estadoPrevio[clave] = fechaActual;
  saveState(estadoPrevio);

  return {
    evento: eventoBuscado,
    alerta: cambio
  };
}

['salida', 'trasbordo', 'destino', 'retiro'].forEach(tipo => {
  app.get(`/${tipo}`, async (req, res) => {
    const container = req.query.container;
    if (!container) return res.status(400).json({ error: 'Falta parámetro container' });

    try {
      const resultado = await consultarEvento(container, tipo);
      res.json(resultado);
    } catch (err) {
      res.status(500).json({ error: 'Error al consultar API', detalle: err.message });
    }
  });
});

const PORT = process.env.PORT || 3000;
const dns = require('dns');

app.get('/test-dns', (req, res) => {
  dns.lookup('api.hapag-lloyd.com', (err, address) => {
    if (err) {
      res.json({ error: err.message });
    } else {
      res.json({ address });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});