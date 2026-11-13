// Núcleo OBD-II / ELM327: tabela de PIDs, parsers e transportes (USB, Bluetooth, demo).

const FUEL = ['—', 'Gasolina', 'Metanol', 'Etanol', 'Diesel', 'GLP', 'GNV', 'Propano', 'Elétrico',
  'Bi-fuel gasolina', 'Bi-fuel metanol', 'Bi-fuel etanol', 'Bi-fuel GLP', 'Bi-fuel GNV', 'Bi-fuel propano',
  'Bi-fuel elétrico', 'Bi-fuel gasolina/elétrico', 'Híbrido gasolina', 'Híbrido etanol', 'Híbrido diesel',
  'Híbrido elétrico', 'Híbrido misto', 'Híbrido regenerativo', 'Bi-fuel diesel'];

// f(A, B) -> valor físico. Unidades no padrão brasileiro (km/h, °C, kPa).
export const PIDS = {
  '04': { name: 'Carga do motor', unit: '%', min: 0, max: 100, f: a => a * 100 / 255 },
  '05': { name: 'Temp. arrefecimento', unit: '°C', min: -40, max: 130, f: a => a - 40 },
  '06': { name: 'Ajuste curto (STFT) B1', unit: '%', min: -25, max: 25, f: a => a / 1.28 - 100 },
  '07': { name: 'Ajuste longo (LTFT) B1', unit: '%', min: -25, max: 25, f: a => a / 1.28 - 100 },
  '0B': { name: 'Pressão coletor (MAP)', unit: 'kPa', min: 0, max: 255, f: a => a },
  '0C': { name: 'Rotação', unit: 'rpm', min: 0, max: 8000, f: (a, b) => (256 * a + b) / 4 },
  '0D': { name: 'Velocidade', unit: 'km/h', min: 0, max: 220, f: a => a },
  '0E': { name: 'Avanço de ignição', unit: '°', min: -64, max: 64, f: a => a / 2 - 64 },
  '0F': { name: 'Temp. ar admissão', unit: '°C', min: -40, max: 100, f: a => a - 40 },
  '10': { name: 'Fluxo de ar (MAF)', unit: 'g/s', min: 0, max: 200, f: (a, b) => (256 * a + b) / 100 },
  '11': { name: 'Posição borboleta', unit: '%', min: 0, max: 100, f: a => a * 100 / 255 },
  '14': { name: 'Sonda lambda B1S1', unit: 'V', min: 0, max: 1.275, f: a => a / 200 },
  '15': { name: 'Sonda lambda B1S2', unit: 'V', min: 0, max: 1.275, f: a => a / 200 },
  '1F': { name: 'Tempo motor ligado', unit: 's', min: 0, max: 65535, f: (a, b) => 256 * a + b },
  '21': { name: 'Distância com MIL acesa', unit: 'km', min: 0, max: 65535, f: (a, b) => 256 * a + b },
  '2F': { name: 'Nível de combustível', unit: '%', min: 0, max: 100, f: a => a * 100 / 255 },
  '31': { name: 'Distância desde limpeza DTC', unit: 'km', min: 0, max: 65535, f: (a, b) => 256 * a + b },
  '33': { name: 'Pressão barométrica', unit: 'kPa', min: 0, max: 255, f: a => a },
  '42': { name: 'Tensão do módulo', unit: 'V', min: 0, max: 16, f: (a, b) => (256 * a + b) / 1000 },
  '46': { name: 'Temp. ambiente', unit: '°C', min: -40, max: 60, f: a => a - 40 },
  '51': { name: 'Tipo de combustível', unit: '', text: true, f: a => FUEL[a] ?? `Tipo ${a}` },
  '52': { name: 'Etanol no tanque (flex)', unit: '%', min: 0, max: 100, f: a => a * 100 / 255 },
  '5C': { name: 'Temp. óleo', unit: '°C', min: -40, max: 160, f: a => a - 40 },
  '5E': { name: 'Consumo instantâneo', unit: 'L/h', min: 0, max: 30, f: (a, b) => (256 * a + b) / 20 },
};

// Linhas hex limpas: descarta "SEARCHING...", "BUS INIT", "NO DATA", eco etc.
export const hexLines = raw => raw.split(/[\r\n]+/)
  .map(l => l.replace(/\s/g, '').toUpperCase())
  .filter(l => /^[0-9A-F:]+$/.test(l));

export function parsePid(raw, pid) {
  const line = hexLines(raw).find(l => l.startsWith('41' + pid));
  if (!line) return null;
  const [a = 0, b = 0] = line.slice(4).match(/../g)?.map(h => parseInt(h, 16)) ?? [];
  return PIDS[pid].f(a, b);
}

// Resposta de 0100/0120/0140 -> lista de PIDs suportados ("01".."60").
export function parseSupported(raw, base) {
  const line = hexLines(raw).find(l => l.startsWith('41' + base));
  if (!line) return [];
  const bits = parseInt(line.slice(4, 12), 16);
  const out = [];
  for (let i = 0; i < 32; i++) if (bits & (1 << (31 - i)))
    out.push((parseInt(base, 16) + i + 1).toString(16).toUpperCase().padStart(2, '0'));
  return out;
}

export function decodeDtc(hex) {
  const n = parseInt(hex[0], 16);
  return 'PCBU'[n >> 2] + (n & 3) + hex.slice(1);
}

// Modos 03/07/0A. Em CAN o 1º byte após o modo é a contagem e respostas longas vêm em quadros "0:", "1:".
export function parseDtcs(raw, mode, isCan) {
  const resp = (0x40 + parseInt(mode, 16)).toString(16).toUpperCase();
  const lines = hexLines(raw);
  let data;
  if (isCan) {
    data = lines.filter(l => !/^[0-9A-F]{3}$/.test(l)).map(l => l.replace(/^[0-9A-F]:/, '')).join('');
    const i = data.indexOf(resp);
    if (i < 0) return [];
    data = data.slice(i + 4);
  } else {
    data = lines.filter(l => l.startsWith(resp)).map(l => l.slice(2)).join('');
  }
  return (data.match(/.{4}/g) ?? []).filter(h => h !== '0000').map(decodeDtc);
}

// ---- ELM327 ----
export class Elm {
  constructor(transport) {
    this.t = transport;
    this.buf = '';
    this.q = Promise.resolve();
    this.isCan = false;
    transport.onData = s => {
      this.buf += s;
      const i = this.buf.indexOf('>');
      if (i >= 0) { const r = this.buf.slice(0, i); this.buf = ''; this.done?.(r); }
    };
  }

  // Comandos serializados: o ELM só aceita um por vez (até o prompt '>').
  send(cmd, timeout = 4000) {
    const p = this.q.then(() => new Promise(res => {
      const tm = setTimeout(() => { this.done = null; this.buf = ''; res(''); }, timeout);
      this.done = r => { clearTimeout(tm); this.done = null; res(r); };
      this.t.write(cmd + '\r');
    }));
    this.q = p;
    return p;
  }

  async init(protocol = '0') {
    await this.send('ATZ', 3000);
    for (const c of ['ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATAT1', 'ATSP' + protocol]) await this.send(c);
    // Primeira consulta dispara a busca de protocolo; K-line (ISO 9141/KWP, comum em Gol/Palio/Corsa antigos) é lenta.
    const r0 = await this.send('0100', 15000);
    if (!hexLines(r0).some(l => l.startsWith('4100'))) throw new Error('ECU não respondeu: ' + r0.trim());
    const dpn = (await this.send('ATDPN')).trim().replace(/^A/, '');
    this.isCan = /^[6-9AB]/.test(dpn);
    const supported = parseSupported(r0, '00');
    for (const base of ['20', '40']) {
      if (!supported.includes(base)) break;
      supported.push(...parseSupported(await this.send('01' + base), base));
    }
    return {
      version: (await this.send('ATI')).trim(),
      voltage: (await this.send('ATRV')).trim(),
      protocol: (await this.send('ATDP')).trim(),
      supported: supported.filter(p => PIDS[p]),
    };
  }

  async read(pid) { return parsePid(await this.send('01' + pid), pid); }
  async dtcs(mode) { return parseDtcs(await this.send(mode, 8000), mode, this.isCan); }
  clearDtcs() { return this.send('04', 8000); }
}

// ---- Transportes: cada um expõe write(str), onData(str), close() ----

// USB (FTDI/CH340/PL2303) e Bluetooth clássico pareado (aparece como porta serial / COM).
export class SerialTransport {
  async open(baudRate = 38400) {
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate });
    this.writer = this.port.writable.getWriter();
    this.reader = this.port.readable.getReader();
    const dec = new TextDecoder();
    (async () => {
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          this.onData?.(dec.decode(value));
        }
      } catch { /* porta fechada */ }
    })();
  }
  write(s) { return this.writer.write(new TextEncoder().encode(s)); }
  async close() {
    await this.reader?.cancel().catch(() => {});
    this.reader?.releaseLock(); this.writer?.releaseLock();
    await this.port?.close().catch(() => {});
  }
}

// Bluetooth LE (ELM327 BLE genéricos, Vgate iCar Pro, Vlinker etc.).
const BLE_SERVICES = [0xfff0, 0xffe0, 0x18f0, 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'];
export class BleTransport {
  async open() {
    this.dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES });
    const gatt = await this.dev.gatt.connect();
    for (const svc of await gatt.getPrimaryServices()) {
      for (const ch of await svc.getCharacteristics()) {
        if (!this.rx && (ch.properties.notify || ch.properties.indicate)) this.rx = ch;
        if (!this.tx && (ch.properties.write || ch.properties.writeWithoutResponse)) this.tx = ch;
      }
      if (this.rx && this.tx) break;
    }
    if (!this.rx || !this.tx) throw new Error('Adaptador BLE sem característica de leitura/escrita reconhecida');
    const dec = new TextDecoder();
    this.rx.addEventListener('characteristicvaluechanged', e => this.onData?.(dec.decode(e.target.value)));
    await this.rx.startNotifications();
  }
  async write(s) {
    const bytes = new TextEncoder().encode(s);
    for (let i = 0; i < bytes.length; i += 20) { // MTU padrão do BLE
      const chunk = bytes.slice(i, i + 20);
      if (this.tx.properties.writeWithoutResponse) await this.tx.writeValueWithoutResponse(chunk);
      else await this.tx.writeValueWithResponse(chunk);
    }
  }
  async close() { this.dev?.gatt.disconnect(); }
}

// Simulador: responde como um ELM327 num carro flex CAN, para testar sem carro.
export class DemoTransport {
  async open() { this.t0 = Date.now(); }
  async close() {}
  write(s) {
    const cmd = s.trim().toUpperCase();
    setTimeout(() => this.onData?.(this.reply(cmd) + '\r\r>'), 15);
  }
  reply(cmd) {
    if (cmd === 'ATI' || cmd === 'ATZ') return 'ELM327 v1.5 (demo)';
    if (cmd === 'ATRV') return '13.9V';
    if (cmd === 'ATDP') return 'AUTO, ISO 15765-4 (CAN 11/500)';
    if (cmd === 'ATDPN') return 'A6';
    if (cmd.startsWith('AT')) return 'OK';
    if (cmd === '03') return '4303017103010420'; // P0171, P0301, P0420
    if (cmd === '07') return '47010133';
    if (cmd === '0A') return '4A00';
    if (cmd === '04') return '44';
    const pid = cmd.slice(2);
    if (['00', '20', '40'].includes(pid)) {
      let bits = 0;
      const base = parseInt(pid, 16);
      for (const k of [...Object.keys(PIDS), '20', '40']) {
        const i = parseInt(k, 16) - base - 1;
        if (i >= 0 && i < 32) bits |= 1 << (31 - i);
      }
      return '41' + pid + (bits >>> 0).toString(16).toUpperCase().padStart(8, '0');
    }
    if (!PIDS[pid]) return 'NO DATA';
    const s = (Date.now() - this.t0) / 1000;
    const w = (p, a = 0.5) => 0.5 + a * Math.sin(s / p); // onda 0..1
    const rpm = 850 + 3200 * w(5, 0.5) ** 2;
    const b = {
      '0C': [rpm * 4 >> 8, rpm * 4 & 255],
      '0D': [Math.round(90 * w(9))],
      '05': [Math.round(40 + Math.min(92, 25 + s * 2))],
      '42': [13900 >> 8, 13900 & 255],
      '51': [3],
      '52': [Math.round(255 * 0.62)],
      '5E': [0, Math.round(20 * (1 + 10 * w(5)))],
      '10': [0, Math.round(rpm / 15)],
    }[pid] ?? [Math.round(255 * w(3 + parseInt(pid, 16) % 7, 0.3)), 0];
    return '41' + pid + b.map(x => Math.max(0, Math.min(255, x | 0)).toString(16).toUpperCase().padStart(2, '0')).join('');
  }
}
