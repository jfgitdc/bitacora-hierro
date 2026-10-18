// Bitácora de Hierro · v1.1
// App web instalable (PWA) con Firebase Authentication + Cloud Firestore (con caché sin conexión).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut }
  from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, setDoc, deleteDoc,
  onSnapshot, query, orderBy, limit, writeBatch } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig, APP_VERSION } from './firebase-config.js';

/* ================= Firebase ================= */
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
let db;
try { db = initializeFirestore(fbApp, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
catch (e) { db = initializeFirestore(fbApp, {}); }

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));

/* ================= Constantes ================= */
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const REGISTROS = { peso_reps: 'Peso y repeticiones', peso_corporal: 'Peso corporal (+ lastre)', tiempo: 'Por tiempo', cardio: 'Cardio' };
const IC = {
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>'
};

/* ================= Estado ================= */
const S = {
  user: null, authReady: false, loginErr: '', loginOk: '',
  catalog: [], grupos: [], catMap: {}, catErr: false,
  perfil: null, perfilLoaded: false, plantillas: {}, plLoaded: false,
  sesiones: [], sesLoaded: false, activa: null, actLoaded: false,
  tab: 'hoy', rutView: 'semana', editPl: null, verSesion: null,
  picker: null, confirm: null, timer: null, needRender: false
};
let unsubs = [], lastPerfilEdit = 0;
const lastPlEdit = {};

/* ================= Utilidades ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const hoyIdx = () => (new Date().getDay() + 6) % 7;
const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const isNum = v => v !== '' && v != null && !isNaN(v);
const fechaCorta = iso => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
const fechaLarga = iso => new Date(iso).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const hora = iso => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

/* ================= Rutas en Firestore ================= */
const R = {
  perfil: () => doc(db, 'users', S.user.uid, 'config', 'perfil'),
  activa: () => doc(db, 'users', S.user.uid, 'config', 'activa'),
  pl: id => doc(db, 'users', S.user.uid, 'plantillas', id),
  plCol: () => collection(db, 'users', S.user.uid, 'plantillas'),
  ses: id => doc(db, 'users', S.user.uid, 'sesiones', id),
  sesCol: () => collection(db, 'users', S.user.uid, 'sesiones')
};

/* ================= Guardado ================= */
function setSave(t) {
  const el = $('#save'); el.textContent = t;
  clearTimeout(setSave.t);
  if (t === 'Guardado') setSave.t = setTimeout(() => { if (el.textContent === 'Guardado') el.textContent = ''; }, 1800);
}
function escribir(ref, data) {
  setSave(navigator.onLine ? 'Guardando…' : 'Sin conexión · se guarda en el celular');
  const p = data === null ? deleteDoc(ref) : setDoc(ref, data);
  p.then(() => setSave('Guardado')).catch(e => { console.error(e); setSave('No se pudo guardar'); });
  return p;
}
const timers = {};
function programar(key, fn, delay) { clearTimeout(timers[key]); timers[key] = setTimeout(fn, delay); }
function guardarPerfil(delay = 600) { lastPerfilEdit = Date.now(); programar('perfil', () => escribir(R.perfil(), clone(S.perfil)), delay); }
function guardarPl(id, delay = 600) {
  lastPlEdit[id] = Date.now();
  programar('pl:' + id, () => { if (S.plantillas[id]) escribir(R.pl(id), clone(S.plantillas[id])); }, delay);
}
function guardarAct(delay = 400) { programar('act', () => escribir(R.activa(), S.activa ? clone(S.activa) : null), delay); }
window.addEventListener('online', () => setSave('Conectado'));
window.addEventListener('offline', () => setSave('Sin conexión · se guarda en el celular'));

/* ================= Sesión de usuario ================= */
onAuthStateChanged(auth, user => {
  unsubs.forEach(u => u()); unsubs = [];
  Object.assign(S, { user, authReady: true, perfil: null, perfilLoaded: false, plantillas: {}, plLoaded: false,
    sesiones: [], sesLoaded: false, activa: null, actLoaded: false, tab: 'hoy', editPl: null, verSesion: null, picker: null, confirm: null });
  if (user) suscribir();
  render();
});

function suscribir() {
  unsubs.push(onSnapshot(R.perfil(), { includeMetadataChanges: false }, snap => {
    if (snap.metadata.hasPendingWrites) return;
    if (!snap.exists() && snap.metadata.fromCache && navigator.onLine && !S.perfilLoaded) return; // esperar al servidor
    if (S.perfilLoaded && Date.now() - lastPerfilEdit < 4000) return;
    S.perfil = snap.exists() ? clone(snap.data()) : null; S.perfilLoaded = true; buildMap(); scheduleRender();
  }, err => { console.error(err); S.perfilLoaded = true; scheduleRender(); }));

  unsubs.push(onSnapshot(R.plCol(), snap => {
    if (snap.empty && snap.metadata.fromCache && navigator.onLine && !S.plLoaded) return;
    const nuevo = {};
    for (const d of snap.docs) {
      const local = S.plantillas[d.id];
      if (local && (d.metadata.hasPendingWrites || Date.now() - (lastPlEdit[d.id] || 0) < 4000)) nuevo[d.id] = local;
      else nuevo[d.id] = Object.assign(clone(d.data()), { id: d.id });
    }
    S.plantillas = nuevo; S.plLoaded = true; scheduleRender();
  }, err => { console.error(err); S.plLoaded = true; scheduleRender(); }));

  unsubs.push(onSnapshot(query(R.sesCol(), orderBy('fecha', 'desc'), limit(500)), snap => {
    S.sesiones = snap.docs.map(d => Object.assign({ id: d.id }, d.data())); S.sesLoaded = true; scheduleRender();
  }, err => { console.error(err); S.sesLoaded = true; scheduleRender(); }));

  // La sesión en curso se lee una vez; desde ahí, el estado local es el que manda.
  const off = onSnapshot(R.activa(), snap => {
    if (!snap.exists() && snap.metadata.fromCache && navigator.onLine && !S.actLoaded) return;
    off();
    S.activa = snap.exists() ? clone(snap.data()) : null; S.actLoaded = true; render(); if (S.activa) wake();
  }, err => { console.error(err); S.actLoaded = true; render(); });
  unsubs.push(() => { try { off(); } catch (e) {} });

  // Si no hay respuesta del servidor (sin señal y sin caché), no bloquear la app.
  setTimeout(() => {
    let changed = false;
    for (const k of ['perfilLoaded', 'plLoaded', 'sesLoaded', 'actLoaded']) if (!S[k]) { S[k] = true; changed = true; }
    if (changed) render();
  }, 6000);
}

/* ================= Catálogo ================= */
fetch('catalogo-ejercicios.json').then(r => { if (!r.ok) throw new Error(); return r.json(); })
  .then(d => { S.catalog = d.ejercicios || []; S.grupos = d.grupos || []; buildMap(); scheduleRender(); })
  .catch(() => { S.catErr = true; scheduleRender(); });

function buildMap() {
  S.catMap = {};
  for (const e of S.catalog) S.catMap[e.id] = e;
  for (const e of (S.perfil && S.perfil.personalizados) || []) S.catMap[e.id] = e;
}
function getEj(id) { return S.catMap[id] || { id, nombre: id, grupo: '', registro: 'peso_reps', carga: 'total', equipo: '', alias: [] }; }
function grupoNombre(g) { const x = S.grupos.find(z => z.id === g); return x ? x.nombre : (g || ''); }
function campos(ej, carga) {
  const c = carga || ej.carga;
  if (ej.registro === 'cardio') return [['min', 'min'], ['nivel', 'nivel']];
  if (ej.registro === 'tiempo') return c && c !== 'ninguna' ? [['kg', c === 'por_mano' ? 'kg c/u' : 'kg'], ['seg', 'seg']] : [['seg', 'seg']];
  if (ej.registro === 'peso_corporal') return [['kg', '+kg'], ['reps', 'reps']];
  return [['kg', c === 'por_mano' ? 'kg c/u' : 'kg'], ['reps', 'reps']];
}
function fmtSet(s, ej, carga) {
  const c = carga || ej.carga; const u = c === 'por_mano' ? ' c/u' : '';
  if (ej.registro === 'cardio') return [isNum(s.min) ? s.min + ' min' : '', isNum(s.nivel) ? 'niv ' + s.nivel : ''].filter(Boolean).join(' · ') || '—';
  if (ej.registro === 'tiempo') return (isNum(s.kg) && +s.kg ? s.kg + 'kg' + u + ' · ' : '') + (isNum(s.seg) ? s.seg + ' s' : '—');
  if (ej.registro === 'peso_corporal') return (isNum(s.kg) && +s.kg ? 'PC+' + s.kg : 'PC') + '×' + (isNum(s.reps) ? s.reps : '—');
  return (isNum(s.kg) ? s.kg : '—') + u + '×' + (isNum(s.reps) ? s.reps : '—');
}
function serieVacia(id, prev) {
  const s = {};
  for (const [k] of campos(getEj(id))) s[k] = k === 'reps' ? (prev && isNum(prev.reps) ? prev.reps : 10) : k === 'seg' ? 30 : k === 'min' ? 20 : '';
  return s;
}
function defaultSeries(id, n, prev) { const out = []; for (let i = 0; i < n; i++) out.push(serieVacia(id, prev && prev[i])); return out; }
function ultima(ej) {
  for (const s of S.sesiones) for (const it of s.items || []) if (it.ej === ej) {
    const h = (it.series || []).filter(x => x.hecho !== false);
    if (h.length) return { fecha: s.fecha, series: h, carga: it.carga };
  }
  return null;
}
function prefill(ej, objetivo) {
  const u = ultima(ej); const keys = campos(getEj(ej)).map(x => x[0]);
  const n = objetivo.length || (u ? u.series.length : 3); const out = [];
  for (let i = 0; i < n; i++) {
    const base = (u && u.series[i]) || objetivo[i] || (u && u.series[u.series.length - 1]) || objetivo[objetivo.length - 1] || serieVacia(ej);
    const s = { hecho: false }; for (const k of keys) s[k] = base[k] ?? ''; out.push(s);
  }
  return out;
}
function volumen(ses) {
  let v = 0;
  for (const it of ses.items || []) {
    const ej = getEj(it.ej); if (ej.registro !== 'peso_reps') continue;
    const f = (it.carga || ej.carga) === 'por_mano' ? 2 : 1;
    for (const s of it.series || []) if (s.hecho !== false && isNum(s.kg) && isNum(s.reps)) v += s.kg * s.reps * f;
  }
  return Math.round(v);
}
const seriesHechas = ses => (ses.items || []).reduce((n, it) => n + (it.series || []).filter(s => s.hecho !== false).length, 0);
const plOrdenadas = () => Object.values(S.plantillas).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
function semana() { return (S.perfil && S.perfil.semana) || DIAS.map(() => ({ plantilla: null, descanso: false })); }
function diasDePl(id) { return semana().map((d, i) => d.plantilla === id ? i : -1).filter(i => i >= 0); }

/* ================= Acciones de sesión ================= */
function nuevaSesion(pid) {
  const pl = pid ? S.plantillas[pid] : null;
  S.activa = {
    id: nid(), plantilla: pl ? pid : null, dia: hoyIdx(), nombre: pl ? (pl.nombre || 'Entrenamiento') : 'Sesión libre', inicio: new Date().toISOString(),
    items: (pl ? pl.items : []).map(it => ({ uid: nid(), rid: it.uid, ej: it.ej, origen: 'rutina', descanso: it.descanso || 0, nota: it.nota || '', carga: it.carga || '',
      objetivo: clone(it.series || []), series: prefill(it.ej, it.series || []) }))
  };
  guardarAct(0); S.tab = 'hoy'; render(); window.scrollTo(0, 0); wake();
}
function terminar() {
  const a = S.activa; const hechas = a.items.reduce((n, it) => n + it.series.filter(s => s.hecho).length, 0);
  if (!hechas) { ask('No marcaste ninguna serie', 'Marca con ✓ cada serie que completes. Si no entrenaste, puedes descartar esta sesión.', 'Descartar sesión', descartar); return; }
  const fin = new Date(); const ses = clone(a); delete ses.id;
  ses.fin = fin.toISOString(); ses.fecha = a.inicio; ses.duracionMin = Math.max(1, Math.round((fin - new Date(a.inicio)) / 60000));
  ses.items = ses.items.map(it => { it.series = it.series.filter(s => s.hecho); return it; }).filter(it => it.series.length);
  escribir(R.ses(a.id), ses);
  S.activa = null; S.timer = null; tick(); clearTimeout(timers.act); escribir(R.activa(), null); liberar();
  S.tab = 'historial'; S.verSesion = a.id;
  toast(navigator.onLine ? 'Sesión guardada' : 'Sesión guardada en el celular · se sube al volver la señal');
  render(); window.scrollTo(0, 0);
}
function descartar() { S.activa = null; S.timer = null; tick(); clearTimeout(timers.act); escribir(R.activa(), null); liberar(); render(); toast('Sesión descartada'); }

/* ================= Temporizador y pantalla encendida ================= */
let tInt = null;
function startTimer(sec) { if (!sec) return; S.timer = { end: Date.now() + sec * 1000, total: sec }; clearInterval(tInt); tInt = setInterval(tick, 250); tick(); }
function tick() {
  const el = $('#timer');
  if (!S.timer) { el.hidden = true; clearInterval(tInt); return; }
  const left = Math.ceil((S.timer.end - Date.now()) / 1000);
  if (left <= 0) { S.timer = null; el.hidden = true; clearInterval(tInt); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {} toast('Descanso terminado'); return; }
  el.hidden = false; el.querySelector('.t-num').textContent = mmss(left);
  el.querySelector('.t-bar').style.transform = 'scaleX(' + Math.max(0, Math.min(1, left / S.timer.total)) + ')';
}
let wl = null;
async function wake() { if (!S.activa || wl) return; try { if ('wakeLock' in navigator) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } } catch (e) { wl = null; } }
function liberar() { try { wl && wl.release(); } catch (e) {} wl = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { wake(); tick(); } });

/* ================= Ayudas de interfaz ================= */
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2800); }
function ask(titulo, texto, ok, fn) { S.confirm = { titulo, texto, ok, fn }; renderOverlay(); }
function scheduleRender() {
  const a = document.activeElement;
  if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { S.needRender = true; return; }
  render();
}
document.addEventListener('focusout', () => setTimeout(() => {
  if (!S.needRender) return; const a = document.activeElement;
  if (!a || !/INPUT|TEXTAREA|SELECT/.test(a.tagName)) { S.needRender = false; render(); }
}, 50));

/* ================= Vistas ================= */
const listo = () => S.perfilLoaded && S.plLoaded && S.actLoaded;
const vCargando = () => '<div class="card empty"><h3>Cargando tus datos…</h3><p class="muted">Un momento.</p></div>';

function vLogin() {
  return `<section class="login">
    <img class="logo" src="icons/icon-192.png" alt="">
    <div><div class="brand">Tu entrenamiento, serie por serie</div><h1>Bitácora de Hierro</h1></div>
    <form id="login-form" novalidate>
      <label class="f">Correo<input class="inp" id="lg-email" type="email" autocomplete="username" inputmode="email" required></label>
      <label class="f">Contraseña<input class="inp" id="lg-pass" type="password" autocomplete="current-password" required></label>
      ${S.loginErr ? `<div class="err" role="alert">${esc(S.loginErr)}</div>` : ''}
      ${S.loginOk ? `<div class="ok" role="status">${esc(S.loginOk)}</div>` : ''}
      <button class="btn primary big block" type="submit" id="lg-btn">Entrar</button>
      <button class="btn ghost block" type="button" data-act="reset-pass">Olvidé mi contraseña</button>
    </form>
  </section>`;
}
function errAuth(e) {
  const c = (e && e.code) || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-email')) return 'El correo o la contraseña no coinciden. Revísalos e inténtalo de nuevo.';
  if (c.includes('too-many-requests')) return 'Demasiados intentos seguidos. Espera unos minutos o restablece tu contraseña.';
  if (c.includes('network-request-failed')) return 'Sin conexión. Necesitas internet para iniciar sesión la primera vez.';
  if (c.includes('missing-email')) return 'Escribe tu correo primero.';
  return 'No se pudo completar. Inténtalo de nuevo.';
}

function vBienvenida() {
  return `<div class="card empty" style="margin-top:12px"><h3>Bienvenido, Javier</h3>
    <p class="muted">Carga tu archivo de datos para traer tu rutina actual, o empieza con la semana vacía.</p>
    <div class="stack" style="margin-top:14px"><button class="btn primary block big" data-act="importar">Importar mis datos (.json)</button>
    <button class="btn block" data-act="empezar-cero">Empezar desde cero</button></div></div>`;
}

function vHoy() {
  if (!listo()) return vCargando();
  if (S.activa) return vSesion();
  if (!S.perfil && !Object.keys(S.plantillas).length) return vBienvenida();
  const h = hoyIdx(); const d = semana()[h]; const pl = d.plantilla && S.plantillas[d.plantilla];
  let html = `<div class="card today"><div class="day">${DIAS[h]} · hoy</div>`;
  if (d.descanso) html += `<h3>Día de descanso</h3><p class="muted">Recuperarse también es entrenar. Si igual vas al gimnasio, elige una rutina abajo.</p>`;
  else if (!pl) html += `<h3>Sin rutina asignada</h3><p class="muted">Asigna una plantilla a este día en Rutinas, o elige una abajo.</p>`;
  else if (!pl.items.length) html += `<h3>${esc(pl.nombre)}</h3><p class="muted">Esta plantilla aún no tiene ejercicios. Agrégalos en Rutinas → Plantillas.</p>`;
  else {
    html += `<h3>${esc(pl.nombre)}</h3><ul class="plan">`;
    for (const it of pl.items) { const ej = getEj(it.ej); html += `<li><span class="code">${esc(it.ej)}</span><div class="nm">${esc(ej.nombre)}<div class="sets">${(it.series || []).length} series · ${(it.series || []).map(s => fmtSet(s, ej, it.carga)).join(' · ')}</div></div></li>`; }
    html += `</ul><button class="btn primary block big" data-act="start" data-p="${esc(pl.id)}">Empezar entrenamiento</button>`;
  }
  html += '</div>';
  const otras = plOrdenadas().filter(p => p.items.length && p.id !== (pl && pl.id));
  html += '<h2 class="sec">Entrenar otra rutina</h2><div class="row">';
  for (const p of otras) html += `<button class="chip" data-act="start" data-p="${esc(p.id)}">${esc(p.nombre)}</button>`;
  html += `<button class="chip" data-act="start-libre">Sesión libre</button></div>`;
  if (S.sesiones[0]) html += `<h2 class="sec">Última sesión</h2><ul class="hist">${filaHist(S.sesiones[0])}</ul>`;
  return html;
}

function vSesion() {
  const a = S.activa;
  const tot = a.items.reduce((n, it) => n + it.series.length, 0), hechas = a.items.reduce((n, it) => n + it.series.filter(s => s.hecho).length, 0);
  let html = `<div class="card"><div class="sess-head"><div><div class="brand">Entrenando · desde las ${hora(a.inicio)}</div>
    <div class="title" style="font-size:26px">${esc(a.nombre)}</div></div><div class="num" style="font-size:26px;font-weight:700">${hechas}<span class="muted" style="font-size:18px">/${tot}</span></div></div>
    <div class="progress" aria-label="Series completadas"><i style="width:${tot ? hechas / tot * 100 : 0}%"></i></div></div><div class="stack" style="margin-top:12px">`;
  a.items.forEach((it, i) => { html += cardSesion(it, i, a.items.length); });
  if (!a.items.length) html += '<div class="card empty"><h3>Sin ejercicios</h3><p class="muted">Agrega el primero para empezar.</p></div>';
  html += `</div><div class="stack" style="margin-top:12px">
    <button class="btn block" data-act="item-add">${IC.plus} Agregar ejercicio</button>
    <button class="btn primary block big" data-act="finish">Terminar y guardar</button>
    <button class="btn ghost danger block" data-act="discard">Descartar sesión</button></div>`;
  return html;
}
function cardSesion(it, i, n) {
  const ej = getEj(it.ej); const cs = campos(ej, it.carga); const u = ultima(it.ej);
  let meta = `<span>${esc(grupoNombre(ej.grupo))}</span>`;
  if (it.descanso) meta += `<span>· descanso ${it.descanso} s</span>`;
  if (it.origen === 'cambio') meta += ` <span class="tag swap">Reemplaza a ${esc(it.reemplazaA)} · ${esc(getEj(it.reemplazaA).nombre)}</span>`;
  if (it.origen === 'agregado') meta += ' <span class="tag add">Agregado hoy</span>';
  let h = `<article class="ex ${it.origen === 'cambio' ? 'is-swap' : ''}"><div class="ex-h"><div><span class="code">${esc(it.ej)}</span><h3>${esc(ej.nombre)}</h3><div class="meta">${meta}</div></div>
    <div class="tools"><button class="icon" data-act="item-swap" data-i="${i}" aria-label="Cambiar ejercicio" title="Cambiar ejercicio">${IC.swap}</button>
    <button class="icon danger" data-act="item-del" data-i="${i}" aria-label="Quitar de esta sesión" title="Quitar">${IC.del}</button></div></div>`;
  if (it.nota) h += `<div class="note">${esc(it.nota)}</div>`;
  if (u) h += `<div class="hint">Última vez (${fechaCorta(u.fecha)}): <b>${u.series.map(s => fmtSet(s, ej, u.carga || it.carga)).join(' · ')}</b></div>`;
  if (it.objetivo && it.objetivo.length) h += `<div class="hint">Meta de la plantilla: ${it.objetivo.map(s => fmtSet(s, ej, it.carga)).join(' · ')}</div>`;
  h += `<table class="sets-t"><thead><tr><th></th>${cs.map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>`;
  it.series.forEach((s, j) => {
    h += `<tr class="${s.hecho ? 'done' : ''}"><td class="n">${j + 1}</td>${cs.map(c => `<td><input class="fld" inputmode="decimal" autocomplete="off" id="s-${it.uid}-${j}-${c[0]}" data-s="${i}|${j}|${c[0]}" value="${esc(s[c[0]])}" aria-label="Serie ${j + 1} ${c[1]}"></td>`).join('')}
      <td style="width:58px"><button class="chk" data-act="set-check" data-i="${i}" data-j="${j}" aria-pressed="${s.hecho ? 'true' : 'false'}" aria-label="Serie ${j + 1} hecha">${IC.check}</button></td></tr>`;
  });
  h += `</tbody></table><div class="ex-foot">
    ${i > 0 ? `<button class="btn sm ghost" data-act="item-up" data-i="${i}" aria-label="Subir">${IC.up}</button>` : ''}
    ${i < n - 1 ? `<button class="btn sm ghost" data-act="item-down" data-i="${i}" aria-label="Bajar">${IC.down}</button>` : ''}
    <button class="btn sm" data-act="set-del" data-i="${i}" ${it.series.length < 2 ? 'disabled' : ''}>${IC.minus} Serie</button>
    <button class="btn sm" data-act="set-add" data-i="${i}">${IC.plus} Serie</button></div></article>`;
  return h;
}

function vRutinas() {
  if (!listo()) return vCargando();
  if (!S.perfil && !Object.keys(S.plantillas).length) return vBienvenida();
  if (S.editPl) { if (S.plantillas[S.editPl]) return vPlantilla(S.editPl); S.editPl = null; }
  const seg = `<div class="seg" role="tablist"><button class="${S.rutView === 'semana' ? 'on' : ''}" data-act="rut-view" data-v="semana">Mi semana</button><button class="${S.rutView === 'plantillas' ? 'on' : ''}" data-act="rut-view" data-v="plantillas">Plantillas</button></div>`;
  return seg + (S.rutView === 'semana' ? vSemana() : vPlantillas());
}
function vSemana() {
  const h = hoyIdx(); const pls = plOrdenadas();
  let html = '<p class="muted small" style="margin:0 0 10px">Elige qué plantilla haces cada día. Para cambiar los ejercicios, edita la plantilla.</p><ul class="week">';
  semana().forEach((d, i) => {
    const v = d.descanso ? '__descanso' : (d.plantilla || '');
    html += `<li class="${i === h ? 'is-today' : ''}"><span class="dn">${DIAS[i]}</span><select class="inp" id="sem-${i}" data-f="sem|${i}" aria-label="Rutina del ${DIAS[i]}">
      <option value="" ${v === '' ? 'selected' : ''}>Sin asignar</option><option value="__descanso" ${v === '__descanso' ? 'selected' : ''}>Descanso</option>
      ${pls.map(p => `<option value="${esc(p.id)}" ${v === p.id ? 'selected' : ''}>${esc(p.nombre || 'Sin nombre')}</option>`).join('')}</select></li>`;
  });
  return html + '</ul>';
}
function vPlantillas() {
  const pls = plOrdenadas();
  let html = '<div class="stack">';
  for (const p of pls) {
    const dias = diasDePl(p.id);
    html += `<button class="pl-card" data-act="pl-open" data-p="${esc(p.id)}"><h3>${esc(p.nombre || 'Sin nombre')}</h3>
      <span class="muted small">${p.items.length} ejercicios${p.items.length ? ' · ' + esc(p.items.slice(0, 4).map(it => it.ej).join(', ')) + (p.items.length > 4 ? '…' : '') : ''}</span>
      <span class="daychips">${dias.length ? dias.map(i => `<span class="tag">${DIAS[i]}</span>`).join('') : '<span class="tag">Sin día asignado</span>'}</span></button>`;
  }
  if (!pls.length) html += '<div class="card empty"><h3>Aún no tienes plantillas</h3><p class="muted">Una plantilla es una rutina reutilizable, por ejemplo "Pierna" o "Pecho y tríceps".</p></div>';
  return html + `<button class="btn primary block" data-act="pl-new">${IC.plus} Nueva plantilla</button></div>`;
}
function vPlantilla(pid) {
  const pl = S.plantillas[pid]; const dias = diasDePl(pid);
  let html = `<div class="row" style="margin:6px 0 10px;justify-content:space-between"><button class="btn sm ghost" data-act="pl-back">${IC.back} Plantillas</button>
    <div class="row"><button class="btn sm" data-act="pl-dup" data-p="${esc(pid)}">${IC.copy} Duplicar</button><button class="btn sm danger" data-act="pl-del" data-p="${esc(pid)}">${IC.del} Eliminar</button></div></div>
  <div class="card stack"><label class="f">Nombre de la plantilla<input class="inp" id="pn-${esc(pid)}" data-f="pl-nombre|${esc(pid)}" value="${esc(pl.nombre)}" placeholder="Ej.: Pecho y tríceps"></label>
  <div class="muted small">Se usa: ${dias.length ? dias.map(i => DIAS[i]).join(', ') : 'ningún día (asígnala en Mi semana)'}</div></div><div class="stack" style="margin-top:12px">`;
  pl.items.forEach((it, i) => {
    const ej = getEj(it.ej); const cs = campos(ej, it.carga);
    html += `<article class="ex"><div class="ex-h"><div><span class="code">${esc(it.ej)}</span><h3>${esc(ej.nombre)}</h3><div class="meta">${esc(grupoNombre(ej.grupo))}</div></div>
      <div class="tools"><button class="icon" data-act="r-swap" data-p="${esc(pid)}" data-i="${i}" aria-label="Cambiar ejercicio">${IC.swap}</button>
      <button class="icon danger" data-act="r-del" data-p="${esc(pid)}" data-i="${i}" aria-label="Eliminar de la plantilla">${IC.del}</button></div></div>
      <table class="sets-t"><thead><tr><th></th>${cs.map(c => `<th>${c[1]} meta</th>`).join('')}</tr></thead><tbody>`;
    it.series.forEach((s, j) => { html += `<tr><td class="n">${j + 1}</td>${cs.map(c => `<td><input class="fld" inputmode="decimal" autocomplete="off" id="r-${it.uid}-${j}-${c[0]}" data-r="${esc(pid)}|${i}|${j}|${c[0]}" value="${esc(s[c[0]])}" aria-label="Serie ${j + 1} ${c[1]}"></td>`).join('')}</tr>`; });
    html += `</tbody></table>
      <div class="inline"><label class="f">Descanso (s)<input class="inp" inputmode="numeric" id="rdesc-${it.uid}" data-f="pl-descanso|${esc(pid)}|${i}" value="${esc(it.descanso || '')}"></label>
      <label class="f">Nota<input class="inp" id="rnota-${it.uid}" data-f="pl-nota|${esc(pid)}|${i}" value="${esc(it.nota || '')}" placeholder="Opcional"></label></div>
      ${ej.carga !== 'ninguna' && ej.registro !== 'cardio' ? `<label class="f" style="margin-top:8px">Cómo anotas el peso<select class="inp" id="rcarga-${it.uid}" data-f="pl-carga|${esc(pid)}|${i}">
        ${[['', 'Según el ejercicio (' + ({ total: 'peso total', por_mano: 'por mano', placas: 'kg de la máquina' }[ej.carga] || 'peso total') + ')'], ['total', 'Peso total'], ['por_mano', 'Por mano (c/u)']].map(o => `<option value="${o[0]}" ${String(it.carga || '') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>` : ''}
      <div class="ex-foot" style="margin-top:8px">
      ${i > 0 ? `<button class="btn sm ghost" data-act="r-up" data-p="${esc(pid)}" data-i="${i}" aria-label="Subir">${IC.up}</button>` : ''}
      ${i < pl.items.length - 1 ? `<button class="btn sm ghost" data-act="r-down" data-p="${esc(pid)}" data-i="${i}" aria-label="Bajar">${IC.down}</button>` : ''}
      <button class="btn sm" data-act="r-set-del" data-p="${esc(pid)}" data-i="${i}" ${it.series.length < 2 ? 'disabled' : ''}>${IC.minus} Serie</button>
      <button class="btn sm" data-act="r-set-add" data-p="${esc(pid)}" data-i="${i}">${IC.plus} Serie</button></div></article>`;
  });
  if (!pl.items.length) html += '<div class="card empty"><h3>Sin ejercicios</h3><p class="muted">Agrega los ejercicios de esta rutina.</p></div>';
  return html + `<button class="btn primary block" data-act="r-add" data-p="${esc(pid)}">${IC.plus} Agregar ejercicio</button></div>`;
}

function filaHist(s) {
  const d = new Date(s.fecha);
  return `<li><button data-act="ses-open" data-id="${esc(s.id)}"><div class="date-b"><b>${d.getDate()}</b><span>${d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')}</span></div>
    <div style="min-width:0"><div class="nm">${esc(s.nombre)}</div><div class="stats"><span>${d.toLocaleDateString('es-CO', { weekday: 'long' })}</span><span>${s.duracionMin || 0} min</span><span>${seriesHechas(s)} series</span><span>${volumen(s).toLocaleString('es-CO')} kg</span></div></div></button></li>`;
}
function vHistorial() {
  if (!S.sesLoaded) return vCargando();
  if (S.verSesion) { const s = S.sesiones.find(x => x.id === S.verSesion); if (s) return vSesionDet(s); S.verSesion = null; }
  if (!S.sesiones.length) return '<div class="card empty"><h3>Aún no hay sesiones</h3><p class="muted">Cuando termines tu primer entrenamiento aparecerá aquí, con cada serie que registraste.</p></div>';
  const semanaMs = Date.now() - 7 * 864e5; const n7 = S.sesiones.filter(s => new Date(s.fecha) > semanaMs).length;
  return `<div class="kpis" style="margin-top:8px"><div class="kpi"><b>${S.sesiones.length}</b><span>sesiones</span></div><div class="kpi"><b>${n7}</b><span>últimos 7 días</span></div><div class="kpi"><b>${S.sesiones.reduce((n, s) => n + seriesHechas(s), 0)}</b><span>series</span></div></div>
    <h2 class="sec">Sesiones</h2><ul class="hist">${S.sesiones.map(filaHist).join('')}</ul>`;
}
function vSesionDet(s) {
  let html = `<div class="row" style="margin:6px 0 10px"><button class="btn sm ghost" data-act="ses-back">${IC.back} Historial</button></div>
  <div class="card"><div class="brand">${esc(fechaLarga(s.fecha))} · ${hora(s.fecha)}</div><div class="title" style="font-size:28px">${esc(s.nombre)}</div>
  <div class="kpis" style="margin-top:12px"><div class="kpi"><b>${s.duracionMin || 0}</b><span>minutos</span></div><div class="kpi"><b>${seriesHechas(s)}</b><span>series</span></div><div class="kpi"><b>${volumen(s).toLocaleString('es-CO')}</b><span>kg de volumen</span></div></div></div>
  <div class="stack" style="margin-top:12px">`;
  for (const it of s.items || []) {
    const ej = getEj(it.ej);
    html += `<article class="ex ${it.origen === 'cambio' ? 'is-swap' : ''}"><span class="code">${esc(it.ej)}</span><h3>${esc(ej.nombre)}</h3>
    <div class="meta"><span>${esc(grupoNombre(ej.grupo))}</span>${it.origen === 'cambio' ? ` <span class="tag swap">Reemplazó a ${esc(it.reemplazaA)}</span>` : ''}${it.origen === 'agregado' ? ' <span class="tag add">Agregado</span>' : ''}</div>
    <div class="setchips">${(it.series || []).map(x => `<span>${fmtSet(x, ej, it.carga)}</span>`).join('')}</div></article>`;
  }
  return html + `</div><button class="btn ghost danger block" style="margin-top:16px" data-act="ses-del" data-id="${esc(s.id)}">Eliminar esta sesión</button>`;
}

function vCuenta() {
  const on = navigator.onLine;
  return `<div class="card account stack" style="margin-top:8px"><dl>
      <dt>Cuenta</dt><dd>${esc(S.user.email)}</dd>
      <dt>Conexión</dt><dd><span class="status-dot ${on ? '' : 'off'}"></span>${on ? 'En línea · sincronizado' : 'Sin conexión · se guarda en el celular'}</dd>
      <dt>Datos</dt><dd>${Object.keys(S.plantillas).length} plantillas · ${S.sesiones.length} sesiones</dd>
      <dt>Versión</dt><dd>${APP_VERSION}</dd></dl></div>
    <h2 class="sec">Respaldo</h2>
    <div class="stack"><button class="btn block" data-act="exportar">Descargar respaldo (.json)</button>
      <button class="btn block" data-act="importar">Restaurar desde un archivo</button>
      <p class="muted small" style="margin:0">Tus datos ya se guardan en la nube. El respaldo es una copia extra que puedes guardar o compartir para un análisis.</p></div>
    <h2 class="sec">Seguridad</h2>
    <div class="stack"><button class="btn block" data-act="cambiar-pass">Cambiar contraseña</button>
      <button class="btn block danger" data-act="logout">Cerrar sesión</button></div>`;
}

/* ================= Selector de ejercicios ================= */
function abrirPicker(p) { S.picker = Object.assign({ q: '', g: '', tambienPl: false }, p); renderOverlay(); }
function pickerLista() {
  const p = S.picker; const words = norm(p.q).split(/\s+/).filter(Boolean);
  const todos = S.catalog.concat((S.perfil && S.perfil.personalizados) || []);
  if (S.catErr && !S.catalog.length) return '<p class="muted">No se pudo cargar el catálogo de ejercicios. Recarga la app.</p>';
  const res = todos.filter(e => (!p.g || e.grupo === p.g || (p.g === 'MI' && e.personalizado)) && (!words.length || (txt => words.every(w => txt.includes(w)))(norm(e.id + ' ' + e.nombre + ' ' + (e.alias || []).join(' ') + ' ' + grupoNombre(e.grupo)))));
  if (!res.length) return '<p class="muted" style="padding:12px 0">Ningún ejercicio coincide. Puedes crearlo abajo.</p>';
  return res.map(e => `<button class="pk" data-act="pick" data-id="${esc(e.id)}"><span class="code">${esc(e.id)}</span><span style="min-width:0"><span class="nm">${esc(e.nombre)}</span><br><span class="sub">${esc(grupoNombre(e.grupo))}${e.equipo ? ' · ' + esc(e.equipo.replace('_', ' ')) : ''}</span></span></button>`).join('');
}
function vPicker() {
  const p = S.picker;
  const titulo = p.modo === 'cambiar' || p.modo === 'r-cambiar' ? 'Cambiar ejercicio' : 'Agregar ejercicio';
  const pers = (S.perfil && S.perfil.personalizados) || [];
  const grupos = [{ id: '', nombre: 'Todos' }].concat(S.grupos, pers.length ? [{ id: 'MI', nombre: 'Personalizados' }] : []);
  let sub = '';
  if (p.modo === 'cambiar') {
    const it = S.activa.items[p.idx]; const pl = S.activa.plantilla && S.plantillas[S.activa.plantilla];
    sub = `<p class="small muted" style="margin:0 0 6px">Reemplaza <b>${esc(it.ej)} · ${esc(getEj(it.ej).nombre)}</b> solo en la sesión de hoy.</p>`;
    if (it.rid && pl && pl.items.some(x => x.uid === it.rid)) sub += `<label class="switch small"><input type="checkbox" id="pk-pl" ${p.tambienPl ? 'checked' : ''}> Cambiarlo también en la plantilla «${esc(pl.nombre)}»</label>`;
  }
  return `<div class="back" data-act="picker-close"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="${titulo}">
    <div class="sheet-h"><h2>${titulo}</h2><button class="btn sm" data-act="picker-close">Cerrar</button></div>
    ${sub}<input class="inp" id="pk-q" type="search" placeholder="Buscar por nombre, código o alias" value="${esc(p.q)}" autocomplete="off">
    <div class="chips-x">${grupos.map(g => `<button class="chip ${p.g === g.id ? 'on' : ''}" data-act="pk-g" data-g="${g.id}">${esc(g.nombre)}</button>`).join('')}</div>
    <div class="pk-list" id="pk-list">${pickerLista()}</div>
    <details class="new"><summary>¿No está en la lista? Crear ejercicio</summary>
      <div class="stack" style="padding:6px 0 4px"><label class="f">Nombre<input class="inp" id="nv-nombre" placeholder="Ej.: Remo en máquina Hammer"></label>
      <div class="grid2"><label class="f">Grupo<select class="inp" id="nv-grupo">${S.grupos.map(g => `<option value="${g.id}">${esc(g.nombre)}</option>`).join('')}</select></label>
      <label class="f">Se registra por<select class="inp" id="nv-reg">${Object.entries(REGISTROS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label></div>
      <button class="btn primary" data-act="nv-crear">Crear y agregar</button></div></details></section>`;
}
function elegir(id) {
  const p = S.picker;
  if (p.modo === 'cambiar') {
    const it = S.activa.items[p.idx]; const old = it.ej; const n = it.series.length || 3;
    const nuevo = { uid: nid(), rid: it.rid || null, ej: id, origen: it.origen === 'agregado' ? 'agregado' : 'cambio', descanso: it.descanso || 0, nota: '', carga: '', objetivo: [], series: prefill(id, defaultSeries(id, n, it.series)) };
    if (nuevo.origen === 'cambio') nuevo.reemplazaA = it.origen === 'cambio' ? it.reemplazaA : old;
    S.activa.items[p.idx] = nuevo;
    if (p.tambienPl && it.rid && S.activa.plantilla && S.plantillas[S.activa.plantilla]) {
      const pl = S.plantillas[S.activa.plantilla]; const ri = pl.items.find(x => x.uid === it.rid);
      if (ri) { ri.ej = id; ri.series = defaultSeries(id, n, ri.series); ri.carga = ''; ri.nota = ''; guardarPl(pl.id, 0); }
    }
    guardarAct(0); toast(p.tambienPl ? 'Cambiado hoy y en la plantilla' : 'Cambiado solo para hoy');
  } else if (p.modo === 'agregar') {
    S.activa.items.push({ uid: nid(), rid: null, ej: id, origen: 'agregado', descanso: 60, nota: '', carga: '', objetivo: [], series: prefill(id, defaultSeries(id, 3)) }); guardarAct(0);
  } else if (p.modo === 'pl-add') {
    S.plantillas[p.pid].items.push({ uid: nid(), ej: id, series: defaultSeries(id, 3), descanso: 60, nota: '', carga: '' }); guardarPl(p.pid, 0);
  } else if (p.modo === 'r-cambiar') {
    const ri = S.plantillas[p.pid].items[p.idx]; ri.ej = id; ri.series = defaultSeries(id, ri.series.length || 3, ri.series); ri.carga = ''; guardarPl(p.pid, 0);
  }
  S.picker = null; render();
}

/* ================= Respaldo ================= */
function exportar() {
  const data = { formato: 'bitacora-hierro', version: 2, exportado: new Date().toISOString(),
    plantillas: Object.values(S.plantillas), semana: semana(), personalizados: (S.perfil && S.perfil.personalizados) || [], sesiones: S.sesiones };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'bitacora-respaldo-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Respaldo descargado');
}
function importar(data) {
  if (!data || data.formato !== 'bitacora-hierro' || !Array.isArray(data.plantillas)) { toast('Ese archivo no es un respaldo de Bitácora de Hierro'); return; }
  const ops = [];
  for (const p of data.plantillas) { const x = clone(p); const id = x.id || nid(); delete x.id; x.items = x.items || []; ops.push([R.pl(id), x]); }
  const perfil = { semana: data.semana || DIAS.map(() => ({ plantilla: null, descanso: false })), personalizados: data.personalizados || [] };
  ops.push([R.perfil(), perfil]);
  for (const s of data.sesiones || []) { const x = clone(s); const id = x.id || nid(); delete x.id; ops.push([R.ses(id), x]); }
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db); for (const [ref, val] of ops.slice(i, i + 400)) b.set(ref, val);
    b.commit().catch(e => { console.error(e); toast('No se pudo importar todo. Inténtalo de nuevo con conexión.'); });
  }
  S.perfil = perfil; S.perfilLoaded = true; lastPerfilEdit = Date.now(); buildMap();
  for (const p of data.plantillas) if (p.id) S.plantillas[p.id] = Object.assign(clone(p), { items: p.items || [] });
  toast(`Importado: ${data.plantillas.length} plantillas y ${(data.sesiones || []).length} sesiones`); render();
}
$('#file-import').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { importar(JSON.parse(r.result)); } catch (err) { toast('No se pudo leer el archivo'); } e.target.value = ''; };
  r.readAsText(f);
});

/* ================= Render ================= */
const TITULOS = { hoy: 'Hoy', rutinas: 'Rutinas', historial: 'Historial', cuenta: 'Cuenta' };
function render() {
  const dentro = S.authReady && S.user;
  $('#top').hidden = !dentro; $('#tabs').hidden = !dentro; document.body.classList.toggle('out', !dentro);
  $('#ver').textContent = 'Versión ' + APP_VERSION;
  if (!S.authReady) { $('#app').innerHTML = '<div class="card empty" style="margin-top:40px"><h3>Cargando…</h3></div>'; return; }
  if (!S.user) { $('#app').innerHTML = vLogin(); renderOverlay(); return; }
  let html;
  if (S.tab === 'hoy') html = vHoy(); else if (S.tab === 'rutinas') html = vRutinas(); else if (S.tab === 'historial') html = vHistorial(); else html = vCuenta();
  $('#app').innerHTML = html;
  $('#vtitle').textContent = S.tab === 'hoy' && S.activa ? 'Entrenando' : S.tab === 'rutinas' && S.editPl ? 'Plantilla' : TITULOS[S.tab];
  for (const t of ['hoy', 'rutinas', 'historial', 'cuenta']) $('#tab-' + t).classList.toggle('on', S.tab === t);
  $('#tab-hoy-l').textContent = S.activa ? 'Entrenando' : 'Hoy'; $('#tab-dot').hidden = !S.activa;
  renderOverlay();
}
function renderOverlay() {
  const o = $('#overlay'); let html = '';
  if (S.picker) html += vPicker();
  if (S.confirm) html += `<div class="back" style="z-index:30" data-act="confirm-no"></div><div class="dialog" role="alertdialog" aria-modal="true"><h3>${esc(S.confirm.titulo)}</h3><p class="muted">${esc(S.confirm.texto)}</p>
    <div class="row"><button class="btn" data-act="confirm-no">Cancelar</button><button class="btn primary" data-act="confirm-ok">${esc(S.confirm.ok)}</button></div></div>`;
  const hadPicker = !!o.querySelector('.sheet'); o.innerHTML = html;
  if (S.picker && !hadPicker) { const q = $('#pk-q'); if (q && window.matchMedia('(pointer:fine)').matches) q.focus(); }
}

/* ================= Eventos ================= */
function parseNum(v) { v = String(v).trim().replace(',', '.'); if (v === '') return ''; const n = Number(v); return isNaN(n) ? '' : n; }
function mover(arr, i, dir) { const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }

document.addEventListener('submit', async e => {
  if (e.target.id !== 'login-form') return;
  e.preventDefault();
  const email = $('#lg-email').value.trim(), pass = $('#lg-pass').value;
  if (!email || !pass) { S.loginErr = 'Escribe tu correo y tu contraseña.'; S.loginOk = ''; render(); return; }
  const btn = $('#lg-btn'); btn.disabled = true; btn.textContent = 'Entrando…';
  try { S.loginErr = ''; S.loginOk = ''; await signInWithEmailAndPassword(auth, email, pass); }
  catch (err) { S.loginErr = errAuth(err); render(); const em = $('#lg-email'); if (em) em.value = email; }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'pk-q') { S.picker.q = t.value; $('#pk-list').innerHTML = pickerLista(); return; }
  if (t.dataset.s) { const [i, j, k] = t.dataset.s.split('|'); S.activa.items[i].series[j][k] = parseNum(t.value); guardarAct(800); return; }
  if (t.dataset.r) { const [pid, i, j, k] = t.dataset.r.split('|'); S.plantillas[pid].items[i].series[j][k] = parseNum(t.value); guardarPl(pid); return; }
  if (t.dataset.f) {
    const [f, pid, i] = t.dataset.f.split('|'); const pl = S.plantillas[pid]; if (!pl) return;
    if (f === 'pl-nombre') pl.nombre = t.value;
    else if (f === 'pl-descanso') pl.items[i].descanso = parseNum(t.value) || 0;
    else if (f === 'pl-nota') pl.items[i].nota = t.value;
    else return;
    guardarPl(pid);
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'pk-pl') { S.picker.tambienPl = t.checked; return; }
  if (!t.dataset.f) return;
  const [f, a, i] = t.dataset.f.split('|');
  if (f === 'sem') {
    if (!S.perfil) S.perfil = { semana: semana(), personalizados: [] };
    S.perfil.semana = semana(); const v = t.value;
    S.perfil.semana[+a] = { plantilla: v && v !== '__descanso' ? v : null, descanso: v === '__descanso' };
    guardarPerfil(0); toast('Semana actualizada');
  } else if (f === 'pl-carga') { S.plantillas[a].items[i].carga = t.value; guardarPl(a, 0); render(); }
});

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, i = +b.dataset.i, pid = b.dataset.p;
  switch (a) {
    case 'tab': S.tab = b.dataset.v; if (S.tab === 'historial') S.verSesion = null; if (S.tab === 'rutinas') S.editPl = null; render(); window.scrollTo(0, 0); break;
    case 'reset-pass': {
      const email = ($('#lg-email') || {}).value || '';
      if (!email.trim()) { S.loginErr = 'Escribe tu correo arriba y vuelve a tocar "Olvidé mi contraseña".'; S.loginOk = ''; render(); break; }
      sendPasswordResetEmail(auth, email.trim()).then(() => { S.loginOk = 'Si el correo está registrado, te llegará un enlace para crear una contraseña nueva.'; S.loginErr = ''; render(); $('#lg-email').value = email; })
        .catch(err => { S.loginErr = errAuth(err); S.loginOk = ''; render(); $('#lg-email').value = email; });
      break;
    }
    case 'cambiar-pass': sendPasswordResetEmail(auth, S.user.email).then(() => toast('Te enviamos un correo para cambiar la contraseña')).catch(err => toast(errAuth(err))); break;
    case 'logout': ask('¿Cerrar sesión?', 'Tus datos quedan guardados en la nube. Para volver a entrar necesitarás tu correo y contraseña.', 'Cerrar sesión', () => { liberar(); S.timer = null; tick(); signOut(auth); }); break;
    case 'importar': $('#file-import').click(); break;
    case 'exportar': exportar(); break;
    case 'empezar-cero': S.perfil = { semana: DIAS.map(() => ({ plantilla: null, descanso: false })), personalizados: [] }; guardarPerfil(0); S.tab = 'rutinas'; S.rutView = 'plantillas'; render(); break;
    case 'start': nuevaSesion(pid); break;
    case 'start-libre': nuevaSesion(null); break;
    case 'set-check': { const s = S.activa.items[i].series[+b.dataset.j]; s.hecho = !s.hecho; guardarAct(0); if (s.hecho) startTimer(+S.activa.items[i].descanso || 0); render(); break; }
    case 'set-add': { const it = S.activa.items[i]; const s = clone(it.series[it.series.length - 1] || serieVacia(it.ej)); s.hecho = false; it.series.push(s); guardarAct(0); render(); break; }
    case 'set-del': { const it = S.activa.items[i]; if (it.series.length > 1) { it.series.pop(); guardarAct(0); render(); } break; }
    case 'item-up': mover(S.activa.items, i, -1); guardarAct(0); render(); break;
    case 'item-down': mover(S.activa.items, i, 1); guardarAct(0); render(); break;
    case 'item-swap': abrirPicker({ modo: 'cambiar', idx: i }); break;
    case 'item-del': { const it = S.activa.items[i]; ask('¿Quitar ' + getEj(it.ej).nombre + '?', 'Solo se quita de la sesión de hoy. Tu plantilla no cambia.', 'Quitar', () => { S.activa.items.splice(i, 1); guardarAct(0); render(); }); break; }
    case 'item-add': abrirPicker({ modo: 'agregar' }); break;
    case 'finish': terminar(); break;
    case 'discard': ask('¿Descartar la sesión?', 'Se borra lo que registraste hoy. Tu plantilla no cambia.', 'Descartar', descartar); break;
    case 'rest-skip': S.timer = null; tick(); break;
    case 'rest-add': if (S.timer) { S.timer.end += 15000; S.timer.total += 15; tick(); } break;
    case 'rut-view': S.rutView = b.dataset.v; render(); break;
    case 'pl-open': S.editPl = pid; render(); window.scrollTo(0, 0); break;
    case 'pl-back': S.editPl = null; S.rutView = 'plantillas'; render(); break;
    case 'pl-new': { const id = nid(); S.plantillas[id] = { id, nombre: 'Nueva plantilla', items: [] }; guardarPl(id, 0); S.editPl = id; render(); window.scrollTo(0, 0); break; }
    case 'pl-dup': { const src = S.plantillas[pid]; const id = nid(); const c = clone(src); c.id = id; c.nombre = (src.nombre || 'Plantilla') + ' (copia)'; c.items.forEach(x => { x.uid = nid(); }); S.plantillas[id] = c; guardarPl(id, 0); S.editPl = id; toast('Plantilla duplicada'); render(); window.scrollTo(0, 0); break; }
    case 'pl-del': {
      const pl = S.plantillas[pid]; const dias = diasDePl(pid);
      ask('¿Eliminar «' + (pl.nombre || 'plantilla') + '»?', (dias.length ? 'Se quitará de: ' + dias.map(x => DIAS[x]).join(', ') + '. ' : '') + 'Las sesiones que ya guardaste no cambian.', 'Eliminar', () => {
        clearTimeout(timers['pl:' + pid]); delete S.plantillas[pid]; escribir(R.pl(pid), null);
        if (dias.length && S.perfil) { S.perfil.semana = semana(); for (const x of dias) S.perfil.semana[x] = { plantilla: null, descanso: false }; guardarPerfil(0); }
        S.editPl = null; S.rutView = 'plantillas'; render();
      });
      break;
    }
    case 'r-add': abrirPicker({ modo: 'pl-add', pid }); break;
    case 'r-swap': abrirPicker({ modo: 'r-cambiar', pid, idx: i }); break;
    case 'r-del': { const it = S.plantillas[pid].items[i]; ask('¿Eliminar ' + getEj(it.ej).nombre + ' de la plantilla?', 'Las sesiones que ya guardaste no cambian.', 'Eliminar', () => { S.plantillas[pid].items.splice(i, 1); guardarPl(pid, 0); render(); }); break; }
    case 'r-up': mover(S.plantillas[pid].items, i, -1); guardarPl(pid, 0); render(); break;
    case 'r-down': mover(S.plantillas[pid].items, i, 1); guardarPl(pid, 0); render(); break;
    case 'r-set-add': { const it = S.plantillas[pid].items[i]; it.series.push(clone(it.series[it.series.length - 1] || serieVacia(it.ej))); guardarPl(pid, 0); render(); break; }
    case 'r-set-del': { const it = S.plantillas[pid].items[i]; if (it.series.length > 1) { it.series.pop(); guardarPl(pid, 0); render(); } break; }
    case 'ses-open': S.verSesion = b.dataset.id; S.tab = 'historial'; render(); window.scrollTo(0, 0); break;
    case 'ses-back': S.verSesion = null; render(); break;
    case 'ses-del': { const id = b.dataset.id; ask('¿Eliminar esta sesión?', 'Se borra del historial para siempre.', 'Eliminar', () => { escribir(R.ses(id), null); S.verSesion = null; toast('Sesión eliminada'); render(); }); break; }
    case 'picker-close': S.picker = null; renderOverlay(); break;
    case 'pk-g': S.picker.g = b.dataset.g; renderOverlay(); break;
    case 'pick': elegir(b.dataset.id); break;
    case 'nv-crear': {
      const nombre = $('#nv-nombre').value.trim(); if (!nombre) { toast('Escribe el nombre del ejercicio'); $('#nv-nombre').focus(); break; }
      if (!S.perfil) S.perfil = { semana: semana(), personalizados: [] };
      if (!S.perfil.personalizados) S.perfil.personalizados = [];
      const id = 'MI' + String(S.perfil.personalizados.length + 1).padStart(2, '0'); const reg = $('#nv-reg').value;
      S.perfil.personalizados.push({ id, nombre, grupo: $('#nv-grupo').value, registro: reg, carga: reg === 'peso_reps' || reg === 'tiempo' ? 'total' : 'ninguna', equipo: '', alias: [], personalizado: true });
      buildMap(); guardarPerfil(0); elegir(id); break;
    }
    case 'confirm-ok': { const fn = S.confirm.fn; S.confirm = null; renderOverlay(); fn(); break; }
    case 'confirm-no': S.confirm = null; renderOverlay(); break;
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (S.confirm) { S.confirm = null; renderOverlay(); } else if (S.picker) { S.picker = null; renderOverlay(); } } });

render();
