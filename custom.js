// Importa PIDs do fabricante no formato CSV do Torque Pro (o mais comum nas listas da comunidade):
// Name,ShortName,ModeAndPID,Equation,Min Value,Max Value,Units,Header
// Ex.: Temp. câmbio,ATF,0x221940,A-40,-40,150,°C,7E1

// Fórmula do Torque -> função JS. Só tokens da lista abaixo são aceitos, então nada arbitrário é executado.
// A..Z = bytes 0..25, AA..AZ = 26..51 (maiúsculas ou minúsculas); {A:7} = bit 7 de A;
// Signed(A) = byte com sinal; INT/ABS; operadores + - * / & | >> <<.
const TOKEN = /\s*(?:(\d+(?:\.\d+)?|\.\d+)|\{([A-Z]{1,2}):([0-7])\}|(signed|int|abs)(?=\s*\()|([A-Z]{1,2})|(>>|<<|[-+*/(),&|]))/iy;
const FN = { signed: 'S', int: 'Math.trunc', abs: 'Math.abs' };
const byteIdx = v => (v = v.toUpperCase()).length === 1 ? v.charCodeAt(0) - 65 : 26 + v.charCodeAt(1) - 65;

export function compile(eq) {
  let js = '', m;
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < eq.trimEnd().length) {
    const at = TOKEN.lastIndex;
    if (!(m = TOKEN.exec(eq))) throw new Error(`fórmula inválida perto de "${eq.slice(at, at + 8)}"`);
    const [, num, bitVar, bit, fn, v, op] = m;
    js += num ?? (bitVar ? `((b[${byteIdx(bitVar)}]>>${bit})&1)` : fn ? FN[fn.toLowerCase()] : v ? `b[${byteIdx(v)}]` : op);
  }
  const f = new Function('b', 'S', `return (${js});`);
  return bytes => f(bytes.map(x => x ?? 0), x => x > 127 ? x - 256 : x);
}

function csvRow(line) {
  const out = [], re = /\s*("(?:[^"]|"")*"|[^,]*)\s*(?:,|$)/g;
  for (let m; re.lastIndex < line.length && (m = re.exec(line));)
    out.push(m[1].replace(/^"|"$/g, '').replace(/""/g, '"').trim());
  return out;
}

export function parseTorqueCsv(text) {
  const rows = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')).map(csvRow);
  let col = { name: 0, modeandpid: 2, equation: 3, 'min value': 4, 'max value': 5, units: 6, header: 7 };
  if (/name/i.test(rows[0]?.[0])) {
    const h = rows.shift().map(x => x.toLowerCase());
    for (const k of Object.keys(col)) if (h.includes(k)) col[k] = h.indexOf(k);
  }
  const pids = [], errors = [];
  rows.forEach((r, i) => {
    const get = k => r[col[k]] ?? '';
    try {
      const cmd = get('modeandpid').replace(/^0x/i, '').toUpperCase();
      if (!/^[0-9A-F]{4,8}$/.test(cmd)) throw new Error(`ModeAndPID inválido "${get('modeandpid')}"`);
      const header = get('header').replace(/^0x/i, '').toUpperCase();
      if (header && !/^([0-9A-F]{3}|[0-9A-F]{6}|[0-9A-F]{8})$/.test(header)) throw new Error(`cabeçalho inválido "${header}"`);
      const min = parseFloat(get('min value')), max = parseFloat(get('max value'));
      pids.push({
        id: 'X' + pids.length, name: get('name') || cmd, unit: get('units'),
        min: Number.isFinite(min) ? min : 0, max: Number.isFinite(max) ? max : 100,
        cmd, header, prefix: (parseInt(cmd.slice(0, 2), 16) + 0x40).toString(16).toUpperCase() + cmd.slice(2),
        calc: compile(get('equation') || 'A'),
      });
    } catch (e) { errors.push(`linha ${i + 2}: ${e.message}`); }
  });
  return { pids, errors };
}

// ---- OBDb (github.com/OBDb, CC BY-SA 4.0): base comunitária de sinais por modelo ----
// Segue o decodificador de referência (OBDb/.schemas python/can/signals.py).
const UNITS = {
  celsius: '°C', percent: '%', kilometersPerHour: 'km/h', kilometers: 'km', kilopascal: 'kPa', volts: 'V', amps: 'A',
  rpm: 'rpm', degrees: '°', newtonMeters: 'Nm', seconds: 's', milliseconds: 'ms', minutes: 'min', hours: 'h', psi: 'psi',
  liters: 'L', milligrams: 'mg', grams: 'g', gramsPerSecond: 'g/s', litersPerHour: 'L/h', bar: 'bar', hertz: 'Hz',
  kilowatts: 'kW', kilowattHours: 'kWh', watts: 'W', ohms: 'Ω', meters: 'm', millimeters: 'mm', degreesPerSecond: '°/s',
  metersPerSecondSquared: 'm/s²', lambda: 'λ', scalar: '', unknown: '', normal: '',
};
const BOOL = { offon: ['Desligado', 'Ligado'], noyes: ['Não', 'Sim'], yesno: ['Sim', 'Não'] };

// Lê `len` bits a partir de `bix` (0 = bit mais significativo do 1º byte de dados). blsb = bytes invertidos.
function bitsOf(bytes, { bix = 0, len, blsb }) {
  if (bix + len > bytes.length * 8) return null;
  let b = bytes;
  if (blsb && len > 8) {
    const s = bix >> 3, n = (len + 7) >> 3;
    b = [...bytes.slice(0, s), ...bytes.slice(s, s + n).reverse(), ...bytes.slice(s + n)];
  }
  let v = 0;
  for (let i = bix; i < bix + len; i++) v = v * 2 + ((b[i >> 3] >> (7 - (i & 7))) & 1);
  return v;
}

export function decodeObdb(fmt, bytes) {
  let raw = bitsOf(bytes, fmt);
  if (raw == null) return null;
  if (fmt.map) return fmt.map[raw]?.description ?? null;
  if (fmt.sign && raw >= 2 ** (fmt.len - 1)) raw -= 2 ** fmt.len;
  let v = raw * (fmt.mul ?? 1) / (fmt.div ?? 1) + (fmt.add ?? 0);
  const min = fmt.min ?? 0, max = fmt.max ?? 0;
  if (max > min) v = Math.max(min, Math.min(v, max));
  if ((fmt.nullmin != null && v <= fmt.nullmin) || (fmt.nullmax != null && v >= fmt.nullmax)) return null;
  return BOOL[fmt.unit] ? BOOL[fmt.unit][v ? 1 : 0] : v;
}

// Filtro de ano-modelo do OBDb (from > to = intervalo "dá a volta").
export function yearMatches(f, y) {
  if (y == null) return false;
  const { from, to, years } = f;
  if (from != null && to != null ? (from < to ? from <= y && y <= to : y >= from || y <= to)
    : to != null ? y <= to : from != null && y >= from) return true;
  return !!years?.includes(y);
}

// Signalset -> PIDs no formato interno. Pula sinais de depuração, brutos e de outros anos.
// dbgfilter = anos em que o sinal ainda não foi confirmado num carro real: entra marcado como não verificado.
export function parseObdb(json, year) {
  const pids = [];
  for (const c of json.commands ?? []) {
    if (c.dbg || c.eax) continue; // ponytail: endereçamento estendido (BMW) não suportado
    if (year && c.filter && !yearMatches(c.filter, year)) continue;
    const unverified = !!(year && c.dbgfilter && yearMatches(c.dbgfilter, year));
    const [[mode, id]] = Object.entries(c.cmd);
    const cmd = mode + id, prefix = (parseInt(mode, 16) + 0x40).toString(16).toUpperCase() + id;
    for (const s of c.signals) {
      const f = s.fmt;
      if (/_RAW_/.test(s.id)) continue;
      pids.push({
        id: 'X' + pids.length, name: s.name, unit: UNITS[f.unit] ?? f.unit ?? '',
        min: f.min ?? 0, max: f.max ?? 100, text: !!(f.map || BOOL[f.unit]),
        cmd, header: c.hdr, rax: c.rax, prefix, unverified, calc: bytes => decodeObdb(f, bytes),
      });
    }
  }
  return pids;
}
