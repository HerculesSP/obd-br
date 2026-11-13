// Importa PIDs do fabricante no formato CSV do Torque Pro (o mais comum nas listas da comunidade):
// Name,ShortName,ModeAndPID,Equation,Min Value,Max Value,Units,Header
// Ex.: Temp. câmbio,ATF,0x221940,A-40,-40,150,°C,7E1

// Fórmula do Torque -> função JS. Só tokens da lista abaixo são aceitos, então nada arbitrário é executado.
// A..Z = bytes 0..25, AA..AZ = 26..51; {A:7} = bit 7 de A; Signed(A) = byte com sinal; INT/ABS.
const TOKEN = /\s*(?:(\d+(?:\.\d+)?)|\{([A-Z]{1,2}):([0-7])\}|(Signed|SIGNED|INT|ABS)(?=\s*\()|([A-Z]{1,2})|([-+*/(),]))/y;
const FN = { Signed: 'S', SIGNED: 'S', INT: 'Math.trunc', ABS: 'Math.abs' };
const byteIdx = v => v.length === 1 ? v.charCodeAt(0) - 65 : 26 + v.charCodeAt(1) - 65;

export function compile(eq) {
  let js = '', m;
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < eq.trimEnd().length) {
    const at = TOKEN.lastIndex;
    if (!(m = TOKEN.exec(eq))) throw new Error(`fórmula inválida perto de "${eq.slice(at, at + 8)}"`);
    const [, num, bitVar, bit, fn, v, op] = m;
    js += num ?? (bitVar ? `((b[${byteIdx(bitVar)}]>>${bit})&1)` : fn ? FN[fn] : v ? `b[${byteIdx(v)}]` : op);
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
