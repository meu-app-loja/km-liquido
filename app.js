// ===== Km Líquido — interface (versão Firebase: um carro, vários motoristas) =====
import { FB } from './fb.js?v=7';

(() => {
  'use strict';
  const P = Calc.parseNum;
  const $ = (s, el = document) => el.querySelector(s);
  const view = $('#view');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- formatos ----------
  const fBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fBRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const ok = (n) => n != null && isFinite(n);
  const brl = (n) => (ok(n) ? fBRL.format(Math.abs(n) < 0.005 ? 0 : n) : '—');
  const brl0 = (n) => (ok(n) ? fBRL0.format(Math.abs(n) < 0.5 ? 0 : n) : '—');
  const nf = (n, d = 0) => (ok(n) ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n) : '—');
  const hrs = (h) => { if (!ok(h)) return '—'; const m = Math.round(h * 60); return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); };
  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const hoje = () => keyOf(new Date());
  const addDias = (k, n) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return keyOf(d); };
  const agoraHHMM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const agoraMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const hhmm = (m) => pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);
  const fData = (k, opt) => new Intl.DateTimeFormat('pt-BR', opt).format(new Date(k + 'T12:00:00'));
  const dm = (k) => fData(k, { day: '2-digit', month: '2-digit' });
  const refMes = (k) => k.slice(0, 7);
  const nomeMes = (ref) => fData(ref + '-15', { month: 'long', year: 'numeric' });
  const mesAnt = (ref) => { const d = new Date(ref + '-15T12:00:00'); d.setMonth(d.getMonth() - 1); return keyOf(d).slice(0, 7); };
  const mesSeg = (ref) => { const d = new Date(ref + '-15T12:00:00'); d.setMonth(d.getMonth() + 1); return keyOf(d).slice(0, 7); };
  const fimMes = (ref) => addDias(mesSeg(ref) + '-01', -1);
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setPath = (o, p, v) => { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { a[ks[i]] = a[ks[i]] || {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; };
  const pathObj = (p, v) => { const o = {}; setPath(o, p, v); return o; };
  function mergeInto(t, s) {
    for (const k of Object.keys(s)) {
      const v = s[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) mergeInto(t[k], v);
      else t[k] = v;
    }
    return t;
  }
  function mesclar(base, obj) {
    if (!obj || typeof obj !== 'object') return base;
    const out = { ...base };
    for (const k of Object.keys(obj)) {
      const b = base[k], v = obj[k];
      out[k] = b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v) ? mesclar(b, v) : v;
    }
    return out;
  }

  const ICON = {
    l: '<path d="M15 6l-6 6 6 6"/>', r: '<path d="M9 6l6 6-6 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  };
  const ic = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">${ICON[n]}</svg>`;

  const TIPOS_GASTO = [['combustivel', 'Combustível'], ['manutencao', 'Manutenção'], ['lavagem', 'Lavagem'], ['pedagio', 'Pedágio'], ['estacionamento', 'Estacionamento'], ['alimentacao', 'Alimentação'], ['outro', 'Outro']];
  const nomeGasto = (t) => (TIPOS_GASTO.find((x) => x[0] === t) || [0, 'Outro'])[1];
  const TIPOS_CORRIDA = [['corrida', 'Corrida'], ['gorjeta', 'Gorjeta'], ['bonus', 'Bônus']];
  const nomeCorrida = (t) => (TIPOS_CORRIDA.find((x) => x[0] === t) || [0, 'Corrida'])[1];
  const TABS = ['hoje', 'gastos', 'resultados', 'historico', 'ajustes'];
  const EST = { 'comb.preco': 'preco', 'comb.consumo': 'consumo', manutencaoKm: 'manutencaoKm', deprecAnualPct: 'deprecAnualPct' };

  function cfgPadrao() {
    return {
      v: 3,
      motoristas: [],
      acordo: { tipo: 'nada', valor: '', desgaste: false },
      veiculo: { marca: '', modelo: '', anoFab: '', anoModelo: '', combustivel: 'flex' },
      situacao: 'financiado',
      fipe: { historico: [] },
      deprecAnualPct: '10',
      fin: { parcela: '', restantes: '', taxaMensalPct: '', valorFinanciado: '', totalParcelas: '' },
      aluguel: { valor: '', periodo: 'semana' },
      comb: { preco: '6,00', consumo: '10', usarReal: true, usarUltimoPreco: true },
      manutencaoKm: '0,15',
      fixos: { seguroAnual: '', ipvaAnual: '', licenciamentoAnual: '', celularMensal: '', meiMensal: '', outrosMensal: '' },
      plataformas: ['Uber', '99', 'inDrive', 'Particular'],
      est: { preco: true, consumo: true, manutencaoKm: true, deprecAnualPct: true },
    };
  }
  const vazio = () => ({ config: null, usos: {}, gastos: {}, pagamentos: {} });
  function normalizar(d) {
    const o = vazio();
    if (!d) return o;
    o.config = d.config ? mesclar(cfgPadrao(), d.config) : null;
    for (const c of ['usos', 'gastos', 'pagamentos']) o[c] = d[c] && typeof d[c] === 'object' ? d[c] : {};
    return o;
  }

  // ---------- estado ----------
  const LCARRO = 'kmliquido:carro', LOBS = 'kmliquido:obs';
  const lsGet = (k) => { try { const j = localStorage.getItem(k); return j ? JSON.parse(j) : null; } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } };

  const S = {
    data: vazio(), demo: null, ver: null,
    fase: 'inicio', user: null, carroId: null, carro: null, authModo: 'entrar', scModo: 'cadastrar', instalar: null,
    tab: 'hoje', dia: hoje(), periodo: '7d', histMes: null, gastoMes: null, usoSel: null,
    plat: null, tipoC: 'corrida', gTipo: 'combustivel', gPagou: null, draft: {}, contaAberta: false, serie: [], pg: null, lac: null,
  };
  const D = () => S.demo || S.data;
  const cfg = () => { const T = D(); if (!T.config) T.config = cfgPadrao(); return T.config; };
  const usosArr = () => Object.values(D().usos);
  const gastosArr = () => Object.values(D().gastos);
  const pagArr = () => Object.values(D().pagamentos);
  const base = () => ({ usos: usosArr(), gastos: gastosArr(), pagamentos: pagArr() });
  const mots = () => cfg().motoristas || [];
  const mot = (id) => mots().find((m) => m.id === id) || null;
  const nomeMot = (id) => (mot(id) || {}).nome || 'Sem nome';
  const donoM = () => mots().find((m) => m.dono) || mots()[0] || null;
  const varios = () => mots().length > 1;
  const souCriador = () => !!(S.user && S.carro && S.carro.criador === S.user.uid);
  // Quem é a pessoa logada: o motorista ligado à conta dela
  function EU() {
    if (S.demo || !S.user) return null;
    const m = mots().find((x) => x.uid === S.user.uid);
    if (m) return m.id;
    return S.carroId && lsGet(LOBS) === S.carroId ? 'obs' : null;
  }
  function verId() {
    if (mot(S.ver)) return S.ver;
    const e = EU();
    if (mot(e)) return e;
    return (donoM() || {}).id || null;
  }
  const kmTotal = () => usosArr().reduce((s, u) => s + (Calc.kmUso(u).km || 0), 0);
  const ctx = () => Calc.contexto(cfg(), gastosArr(), kmTotal());
  const chaveUso = (u) => u.data + ' ' + (u.ini || '99:99') + ' ' + String(u.criado || 0).padStart(15, '0');
  const ordUso = (a, b) => (chaveUso(a) < chaveUso(b) ? -1 : 1);
  const abertos = () => usosArr().filter((u) => u.ini && !u.fim && u.data >= addDias(hoje(), -1)).sort(ordUso).reverse();
  function usosDoDia(m, k) {
    const us = usosArr().filter((u) => u.mot === m && u.data === k);
    if (k === hoje()) for (const u of abertos()) if (u.mot === m && u.data !== k) us.push(u);
    return us.sort(ordUso);
  }
  function ultimoOdo(excetoId) {
    let best = null;
    for (const u of usosArr()) {
      if (u.id === excetoId) continue;
      for (const f of ['odoIni', 'odoFim']) {
        const v = P(u[f]);
        if (v != null && (!best || v > best.odo)) best = { odo: v, uso: u, campo: f };
      }
    }
    return best;
  }
  const metaDia = (m) => { const o = mot(m) || {}; return (P(o.meta) || 0) / Math.max(1, P(o.diasMes) || 26); };

  // ---------- gravação (Firebase) ----------
  function podeGravar() {
    if (S.demo) return true;
    if (S.fase !== 'app' || !S.carroId) { toast('Entre na conta para salvar.'); return false; }
    return true;
  }
  function put(col, obj) {
    if (!podeGravar()) return false;
    const T = D();
    if (col === 'app') T.config = obj; else T[col][obj.id] = obj;
    if (!S.demo) Fire.put(col, obj.id, obj);
    return true;
  }
  function patch(col, id, p) {
    if (!podeGravar()) return false;
    const T = D();
    const cur = col === 'app' ? cfg() : T[col][id];
    if (!cur) return false;
    mergeInto(cur, clone(p));
    if (!S.demo) Fire.patch(col, id, p);
    return true;
  }
  function remover(col, id) {
    if (!podeGravar()) return false;
    delete D()[col][id];
    if (!S.demo) Fire.del(col, id);
    return true;
  }
  const patchCfg = (p) => patch('app', 'config', p);
  const patchUso = (id, p) => patch('usos', id, p);

  const Fire = {
    unsubs: [], pend: {}, timer: null,
    pares(obj, prefixo) {
      const out = [];
      const rec = (o, p) => {
        for (const k of Object.keys(o)) {
          const v = o[k];
          if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) rec(v, p.concat(k));
          else out.push([p.concat(k), v]);
        }
      };
      rec(obj, prefixo || []);
      return out;
    },
    erro(e) {
      const c = e && e.code;
      toast(c === 'permission-denied' ? 'Sem permissão para salvar. Saia e entre de novo na conta.' : `Não foi possível salvar (${c || 'erro'}). Confira a internet.`);
    },
    put(col, id, obj) {
      const pr = col === 'app' ? FB.updCarro(S.carroId, [[['config'], clone(obj)]]) : FB.setItem(S.carroId, col, id, clone(obj));
      pr.catch((e) => this.erro(e));
    },
    patch(col, id, p) {
      const pares = this.pares(clone(p), col === 'app' ? ['config'] : []);
      const pr = col === 'app' ? FB.updCarro(S.carroId, pares) : FB.updItem(S.carroId, col, id, pares);
      pr.catch((e) => this.erro(e));
    },
    del(col, id) { FB.delItem(S.carroId, col, id).catch((e) => this.erro(e)); },
    pendente() { return Object.values(this.pend).some(Boolean); },
    parar() {
      for (const u of this.unsubs) { try { u(); } catch (e) { /* já parado */ } }
      this.unsubs = []; this.pend = {}; clearTimeout(this.timer);
    },
    sairDoCarro(msg) {
      this.parar(); S.carroId = null; S.carro = null; S.data = vazio(); lsSet(LCARRO, null);
      S.fase = S.user ? 'semCarro' : 'login'; render();
      if (msg) toast(msg);
    },
    ouvir(id) {
      this.parar();
      S.carroId = id; lsSet(LCARRO, id); S.data = vazio(); S.carro = null;
      const carregado = { carro: false, usos: false, gastos: false, pagamentos: false };
      const pronto = () => {
        if (S.fase === 'app' || !Object.values(carregado).every(Boolean)) return;
        clearTimeout(this.timer); S.fase = 'app'; S.dia = hoje(); render();
      };
      this.timer = setTimeout(() => { if (S.fase !== 'app') toast('Os dados ainda não chegaram. Confira a internet.'); }, 12000);
      const falha = (e) => {
        if (e && e.code === 'permission-denied') this.sairDoCarro('Você não tem acesso a esse carro.');
        else toast('Problema para carregar os dados. Confira a internet.');
      };
      this.unsubs.push(FB.ouvirCarro(id, (s) => {
        this.pend.carro = s.pendente;
        if (!s.exists) { if (!s.cache) this.sairDoCarro('Esse carro não existe mais.'); return; }
        const d = s.data;
        S.carro = { criador: d.criador, membros: d.membros || [], contas: d.contas || {}, codigo: d.codigo || '' };
        const novo = mesclar(cfgPadrao(), d.config || {});
        const mudou = JSON.stringify(novo) !== JSON.stringify(S.data.config);
        S.data.config = novo; carregado.carro = true;
        syncChip();
        if (S.fase === 'app' && mudou) renderSuave();
        pronto();
      }, falha));
      for (const c of ['usos', 'gastos', 'pagamentos']) {
        this.unsubs.push(FB.ouvirCol(id, c, (s) => {
          this.pend[c] = s.pendente;
          const mudou = JSON.stringify(s.docs) !== JSON.stringify(S.data[c]);
          S.data[c] = s.docs; carregado[c] = true;
          syncChip();
          if (S.fase === 'app' && mudou) renderSuave();
          pronto();
        }, falha));
      }
    },
  };

  // ---------- utilidades de interface ----------
  function syncChip() {
    const el = $('#sync'); if (!el) return;
    let s, t;
    if (S.demo) { s = 'demo'; t = 'Exemplo'; }
    else if (S.fase !== 'app') { el.hidden = true; return; }
    else if (!navigator.onLine) { s = 'saving'; t = 'Sem internet'; }
    else if (Fire.pendente()) { s = 'saving'; t = 'Salvando…'; }
    else { s = 'cloud'; t = 'Sincronizado'; }
    el.hidden = false; el.dataset.s = s; el.innerHTML = `<i></i>${t}`;
  }
  let tToast;
  function toast(msg, acao) {
    const el = $('#toast');
    el.innerHTML = `<span>${esc(msg)}</span>` + (acao ? `<button class="btn sm" id="toastBtn" type="button">${esc(acao.label)}</button>` : '');
    el.hidden = false;
    if (acao) $('#toastBtn').onclick = () => { el.hidden = true; acao.fn(); };
    clearTimeout(tToast); tToast = setTimeout(() => { el.hidden = true; }, acao ? 6000 : 3500);
  }
  const sheetBox = $('#sheet');
  let confirmFn = null, pendSuave = false;
  function abrirSheet(html) { sheetBox.innerHTML = `<div class="sheet-bg" data-sact="fora"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`; sheetBox.hidden = false; }
  function fecharSheet() {
    sheetBox.hidden = true; sheetBox.innerHTML = ''; confirmFn = null; S.pg = null; S.lac = null;
    if (pendSuave) { pendSuave = false; setTimeout(render, 0); }
  }
  function confirmar(titulo, texto, okTxt, fn, perigo = true) {
    abrirSheet(`<h2 class="sec-title">${titulo}</h2><p class="note">${texto}</p><div class="row"><button class="btn ${perigo ? 'danger' : 'primary'}" data-sact="ok" type="button">${okTxt}</button><button class="btn" data-sact="fechar" type="button">Cancelar</button></div>`);
    confirmFn = fn;
  }
  const dv = (id, def) => (id in S.draft ? S.draft[id] : def == null ? '' : def);

  function campo(o) {
    const c = cfg();
    const v = o.val !== undefined ? o.val : (getPath(c, o.path) == null ? '' : getPath(c, o.path));
    const est = o.est ? `<span class="tag est" data-est="${o.est}" ${(c.est || {})[o.est] ? '' : 'hidden'}>estimativa</span>` : '';
    const wrap = [o.pre ? 'prefix' : '', o.suf ? 'suffix' : ''].join(' ').trim();
    const attrs = o.attrs || (o.path ? `data-c="${o.path}"` : '');
    return `<label class="field" for="${o.id}"><span>${o.label}${est}</span><div class="${wrap}">${o.pre ? `<b>${o.pre}</b>` : ''}<input class="input${o.cls ? ' ' + o.cls : ''}" id="${o.id}" ${attrs} type="${o.type || 'text'}" inputmode="${o.mode || 'decimal'}" value="${esc(v)}" placeholder="${esc(o.ph || '')}" autocomplete="off" ${o.extra || ''}>${o.suf ? `<b>${o.suf}</b>` : ''}</div></label>`;
  }
  const linha = (rot, v, hint, cls) => `<tr${cls ? ` class="${cls}"` : ''}><td>${rot}${hint ? `<span class="hint">${hint}</span>` : ''}</td><td>${v}</td></tr>`;
  const menos = (v) => (v > 0.004 ? '−' + brl(v) : brl(0));
  const mini = (v, l) => `<div class="mini"><b>${v}</b><span>${l}</span></div>`;
  const meter = (pct, left, right) => `<div class="stack" style="gap:6px"><div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div><div class="meter-txt"><span>${left}</span><span class="muted">${right}</span></div></div>`;
  const plural = (n, s, p) => `${nf(n)} ${n === 1 ? s : p}`;

  // ---------- blocos de resultado ----------
  function subBolso(R, x) {
    if (!R.isDono) {
      const a = cfg().acordo || {};
      const partes = ['combustível', 'seus gastos'];
      if (R.reembolsa) partes.push('desgaste');
      if (a.tipo && a.tipo !== 'nada' && P(a.valor, 'dec') > 0) partes.push('pagamento pelo carro');
      return 'depois de ' + partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1];
    }
    const sit = cfg().situacao;
    if (sit === 'alugado') return 'depois de combustível, custos e aluguel do carro';
    if (sit === 'financiado' && x.cap.parcela > 0) return 'depois de combustível, custos e parcela do carro';
    return 'depois de combustível e custos do carro';
  }
  const heroBolso = (R, x) => `<div class="hero"><span class="lbl">Dinheiro no bolso</span><span class="val${R.bolso < 0 ? ' neg' : ''}">${brl(R.bolso)}</span><span class="sub">${subBolso(R, x)}</span></div>`;

  function contaBolso(R, x) {
    const sit = cfg().situacao;
    let t = '<table class="conta"><tbody>';
    t += linha('Faturamento', brl(R.bruto), 'corridas, gorjetas e bônus');
    t += linha('Combustível', menos(R.comb), R.kmT > 0 ? `${nf(R.kmT)} km × ${brl(x.combKm)} por km` : 'sem km informado');
    if (R.isDono || R.reembolsa) t += linha('Manutenção e pneus', menos(R.manut), R.kmT > 0 ? `${nf(R.kmT)} km × ${brl(x.manutKm)} por km` : 'sem km informado');
    if (R.outros > 0.004) t += linha('Outros gastos', menos(R.outros), 'lavagem, pedágio, alimentação…');
    if (R.isDono) {
      t += linha('Custos fixos', menos(R.fixos), 'seguro, IPVA, celular… divididos pelos dias de trabalho');
      if (sit === 'alugado') t += linha('Aluguel do carro', menos(R.capBolso), 'dividido pelos dias de trabalho');
      else if (sit === 'financiado' && x.cap.parcela > 0) t += linha('Parcela do carro', menos(R.capBolso), 'dividida pelos dias de trabalho');
      if (R.recebido > 0.004) t += linha('Recebido pelo uso do carro', '+' + brl(R.recebido), 'pago pelos outros motoristas');
      if (R.desgOutros > 0.004) {
        const km = Object.values(R.outros).reduce((s, o) => s + o.kmT + o.kmP, 0);
        const nomes = Object.keys(R.outros).filter((id) => R.outros[id].kmT + R.outros[id].kmP > 0).map((id) => esc(nomeMot(id))).join(', ');
        t += linha('Desgaste no uso dos outros', menos(R.desgOutros), `${nf(km)} km de ${nomes} × ${brl(x.manutKm)} (manutenção e pneus)`);
      }
    } else if (R.pagoUso > 0.004) t += linha('Pagamento pelo uso do carro', menos(R.pagoUso), `para ${esc(nomeMot(R.donoId))}`);
    t += linha('Dinheiro no bolso', brl(R.bolso), '', 'tot');
    return t + '</tbody></table>';
  }

  function blocoResultado(k, vid) {
    const x = ctx(), isH = k === hoje();
    const R = Calc.resultado(x, cfg(), base(), vid, k, k, { hoje: hoje(), agoraMin: agoraMin() });
    const quem = varios() ? ' · ' + esc(nomeMot(vid)) : '';
    if (!R.diasTrab && Math.abs(R.bolso) < 0.005 && !(R.kmP > 0)) {
      return `<p class="eyebrow">Resultado do dia${quem}</p><div class="empty">Nada lançado ${isH ? 'hoje' : 'neste dia'} ainda.<br>Pegue o carro e lance as corridas abaixo.</div>`;
    }
    let h = `<div class="row between"><p class="eyebrow">Resultado do dia${quem}</p>${R.bolso < 0 ? '<span class="status bad">No prejuízo</span>' : '<span class="status ok">No lucro</span>'}</div>`;
    h += heroBolso(R, x);
    if (R.diasSemKm) h += '<p class="note"><span class="tag est">sem km</span> O combustível entra na conta quando o odômetro do fim (ou os km) for anotado.</p>';
    const custo = R.bruto - R.bolso, md = metaDia(vid);
    if (R.diasTrab) {
      if (R.bolso < 0) h += meter(custo > 0 ? R.bruto / custo * 100 : 0, `Faltam <b>${brl(-R.bolso)}</b> para cobrir os custos do dia`, `custos ${brl0(custo)}`);
      else if (md > 0) h += meter(R.bolso / md * 100, R.bolso >= md ? '<b>Meta do dia batida</b>' : `Faltam <b>${brl(md - R.bolso)}</b> para a meta do dia`, `meta ${brl0(md)}`);
      h += `<div class="minis">${mini(brl0(R.bruto), 'faturado')}${mini(R.kmT > 0 ? nf(R.kmT) + ' km' : '—', 'rodados')}${mini(hrs(R.horas || null), 'trabalhadas')}${mini(R.porHoraBolso != null ? brl(R.porHoraBolso) : '—', 'no bolso/hora')}</div>`;
    }
    if (R.kmP > 0) h += `<p class="note">Uso particular: ${nf(R.kmP)} km, que custaram ${brl(R.combP + R.manutP)}. Sobra depois disso: <b>${brl(R.bolso - R.combP - R.manutP)}</b>.</p>`;
    h += `<details class="more" id="contaDia"${S.contaAberta ? ' open' : ''}><summary>Ver a conta do dia</summary>${contaBolso(R, x)}</details>`;
    return h;
  }

  // ---------- tela Hoje ----------
  function cardSetup() {
    return `<section class="card"><p class="eyebrow">Primeiro passo</p><h2>Quem usa o carro?</h2><p class="note">Coloque o nome do dono do carro e de quem mais trabalha com ele. Dá para mudar depois em Ajustes.</p>
      <form id="fSetup" class="stack">
        <label class="field" for="s-dono"><span>Nome do dono do carro</span><input class="input dr" id="s-dono" autocomplete="off" value="${esc(dv('s-dono'))}" placeholder="ex.: Marcos"></label>
        <label class="field" for="s-outro"><span>Outro motorista (se houver)</span><input class="input dr" id="s-outro" autocomplete="off" value="${esc(dv('s-outro'))}" placeholder="ex.: Lucas"></label>
        <button class="btn primary big block" type="submit">Continuar</button>
      </form><button class="btn ghost" data-act="entrarDemo" type="button">Ver um exemplo antes</button></section>`;
  }
  function cardQuemSou() {
    return `<section class="card"><h2>Quem é você?</h2><p class="note">Assim os seus lançamentos ficam no seu nome, em qualquer celular em que você entrar.</p><div class="chips">${mots().map((m) => `<button class="chip" data-act="souEu" data-id="${m.id}" type="button">${esc(m.nome)}${m.uid && (!S.user || m.uid !== S.user.uid) ? ' · já ligado' : ''}</button>`).join('')}<button class="chip" data-act="souEu" data-id="obs" type="button">Só acompanho</button></div></section>`;
  }
  function seletorMot(vid, rotulo) {
    if (!varios()) return '';
    return `<div class="chips" role="group" aria-label="${rotulo || 'Motorista'}">${mots().map((m) => `<button class="chip sm" data-act="ver" data-id="${m.id}" aria-pressed="${m.id === vid}" type="button">${esc(m.nome)}${!S.demo && m.id === EU() ? ' (você)' : ''}</button>`).join('')}</div>`;
  }
  function cardCarro() {
    const u = abertos()[0];
    let t;
    if (u) {
      const quem = !S.demo && u.mot === EU() ? 'Você está' : `${esc(nomeMot(u.mot))} está`;
      t = `<span class="turno-live"><i></i>${quem} com o carro</span><span class="muted small">${u.tipo === 'particular' ? 'uso particular' : 'trabalhando'} desde ${esc(u.ini)}${u.data !== hoje() ? ' de ontem' : ''}${P(u.odoIni) ? ' · saiu com ' + nf(P(u.odoIni)) + ' km' : ''}</span>`;
    } else {
      const lo = ultimoOdo();
      t = `<span class="turno-live off"><i></i>Carro livre</span>${lo ? `<span class="muted small">Último odômetro: ${nf(lo.odo)} km · ${esc(nomeMot(lo.uso.mot))}${lo.uso.data !== hoje() ? ', ' + dm(lo.uso.data) : ''}${lo.uso.fim ? ' às ' + esc(lo.uso.fim) : ''}</span>` : ''}`;
    }
    return `<div class="banner info carro">${t}</div>`;
  }
  function custoParticular(km, quem) {
    const x = ctx();
    const paga = (mot(quem) || {}).dono || (cfg().acordo || {}).desgaste;
    return km * x.combKm + (paga ? km * x.manutKm : 0);
  }
  function usoInfo(u) {
    const kmu = Calc.kmUso(u), h = Calc.horasUso(u, u.data === hoje() ? agoraMin() : null);
    const oi = P(u.odoIni), of = P(u.odoFim);
    let t;
    if (kmu.km != null) t = `<b>${nf(kmu.km)} km</b>${kmu.fonte === 'odometro' ? ' pelo odômetro' : ''}`;
    else if (oi != null && of != null && of <= oi) t = 'O odômetro do fim precisa ser maior que o do início.';
    else if (u.ini && !u.fim) t = 'Em andamento. Anote o odômetro no fim.';
    else t = 'Anote o odômetro no início e no fim.';
    if (u.tipo !== 'particular' && h.h != null) t += ` · ${hrs(h.h)} ${h.fonte === 'andamento' ? 'até agora' : 'de trabalho'}`;
    if (u.tipo === 'particular' && kmu.km > 0) t += ` · custou cerca de ${brl(custoParticular(kmu.km, u.mot))} em combustível e desgaste`;
    let extra = '';
    if (u.odoAuto && oi != null) extra = '<p class="note"><span class="tag est">confira</span> O odômetro do início veio do último uso do carro. Confira com o painel e corrija se estiver diferente: a diferença vira km sem dono.</p>';
    return `<p class="note">${t}</p>${extra}`;
  }
  function campoU(u, f, label, type, mode, ph, suf) {
    return `<label class="field" for="u-${f}"><span>${label}</span><div class="${suf ? 'suffix' : ''}"><input class="input" id="u-${f}" data-u="${f}" data-uid="${u.id}" type="${type}" inputmode="${mode}" value="${esc(u[f] || '')}" placeholder="${esc(ph || '')}" autocomplete="off">${suf ? `<b>${suf}</b>` : ''}</div></label>`;
  }
  function campoHora(u, f, label) {
    return `<div class="field"><span>${label}</span><div class="hora"><input class="input" id="u-${f}" aria-label="${label}" data-u="${f}" data-uid="${u.id}" data-hora="1" type="text" inputmode="numeric" maxlength="5" placeholder="--:--" value="${esc(u[f] || '')}" autocomplete="off"><button class="btn sm" data-act="agoraHora" data-f="${f}" data-uid="${u.id}" type="button">Agora</button></div></div>`;
  }
  // "1710" -> "17:10", "9" -> "09:00", "930" -> "09:30"; null se inválida
  function lerHora(v) {
    const d = String(v || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length > 4) return null;
    const h = d.length <= 2 ? +d : +d.slice(0, d.length - 2);
    const m = d.length <= 2 ? 0 : +d.slice(-2);
    if (h > 23 || m > 59) return null;
    return pad(h) + ':' + pad(m);
  }
  function cardUso(u, isH) {
    const aberto = u.ini && !u.fim, part = u.tipo === 'particular';
    const lo = ultimoOdo(u.id);
    let h = `<section class="card" id="cardUso"><div class="row between"><h2>${part ? 'Uso particular' : 'Trabalho'}${u.data !== S.dia ? ` <span class="muted small">(começou ${dm(u.data)})</span>` : ''}</h2>${aberto && isH ? `<span class="turno-live"><i></i>desde ${esc(u.ini)}</span>` : ''}</div>`;
    h += `<p class="eyebrow">Tipo deste uso</p><div class="seg" role="group" aria-label="Tipo deste uso"><button data-act="tipoUso" data-t="trabalho" aria-pressed="${!part}" type="button">Trabalho</button><button data-act="tipoUso" data-t="particular" aria-pressed="${part}" type="button">Particular</button></div>`;
    if (aberto && isH) h += `<button class="btn dark big block" data-act="encerrar" type="button">Encerrar ${part ? 'o uso particular' : 'o trabalho'} agora</button>`;
    h += `<div class="grid2">${campoHora(u, 'ini', 'Início')}${campoHora(u, 'fim', 'Fim')}</div>`;
    h += `<div class="grid2">${campoU(u, 'odoIni', 'Odômetro no início', 'text', 'numeric', lo ? nf(lo.odo) : 'km do painel')}${campoU(u, 'odoFim', 'Odômetro no fim', 'text', 'numeric', 'km do painel')}</div>`;
    h += `<details class="more"${u.kmManual || u.horasManual ? ' open' : ''}><summary>Sem odômetro ou sem horário? Informe direto</summary><div class="grid2">${campoU(u, 'kmManual', 'Km rodados', 'text', 'decimal', '', 'km')}${part ? '' : campoU(u, 'horasManual', 'Horas trabalhadas', 'text', 'decimal', 'ex.: 9,5', 'h')}</div><p class="note">Conte também os trechos vazios: ir buscar passageiro, voltar e rodar esperando chamada.</p></details>`;
    h += `<div id="usoInfo">${usoInfo(u)}</div>`;
    h += `<div><button class="btn ghost sm danger-t" data-act="delUso" data-id="${u.id}" type="button">Apagar este ${part ? 'uso particular' : 'trabalho'}</button></div></section>`;
    return h;
  }
  function listaUsos(us, sel) {
    return `<section class="card"><h2>Usos do carro no dia</h2><div class="list">${us.map((u) => {
      const km = Calc.kmUso(u).km, g = Calc.ganhosUso(u);
      return `<button class="li btnrow${sel && u.id === sel.id ? ' on' : ''}" data-act="selUso" data-id="${u.id}" type="button"><span class="t">${esc(u.ini || '—')}</span><span class="main"><b>${u.tipo === 'particular' ? 'Uso particular' : 'Trabalho'}</b><small>${km != null ? nf(km) + ' km' : 'sem km'}${u.fim ? ' · até ' + esc(u.fim) : u.ini ? ' · em andamento' : ''}</small></span><span class="v">${u.tipo === 'particular' ? '' : brl(g.bruto)}</span></button>`;
    }).join('')}</div></section>`;
  }
  function blocoGanhos(sel, k, isH) {
    const c = cfg();
    const modo = sel && sel.modo === 'resumo' ? 'resumo' : 'corridas';
    let h = `<div class="seg" role="group" aria-label="Como lançar os ganhos"><button data-act="modo" data-m="corridas" aria-pressed="${modo === 'corridas'}" type="button">Corrida a corrida</button><button data-act="modo" data-m="resumo" aria-pressed="${modo === 'resumo'}" type="button">Resumo do dia</button></div>`;
    if (modo === 'corridas') {
      h += `<section class="card"><h2>Nova corrida</h2>
        <div class="chips" role="group" aria-label="Plataforma">${c.plataformas.map((p) => `<button class="chip" data-act="plat" data-p="${esc(p)}" aria-pressed="${p === S.plat}" type="button">${esc(p)}</button>`).join('')}</div>
        <form id="fCorrida" class="stack">
          <label class="field" for="c-valor"><span>Valor que caiu para você</span><div class="prefix"><b>R$</b><input class="input big dr" id="c-valor" inputmode="decimal" placeholder="0,00" autocomplete="off" value="${esc(dv('c-valor'))}"></div></label>
          <div class="chips" role="group" aria-label="Tipo">${TIPOS_CORRIDA.map(([t, n]) => `<button class="chip sm" data-act="tipoc" data-t="${t}" aria-pressed="${t === S.tipoC}" type="button">${n}</button>`).join('')}</div>
          <details class="more"><summary>Km da corrida (opcional)</summary>${campo({ id: 'c-km', label: 'Km com passageiro', val: dv('c-km'), suf: 'km', cls: 'dr', attrs: ' ' })}</details>
          <button class="btn primary big block" type="submit">Adicionar ${esc(S.tipoC === 'corrida' ? 'corrida' : nomeCorrida(S.tipoC).toLowerCase())} · ${esc(S.plat)}</button>
        </form></section>`;
      const cs = ((sel && sel.corridas) || []).slice().sort((a, b) => (a.h < b.h ? 1 : -1));
      const nC = cs.filter((x) => (x.tipo || 'corrida') === 'corrida').length;
      h += `<section class="card"><div class="row between"><h2>Lançamentos ${isH ? 'de agora' : 'do dia'}</h2><span class="muted small">${plural(nC, 'corrida', 'corridas')}</span></div>`;
      h += cs.length ? `<div class="list">${cs.map((x) => `<div class="li"><span class="t">${esc(x.h || '')}</span><div class="main"><b>${esc(x.p)}</b><small>${nomeCorrida(x.tipo)}${x.km ? ' · ' + nf(x.km, 1) + ' km · ' + brl(x.v / x.km) + '/km' : ''}</small></div><span class="v">${brl(x.v)}</span><button class="icon-btn" data-act="delCorrida" data-id="${x.id}" aria-label="Apagar lançamento de ${brl(x.v)}" type="button">${ic('x')}</button></div>`).join('')}</div>` : '<div class="empty">Nenhuma corrida lançada.</div>';
      h += '</section>';
    } else {
      const rs = (sel && sel.resumo) || {};
      h += `<section class="card"><h2>Resumo do dia</h2><p class="note">Digite o total que cada app mostrou no fim do dia, já com gorjetas e bônus.</p><div class="grid2">${c.plataformas.map((p, i) => `<label class="field" for="r-${i}"><span>${esc(p)}</span><div class="prefix"><b>R$</b><input class="input" id="r-${i}" data-r="${esc(p)}" inputmode="decimal" value="${esc(rs[p] || '')}" placeholder="0,00" autocomplete="off"></div></label>`).join('')}</div>${campo({ id: 'r-n', label: 'Número de corridas (opcional)', val: (sel && sel.corridasResumo) || '', mode: 'numeric', attrs: 'data-u="corridasResumo"' + (sel ? ` data-uid="${sel.id}"` : '') })}${sel && (sel.corridas || []).length ? `<p class="note">As ${sel.corridas.length} corridas lançadas uma a uma continuam guardadas, mas enquanto o resumo estiver ativo a conta usa só os totais acima.</p>` : ''}</section>`;
    }
    return h;
  }
  function liGasto(g) {
    let det = '';
    if (g.tipo === 'combustivel') det = [g.litros ? nf(g.litros, 1) + ' L' : '', g.litros && g.valor ? brl(g.valor / g.litros) + '/L' : '', g.cheio ? 'tanque cheio' : ''].filter(Boolean).join(' · ');
    else det = g.descr || '';
    if (varios()) det = (det ? det + ' · ' : '') + 'pago por ' + nomeMot(g.pagoPor || (donoM() || {}).id);
    return `<div class="li"><span class="t">${esc(dm(g.data))}</span><div class="main"><b>${esc(nomeGasto(g.tipo))}</b>${det ? `<small>${esc(det)}</small>` : ''}</div><span class="v">${brl(g.valor)}</span><button class="icon-btn" data-act="delGasto" data-id="${g.id}" aria-label="Apagar gasto de ${brl(g.valor)}" type="button">${ic('x')}</button></div>`;
  }
  function gastosDia(vid, k) {
    const dono = (donoM() || {}).id;
    const gd = gastosArr().filter((g) => g.data === k && (g.pagoPor || dono) === vid);
    let h = `<section class="card"><div class="row between"><h2>Gastos do dia</h2><button class="btn sm" data-act="gastoDoDia" type="button">Adicionar gasto</button></div>`;
    h += gd.length ? `<div class="list">${gd.map(liGasto).join('')}</div>` : `<p class="note">Abasteceu, lavou o carro ou pagou pedágio? Lance aqui${varios() ? ', no nome de quem pagou' : ''}.</p>`;
    return h + '</section>';
  }

  function vHoje() {
    const c = cfg(), k = S.dia, isH = k === hoje();
    if (!S.demo && !mots().length) return cardSetup();
    let h = '';
    if (!S.demo && !mot(EU()) && EU() !== 'obs') h += cardQuemSou();
    if (!S.demo && souCriador() && varios() && S.carro && (S.carro.membros || []).length < 2) h += cardConvite(true);
    const vid = verId();
    if (!c.plataformas.includes(S.plat)) S.plat = c.plataformas[0] || 'Uber';
    h += seletorMot(vid);
    h += `<div class="daynav"><button class="icon-btn" data-act="dia" data-n="-1" aria-label="Dia anterior" type="button">${ic('l')}</button><div class="d"><b>${isH ? 'Hoje' : esc(cap(fData(k, { weekday: 'long' })))}</b><small>${esc(isH ? fData(k, { weekday: 'long', day: 'numeric', month: 'long' }) : fData(k, { day: 'numeric', month: 'long', year: 'numeric' }))}${isH ? '' : ' · <button class="linkbtn" data-act="irHoje" type="button">voltar para hoje</button>'}</small></div><button class="icon-btn" data-act="dia" data-n="1" aria-label="Próximo dia" type="button" ${isH ? 'disabled' : ''}>${ic('r')}</button></div>`;
    if (isH && varios()) h += cardCarro();
    h += `<section class="card result" id="resHoje">${blocoResultado(k, vid)}</section>`;
    const us = usosDoDia(vid, k);
    const aberto = us.find((u) => u.ini && !u.fim);
    if (isH && !aberto) {
      h += `<section class="card"><h2>Pegar o carro${varios() && vid !== EU() ? ` <span class="muted small">em nome de ${esc(nomeMot(vid))}</span>` : ''}</h2><div class="grid2"><button class="btn primary big" data-act="comecar" data-t="trabalho" type="button">Trabalhar</button><button class="btn big" data-act="comecar" data-t="particular" type="button">Uso particular</button></div></section>`;
    }
    const sel = us.find((u) => u.id === S.usoSel) || aberto || us[us.length - 1] || null;
    if (us.length > 1) h += listaUsos(us, sel);
    if (sel) h += cardUso(sel, isH);
    else if (!isH) h += `<section class="card"><p class="note">Nenhum uso do carro lançado${varios() ? ' por ' + esc(nomeMot(vid)) : ''} neste dia.</p><div class="row"><button class="btn" data-act="novoUso" data-t="trabalho" type="button">Lançar trabalho</button><button class="btn" data-act="novoUso" data-t="particular" type="button">Lançar uso particular</button></div></section>`;
    if (!sel || sel.tipo !== 'particular') h += blocoGanhos(sel, k, isH);
    h += gastosDia(vid, k);
    return h;
  }

  // ---------- tela Gastos ----------
  function vGastos() {
    const t = S.gTipo, ref = S.gastoMes || refMes(hoje()), x = ctx();
    const pagou = mot(S.gPagou) ? S.gPagou : verId();
    let h = `<section class="card"><h2>Novo gasto</h2>
      <div class="chips" role="group" aria-label="Tipo de gasto">${TIPOS_GASTO.map(([k, n]) => `<button class="chip sm" data-act="gtipo" data-t="${k}" aria-pressed="${k === t}" type="button">${n}</button>`).join('')}</div>
      <form id="fGasto" class="stack">`;
    if (varios()) h += `<div class="field"><span>Quem pagou</span><div class="chips" role="group" aria-label="Quem pagou">${mots().map((m) => `<button class="chip sm" data-act="gpagou" data-id="${m.id}" aria-pressed="${m.id === pagou}" type="button">${esc(m.nome)}</button>`).join('')}</div></div>`;
    h += `<div class="grid2"><label class="field" for="g-data"><span>Data</span><input class="input dr" id="g-data" type="date" value="${esc(dv('g-data', hoje()))}" max="${hoje()}"></label>
        <label class="field" for="g-valor"><span>Valor pago</span><div class="prefix"><b>R$</b><input class="input dr" id="g-valor" inputmode="decimal" placeholder="0,00" autocomplete="off" value="${esc(dv('g-valor'))}"></div></label></div>`;
    if (t === 'combustivel') {
      const lo = ultimoOdo();
      h += `<div class="grid2"><label class="field" for="g-litros"><span>Litros</span><div class="suffix"><input class="input dr" id="g-litros" inputmode="decimal" placeholder="0,0" autocomplete="off" value="${esc(dv('g-litros'))}"><b>L</b></div></label>
        <label class="field" for="g-odo"><span>Odômetro</span><div class="suffix"><input class="input dr" id="g-odo" inputmode="numeric" placeholder="${esc(lo ? nf(lo.odo) : 'km do painel')}" autocomplete="off" value="${esc(dv('g-odo'))}"><b>km</b></div></label></div>
        <label class="check"><input type="checkbox" class="dr" id="g-cheio" ${dv('g-cheio', false) ? 'checked' : ''}><span>Completei o tanque (só marque se encheu até a boca)</span></label>
        <p class="note">${varios() ? 'O combustível de todos é somado e dividido pelos km de cada um no acerto, em Resultados. ' : ''}Com dois abastecimentos de tanque cheio e o odômetro, o app mede o consumo real do carro.</p>`;
    } else if (t === 'manutencao' || t === 'outro') {
      h += `<label class="field" for="g-desc"><span>Descrição</span><input class="input dr" id="g-desc" placeholder="${t === 'manutencao' ? 'ex.: troca de óleo, pneus, pastilhas' : 'o que foi'}" autocomplete="off" value="${esc(dv('g-desc'))}"></label>`;
      h += t === 'manutencao' ? '<p class="note">Serve para comparar o gasto real com a estimativa de manutenção por km. Não é descontado de novo.</p>' : '<p class="note">Descontado de quem pagou, no dia em que aconteceu.</p>';
    } else h += '<p class="note">Descontado de quem pagou, no dia em que aconteceu.</p>';
    h += '<button class="btn primary big block" type="submit">Salvar gasto</button></form></section>';

    h += `<section class="card"><h2>O que os gastos mostram</h2><div class="list">`;
    h += `<div class="li"><div class="main"><b>Consumo</b><small>${x.consumoReal ? `${nf(x.consumoReal.kmPorLitro, 1)} km/l medido em ${nf(x.consumoReal.km)} km` : 'Registre 2 abastecimentos de tanque cheio com o odômetro para medir'}</small></div><span class="v">${x.consumo ? nf(x.consumo, 1) + ' km/l' : '—'}</span></div>`;
    h += `<div class="li"><div class="main"><b>Preço do combustível</b><small>${x.precoFonte === 'abastecimento' ? 'do último abastecimento' : 'informado em Ajustes'}</small></div><span class="v">${brl(x.preco)}</span></div>`;
    h += `<div class="li"><div class="main"><b>Combustível por km</b><small>preço ÷ consumo</small></div><span class="v">${brl(x.combKm)}</span></div>`;
    if (x.manutReal && x.manutReal.gasto > 0) h += `<div class="li"><div class="main"><b>Manutenção real</b><small>${brl0(x.manutReal.gasto)} em ${nf(x.manutReal.km)} km · estimativa: ${brl(x.manutKm)}/km</small></div><span class="v">${brl(x.manutReal.porKm)}/km</span></div>`;
    h += '</div></section>';

    const gs = gastosArr().filter((g) => refMes(g.data) === ref).sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
    const tot = gs.reduce((s, g) => s + (g.valor || 0), 0);
    h += `<section class="card"><div class="daynav"><button class="icon-btn" data-act="gmes" data-n="-1" aria-label="Mês anterior" type="button">${ic('l')}</button><div class="d"><b>${esc(cap(nomeMes(ref)))}</b><small>${plural(gs.length, 'gasto', 'gastos')} · ${brl(tot)}</small></div><button class="icon-btn" data-act="gmes" data-n="1" aria-label="Próximo mês" type="button" ${ref >= refMes(hoje()) ? 'disabled' : ''}>${ic('r')}</button></div>`;
    h += gs.length ? `<div class="list">${gs.map(liGasto).join('')}</div>` : '<div class="empty">Nenhum gasto neste mês.</div>';
    return h + '</section>';
  }

  // ---------- tela Resultados ----------
  function intervalo(p) {
    const h = hoje();
    if (p === 'hoje') return [h, h, 'Hoje'];
    if (p === '7d') return [addDias(h, -6), h, 'Últimos 7 dias'];
    if (p === 'mes') return [refMes(h) + '-01', h, cap(nomeMes(refMes(h)))];
    const ra = mesAnt(refMes(h));
    return [ra + '-01', fimMes(ra), cap(nomeMes(ra))];
  }
  function pendencias() {
    const c = cfg(), x = ctx(), p = [];
    if (c.situacao !== 'alugado' && !(x.cap.dep && x.cap.dep.atual > 0)) p.push('Valor do carro na tabela FIPE');
    if (c.situacao === 'financiado' && (!(P(c.fin.parcela) > 0) || !(P(c.fin.restantes) > 0))) p.push('Valor da parcela e quantas faltam');
    else if (c.situacao === 'financiado' && x.cap.juros && x.cap.juros.ok === false && x.cap.parcela > 0) p.push('Taxa de juros do financiamento');
    if (c.situacao === 'alugado' && !(P(c.aluguel.valor) > 0)) p.push('Valor do aluguel do carro');
    if (c.est.preco && x.precoFonte !== 'abastecimento') p.push('Preço do combustível (está com valor de exemplo)');
    if (c.est.consumo && x.consumoFonte !== 'real') p.push('Consumo do carro (está com valor de exemplo)');
    if (c.est.manutencaoKm) p.push('Manutenção por km (está com estimativa)');
    if (c.situacao !== 'alugado' && c.fixos.seguroAnual === '' && c.fixos.ipvaAnual === '') p.push('Seguro e IPVA (use 0 se não tiver)');
    return p;
  }
  function blocoPend(onde) {
    const p = pendencias();
    if (!p.length) return onde === 'ajustes' ? '<p class="note"><b>Configuração completa.</b> Atualize o valor FIPE uma vez por mês.</p>' : '';
    return `<p class="eyebrow">Para a conta ficar exata, falta</p><ul class="pend">${p.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${onde !== 'ajustes' ? '<div><button class="btn sm" data-act="tab" data-tab="ajustes" type="button">Completar em Ajustes</button></div>' : ''}`;
  }
  function cardGanho(R, x) {
    const c = cfg(), sit = c.situacao;
    if (!R.isDono || sit === 'alugado') return '';
    const fin = sit === 'financiado' && x.cap.parcela > 0;
    const h = '<section class="card"><h2>Ganho total</h2>';
    const falta = [];
    if (!(x.cap.dep && x.cap.dep.atual > 0)) falta.push('o valor FIPE do carro');
    if (fin && !(x.cap.juros && x.cap.juros.ok)) falta.push('a taxa de juros do financiamento');
    if (falta.length) return h + `<p class="note">Mostra quanto você ganhou contando também o que aconteceu com o carro. Para calcular, informe ${falta.join(' e ')}.</p><div><button class="btn sm" data-act="tab" data-tab="ajustes" type="button">Completar em Ajustes</button></div></section>`;
    const dep = x.cap.dep.valor, jur = fin ? x.cap.juros.valor : 0, tot = dep + jur;
    const fDep = tot > 0 ? R.capReal * dep / tot : 0, fJur = tot > 0 ? R.capReal * jur / tot : 0;
    let t = h + `<p class="note">${fin ? 'Nem toda a parcela é gasto. A parte que não é juros quita o carro, e isso continua seu. Em compensação, o carro perde valor com o uso.' : 'O carro está quitado, mas perde valor com o uso. Esse custo não sai do bolso agora: aparece quando você vender ou trocar o carro.'}</p><table class="conta"><tbody>`;
    t += linha('Dinheiro no bolso', brl(R.bolso));
    if (fin) t += linha('Parte da parcela que quitou o carro', '+' + brl(R.capBolso - fJur), `da parcela de ${brl(R.capBolso)}, ${brl(fJur)} foram juros`);
    t += linha('Quanto o carro desvalorizou', menos(fDep), x.cap.dep.fonte === 'fipe' ? 'pela variação da tabela FIPE' : `estimativa de ${esc(c.deprecAnualPct || '10')}% ao ano`);
    t += linha('Ganho total', brl(R.real), '', 'tot');
    return t + '</tbody></table></section>';
  }
  function cardParticular(R) {
    if (!(R.kmP > 0)) return '';
    let t = `<section class="card"><h2>Uso particular</h2><p class="note">Km rodados sem corridas. Não entram no dinheiro do trabalho, mas gastam combustível${R.isDono || R.reembolsa ? ' e desgastam o carro' : ''}.</p><table class="conta"><tbody>`;
    t += linha('Dinheiro no bolso do trabalho', brl(R.bolso));
    t += linha('Combustível do uso particular', menos(R.combP), `${nf(R.kmP)} km`);
    if (R.manutP > 0.004) t += linha('Desgaste do uso particular', menos(R.manutP), 'manutenção e pneus');
    t += linha('Sobra depois do uso particular', brl(R.bolso - R.combP - R.manutP), '', 'tot');
    return t + '</tbody></table></section>';
  }
  function cardUsoOutros(R, x) {
    if (!R.isDono) return '';
    let h = '';
    const custoCarro = (x.fixosMes + x.cap.real) * R.nDias / 30.44;
    for (const id of Object.keys(R.outros)) {
      const O = R.outros[id], km = O.kmT + O.kmP;
      if (!(km > 0)) continue;
      const nome = esc(nomeMot(id));
      const parte = R.kmCarro > 0 ? custoCarro * km / R.kmCarro : 0;
      const custo = parte + O.desgaste;
      const pago = O.taxa + (R.reembolsa ? O.desgaste : 0);
      const justo = O.diasTrab > 0 ? custo / O.diasTrab : null;
      h += `<section class="card"><h2>O uso do carro por ${nome}</h2><p class="note">${nome} rodou ${nf(km)} km no período${O.kmP > 0 ? `, ${nf(O.kmP)} deles em uso particular` : ''}. Isso é ${nf(R.kmCarro > 0 ? km / R.kmCarro * 100 : 0)}% dos km do carro.</p><table class="conta"><tbody>`;
      h += linha('Desgaste (manutenção e pneus)', brl(O.desgaste), R.reembolsa ? `${nome} paga esse valor` : 'pago por você, já descontado no seu bolso');
      h += linha('Parte dos custos do carro', brl(parte), `seguro, IPVA, licenciamento${cfg().situacao === 'financiado' ? ', juros' : ''} e desvalorização, pelos km (estimativa)`);
      h += linha(`Quanto o uso de ${nome} custa`, brl(custo), '', 'tot');
      h += linha(`Pago por ${nome}`, brl(pago));
      h += `</tbody></table>${justo && pago < custo - 0.5 ? `<p class="note">Para cobrir esse custo, um valor justo seria cerca de <b>${brl(justo)} por dia</b> que ${nome} trabalha. Se combinarem um valor, registre em Ajustes.</p>` : ''}</section>`;
    }
    return h;
  }
  function cardAcerto() {
    const A = Calc.acerto(ctx(), cfg(), base(), hoje());
    let h = '<section class="card"><h2>Acerto entre vocês</h2>';
    if (!A.transf.length) h += '<p class="note"><b>Tudo certo.</b> Ninguém deve nada a ninguém agora.</p>';
    else h += `<div class="stack">${A.transf.map((t) => `<div class="acerto"><span><b>${esc(nomeMot(t.de))}</b> deve <b>${brl(t.valor)}</b> a <b>${esc(nomeMot(t.para))}</b></span><button class="btn sm" data-act="pagar" data-de="${t.de}" data-para="${t.para}" data-v="${Calc.r2(t.valor)}" type="button">Registrar pagamento</button></div>`).join('')}</div>`;
    let det = '';
    for (const m of mots()) {
      const r = A.R[m.id]; if (!r) continue;
      det += '<table class="conta"><tbody>';
      det += `<tr class="h"><td>${esc(m.nome)}</td><td></td></tr>`;
      det += linha('Km rodados (com o particular)', nf(r.km) + ' km');
      det += linha('Combustível que abasteceu', brl(r.pagoComb));
      det += linha('Combustível que gastou, pelos km', menos(r.parteComb));
      if (r.taxa > 0.004) det += linha('Pagamento pelo uso do carro', menos(r.taxa));
      if (r.desgaste > 0.004) det += linha('Desgaste dos km dele', menos(r.desgaste));
      if (m.dono) { const rec = Object.keys(A.R).reduce((s, id) => (id === m.id ? s : s + A.R[id].taxa + A.R[id].desgaste), 0); if (rec > 0.004) det += linha('A receber pelo uso do carro', '+' + brl(rec)); }
      if (r.pagou > 0.004) det += linha('Já pagou', '+' + brl(r.pagou));
      if (r.recebeu > 0.004) det += linha('Já recebeu', menos(r.recebeu));
      det += linha(r.saldo >= 0 ? 'Saldo a receber' : 'Saldo a pagar', brl(Math.abs(r.saldo)), '', 'tot');
      det += '</tbody></table>';
    }
    h += `<details class="more"><summary>Como esse valor é calculado</summary><p class="note">Todo o combustível abastecido desde o início é somado e dividido pelos km que cada um rodou, contando o uso particular. Quem abasteceu mais do que gastou tem a receber.</p>${det}</details>`;
    const ps = pagArr().sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 5);
    if (ps.length) h += `<p class="eyebrow">Pagamentos registrados</p><div class="list">${ps.map((p) => `<div class="li"><span class="t">${esc(dm(p.data))}</span><div class="main"><b>${esc(nomeMot(p.de))} → ${esc(nomeMot(p.para))}</b></div><span class="v">${brl(p.valor)}</span><button class="icon-btn" data-act="delPag" data-id="${p.id}" aria-label="Apagar pagamento de ${brl(p.valor)}" type="button">${ic('x')}</button></div>`).join('')}</div>`;
    return h + '</section>';
  }
  function cardKmCarro(de, ate, rot) {
    const us = usosArr().filter((u) => u.data >= de && u.data <= ate);
    const por = {};
    for (const u of us) {
      const km = Calc.kmUso(u).km || 0;
      por[u.mot] = por[u.mot] || { t: 0, p: 0 };
      if (u.tipo === 'particular') por[u.mot].p += km; else por[u.mot].t += km;
    }
    const tot = Object.values(por).reduce((s, v) => s + v.t + v.p, 0);
    const gaps = Calc.lacunas(usosArr()).filter((g) => g.ate.data >= de && g.ate.data <= ate);
    let h = `<section class="card"><h2>Km do carro</h2><p class="note">${esc(rot)} · ${nf(tot)} km no total.</p><div class="list">`;
    for (const m of mots()) {
      const v = por[m.id] || { t: 0, p: 0 };
      h += `<div class="li"><div class="main"><b>${esc(m.nome)}</b><small>trabalho ${nf(v.t)} km · particular ${nf(v.p)} km</small></div><span class="v">${nf(v.t + v.p)} km</span></div>`;
    }
    h += '</div>';
    for (const g of gaps) {
      h += `<div class="banner"><span><b>${nf(g.km)} km sem dono</b> entre ${esc(nomeMot(g.de.mot))} (${dm(g.de.data)}${g.de.fim ? ' até ' + esc(g.de.fim) : ''}) e ${esc(nomeMot(g.ate.mot))} (${dm(g.ate.data)}${g.ate.ini ? ' às ' + esc(g.ate.ini) : ''}). Ninguém lançou esses km.</span><button class="btn sm dark" data-act="lacuna" data-a="${g.odoA}" data-b="${g.odoB}" data-k="${g.ate.data}" type="button">Dizer de quem foram</button></div>`;
    }
    return h + '</section>';
  }

  function vResultados() {
    if (!mots().length) return '<section class="card"><div class="empty">Cadastre quem usa o carro na tela Hoje.</div></section>';
    const vid = verId();
    const [de, ate, rot] = intervalo(S.periodo);
    const x = ctx();
    const R = Calc.resultado(x, cfg(), base(), vid, de, ate, { hoje: hoje(), agoraMin: agoraMin() });
    S.serie = R.serie;
    const per = [['hoje', 'Hoje'], ['7d', '7 dias'], ['mes', 'Este mês'], ['mesant', 'Mês passado']];
    let h = seletorMot(vid);
    h += `<div class="seg" role="group" aria-label="Período">${per.map(([k, n]) => `<button data-act="periodo" data-p="${k}" aria-pressed="${S.periodo === k}" type="button">${n}</button>`).join('')}</div>`;
    const pend = blocoPend('resultados');
    if (pend && !S.demo) h += `<section class="card">${pend}</section>`;
    const ativo = R.diasTrab || R.kmP > 0 || Math.abs(R.bolso) > 0.005;
    if (!ativo) {
      h += `<section class="card"><p class="eyebrow">${esc(rot)}${varios() ? ' · ' + esc(nomeMot(vid)) : ''}</p><div class="empty">Nenhum uso do carro neste período.<br><button class="btn sm" style="margin-top:10px" data-act="tab" data-tab="hoje" type="button">Lançar o dia de hoje</button></div></section>`;
    } else {
      h += `<section class="card result"><div class="row between"><p class="eyebrow">${esc(rot)}${varios() ? ' · ' + esc(nomeMot(vid)) : ''} · ${plural(R.diasTrab, 'dia trabalhado', 'dias trabalhados')}</p>${R.bolso < 0 ? '<span class="status bad">No prejuízo</span>' : '<span class="status ok">No lucro</span>'}</div>${heroBolso(R, x)}<div class="minis">${mini(brl0(R.bruto), 'faturado')}${mini(brl0(R.bruto - R.bolso), 'custos')}${mini(R.diasTrab > 0 ? brl0(R.bolso / R.diasTrab) : '—', 'por dia')}${mini(R.porHoraBolso != null ? brl(R.porHoraBolso) : '—', 'por hora')}</div></section>`;
      if (S.periodo !== 'hoje') h += '<section class="card"><div><h2>Dinheiro no bolso por dia</h2><p class="note">Toque numa barra para ver o dia. Barras para baixo são dias no prejuízo.</p></div><div class="chart" id="chart" aria-label="Gráfico do dinheiro no bolso por dia"></div></section>';
      h += `<section class="card"><h2>A conta</h2>${contaBolso(R, x)}</section>`;
      h += cardParticular(R);
      h += cardGanho(R, x);
      h += cardUsoOutros(R, x);
      h += `<section class="card"><h2>Indicadores</h2><div class="stats">
        <div class="stat"><b>${hrs(R.horas || null)}</b><span>horas trabalhadas${R.diasSemHoras ? ` · ${plural(R.diasSemHoras, 'dia sem horário', 'dias sem horário')}` : ''}</span></div>
        <div class="stat"><b>${nf(R.kmT)} km</b><span>rodados trabalhando${R.diasSemKm ? ` · ${plural(R.diasSemKm, 'dia sem km', 'dias sem km')}` : ''}</span></div>
        <div class="stat"><b>${brl(R.porHoraBolso)}</b><span>no bolso por hora</span></div>
        <div class="stat"><b>${brl(R.ticket)}</b><span>média por corrida</span></div>
        <div class="stat"><b>${brl(R.brutoPorKm)}</b><span>faturado por km rodado</span></div>
        <div class="stat"><b>${brl(R.custoPorKm)}</b><span>custo por km rodado</span></div>
        </div>${R.custoPorKm ? `<p class="note">Cada km rodado custa <b>${brl(R.custoPorKm)}</b> contando todos os seus custos. Uma corrida que paga menos que isso por km, somando o trecho até o passageiro, não se paga.</p>` : ''}</section>`;
      const plats = Object.entries(R.porPlat).sort((a, b) => b[1].valor - a[1].valor);
      if (plats.length) {
        const max = plats[0][1].valor || 1;
        h += `<section class="card"><h2>Por plataforma</h2><div class="stack">${plats.map(([p, v]) => `<div class="hbar"><div>${esc(p)}<small>${v.corridas ? plural(v.corridas, 'corrida', 'corridas') + ' · média ' + brl(v.valor / v.corridas) : 'pelo resumo do dia'}</small></div><div class="track"><i style="width:${(v.valor / max * 100).toFixed(1)}%"></i></div><div class="num">${brl0(v.valor)}<small>${nf(v.valor / (R.bruto || 1) * 100)}%</small></div></div>`).join('')}</div></section>`;
      }
      if (R.isDono && (S.periodo === 'mes' || S.periodo === 'mesant')) {
        const dono = donoM() || {};
        const diasM = Math.max(1, P(dono.diasMes) || 26);
        const totMes = x.fixosMes + x.cap.bolso, cob = R.fixos + R.capBolso;
        if (totMes > 0) h += `<section class="card"><h2>Custos fixos do mês</h2>${meter(cob / totMes * 100, `<b>${brl0(cob)}</b> de ${brl0(totMes)} cobertos`, `${R.diasTrab} de ${nf(diasM)} dias`)}<p class="note">Seguro, IPVA, celular${x.cap.bolso > 0 ? (cfg().situacao === 'alugado' ? ' e aluguel' : ' e parcela') : ''} chegam todo mês e são pagos por ${esc(dono.nome || 'quem é dono')}. Cada dia trabalhado cobre ${brl((x.fixosMes + x.cap.bolso) / diasM)} deles.</p></section>`;
      }
    }
    if (varios()) h += cardAcerto() + cardKmCarro(de, ate, rot);
    return h;
  }

  // ---------- tela Histórico ----------
  function vHistorico() {
    const ref = S.histMes || refMes(hoje());
    const ate = ref === refMes(hoje()) ? hoje() : fimMes(ref);
    const x = ctx(), b = base();
    let h = `<section class="card"><div class="daynav"><button class="icon-btn" data-act="hmes" data-n="-1" aria-label="Mês anterior" type="button">${ic('l')}</button><div class="d"><b>${esc(cap(nomeMes(ref)))}</b><small>no bolso de cada um</small></div><button class="icon-btn" data-act="hmes" data-n="1" aria-label="Próximo mês" type="button" ${ref >= refMes(hoje()) ? 'disabled' : ''}>${ic('r')}</button></div>`;
    if (mots().length) {
      h += '<table class="conta"><tbody>';
      for (const m of mots()) {
        const R = Calc.resultado(x, cfg(), b, m.id, ref + '-01', ate, { hoje: hoje(), agoraMin: agoraMin() });
        h += linha(esc(m.nome), brl(R.bolso), `${plural(R.diasTrab, 'dia', 'dias')} · faturou ${brl0(R.bruto)} · ${nf(R.kmT + R.kmP)} km`);
      }
      h += '</tbody></table>';
    }
    h += '</section>';
    const us = b.usos.filter((u) => refMes(u.data) === ref).sort(ordUso).reverse();
    h += '<section class="card"><h2>Usos do carro</h2>';
    if (!us.length) h += `<div class="empty">Nenhum uso lançado em ${esc(nomeMes(ref))}.</div>`;
    else {
      h += '<div class="list">';
      for (const u of us) {
        const km = Calc.kmUso(u).km, g = Calc.ganhosUso(u);
        const det = [u.tipo === 'particular' ? 'particular' : plural(g.corridas, 'corrida', 'corridas'), km != null ? nf(km) + ' km' : 'sem km', u.ini ? esc(u.ini) + (u.fim ? '–' + esc(u.fim) : ' em andamento') : ''].filter(Boolean).join(' · ');
        h += `<button class="li btnrow" data-act="abrirUso" data-id="${u.id}" type="button"><span class="t">${esc(fData(u.data, { weekday: 'short' }).replace('.', ''))}<br><b style="color:var(--ink);font-size:16px">${u.data.slice(8)}</b></span><span class="main"><b>${varios() ? esc(nomeMot(u.mot)) + ' · ' : ''}${u.tipo === 'particular' ? 'Uso particular' : 'Trabalho'}</b><small>${det}</small></span><span class="v">${u.tipo === 'particular' ? '' : brl(g.bruto)}</span></button>`;
      }
      h += '</div><p class="note">Valor à direita: faturado no uso. Toque para abrir e editar.</p>';
    }
    return h + '</section>';
  }

  // ---------- tela Ajustes ----------
  function ajDep() {
    const c = cfg(), x = ctx(), d = x.cap.dep || Calc.depreciacaoMensal(c);
    if (c.situacao === 'alugado') return 'Carro alugado: a desvalorização é do dono, não entra na sua conta.';
    if (!(d.atual > 0)) return 'Registre o valor FIPE para o app calcular quanto o carro desvaloriza.';
    if (d.fonte === 'fipe') return `O carro perde <b>${brl(d.valor)} por mês</b> de valor, pela variação da FIPE em ${d.meses} ${d.meses === 1 ? 'mês' : 'meses'}.${d.valorizou ? ' O valor FIPE subiu no período, então por enquanto a desvalorização fica em zero.' : ''}`;
    return `O carro perde cerca de <b>${brl(d.valor)} por mês</b> de valor (estimativa de ${esc(c.deprecAnualPct || '10')}% ao ano sobre ${brl0(d.atual)}). Com dois meses de FIPE registrados, o app passa a usar a variação real.`;
  }
  function ajJuros() {
    const x = ctx(), j = x.cap.juros;
    if (!j) return '';
    if (j.quitado || !(x.cap.parcela > 0)) return 'Informe a parcela e quantas faltam.';
    if (!j.ok) return 'Sem a taxa de juros, o app não sabe quanto da parcela quita o carro. Informe a taxa do contrato ou o valor financiado e o total de parcelas.';
    return `Da parcela de ${brl(x.cap.parcela)}, <b>${brl(j.valor)} são juros</b> e ${brl(x.cap.parcela - j.valor)} quitam o carro. Faltam cerca de ${brl0(j.saldo)} para quitar. Taxa de ${nf(j.taxa * 100, 2)}% ao mês${j.fonte === 'calculada' ? ', calculada pelo app' : ''}.`;
  }
  function ajComb() { const x = ctx(); return `Combustível: <b>${brl(x.combKm)} por km</b> = ${brl(x.preco)} ${x.precoFonte === 'abastecimento' ? '(último abastecimento)' : ''} ÷ ${nf(x.consumo, 1)} km/l${x.consumoFonte === 'real' ? ' (medido)' : ''}.`; }
  function ajManut() { const x = ctx(); return x.manutReal && x.manutReal.gasto > 0 ? `Pelos registros: ${brl0(x.manutReal.gasto)} em ${nf(x.manutReal.km)} km = ${brl(x.manutReal.porKm)} por km.` : 'Inclui óleo, filtros, pneus, freios, suspensão e revisões, divididos pelos km rodados.'; }
  function ajFixos() {
    const x = ctx(), d = donoM() || {}, dias = Math.max(1, P(d.diasMes) || 26);
    return `Total: <b>${brl(x.fixosMes)} por mês</b>${varios() ? `, pagos por ${esc(d.nome || 'quem é dono')}` : ''}. São ${brl(x.fixosMes / dias)} por dia que ${varios() ? esc(d.nome || 'o dono') : 'você'} trabalha.`;
  }
  function refreshAjustes() {
    const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    set('ajPend', blocoPend('ajustes')); set('ajDep', ajDep()); set('ajJuros', ajJuros()); set('ajComb', ajComb()); set('ajManut', ajManut()); set('ajFixos', ajFixos());
    document.querySelectorAll('[data-est]').forEach((t) => { t.hidden = !(cfg().est || {})[t.dataset.est]; });
  }
  function cardMotoristas() {
    let h = '<section class="card"><h2>Quem usa o carro</h2>';
    if (!mots().length) return h + '<p class="note">Ninguém cadastrado ainda. Comece pela tela Hoje.</p></section>';
    const temUso = (id) => usosArr().some((u) => u.mot === id);
    for (const m of mots()) {
      h += `<div class="mot"><div class="row between"><b>${esc(m.nome)}${m.dono ? ' <span class="tag">dono do carro</span>' : ''}</b>${!m.dono && !temUso(m.id) ? `<button class="btn ghost sm danger-t" data-act="delMot" data-id="${m.id}" type="button">Remover</button>` : ''}</div>
        ${campo({ id: 'm-nome-' + m.id, label: 'Nome', val: m.nome, mode: 'text', attrs: `data-m="nome" data-mid="${m.id}"` })}
        <div class="grid2">${campo({ id: 'm-dias-' + m.id, label: 'Dias de trabalho por mês', val: m.diasMes || '', mode: 'numeric', ph: '26', attrs: `data-m="diasMes" data-mid="${m.id}"` })}${campo({ id: 'm-meta-' + m.id, label: 'Meta no bolso por mês', val: m.meta || '', pre: 'R$', attrs: `data-m="meta" data-mid="${m.id}"` })}</div>
        ${!m.dono ? `<div><button class="btn sm" data-act="tornarDono" data-id="${m.id}" type="button">Marcar como dono do carro</button></div>` : '<p class="note">Os dias de trabalho do dono dividem os custos fixos e a parcela por dia.</p>'}</div>`;
    }
    h += `<form id="fMot" class="row" style="flex-wrap:nowrap"><input class="input dr" id="m-novo" placeholder="Adicionar motorista" autocomplete="off" value="${esc(dv('m-novo'))}"><button class="btn" type="submit">Adicionar</button></form>`;
    if (!S.demo) h += `<p class="note">Nesta conta: <b>${EU() === 'obs' ? 'só acompanhando' : mot(EU()) ? esc(nomeMot(EU())) : 'ninguém escolhido'}</b>. <button class="linkbtn" data-act="trocarEu" type="button">Trocar</button></p>`;
    return h + '</section>';
  }
  function cardAcordo() {
    if (!varios()) return '';
    const a = cfg().acordo || {}, d = donoM() || {};
    const tipos = [['nada', 'Nada por enquanto'], ['dia', 'Por dia trabalhado'], ['semana', 'Por semana'], ['pct', 'Porcentagem das corridas']];
    let h = `<section class="card"><h2>Acordo pelo uso do carro</h2><p class="note">Quanto quem não é dono paga a ${esc(d.nome || 'quem é dono')} pelo uso do carro.</p>
      <label class="field" for="a-tipo"><span>Forma de pagamento</span><select class="input" id="a-tipo" data-c="acordo.tipo">${tipos.map(([v, n]) => `<option value="${v}"${(a.tipo || 'nada') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`;
    if (a.tipo && a.tipo !== 'nada') h += campo({ id: 'a-val', label: a.tipo === 'pct' ? 'Porcentagem do faturamento' : a.tipo === 'dia' ? 'Valor por dia trabalhado' : 'Valor por semana', path: 'acordo.valor', pre: a.tipo === 'pct' ? '' : 'R$', suf: a.tipo === 'pct' ? '%' : '' });
    h += `<label class="check"><input type="checkbox" id="a-desg" data-cb="acordo.desgaste" ${a.desgaste ? 'checked' : ''}><span>Também paga o desgaste dos km que roda (manutenção e pneus)</span></label>
      <p class="note">Combustível: cada um abastece quando precisa, e o app divide o total pelos km de cada um, inclusive o uso particular. O valor aparece em Resultados, no acerto.</p></section>`;
    return h;
  }
  function cardDados() {
    let h = `<section class="card"><h2>Seus dados</h2><p class="note">${S.demo ? 'Você está vendo o exemplo. Seus dados não foram alterados.' : 'Ficam salvos no Firebase e aparecem para todos que entraram no carro. Sem internet, o app continua funcionando e envia os lançamentos quando a conexão voltar.'}</p>`;
    if (!S.demo) h += '<details class="more"><summary>Trazer os dados da versão no Claude</summary><p class="note">No app antigo, abra Ajustes e toque em Baixar backup. Aqui, toque em Restaurar backup e escolha o arquivo. Os motoristas do backup substituem os daqui; depois cada um escolhe quem é na tela Hoje.</p></details>';
    h += '<div class="grid2"><button class="btn" data-act="exportar" type="button">Baixar backup</button><button class="btn" data-act="restaurar" type="button">Restaurar backup</button></div>';
    h += `<div class="grid2">${S.demo ? '<button class="btn" data-act="sairDemo" type="button">Sair do exemplo</button>' : '<button class="btn" data-act="entrarDemo" type="button">Ver exemplo</button>'}${S.demo || souCriador() ? '<button class="btn danger" data-act="apagar" type="button">Apagar tudo</button>' : ''}</div>`;
    return h + '</section>';
  }
  const fmtCod = (c) => (c ? c.slice(0, 4) + '-' + c.slice(4) : '');
  const linkApp = () => location.origin + location.pathname;
  const msgConvite = () => `Vamos lançar o uso do carro no Km Líquido.\n\n1. Abra este link no navegador (Safari no iPhone, Chrome no Android):\n${linkApp()}\n\n2. Instale na tela do celular:\n• iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início"\n• Android: toque no menu ⋮ e depois em "Instalar app"\n\n3. Abra o app pelo ícone novo e crie sua conta com seu e-mail e uma senha.\n\n4. Toque em "Tenho um código" e digite: ${fmtCod(S.carro.codigo)}\n\n5. Escolha o seu nome. Pronto!`;
  function cardConvite(curto) {
    if (S.demo || !S.carro || !S.carro.codigo) return '';
    const contas = Object.values(S.carro.contas || {}).map((c) => esc(c.email || '')).filter(Boolean);
    return `<section class="card"><h2>${curto ? 'Falta o outro motorista entrar' : 'Convidar motorista'}</h2><p class="note">Quem vai usar o carro abre o app, cria a conta e digita este código em "Tenho um código".</p><div class="codigo">${fmtCod(S.carro.codigo)}</div><div class="grid2"><button class="btn" data-act="copiarConvite" type="button">Copiar convite</button><a class="btn" href="https://wa.me/?text=${encodeURIComponent(msgConvite())}" target="_blank" rel="noopener">Enviar no WhatsApp</a></div>${!curto && contas.length ? `<p class="note">Contas neste carro: ${contas.join(', ')}.</p>` : ''}${!curto && souCriador() ? '<div><button class="linkbtn" data-act="novoCodigo" type="button">Gerar outro código</button></div>' : ''}</section>`;
  }
  function cardConta() {
    if (S.demo || !S.user) return '';
    return `<section class="card"><h2>Conta</h2><p class="note">Você entrou como <b>${esc(S.user.email)}</b>.</p><div><button class="btn" data-act="sair" type="button">Sair da conta</button></div></section>`;
  }
  const instalado = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  function cardInstalar() {
    if (instalado()) return '';
    return `<section class="card"><h2>Instalar no celular</h2>${S.instalar ? '<button class="btn primary block" data-act="instalar" type="button">Instalar o app</button>' : ''}<p class="note"><b>iPhone:</b> no Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.<br><b>Android:</b> no Chrome, toque no menu ⋮ e depois em Instalar app.</p></section>`;
  }

  // ---------- telas de entrada ----------
  const ERROS_AUTH = {
    'auth/invalid-email': 'Esse e-mail não parece válido.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/missing-password': 'Digite a senha.',
    'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Toque em Entrar.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Espere alguns minutos e tente de novo.',
    'auth/network-request-failed': 'Sem internet. Conecte e tente de novo.',
  };
  const erroAuth = (e) => ERROS_AUTH[e && e.code] || `Não foi possível entrar (${(e && e.code) || 'erro'}).`;
  function marcarOcupado(on) {
    const b = view.querySelector('form button[type=submit]');
    if (!b) return;
    if (on) { b.dataset.txt = b.textContent; b.textContent = 'Aguarde…'; b.disabled = true; }
    else { if (b.dataset.txt) b.textContent = b.dataset.txt; b.disabled = false; }
  }
  function vConfig() {
    return '<section class="card"><h2>Falta ligar o app ao Firebase</h2><p class="note">A configuração do projeto ainda não foi colocada no app.</p><button class="btn" data-act="entrarDemo" type="button">Ver o exemplo</button></section>';
  }
  function vLogin() {
    const criar = S.authModo === 'criar';
    return `<section class="card"><div class="auth-top"><span class="brand-mark big" aria-hidden="true">km</span><div><h2>Km Líquido</h2><p class="note">Quanto sobra de verdade das corridas.</p></div></div>
      <div class="seg" role="group" aria-label="Entrar ou criar conta"><button data-act="authModo" data-m="entrar" aria-pressed="${!criar}" type="button">Entrar</button><button data-act="authModo" data-m="criar" aria-pressed="${criar}" type="button">Criar conta</button></div>
      <form id="fAuth" class="stack">
        <label class="field" for="au-email"><span>E-mail</span><input class="input dr" id="au-email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" value="${esc(dv('au-email'))}"></label>
        <label class="field" for="au-senha"><span>Senha${criar ? ' (pelo menos 6 caracteres)' : ''}</span><input class="input" id="au-senha" type="password" autocomplete="${criar ? 'new-password' : 'current-password'}"></label>
        <button class="btn primary big block" type="submit">${criar ? 'Criar conta' : 'Entrar'}</button>
      </form>
      ${criar ? '' : '<div><button class="linkbtn" data-act="esqueci" type="button">Esqueci minha senha</button></div>'}</section>
      <button class="btn ghost block" data-act="entrarDemo" type="button">Ver um exemplo sem entrar</button>`;
  }
  function vSemCarro() {
    const cod = S.scModo === 'codigo';
    let h = `<section class="card"><p class="eyebrow">${esc(S.user ? S.user.email : '')}</p><h2>Vamos começar</h2><p class="note">Cadastre o carro, ou entre no carro de outra pessoa com o código de convite que ela te mandou.</p><div class="seg" role="group" aria-label="Como começar"><button data-act="scModo" data-m="cadastrar" aria-pressed="${!cod}" type="button">Cadastrar o carro</button><button data-act="scModo" data-m="codigo" aria-pressed="${cod}" type="button">Tenho um código</button></div></section>`;
    if (cod) h += `<section class="card"><form id="fCodigo" class="stack"><label class="field" for="cv-cod"><span>Código de convite</span><input class="input big dr" id="cv-cod" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX" value="${esc(dv('cv-cod'))}"></label><button class="btn primary big block" type="submit">Entrar no carro</button></form></section>`;
    else h += cardSetup();
    return h + '<button class="btn ghost block" data-act="sair" type="button">Sair da conta</button>';
  }
  function gerarCodigo() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const r = new Uint32Array(8);
    crypto.getRandomValues(r);
    return Array.from(r, (x) => A[x % A.length]).join('');
  }
  async function autenticar() {
    const email = ($('#au-email').value || '').trim(), senha = $('#au-senha').value || '';
    if (!email) { toast('Digite o seu e-mail.'); return; }
    if (!senha) { toast('Digite a senha.'); return; }
    if (S.authModo === 'criar' && senha.length < 6) { toast('A senha precisa ter pelo menos 6 caracteres.'); return; }
    marcarOcupado(true);
    try { if (S.authModo === 'criar') await FB.criarConta(email, senha); else await FB.entrar(email, senha); }
    catch (e) { marcarOcupado(false); toast(erroAuth(e)); }
  }
  async function criarCarro(ms) {
    if (!navigator.onLine) { toast('Para cadastrar o carro, conecte à internet.'); return; }
    const u = S.user, id = FB.novoId(), codigo = gerarCodigo();
    if (ms.length === 1) ms[0].uid = u.uid;
    const config = mesclar(cfgPadrao(), { motoristas: ms });
    marcarOcupado(true);
    try {
      await FB.criarCarro(id, { criador: u.uid, membros: [u.uid], contas: { [u.uid]: { email: u.email || '' } }, codigo, config: clone(config), criadoEm: Date.now() });
      await FB.criarConvite(codigo, id);
    } catch (e) { marcarOcupado(false); toast(`Não foi possível cadastrar agora (${(e && e.code) || 'erro'}).`); return; }
    delete S.draft['s-dono']; delete S.draft['s-outro'];
    Fire.ouvir(id);
  }
  async function entrarComCodigo(raw) {
    const codigo = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (codigo.length !== 8) { toast('O código tem 8 letras e números, como ABCD-2345.'); return; }
    if (!navigator.onLine) { toast('Para entrar no carro, conecte à internet.'); return; }
    marcarOcupado(true);
    try {
      const carroId = await FB.lerConvite(codigo);
      if (!carroId) { marcarOcupado(false); toast('Código não encontrado. Confira com quem te convidou.'); return; }
      await FB.entrarNoCarro(carroId, S.user.uid, S.user.email || '', codigo);
      delete S.draft['cv-cod'];
      Fire.ouvir(carroId);
    } catch (e) {
      marcarOcupado(false);
      toast(e && e.code === 'permission-denied' ? 'Esse código não vale mais. Peça um novo a quem te convidou.' : 'Não foi possível entrar agora. Confira a internet.');
    }
  }
  function vAjustes() {
    const c = cfg();
    let h = `<section class="card" id="ajPend">${blocoPend('ajustes')}</section>`;
    h += cardMotoristas();
    h += cardConvite(false);
    h += cardAcordo();
    h += `<section class="card"><h2>O carro</h2><div class="grid2">${campo({ id: 'v-marca', label: 'Marca', path: 'veiculo.marca', mode: 'text', ph: 'ex.: Chevrolet' })}${campo({ id: 'v-modelo', label: 'Modelo e versão', path: 'veiculo.modelo', mode: 'text', ph: 'ex.: Onix 1.0' })}</div>
      <div class="grid3">${campo({ id: 'v-af', label: 'Ano fabricação', path: 'veiculo.anoFab', mode: 'numeric', ph: '2021', extra: 'maxlength="4"' })}${campo({ id: 'v-am', label: 'Ano modelo', path: 'veiculo.anoModelo', mode: 'numeric', ph: '2022', extra: 'maxlength="4"' })}
      <label class="field" for="v-comb"><span>Combustível</span><select class="input" id="v-comb" data-c="veiculo.combustivel">${[['flex', 'Flex'], ['gasolina', 'Gasolina'], ['etanol', 'Etanol'], ['diesel', 'Diesel'], ['gnv', 'GNV']].map(([v, n]) => `<option value="${v}"${c.veiculo.combustivel === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div></section>`;
    const hist = (c.fipe.historico || []).slice().sort((a, b) => (a.ref < b.ref ? 1 : -1));
    h += `<section class="card"><h2>Valor do carro na FIPE</h2><p class="note">Abra a tabela, escolha Carros, a marca, o modelo e o <b>ano do modelo</b>${c.veiculo.anoModelo ? ` (${esc(c.veiculo.anoModelo)})` : ''}. Depois registre aqui o valor e o mês de referência. Repita uma vez por mês.</p>
      <a class="btn block" href="https://veiculos.fipe.org.br/" target="_blank" rel="noopener">Abrir tabela FIPE ${ic('ext')}</a>
      <form id="fFipe" class="stack"><div class="grid2"><label class="field" for="fipe-ref"><span>Mês de referência</span><input class="input dr" id="fipe-ref" type="month" value="${esc(dv('fipe-ref', refMes(hoje())))}" placeholder="aaaa-mm"></label><label class="field" for="fipe-val"><span>Valor FIPE</span><div class="prefix"><b>R$</b><input class="input dr" id="fipe-val" inputmode="decimal" placeholder="0" autocomplete="off" value="${esc(dv('fipe-val'))}"></div></label></div><button class="btn dark block" type="submit">Registrar valor</button></form>
      ${hist.length ? `<div class="list">${hist.map((x) => `<div class="li"><div class="main"><b>${esc(cap(nomeMes(x.ref)))}</b></div><span class="v">${brl0(x.valor)}</span><button class="icon-btn" data-act="delFipe" data-ref="${x.ref}" aria-label="Apagar valor de ${esc(nomeMes(x.ref))}" type="button">${ic('x')}</button></div>`).join('')}</div>` : ''}
      <p class="note" id="ajDep">${ajDep()}</p>
      ${c.situacao !== 'alugado' ? campo({ id: 'v-dep', label: 'Desvalorização por ano', path: 'deprecAnualPct', suf: '%', est: 'deprecAnualPct' }) : ''}</section>`;
    h += `<section class="card"><h2>Situação do carro</h2><div class="seg" role="group" aria-label="Situação">${[['financiado', 'Financiado'], ['proprio', 'Quitado'], ['alugado', 'Alugado']].map(([v, n]) => `<button data-act="sit" data-v="${v}" aria-pressed="${c.situacao === v}" type="button">${n}</button>`).join('')}</div>`;
    if (c.situacao === 'financiado') {
      h += `<div class="grid2">${campo({ id: 'f-parc', label: 'Valor da parcela', path: 'fin.parcela', pre: 'R$' })}${campo({ id: 'f-rest', label: 'Parcelas que faltam', path: 'fin.restantes', mode: 'numeric' })}</div>
        ${campo({ id: 'f-taxa', label: 'Taxa de juros (está no contrato)', path: 'fin.taxaMensalPct', suf: '% a.m.', ph: 'ex.: 1,89' })}
        <details class="more"${c.fin.valorFinanciado ? ' open' : ''}><summary>Não sabe a taxa? O app calcula</summary><div class="grid2">${campo({ id: 'f-vf', label: 'Valor financiado', path: 'fin.valorFinanciado', pre: 'R$' })}${campo({ id: 'f-tot', label: 'Total de parcelas', path: 'fin.totalParcelas', mode: 'numeric', ph: 'ex.: 48' })}</div><p class="note">Deixe a taxa em branco para usar o cálculo.</p></details>
        <p class="note" id="ajJuros">${ajJuros()}</p>`;
    } else if (c.situacao === 'alugado') {
      h += `<div class="grid2">${campo({ id: 'a-alug', label: 'Valor do aluguel', path: 'aluguel.valor', pre: 'R$' })}<label class="field" for="a-per"><span>Pago por</span><select class="input" id="a-per" data-c="aluguel.periodo"><option value="semana"${c.aluguel.periodo !== 'mes' ? ' selected' : ''}>Semana</option><option value="mes"${c.aluguel.periodo === 'mes' ? ' selected' : ''}>Mês</option></select></label></div><p class="note">Se o seguro e o IPVA já estão no aluguel, deixe esses custos em zero.</p>`;
    } else h += '<p class="note">Carro quitado: não tem parcela. O ganho total, em Resultados, desconta quanto o carro desvaloriza com o uso.</p>';
    h += '</section>';
    h += `<section class="card"><h2>Combustível</h2><div class="grid2">${campo({ id: 'k-preco', label: 'Preço por litro', path: 'comb.preco', pre: 'R$', est: 'preco', ph: '0,00' })}${campo({ id: 'k-cons', label: 'Consumo na cidade', path: 'comb.consumo', suf: 'km/l', est: 'consumo' })}</div>
      <label class="check"><input type="checkbox" id="k-up" data-cb="comb.usarUltimoPreco" ${c.comb.usarUltimoPreco !== false ? 'checked' : ''}><span>Atualizar o preço pelo último abastecimento lançado</span></label>
      <label class="check"><input type="checkbox" id="k-real" data-cb="comb.usarReal" ${c.comb.usarReal !== false ? 'checked' : ''}><span>Usar o consumo real medido nos abastecimentos, quando houver</span></label>
      <p class="note" id="ajComb">${ajComb()}</p></section>`;
    h += `<section class="card"><h2>Manutenção</h2>${campo({ id: 'm-km', label: 'Custo de manutenção por km', path: 'manutencaoKm', pre: 'R$', suf: '/km', est: 'manutencaoKm' })}<p class="note" id="ajManut">${ajManut()}</p></section>`;
    h += `<section class="card"><h2>Custos fixos</h2><div class="grid2">
      ${campo({ id: 'x-seg', label: 'Seguro (por ano)', path: 'fixos.seguroAnual', pre: 'R$' })}${campo({ id: 'x-ipva', label: 'IPVA (por ano)', path: 'fixos.ipvaAnual', pre: 'R$' })}
      ${campo({ id: 'x-lic', label: 'Licenciamento (por ano)', path: 'fixos.licenciamentoAnual', pre: 'R$' })}${campo({ id: 'x-cel', label: 'Celular e internet (mês)', path: 'fixos.celularMensal', pre: 'R$' })}
      ${campo({ id: 'x-mei', label: 'MEI ou INSS (mês)', path: 'fixos.meiMensal', pre: 'R$' })}${campo({ id: 'x-out', label: 'Outros fixos (mês)', path: 'fixos.outrosMensal', pre: 'R$' })}
      </div><p class="note" id="ajFixos">${ajFixos()}</p></section>`;
    h += `<section class="card"><h2>Plataformas</h2><div class="chips">${c.plataformas.map((p) => `<span class="chip" style="display:inline-flex;align-items:center;gap:4px;padding-right:4px">${esc(p)}<button class="icon-btn" style="width:30px;height:30px" data-act="delPlat" data-p="${esc(p)}" aria-label="Remover ${esc(p)}" type="button">${ic('x')}</button></span>`).join('')}</div>
      <form id="fPlat" class="row" style="flex-wrap:nowrap"><input class="input dr" id="p-novo" placeholder="Adicionar plataforma" autocomplete="off" value="${esc(dv('p-novo'))}"><button class="btn" type="submit">Adicionar</button></form></section>`;
    h += cardConta() + cardInstalar() + cardDados();
    h += '<p class="note" style="text-align:center">Km Líquido · versão 7</p>';
    return h;
  }

  // ---------- gráfico ----------
  function passo(v) { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))); const f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; }
  function desenharGrafico() {
    const box = $('#chart'); if (!box) return;
    const serie = S.serie, n = serie.length; if (!n) return;
    const W = Math.max(260, box.clientWidth || 320), H = 180, padL = 50, padR = 4, padT = 8, padB = 24;
    const vals = serie.map((s) => s.bolso);
    let max = Math.max(0, ...vals);
    const min = Math.min(0, ...vals);
    if (max - min < 1) max = 100;
    const st = passo((max - min) / 3);
    const top = Math.max(st, Math.ceil(max / st) * st), bot = Math.floor(min / st) * st;
    const y = (v) => padT + (top - v) / (top - bot) * (H - padT - padB);
    const slot = (W - padL - padR) / n, gap = slot > 6 ? 2 : 1, bw = Math.max(1, slot - gap), y0 = y(0);
    let g = '';
    for (let v = bot; v <= top + 1e-6; v += st) {
      const yy = y(v).toFixed(1);
      g += `<line class="${Math.abs(v) < 1e-6 ? 'zero' : 'grid'}" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}"/><text x="${padL - 6}" y="${(+yy + 4).toFixed(1)}" text-anchor="end">${v < 0 ? '−' : ''}R$ ${nf(Math.abs(v))}</text>`;
    }
    let bars = '';
    serie.forEach((s, i) => {
      const x0 = padL + i * slot + gap / 2;
      if (!s.ativo) { bars += `<rect class="off" x="${x0.toFixed(1)}" y="${(y0 - 1).toFixed(1)}" width="${bw.toFixed(1)}" height="2" data-i="${i}"/>`; return; }
      const y1 = y(s.bolso), hgt = Math.abs(y1 - y0), r = Math.min(4, bw / 2, hgt);
      const xa = x0.toFixed(1), xb = (x0 + bw).toFixed(1), xr1 = (x0 + r).toFixed(1), xr2 = (x0 + bw - r).toFixed(1);
      const d = s.bolso >= 0
        ? `M${xa} ${y0.toFixed(1)}V${(y1 + r).toFixed(1)}Q${xa} ${y1.toFixed(1)} ${xr1} ${y1.toFixed(1)}H${xr2}Q${xb} ${y1.toFixed(1)} ${xb} ${(y1 + r).toFixed(1)}V${y0.toFixed(1)}Z`
        : `M${xa} ${y0.toFixed(1)}V${(y1 - r).toFixed(1)}Q${xa} ${y1.toFixed(1)} ${xr1} ${y1.toFixed(1)}H${xr2}Q${xb} ${y1.toFixed(1)} ${xb} ${(y1 - r).toFixed(1)}V${y0.toFixed(1)}Z`;
      bars += `<path class="${s.bolso >= 0 ? 'bp' : 'bn'}" d="${d}" data-i="${i}"/>`;
    });
    let xl = '';
    const marcar = n <= 8 ? serie.map((_, i) => i) : [0, ...serie.map((s, i) => i).filter((i) => i > 0 && i < n - 1 && Number(serie[i].data.slice(8)) % 5 === 0), n - 1];
    const usados = [];
    for (const i of marcar) {
      const cx = padL + i * slot + slot / 2;
      if (usados.some((u) => Math.abs(u - cx) < 24)) continue;
      usados.push(cx);
      const lab = n <= 8 ? fData(serie[i].data, { weekday: 'short' }).replace('.', '') : serie[i].data.slice(8);
      xl += `<text x="${cx.toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(lab)}</text>`;
    }
    const pos = serie.filter((s) => s.ativo && s.bolso >= 0).length, neg = serie.filter((s) => s.ativo && s.bolso < 0).length;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${pos} dias no lucro e ${neg} no prejuízo">${g}${bars}${xl}<rect class="hit" x="${padL}" y="0" width="${W - padL - padR}" height="${H}"/></svg><div class="tip" id="tip" hidden></div>`;
    const svg = box.querySelector('svg'), tip = $('#tip');
    const mostrar = (ev) => {
      const rc = svg.getBoundingClientRect();
      const px = (ev.clientX - rc.left) * (W / rc.width);
      const i = Math.max(0, Math.min(n - 1, Math.floor((px - padL) / slot)));
      const s = serie[i];
      svg.querySelectorAll('.sel').forEach((e) => e.classList.remove('sel'));
      const el = svg.querySelector(`[data-i="${i}"]`); if (el) el.classList.add('sel');
      box.classList.add('has-sel');
      tip.innerHTML = `<b>${esc(fData(s.data, { weekday: 'short', day: 'numeric', month: 'short' }))}</b><br>${s.trabalhou ? `Bolso ${brl(s.bolso)} · faturou ${brl0(s.bruto)}` : s.ativo ? `Bolso ${brl(s.bolso)}` : 'Sem trabalho'}`;
      tip.hidden = false;
      const cx = (padL + i * slot + slot / 2) * (rc.width / W), half = tip.offsetWidth / 2;
      tip.style.left = Math.max(half, Math.min(rc.width - half, cx)) + 'px';
      tip.style.top = '-6px';
    };
    svg.addEventListener('pointermove', mostrar);
    svg.addEventListener('pointerdown', mostrar);
    svg.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') { tip.hidden = true; box.classList.remove('has-sel'); svg.querySelectorAll('.sel').forEach((e) => e.classList.remove('sel')); } });
  }

  // ---------- exemplo ----------
  function gerarExemplo() {
    let seed = 20261106;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const hj = hoje(), ref = refMes(hj);
    let ref6 = ref; for (let i = 0; i < 6; i++) ref6 = mesAnt(ref6);
    const A = { id: 'ex-a', nome: 'Marcos', dono: true, diasMes: '24', meta: '3.000' };
    const B = { id: 'ex-b', nome: 'Lucas', dono: false, diasMes: '20', meta: '2.000' };
    const config = mesclar(cfgPadrao(), {
      motoristas: [A, B], acordo: { tipo: 'nada', valor: '', desgaste: false },
      veiculo: { marca: 'Exemplo', modelo: 'Hatch 1.0', anoFab: '2021', anoModelo: '2022', combustivel: 'flex' },
      situacao: 'financiado', fipe: { historico: [{ ref: ref6, valor: 72400 }, { ref, valor: 68900 }] },
      fin: { parcela: '1.380,00', restantes: '28', taxaMensalPct: '1,79', valorFinanciado: '', totalParcelas: '' },
      comb: { preco: '6,09', consumo: '11', usarReal: true, usarUltimoPreco: true }, manutencaoKm: '0,15',
      fixos: { seguroAnual: '3.200', ipvaAnual: '2.100', licenciamentoAnual: '160', celularMensal: '70', meiMensal: '81', outrosMensal: '' },
      est: { preco: false, consumo: false, manutencaoKm: false, deprecAnualPct: false },
    });
    const usos = {}, gastos = {}, pagamentos = {};
    let odo = 48210, tanque = 0, n = 0;
    const abastecer = (k, quem) => {
      const litros = Math.round(tanque / (10.4 + rnd() * 1.3) * 10) / 10;
      const id = 'exg' + (n++);
      gastos[id] = { id, data: k, tipo: 'combustivel', valor: Math.round(litros * (5.98 + rnd() * 0.22) * 100) / 100, litros, odo, cheio: true, pagoPor: quem };
      tanque = 0;
    };
    const trabalho = (k, quem, iniMin, durMin, nC, aberto) => {
      const corridas = []; let t = iniMin + 8, bruto = 0;
      for (let j = 0; j < nC; j++) {
        t += Math.floor((aberto ? 22 : durMin / nC) * (0.7 + rnd() * 0.5));
        const q = rnd(), p = q < 0.56 ? 'Uber' : q < 0.88 ? '99' : 'inDrive';
        const v = Math.round((8.5 + rnd() * 30) * 100) / 100;
        corridas.push({ id: 'exc' + (n++), h: hhmm(t % 1440), p, v, tipo: 'corrida' }); bruto += v;
      }
      if (!aberto && rnd() < 0.3) corridas.push({ id: 'exc' + (n++), h: hhmm((t + 4) % 1440), p: 'Uber', v: Math.round((2 + rnd() * 8) * 100) / 100, tipo: 'gorjeta' });
      const km = Math.round(bruto / (1.7 + rnd() * 0.55));
      const id = 'exu' + (n++);
      const u = { id, mot: quem, tipo: 'trabalho', data: k, ini: hhmm(iniMin), fim: '', odoIni: String(odo), odoFim: '', modo: 'corridas', corridas, resumo: {}, criado: n };
      if (!aberto) { u.fim = hhmm((iniMin + durMin) % 1440); u.odoFim = String(odo + km); odo += km; tanque += km; }
      usos[id] = u;
    };
    const particular = (k, quem, iniMin, km) => {
      const id = 'exu' + (n++);
      usos[id] = { id, mot: quem, tipo: 'particular', data: k, ini: hhmm(iniMin), fim: hhmm(iniMin + 40 + Math.floor(rnd() * 80)), odoIni: String(odo), odoFim: String(odo + km), corridas: [], resumo: {}, criado: n };
      odo += km; tanque += km;
    };
    for (let i = 34; i >= 0; i--) {
      const k = addDias(hj, -i), dow = new Date(k + 'T12:00:00').getDay(), isHj = i === 0;
      if (i === 34) { gastos['exg' + (n++)] = { id: 'exg' + n, data: k, tipo: 'combustivel', valor: 228.4, litros: 38, odo, cheio: true, pagoPor: A.id }; }
      if (dow !== 0) {
        if (isHj) trabalho(k, A.id, Math.max(30, agoraMin() - 170), 0, 7, true);
        else trabalho(k, A.id, 6 * 60 + 15 + Math.floor(rnd() * 60), 7 * 60 + Math.floor(rnd() * 90), 11 + Math.floor(rnd() * 6), false);
        if (!isHj && tanque > 330) abastecer(k, A.id);
      } else if (!isHj && rnd() < 0.75) particular(k, A.id, 10 * 60, 25 + Math.floor(rnd() * 35));
      if (isHj) continue;
      if (i === 4) odo += 18; // km que ninguém lançou
      if ((dow >= 1 && dow <= 5) || (dow === 6 && rnd() < 0.5)) {
        trabalho(k, B.id, 15 * 60 + Math.floor(rnd() * 40), 6 * 60 + Math.floor(rnd() * 70), 9 + Math.floor(rnd() * 5), false);
        if (tanque > 330) abastecer(k, B.id);
        if (rnd() < 0.25) particular(k, B.id, 22 * 60 + 30, 8 + Math.floor(rnd() * 12));
      }
      if (dow === 6) { const id = 'exg' + (n++); gastos[id] = { id, data: k, tipo: 'lavagem', valor: 35, pagoPor: A.id }; }
    }
    const k12 = addDias(hj, -12), k10 = addDias(hj, -10);
    gastos.exm = { id: 'exm', data: k12, tipo: 'manutencao', valor: 260, descr: 'Troca de óleo e filtro', pagoPor: A.id };
    pagamentos.exp = { id: 'exp', data: k10, de: B.id, para: A.id, valor: 150 };
    return { config, usos, gastos, pagamentos };
  }

  // ---------- versões anteriores e backup ----------
  function deV1(old, donoId) {
    const oc = old.cfg || {};
    const config = mesclar(cfgPadrao(), oc);
    const dono = { id: donoId || uid(), nome: 'Dono', dono: true, diasMes: oc.diasMes || '26', meta: oc.metaMensal || '' };
    delete config.diasMes; delete config.metaMensal; delete config.configurado;
    config.motoristas = [dono]; config.v = 3;
    const usos = {}, gastos = {};
    for (const m of Object.values(old.months || {})) {
      for (const [k, d] of Object.entries(m.days || {})) {
        const id = 'v1-' + k;
        usos[id] = { id, mot: dono.id, tipo: 'trabalho', data: k, ini: d.ini || '', fim: d.fim || '', odoIni: d.odoIni || '', odoFim: d.odoFim || '', kmManual: d.kmManual || '', horasManual: d.horasManual || '', modo: d.modo === 'resumo' ? 'resumo' : 'corridas', corridas: d.corridas || [], resumo: d.resumo || {}, corridasResumo: d.corridasResumo || '', criado: 0 };
      }
      for (const g of m.gastos || []) gastos[g.id] = { ...g, pagoPor: dono.id };
    }
    return { config, usos, gastos, pagamentos: {} };
  }
  function trazer(conv, comConfig) {
    S.demo = null; S.demoAuto = false;
    if (comConfig && conv.config) put('app', conv.config);
    for (const c of ['usos', 'gastos', 'pagamentos']) for (const o of Object.values(conv[c] || {})) put(c, o);
  }
  function exportar() {
    const T = D();
    const json = JSON.stringify({ app: 'km-liquido', versao: 3, exportadoEm: new Date().toISOString(), config: T.config, usos: T.usos, gastos: T.gastos, pagamentos: T.pagamentos });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = `km-liquido-backup-${hoje()}.json`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    toast('Backup baixado.');
  }
  async function restaurar() {
    let txt = ($('#imp-txt') || {}).value || '';
    const f = $('#imp-file') && $('#imp-file').files[0];
    try { if (f) txt = await f.text(); } catch (e) { /* usa o texto */ }
    let b = null;
    try { b = JSON.parse(txt.trim()); } catch (e) { b = null; }
    if (!b || b.app !== 'km-liquido') { toast('Esse arquivo não é um backup do Km Líquido.'); return; }
    const conv = b.versao === 3 ? normalizar(b) : deV1(b, (donoM() || {}).id);
    if (!mots().length) { trazer(conv, true); fecharSheet(); render(); toast('Backup restaurado.'); return; }
    // Já tem gente cadastrada: mantém os motoristas daqui e traz os dados do carro e os lançamentos
    const atual = mots(), dono = donoM();
    const doBk = (conv.config && conv.config.motoristas) || [];
    const bkDono = doBk.find((m) => m.dono) || doBk[0];
    const mapa = {};
    if (bkDono && dono) mapa[bkDono.id] = dono.id;
    const outrosBk = doBk.filter((m) => m !== bkDono), outrosAqui = atual.filter((m) => !dono || m.id !== dono.id);
    outrosBk.forEach((m, i) => { if (outrosAqui[i]) mapa[m.id] = outrosAqui[i].id; });
    const p = {};
    for (const k of CAMPOS_CARRO) if (conv.config && conv.config[k] !== undefined) p[k] = clone(conv.config[k]);
    if (bkDono && dono) p.motoristas = atual.map((m) => (m.id === dono.id ? { ...m, diasMes: bkDono.diasMes || m.diasMes, meta: bkDono.meta || m.meta } : m));
    S.demo = null;
    if (Object.keys(p).length && !patchCfg(p)) return;
    const troca = (id) => mapa[id] || id;
    for (const u of Object.values(conv.usos || {})) put('usos', { ...u, mot: troca(u.mot) });
    for (const g of Object.values(conv.gastos || {})) put('gastos', { ...g, pagoPor: troca(g.pagoPor) });
    for (const x of Object.values(conv.pagamentos || {})) put('pagamentos', { ...x, de: troca(x.de), para: troca(x.para) });
    fecharSheet(); render(); toast('Dados do carro trazidos.');
  }
  const CAMPOS_CARRO = ['veiculo', 'situacao', 'fipe', 'deprecAnualPct', 'fin', 'aluguel', 'comb', 'manutencaoKm', 'fixos', 'plataformas', 'est'];

  // ---------- ações ----------
  function irTab(t) { S.tab = TABS.includes(t) ? t : 'hoje'; try { if (location.hash !== '#' + S.tab) location.hash = S.tab; } catch (e) { /* sem hash */ } render(); window.scrollTo(0, 0); }
  function novoUso(m, k, tipo, extra) {
    const u = { id: uid(), mot: m, tipo, data: k, ini: '', fim: '', odoIni: '', odoFim: '', modo: 'corridas', corridas: [], resumo: {}, criado: Date.now(), ...(extra || {}) };
    return put('usos', u) ? u : null;
  }
  function usoSelecionado() {
    const vid = verId(), us = usosDoDia(vid, S.dia);
    return us.find((u) => u.id === S.usoSel) || us.find((u) => u.ini && !u.fim) || us[us.length - 1] || null;
  }
  function garantirTrabalho() {
    const sel = usoSelecionado();
    if (sel && sel.tipo !== 'particular') return sel;
    const u = novoUso(verId(), S.dia, 'trabalho');
    if (u) S.usoSel = u.id;
    return u;
  }
  function comecar(tipo) {
    const vid = verId();
    const outro = abertos().find((u) => u.mot !== vid);
    const go = () => {
      if (outro) patchUso(outro.id, { fim: agoraHHMM() });
      const lo = ultimoOdo();
      const extra = { ini: agoraHHMM() };
      if (lo) { extra.odoIni = String(lo.odo); extra.odoAuto = true; }
      if (outro) extra.encerra = outro.id;
      const u = novoUso(vid, hoje(), tipo, extra);
      if (!u) return;
      S.usoSel = u.id; S.dia = hoje(); render();
      const el = $('#u-odoIni'); if (el) { el.focus(); el.select(); }
    };
    if (outro) confirmar(`${esc(nomeMot(outro.mot))} ainda está com o carro`, `O uso de ${esc(nomeMot(outro.mot))} começou às ${esc(outro.ini)} e não foi encerrado. Ao começar, ele será encerrado agora, e o odômetro que você anotar vira o final dele.`, 'Começar mesmo assim', go, false);
    else go();
  }
  function addCorrida() {
    const inp = $('#c-valor'); const v = P(inp.value);
    if (!(v > 0)) { toast('Digite o valor da corrida.'); inp.focus(); return; }
    const km = P(($('#c-km') || {}).value, 'dec');
    const u = garantirTrabalho(); if (!u) return;
    const isH = S.dia === hoje();
    const ult = (u.corridas || []).map((c) => c.h).filter(Boolean).sort().pop();
    const item = { id: uid(), h: isH ? agoraHHMM() : ult || u.ini || '12:00', p: S.plat, v: Calc.r2(v), tipo: S.tipoC };
    if (km > 0) item.km = km;
    patchUso(u.id, { corridas: [...(u.corridas || []), item] });
    delete S.draft['c-valor']; delete S.draft['c-km'];
    const tipo = S.tipoC; S.tipoC = 'corrida';
    render();
    toast(`${nomeCorrida(tipo)} de ${brl(v)} na ${S.plat} lançada.`);
  }
  function addGasto() {
    const data = $('#g-data').value || hoje();
    const valor = P($('#g-valor').value);
    if (!(valor > 0)) { toast('Digite o valor pago.'); $('#g-valor').focus(); return; }
    const pagou = mot(S.gPagou) ? S.gPagou : verId();
    const g = { id: uid(), data, tipo: S.gTipo, valor: Calc.r2(valor), pagoPor: pagou };
    if (S.gTipo === 'combustivel') {
      const l = P($('#g-litros').value, 'dec'), o = P($('#g-odo').value);
      if (l > 0) g.litros = l;
      if (o > 0) g.odo = o;
      g.cheio = $('#g-cheio').checked;
    }
    const ds = $('#g-desc'); if (ds && ds.value.trim()) g.descr = ds.value.trim().slice(0, 80);
    if (!put('gastos', g)) return;
    for (const id of ['g-data', 'g-valor', 'g-litros', 'g-odo', 'g-desc', 'g-cheio']) delete S.draft[id];
    S.gastoMes = refMes(data);
    render();
    toast(S.gTipo === 'combustivel' && !(g.litros > 0) ? 'Gasto salvo. Com os litros, o app calcula o preço e o consumo.' : `${nomeGasto(g.tipo)} de ${brl(valor)} salvo${varios() ? ' no nome de ' + nomeMot(pagou) : ''}.`);
  }
  function addFipe() {
    let ref = $('#fipe-ref').value.trim();
    const mm = ref.match(/^(\d{1,2})\/(\d{4})$/); if (mm) ref = mm[2] + '-' + pad(+mm[1]);
    const valor = P($('#fipe-val').value);
    if (!/^\d{4}-\d{2}$/.test(ref)) { toast('Informe o mês de referência (ex.: 2026-11).'); return; }
    if (!(valor > 1000)) { toast('Digite o valor FIPE do carro.'); $('#fipe-val').focus(); return; }
    const hist = (cfg().fipe.historico || []).filter((h) => h.ref !== ref).concat([{ ref, valor: Math.round(valor) }]);
    if (!patchCfg({ fipe: { historico: hist } })) return;
    delete S.draft['fipe-val']; delete S.draft['fipe-ref'];
    render(); toast(`FIPE de ${nomeMes(ref)} registrada.`);
  }
  function abrirPagamento() {
    const p = S.pg;
    const chips = (campoN, sel) => mots().map((m) => `<button class="chip sm" data-sact="${campoN}" data-id="${m.id}" aria-pressed="${m.id === sel}" type="button">${esc(m.nome)}</button>`).join('');
    abrirSheet(`<h2 class="sec-title">Registrar pagamento</h2><div class="field"><span>Quem pagou</span><div class="chips">${chips('pDe', p.de)}</div></div><div class="field"><span>Para quem</span><div class="chips">${chips('pPara', p.para)}</div></div>
      <label class="field" for="pg-val"><span>Valor</span><div class="prefix"><b>R$</b><input class="input big" id="pg-val" inputmode="decimal" value="${esc(p.valor)}" autocomplete="off"></div></label>
      <div class="row"><button class="btn primary" data-sact="pSalvar" type="button">Salvar pagamento</button><button class="btn" data-sact="fechar" type="button">Cancelar</button></div>`);
  }

  const acoes = {
    tab: (b) => irTab(b.dataset.tab),
    dia: (b) => { const k = addDias(S.dia, +b.dataset.n); if (k > hoje()) return; S.dia = k; S.usoSel = null; render(); },
    irHoje: () => { S.dia = hoje(); S.usoSel = null; render(); },
    ver: (b) => { S.ver = b.dataset.id; S.usoSel = null; render(); },
    souEu: (b) => {
      const id = b.dataset.id, meu = S.user && S.user.uid;
      if (!meu) return;
      const aplicar = () => {
        const ms = mots().map((m) => { const o = { ...m }; if (o.uid === meu) delete o.uid; if (o.id === id) o.uid = meu; return o; });
        lsSet(LOBS, id === 'obs' ? S.carroId : null);
        patchCfg({ motoristas: ms }); S.ver = null; render();
        toast(id === 'obs' ? 'Certo, você está só acompanhando.' : `Pronto, ${nomeMot(id)}. Seus lançamentos vão no seu nome.`);
      };
      const m = mot(id);
      if (m && m.uid && m.uid !== meu) confirmar(`${esc(m.nome)} já está ligado a outra conta`, `Se você for ${esc(m.nome)}, a ligação passa para esta conta.`, `Sou ${esc(m.nome)}`, aplicar, false);
      else aplicar();
    },
    trocarEu: () => {
      const meu = S.user && S.user.uid;
      lsSet(LOBS, null);
      patchCfg({ motoristas: mots().map((m) => { const o = { ...m }; if (o.uid === meu) delete o.uid; return o; }) });
      irTab('hoje');
    },
    comecar: (b) => comecar(b.dataset.t),
    novoUso: (b) => { const u = novoUso(verId(), S.dia, b.dataset.t); if (u) { S.usoSel = u.id; render(); } },
    selUso: (b) => { S.usoSel = b.dataset.id; render(); },
    tipoUso: (b) => {
      const u = usoSelecionado(); if (!u || u.tipo === b.dataset.t) return;
      const novo = b.dataset.t, nome = novo === 'particular' ? 'uso particular' : 'trabalho';
      if (!u.fim) { patchUso(u.id, { tipo: novo }); render(); return; }
      abrirSheet(`<h2 class="sec-title">Quer começar um ${nome}?</h2><p class="note">Este uso${u.ini ? ` (das ${esc(u.ini)} às ${esc(u.fim)})` : ''} já foi encerrado. Escolha o que você quer fazer:</p><div class="stack"><button class="btn primary big" data-sact="tipoNovo" data-t="${novo}" type="button">Começar ${nome} agora</button><button class="btn" data-sact="tipoMudar" data-t="${novo}" data-id="${u.id}" type="button">Corrigir: este uso foi ${nome}</button><button class="btn ghost" data-sact="fechar" type="button">Cancelar</button></div>`);
    },
    agoraHora: (b) => {
      const u = D().usos[b.dataset.uid]; if (!u) return;
      const f = b.dataset.f, agora = agoraHHMM();
      if (!patchUso(u.id, { [f]: agora })) return;
      render(); toast(f === 'fim' ? `Uso encerrado às ${agora}.` : `Início marcado às ${agora}.`);
      if (f === 'fim') { const el = $('#u-odoFim'); if (el && !el.value) el.focus(); }
    },
    encerrar: () => {
      const u = usoSelecionado(); if (!u) return;
      patchUso(u.id, { fim: agoraHHMM() }); render();
      const el = $('#u-odoFim'); if (el && !el.value) el.focus();
    },
    delUso: (b) => {
      const u = D().usos[b.dataset.id]; if (!u) return;
      const g = Calc.ganhosUso(u);
      confirmar('Apagar este uso do carro?', `${u.tipo === 'particular' ? 'Uso particular' : 'Trabalho'} de ${esc(nomeMot(u.mot))} em ${dm(u.data)}${g.bruto > 0 ? `, com ${brl(g.bruto)} em corridas` : ''}. Isso não pode ser desfeito.`, 'Apagar', () => { remover('usos', u.id); S.usoSel = null; render(); toast('Uso apagado.'); });
    },
    modo: (b) => { const u = garantirTrabalho(); if (!u) return; patchUso(u.id, { modo: b.dataset.m }); render(); },
    plat: (b) => { S.plat = b.dataset.p; render(); },
    tipoc: (b) => { S.tipoC = b.dataset.t; render(); },
    delCorrida: (b) => {
      const u = usoSelecionado(); if (!u) return;
      const cs = (u.corridas || []).slice(), pos = cs.findIndex((c) => c.id === b.dataset.id);
      if (pos < 0) return;
      const removida = cs.splice(pos, 1)[0];
      patchUso(u.id, { corridas: cs }); render();
      toast(`Lançamento de ${brl(removida.v)} apagado.`, { label: 'Desfazer', fn: () => { const atual = (D().usos[u.id] || {}).corridas || []; const novo = atual.slice(); novo.splice(pos, 0, removida); patchUso(u.id, { corridas: novo }); render(); } });
    },
    gastoDoDia: () => { S.draft['g-data'] = S.dia; S.gPagou = verId(); irTab('gastos'); },
    gtipo: (b) => { S.gTipo = b.dataset.t; render(); },
    gpagou: (b) => { S.gPagou = b.dataset.id; render(); },
    gmes: (b) => { const r = S.gastoMes || refMes(hoje()); S.gastoMes = +b.dataset.n < 0 ? mesAnt(r) : mesSeg(r); render(); },
    hmes: (b) => { const r = S.histMes || refMes(hoje()); S.histMes = +b.dataset.n < 0 ? mesAnt(r) : mesSeg(r); render(); },
    abrirUso: (b) => { const u = D().usos[b.dataset.id]; if (!u) return; S.ver = u.mot; S.dia = u.data; S.usoSel = u.id; irTab('hoje'); },
    delGasto: (b) => {
      const g = D().gastos[b.dataset.id]; if (!g) return;
      if (!remover('gastos', g.id)) return;
      render();
      toast(`Gasto de ${brl(g.valor)} apagado.`, { label: 'Desfazer', fn: () => { put('gastos', g); render(); } });
    },
    periodo: (b) => { S.periodo = b.dataset.p; render(); },
    pagar: (b) => { S.pg = { de: b.dataset.de, para: b.dataset.para, valor: nf(+b.dataset.v, 2) }; abrirPagamento(); },
    delPag: (b) => {
      const p = D().pagamentos[b.dataset.id]; if (!p) return;
      confirmar('Apagar este pagamento?', `${esc(nomeMot(p.de))} → ${esc(nomeMot(p.para))}, ${brl(p.valor)} em ${dm(p.data)}.`, 'Apagar', () => { remover('pagamentos', p.id); render(); });
    },
    lacuna: (b) => {
      S.lac = { a: +b.dataset.a, b: +b.dataset.b, k: b.dataset.k };
      abrirSheet(`<h2 class="sec-title">De quem foram esses ${nf(S.lac.b - S.lac.a)} km?</h2><p class="note">Do odômetro ${nf(S.lac.a)} até ${nf(S.lac.b)}. O app lança como uso particular de quem você escolher.</p><div class="chips">${mots().map((m) => `<button class="chip" data-sact="lacMot" data-id="${m.id}" type="button">${esc(m.nome)}</button>`).join('')}</div><div><button class="btn" data-sact="fechar" type="button">Cancelar</button></div>`);
    },
    sit: (b) => { patchCfg({ situacao: b.dataset.v }); render(); },
    delFipe: (b) => { patchCfg({ fipe: { historico: cfg().fipe.historico.filter((h) => h.ref !== b.dataset.ref) } }); render(); },
    delPlat: (b) => {
      if (cfg().plataformas.length <= 1) { toast('Deixe ao menos uma plataforma.'); return; }
      patchCfg({ plataformas: cfg().plataformas.filter((p) => p !== b.dataset.p) }); render();
    },
    tornarDono: (b) => { patchCfg({ motoristas: mots().map((m) => ({ ...m, dono: m.id === b.dataset.id })) }); render(); },
    delMot: (b) => { const m = mot(b.dataset.id); if (!m) return; confirmar(`Remover ${esc(m.nome)}?`, 'Só dá para remover quem ainda não tem lançamentos.', 'Remover', () => { patchCfg({ motoristas: mots().filter((x) => x.id !== m.id) }); render(); }); },
    exportar: () => exportar(),
    restaurar: () => abrirSheet('<h2 class="sec-title">Restaurar backup</h2><p class="note">Escolha o arquivo de backup ou cole o texto copiado. Os lançamentos do backup são somados aos daqui; os que já existem são substituídos.</p><input type="file" id="imp-file" accept=".json,application/json"><textarea id="imp-txt" placeholder="…ou cole o backup aqui"></textarea><div class="row"><button class="btn primary" data-sact="restaurar" type="button">Restaurar</button><button class="btn" data-sact="fechar" type="button">Cancelar</button></div>'),
    authModo: (b) => { S.authModo = b.dataset.m; render(); },
    esqueci: async () => {
      const email = (($('#au-email') || {}).value || '').trim();
      if (!email) { toast('Digite o seu e-mail no campo acima e toque de novo em Esqueci minha senha.'); return; }
      try { await FB.recuperar(email); toast(`Enviamos um link para ${email}. Confira também a caixa de spam.`); } catch (e) { toast(erroAuth(e)); }
    },
    sair: () => confirmar('Sair da conta?', 'Os dados continuam salvos. Para voltar, entre com o mesmo e-mail e senha.', 'Sair', async () => {
      Fire.parar(); S.carroId = null; S.carro = null; S.data = vazio(); S.ver = null;
      try { await FB.sair(); } catch (e) { toast('Não foi possível sair agora.'); }
    }, false),
    scModo: (b) => { S.scModo = b.dataset.m; render(); },
    copiarConvite: async () => {
      const t = msgConvite();
      try { await navigator.clipboard.writeText(t); toast('Convite copiado. Cole no WhatsApp ou numa mensagem.'); }
      catch (e) { abrirSheet(`<h2 class="sec-title">Convite</h2><textarea id="bk-txt" readonly>${esc(t)}</textarea><div class="row"><button class="btn primary" data-sact="copiar" type="button">Copiar</button><button class="btn" data-sact="fechar" type="button">Fechar</button></div>`); }
    },
    novoCodigo: () => confirmar('Gerar outro código?', 'O código atual deixa de funcionar. Quem já entrou no carro continua com acesso.', 'Gerar código', async () => {
      const velho = S.carro.codigo, novo = gerarCodigo();
      try {
        await FB.criarConvite(novo, S.carroId);
        await FB.updCarro(S.carroId, [[['codigo'], novo]]);
        if (velho) FB.apagarConvite(velho).catch(() => {});
        toast(`Código novo: ${fmtCod(novo)}`);
      } catch (e) { toast('Não foi possível gerar agora. Confira a internet.'); }
    }, false),
    instalar: async () => { const p = S.instalar; if (!p) return; S.instalar = null; p.prompt(); try { await p.userChoice; } catch (e) { /* cancelou */ } render(); },
    entrarDemo: () => { S.demo = gerarExemplo(); S.dia = hoje(); S.ver = null; S.usoSel = null; irTab('hoje'); },
    sairDemo: () => {
      S.demo = null; S.dia = hoje(); S.ver = null; S.usoSel = null; irTab('hoje');
      toast(S.fase === 'app' ? 'Pronto, de volta aos seus dados.' : S.fase === 'login' ? 'Entre ou crie sua conta para começar.' : 'Cadastre o carro para começar.');
    },
    apagar: () => confirmar('Apagar todos os dados?', 'Usos do carro, corridas, gastos, pagamentos e ajustes serão apagados para todos que usam o carro. Isso não pode ser desfeito. Se quiser, baixe um backup antes.', 'Apagar tudo', async () => {
      if (S.demo) { S.demo = null; render(); return; }
      if (!souCriador()) return;
      toast('Apagando…');
      try { const id = S.carroId, cod = S.carro && S.carro.codigo; Fire.parar(); await FB.apagarCarro(id, cod); Fire.sairDoCarro('Dados apagados.'); }
      catch (e) { toast('Não foi possível apagar tudo agora. Confira a internet e tente de novo.'); Fire.ouvir(S.carroId); }
    }),
  };

  // ---------- eventos ----------
  view.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const f = acoes[b.dataset.act]; if (f) f(b, e); });
  view.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = e.target.id;
    if (id === 'fCorrida') addCorrida();
    else if (id === 'fGasto') addGasto();
    else if (id === 'fFipe') addFipe();
    else if (id === 'fPlat') {
      const v = $('#p-novo').value.trim().slice(0, 24); if (!v) return;
      if (cfg().plataformas.some((p) => p.toLowerCase() === v.toLowerCase())) { toast('Essa plataforma já está na lista.'); return; }
      patchCfg({ plataformas: [...cfg().plataformas, v] }); delete S.draft['p-novo']; render();
    } else if (id === 'fMot') {
      const v = $('#m-novo').value.trim().slice(0, 30); if (!v) return;
      patchCfg({ motoristas: [...mots(), { id: uid(), nome: v, dono: !mots().length, diasMes: '26', meta: '' }] }); delete S.draft['m-novo']; render();
    } else if (id === 'fSetup') {
      const a = $('#s-dono').value.trim().slice(0, 30), b = $('#s-outro').value.trim().slice(0, 30);
      if (!a) { toast('Digite o nome do dono do carro.'); $('#s-dono').focus(); return; }
      const ms = [{ id: uid(), nome: a, dono: true, diasMes: '26', meta: '' }];
      if (b) ms.push({ id: uid(), nome: b, dono: false, diasMes: '26', meta: '' });
      if (S.fase === 'app') { if (patchCfg({ motoristas: ms })) render(); return; }
      criarCarro(ms);
    } else if (id === 'fAuth') autenticar();
    else if (id === 'fCodigo') entrarComCodigo($('#cv-cod').value);
  });
  const guardaRascunho = (t) => { if (t.classList && t.classList.contains('dr')) S.draft[t.id] = t.type === 'checkbox' ? t.checked : t.value; };
  view.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.hora) {
      const d = t.value.replace(/\D/g, '').slice(0, 4);
      t.value = d.length > 2 ? d.slice(0, 2) + ':' + d.slice(2) : d;
    }
    guardaRascunho(t);
  });
  view.addEventListener('change', (e) => {
    const t = e.target;
    guardaRascunho(t);
    if (t.dataset.u) {
      const f = t.dataset.u, id = t.dataset.uid || (garantirTrabalho() || {}).id;
      const u = D().usos[id]; if (!u) return;
      let v = t.value.trim();
      if (t.dataset.hora) {
        const h = lerHora(v);
        if (h === null) { toast('Hora inválida. Digite assim: 17:10'); t.value = u[f] || ''; return; }
        v = h; t.value = h;
      }
      const p = { [f]: v };
      if (f === 'odoIni') {
        p.odoAuto = false;
        const enc = u.encerra && D().usos[u.encerra];
        if (enc && !P(enc.odoFim) && P(v) > P(enc.odoIni)) patchUso(enc.id, { odoFim: v });
      }
      let fechou = false;
      if (f === 'odoFim' && v && u.ini && !u.fim && u.data >= addDias(hoje(), -1)) { p.fim = agoraHHMM(); fechou = true; }
      patchUso(id, p);
      refreshHoje();
      if (f === 'ini' || f === 'fim' || fechou) { renderSuave(); if (fechou) toast(`Uso encerrado às ${p.fim}.`); }
      return;
    }
    if (t.dataset.r) { const u = garantirTrabalho(); if (!u) return; patchUso(u.id, { resumo: { [t.dataset.r]: t.value.trim() } }); refreshHoje(); return; }
    if (t.dataset.m) {
      const f = t.dataset.m, id = t.dataset.mid;
      patchCfg({ motoristas: mots().map((m) => (m.id === id ? { ...m, [f]: f === 'nome' ? (t.value.trim().slice(0, 30) || m.nome) : t.value.trim() } : m)) });
      if (f === 'nome') render(); else refreshAjustes();
      return;
    }
    if (t.dataset.c) {
      const path = t.dataset.c, p = pathObj(path, t.value.trim());
      if (EST[path]) p.est = { [EST[path]]: false };
      patchCfg(p);
      if (path === 'acordo.tipo') render(); else refreshAjustes();
      return;
    }
    if (t.dataset.cb) { patchCfg(pathObj(t.dataset.cb, t.checked)); refreshAjustes(); }
  });
  view.addEventListener('toggle', (e) => { if (e.target.id === 'contaDia') S.contaAberta = e.target.open; }, true);

  sheetBox.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-sact]'); if (!b) return;
    const a = b.dataset.sact;
    if (a === 'fora') { if (e.target === b) fecharSheet(); return; }
    if (a === 'fechar') fecharSheet();
    else if (a === 'ok') { const f = confirmFn; fecharSheet(); if (f) f(); }
    else if (a === 'restaurar') restaurar();
    else if (a === 'copiar') {
      const ta = $('#bk-txt');
      try { await navigator.clipboard.writeText(ta.value); toast('Backup copiado.'); } catch (err) { ta.focus(); ta.select(); toast('Selecionei o texto. Use Copiar do seu celular.'); }
    } else if (a === 'pDe' || a === 'pPara') {
      S.pg.valor = ($('#pg-val') || {}).value || S.pg.valor;
      S.pg[a === 'pDe' ? 'de' : 'para'] = b.dataset.id; abrirPagamento();
    } else if (a === 'pSalvar') {
      const v = P(($('#pg-val') || {}).value);
      const p = S.pg;
      if (!(v > 0)) { toast('Digite o valor pago.'); return; }
      if (!p.de || !p.para || p.de === p.para) { toast('Escolha quem pagou e quem recebeu.'); return; }
      const ok2 = put('pagamentos', { id: uid(), data: hoje(), de: p.de, para: p.para, valor: Calc.r2(v) });
      fecharSheet(); render(); if (ok2) toast(`Pagamento de ${brl(v)} registrado.`);
    } else if (a === 'tipoNovo') {
      const t = b.dataset.t; fecharSheet();
      if (S.dia === hoje()) comecar(t);
      else { const u = novoUso(verId(), S.dia, t); if (u) { S.usoSel = u.id; render(); } }
    } else if (a === 'tipoMudar') {
      patchUso(b.dataset.id, { tipo: b.dataset.t }); fecharSheet(); render();
    } else if (a === 'lacMot') {
      const L = S.lac; fecharSheet();
      if (!L) return;
      novoUso(b.dataset.id, L.k, 'particular', { odoIni: String(L.a), odoFim: String(L.b), nota: 'km sem dono' });
      render(); toast(`${nf(L.b - L.a)} km lançados como uso particular de ${nomeMot(b.dataset.id)}.`);
    }
  });

  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => irTab(b.dataset.tab)));
  window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (TABS.includes(t) && t !== S.tab) { S.tab = t; render(); } });
  let tRes; window.addEventListener('resize', () => { clearTimeout(tRes); tRes = setTimeout(() => { if (S.tab === 'resultados') desenharGrafico(); }, 150); });

  function refreshHoje() {
    if (S.tab !== 'hoje') return;
    const el = $('#resHoje'); if (el) el.innerHTML = blocoResultado(S.dia, verId());
    const ui = $('#usoInfo'), u = usoSelecionado(); if (ui && u) ui.innerHTML = usoInfo(u);
  }
  function renderSuave() {
    const a = document.activeElement;
    if ((a && view.contains(a) && a.matches('input, select, textarea')) || !sheetBox.hidden) { pendSuave = true; return; }
    render();
  }
  view.addEventListener('focusout', (e) => {
    if (!pendSuave) return;
    if (e.relatedTarget && view.contains(e.relatedTarget) && e.relatedTarget.matches('input, select, textarea')) return;
    pendSuave = false; setTimeout(render, 0);
  });
  function render() {
    const telas = { hoje: vHoje, gastos: vGastos, resultados: vResultados, historico: vHistorico, ajustes: vAjustes };
    const noApp = !!S.demo || S.fase === 'app';
    document.body.classList.toggle('sem-nav', !noApp);
    let html;
    if (S.demo) html = '<div class="banner"><span><b>Modo exemplo.</b> Dados inventados de dois motoristas, para você ver o app funcionando. Nada aqui é salvo.</span><button class="btn sm dark" data-act="sairDemo" type="button">Usar com meus dados</button></div>' + (telas[S.tab] || vHoje)();
    else if (S.fase === 'config') html = vConfig();
    else if (S.fase === 'inicio') html = '<div class="empty" style="padding-top:48px">Carregando…</div>';
    else if (S.fase === 'login') html = vLogin();
    else if (S.fase === 'semCarro') html = vSemCarro();
    else html = (telas[S.tab] || vHoje)();
    view.innerHTML = html;
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === S.tab ? 'page' : 'false'));
    syncChip();
    if (noApp && S.tab === 'resultados') desenharGrafico();
  }
  setInterval(() => { if (S.tab === 'hoje' && S.dia === hoje() && abertos().length) refreshHoje(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.tab === 'hoje') refreshHoje(); });

  // ---------- início ----------
  window.addEventListener('online', syncChip);
  window.addEventListener('offline', syncChip);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.instalar = e; if (S.tab === 'ajustes' && S.fase === 'app') render(); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  const h0 = location.hash.slice(1); if (TABS.includes(h0)) S.tab = h0;
  if (!FB.configurado) { S.fase = 'config'; render(); }
  else {
    render();
    FB.onAuth(async (u) => {
      S.user = u;
      if (!u) { Fire.parar(); S.carroId = null; S.carro = null; S.data = vazio(); S.authModo = 'entrar'; S.fase = 'login'; render(); return; }
      S.fase = 'inicio'; render();
      let carros = [];
      try { carros = await FB.meusCarros(u.uid); } catch (e) { carros = []; }
      const salvo = lsGet(LCARRO);
      const escolhido = carros.find((c) => c.id === salvo) || carros[0];
      if (escolhido) Fire.ouvir(escolhido.id);
      else if (salvo && !navigator.onLine) Fire.ouvir(salvo);
      else { S.fase = 'semCarro'; render(); }
    });
  }
  window.__km = { S }; // usado nos testes
})();
