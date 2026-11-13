// node test.mjs
import assert from 'node:assert/strict';
import { parsePid, parseSupported, parseDtcs, parseVin, decodeVin, parseMonitors, parseMode6, Elm, DemoTransport } from './obd.js';
import { describe } from './dtc.js';

assert.equal(parsePid('41 0C 1A F8\r\r', '0C'), 1726);
assert.equal(parsePid('SEARCHING...\r410D3C', '0D'), 60);
assert.equal(parsePid('BUS INIT: ...OK\r41 05 7B', '05'), 83);
assert.equal(parsePid('NO DATA', '0C'), null);
assert.equal(parsePid('4151 03', '51'), 'Etanol');

assert.deepEqual(parseSupported('41 00 BE 1F A8 13', '00').slice(0, 4), ['01', '03', '04', '05']);
assert.ok(parseSupported('4100BE1FA813', '00').includes('20'));
assert.deepEqual(parseSupported('4100 00000001\r4100 80000000', '00'), ['01', '20']); // motor + câmbio

assert.deepEqual(parseDtcs('43 01 33 00 00 00 00', '03', false), ['P0133']);
assert.deepEqual(parseDtcs('43 01 71 03 01 04 20\r43 C1 01 00 00 00 00', '03', false), ['P0171', 'P0301', 'P0420', 'U0101']);
assert.deepEqual(parseDtcs('43020171D300', '03', true), ['P0171', 'U1300']);
assert.deepEqual(parseDtcs('00A\r0:43040171030104\r1:20830000000000', '03', true), ['P0171', 'P0301', 'P0420', 'B0300']);
assert.deepEqual(parseDtcs('4300', '03', true), []);

assert.match(describe('P0302').text, /cilindro 2/);
assert.match(describe('P1234').text, /fabricante/);
assert.match(describe('P1136', 'vw').text, /pobre/);
assert.equal(describe('P1136', 'ford').own, true); // sem tabela: cai na categoria
assert.equal(parsePid('41A60007FC97', 'A6'), 52341.5);

// VIN: CAN multiquadro e K-line (uma linha por bloco de 4 bytes)
assert.equal(parseVin('014\r0:490201394244\r1:41423132333435\r2:36373839303132'), '9BDAB123456789012');
assert.equal(parseVin('49 02 01 00 00 00 39\r49 02 02 42 44 41 42\r49 02 03 31 32 33 34\r49 02 04 35 36 37 38\r49 02 05 39 30 31 32'), '9BDAB123456789012');
assert.deepEqual(decodeVin('9BGKS48U0LG123456', 2026), { brand: 'Chevrolet', make: 'gm', country: 'Brasil', year: 2020 });
assert.equal(decodeVin('9BWZZZ377XT004251', 2026).year, 1999);
assert.equal(decodeVin('WF0XXXGCD8X000001', 2026).year, 2008);

// Fluxo completo contra o simulador
const elm = new Elm(new DemoTransport());
await elm.t.open();
const info = await elm.init();
assert.ok(elm.isCan && info.supported.includes('52'));
assert.ok((await elm.read('0C')) >= 850);
assert.deepEqual(await elm.dtcs('03'), ['P0171', 'P0301', 'P0420', 'P1136']);
assert.equal(await elm.vin(), '9BWAG45U3LP012345');

// Prontidão: MIL acesa, 3 códigos, gasolina; catalisador ok, EVAP incompleto
const st = parseMonitors('41 01 83 07 65 04');
assert.equal(st.mil, true); assert.equal(st.count, 3); assert.equal(st.diesel, false);
assert.deepEqual(st.monitors.filter(m => !m.complete).map(m => m.name), ['Sistema EVAP (cânister)']);
assert.equal(st.monitors.length, 7);
assert.equal(parseSupported('42 00 00 BE 1F A8 13', '00', '02')[0], '01');
assert.equal(parsePid('42 0C 00 1A F8', '0C', '02'), 1726);
assert.deepEqual(parseMode6('013\r0:46A40B24000C00\r1:00FFFFA40C24001B\r2:0000FFFF000000').map(r => [r.tid, r.val]), [['0B', 12], ['0C', 27]]);

const ff = await elm.freeze();
assert.equal(ff.code, 'P0171'); assert.ok(ff.values.length > 10);
assert.deepEqual((await elm.misfires()).map(m => [m.cyl, m.cur]), [[1, 1], [2, 1], [3, 27], [4, 1]]);
console.log('ok');

// Importação CSV (formato Torque)
const { parseTorqueCsv, compile } = await import('./custom.js');
assert.equal(compile('A-40')([130]), 90);
assert.equal(compile('(A*256+B)/10')([1, 44]), 30);
assert.equal(compile('Signed(A)*2')([0xF0]), -32);
assert.equal(compile('{B:7}')([0, 0x80]), 1);
assert.equal(compile('INT(AA/3)')(Array(27).fill(10)), 3);
assert.throws(() => compile('A; alert(1)'));
assert.throws(() => compile('constructor'));
const csv = parseTorqueCsv('Name,ShortName,ModeAndPID,Equation,Min Value,Max Value,Units,Header\n"Temp. câmbio, ATF",ATF,0x221940,A-40,-40,150,°C,7E1\nRuim,R,zz,A,0,1,,\nSem header,S,2101FF,A*2,,,%,');
assert.equal(csv.pids.length, 2); assert.equal(csv.errors.length, 1);
assert.deepEqual([csv.pids[0].name, csv.pids[0].cmd, csv.pids[0].prefix, csv.pids[0].header], ['Temp. câmbio, ATF', '221940', '621940', '7E1']);
assert.equal(csv.pids[1].max, 100);
// leitura via simulador com troca de cabeçalho
const { PIDS } = await import('./obd.js');
PIDS.X0 = csv.pids[0];
const atf = await elm.read('X0');
assert.ok(atf >= 20 && atf <= 70, atf);
assert.equal(elm.hdr, '7E1');
assert.ok((await elm.read('0C')) > 0); assert.equal(elm.hdr, null);
console.log('ok csv');
