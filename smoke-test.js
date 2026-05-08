// Smoke test: spawns the server, connects two socket.io clients,
// drives them through join -> pick character -> ready -> verify match starts and ticks.
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3199;
const env = { ...process.env, PORT };
const srv = spawn(process.execPath, [path.join(__dirname, 'server.js')], { env, stdio: 'pipe' });

let exitCode = 1;
const log = (...a) => console.log('[test]', ...a);

srv.stdout.on('data', d => process.stdout.write('[srv] ' + d));
srv.stderr.on('data', d => process.stderr.write('[srv-err] ' + d));

async function run() {
  await wait(800);
  const { io } = require('socket.io-client');
  const a = io('http://localhost:' + PORT, { transports: ['websocket'] });
  const b = io('http://localhost:' + PORT, { transports: ['websocket'] });
  let snapsA = 0, snapsB = 0, sawSetup = false, sawBreak = false;
  a.on('snapshot', s => { snapsA++; if (s.phase === 'setup') sawSetup = true; if (s.phase === 'break') sawBreak = true; });
  b.on('snapshot', s => { snapsB++; });

  const joinedA = new Promise((res, rej) => { a.once('joined', res); setTimeout(() => rej(new Error('A joined timeout')), 3000); });
  const joinedB = new Promise((res, rej) => { b.once('joined', res); setTimeout(() => rej(new Error('B joined timeout')), 3000); });
  a.emit('joinRoom', { roomId: 'smoke', displayName: 'Naarad-A' });
  b.emit('joinRoom', { roomId: 'smoke', displayName: 'Naarad-B' });
  await Promise.all([joinedA, joinedB]);
  log('both clients joined');
  // wait for first snapshots
  await wait(400);

  // pick characters: A on pandavas (arjuna), B on kauravas (karna)
  a.emit('switchTeam', { team: 'pandavas' });
  a.emit('pickCharacter', { character: 'arjuna' });
  b.emit('switchTeam', { team: 'kauravas' });
  b.emit('pickCharacter', { character: 'karna' });
  await wait(300);
  a.emit('setReady', { ready: true });
  b.emit('setReady', { ready: true });
  await wait(2000);

  log('snapsA=', snapsA, 'snapsB=', snapsB, 'sawSetup=', sawSetup, 'sawBreak=', sawBreak);

  // simulate some movement input
  a.emit('input', { right: true, attack: true, facing: 0 });
  await wait(800);

  // place a trap as B during setup
  b.emit('placeTrap', { x: 25, y: 18 });
  await wait(500);

  if (snapsA > 30 && snapsB > 30 && sawSetup) {
    log('PASS: server tick + lobby flow + setup phase reached');
    exitCode = 0;
  } else {
    log('FAIL: insufficient snapshots or never reached setup phase');
  }
  a.close(); b.close();
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

run().catch(e => { console.error(e); exitCode = 2; }).finally(async () => {
  await wait(200);
  srv.kill('SIGTERM');
  setTimeout(() => process.exit(exitCode), 400);
});
