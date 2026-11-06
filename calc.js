// ===== Km Líquido v3 — motor de cálculo (um carro, vários motoristas; funções puras, sem DOM) =====
const Calc = (() => {
  const CALIBRA = ['combustivel', 'manutencao']; // calibram o custo por km; não são descontados de novo
  const r2 = (x) => Math.round(x * 100) / 100;

  // Lê número digitado em pt-BR. mode 'dec': ponto é decimal quando não há vírgula (preço, consumo).
  function parseNum(v, mode) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = String(v).trim().replace(/\s|R\$/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (mode !== 'dec' && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function minutos(hhmm) {
    if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  function mesesEntre(refA, refB) { // 'YYYY-MM'
    const [ya, ma] = refA.split('-').map(Number);
    const [yb, mb] = refB.split('-').map(Number);
    return (yb - ya) * 12 + (mb - ma);
  }

  // Taxa mensal implícita de um financiamento Price (bisseção)
  function taxaImplicita(pv, pmt, n) {
    if (!(pv > 0 && pmt > 0 && n > 0)) return null;
    if (pmt * n <= pv) return 0;
    const f = (i) => pmt * (1 - Math.pow(1 + i, -n)) / i - pv;
    let lo = 1e-7, hi = 1;
    if (f(hi) > 0) return null;
    for (let k = 0; k < 200; k++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  // Consumo real a partir de abastecimentos com tanque cheio e odômetro
  function consumoReal(gastos) {
    const ab = gastos
      .filter((g) => g.tipo === 'combustivel' && g.litros > 0 && g.odo > 0)
      .sort((a, b) => a.odo - b.odo || (a.data < b.data ? -1 : 1));
    let km = 0, litros = 0, ini = null, acum = 0, trechos = 0;
    for (const g of ab) {
      if (ini === null) { if (g.cheio) ini = g.odo; continue; }
      acum += g.litros;
      if (g.cheio) {
        const d = g.odo - ini;
        if (d > 0 && acum > 0) { km += d; litros += acum; trechos++; }
        ini = g.odo; acum = 0;
      }
    }
    return trechos > 0 && litros > 0 ? { kmPorLitro: km / litros, km, litros, trechos } : null;
  }

  function ultimoPreco(gastos) {
    const ab = gastos.filter((g) => g.tipo === 'combustivel' && g.litros > 0 && g.valor > 0)
      .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : (a.odo || 0) - (b.odo || 0)));
    const g = ab[ab.length - 1];
    return g ? { preco: g.valor / g.litros, data: g.data } : null;
  }

  function fixosMensal(cfg) {
    const f = cfg.fixos || {};
    const a = (x) => parseNum(x) || 0;
    return (a(f.seguroAnual) + a(f.ipvaAnual) + a(f.licenciamentoAnual)) / 12 +
      a(f.celularMensal) + a(f.meiMensal) + a(f.outrosMensal);
  }

  function depreciacaoMensal(cfg) {
    const hist = ((cfg.fipe && cfg.fipe.historico) || []).filter((h) => h.valor > 0 && /^\d{4}-\d{2}$/.test(h.ref))
      .sort((a, b) => (a.ref < b.ref ? -1 : 1));
    const atual = hist.length ? hist[hist.length - 1].valor : 0;
    if (hist.length >= 2) {
      const m = mesesEntre(hist[0].ref, hist[hist.length - 1].ref);
      if (m >= 1) {
        const perda = (hist[0].valor - hist[hist.length - 1].valor) / m;
        return { valor: Math.max(0, perda), fonte: 'fipe', meses: m, valorizou: perda < 0, atual };
      }
    }
    const pct = parseNum(cfg.deprecAnualPct, 'dec');
    return { valor: atual * ((pct == null ? 10 : pct) / 100) / 12, fonte: 'estimativa', atual };
  }

  function jurosMensal(fin) {
    const pmt = parseNum(fin.parcela), r = parseNum(fin.restantes);
    if (!(pmt > 0) || !(r > 0)) return { valor: 0, ok: false, motivo: 'parcela' };
    let i = parseNum(fin.taxaMensalPct, 'dec');
    let fonte = 'informada';
    if (i != null) i = i / 100;
    else {
      i = taxaImplicita(parseNum(fin.valorFinanciado), pmt, parseNum(fin.totalParcelas));
      fonte = 'calculada';
    }
    if (i == null) return { valor: 0, ok: false, motivo: 'taxa' };
    const saldo = i === 0 ? pmt * r : pmt * (1 - Math.pow(1 + i, -r)) / i;
    return { valor: saldo * i, ok: true, taxa: i, saldo, fonte };
  }

  // Custos do carro por mês: "bolso" = o que sai do bolso; "real" = desvalorização + juros
  function capitalMensal(cfg) {
    const sit = cfg.situacao || 'financiado';
    const dep = depreciacaoMensal(cfg);
    if (sit === 'alugado') {
      const al = cfg.aluguel || {};
      const v = parseNum(al.valor) || 0;
      const mensal = al.periodo === 'mes' ? v : v * 52 / 12;
      return { bolso: mensal, real: mensal, aluguel: mensal, dep: null, juros: null, parcela: 0 };
    }
    if (sit === 'proprio') return { bolso: 0, real: dep.valor, aluguel: 0, dep, juros: null, parcela: 0 };
    const fin = cfg.fin || {};
    const parcela = parseNum(fin.restantes) > 0 ? (parseNum(fin.parcela) || 0) : 0;
    const juros = parcela > 0 ? jurosMensal(fin) : { valor: 0, ok: true, quitado: true };
    return { bolso: parcela, real: dep.valor + juros.valor, aluguel: 0, dep, juros, parcela };
  }

  // Números do carro, calculados uma vez
  function contexto(cfg, gastos, kmTotalRegistrado) {
    const precoCfg = parseNum(cfg.comb && cfg.comb.preco, 'dec');
    const consumoCfg = parseNum(cfg.comb && cfg.comb.consumo, 'dec');
    const cr = consumoReal(gastos);
    const up = ultimoPreco(gastos);
    const usarReal = !(cfg.comb && cfg.comb.usarReal === false);
    const usarUlt = !(cfg.comb && cfg.comb.usarUltimoPreco === false);
    const consumo = usarReal && cr ? cr.kmPorLitro : consumoCfg;
    const preco = up && usarUlt ? up.preco : precoCfg;
    const combKm = consumo > 0 && preco > 0 ? preco / consumo : 0;
    const manutKm = parseNum(cfg.manutencaoKm, 'dec') || 0;
    const gastoManut = gastos.filter((g) => g.tipo === 'manutencao').reduce((s, g) => s + (g.valor || 0), 0);
    return {
      combKm, consumo, consumoFonte: usarReal && cr ? 'real' : 'informado', consumoReal: cr,
      preco, precoFonte: up && usarUlt ? 'abastecimento' : 'informado',
      manutKm, manutReal: kmTotalRegistrado > 0 ? { porKm: gastoManut / kmTotalRegistrado, gasto: gastoManut, km: kmTotalRegistrado } : null,
      fixosMes: fixosMensal(cfg), cap: capitalMensal(cfg),
    };
  }

  // ---------- um uso do carro (trabalho ou particular) ----------
  function kmUso(u) {
    const oi = parseNum(u.odoIni), of = parseNum(u.odoFim);
    if (oi != null && of != null && of > oi) return { km: of - oi, fonte: 'odometro' };
    const m = parseNum(u.kmManual, 'dec');
    if (m != null && m >= 0) return { km: m, fonte: 'manual' };
    return { km: null, fonte: null };
  }
  function horasUso(u, agoraMin) {
    const hm = parseNum(u.horasManual, 'dec');
    if (hm != null && hm >= 0) return { h: hm, fonte: 'manual' };
    const a = minutos(u.ini);
    let b = minutos(u.fim), fonte = 'turno';
    if (a != null && b == null && agoraMin != null) { b = agoraMin; fonte = 'andamento'; }
    if (a == null || b == null) return { h: null, fonte: null };
    let m = b - a; if (m < 0) m += 1440;
    return { h: m / 60, fonte };
  }
  function ganhosUso(u) {
    const porPlat = {};
    let bruto = 0, corridas = 0;
    if (!u || u.tipo === 'particular') return { bruto, corridas, porPlat };
    const add = (p, v, conta) => {
      if (!(v > 0)) return;
      porPlat[p] = porPlat[p] || { valor: 0, corridas: 0 };
      porPlat[p].valor += v; bruto += v;
      if (conta) { porPlat[p].corridas++; corridas++; }
    };
    if (u.modo === 'resumo') {
      const rs = u.resumo || {};
      for (const p of Object.keys(rs)) add(p, parseNum(rs[p]) || 0, false);
      const n = parseNum(u.corridasResumo);
      if (n > 0) corridas = n;
    } else for (const c of u.corridas || []) add(c.p, c.v, (c.tipo || 'corrida') === 'corrida');
    return { bruto, corridas, porPlat };
  }

  function datas(a, b) {
    const out = [];
    if (!a || !b || a > b) return out;
    const d = new Date(a + 'T12:00:00');
    const fim = new Date(b + 'T12:00:00');
    while (d <= fim) {
      out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  // Pagamento combinado pelo uso do carro (quem não é dono paga ao dono)
  function taxaUso(acordo, k, trabalhou, bruto, inicio) {
    const v = parseNum(acordo && acordo.valor, 'dec') || 0;
    if (!acordo || !(v > 0)) return 0;
    if (acordo.tipo === 'dia') return trabalhou ? v : 0;
    if (acordo.tipo === 'semana') return inicio && k >= inicio ? v / 7 : 0;
    if (acordo.tipo === 'pct') return bruto * v / 100;
    return 0;
  }

  function indexar(base) {
    const porData = {}, gPorData = {}, inicio = {};
    for (const u of base.usos) {
      (porData[u.data] = porData[u.data] || []).push(u);
      if (!inicio[u.mot] || u.data < inicio[u.mot]) inicio[u.mot] = u.data;
    }
    for (const g of base.gastos) (gPorData[g.data] = gPorData[g.data] || []).push(g);
    return { porData, gPorData, inicio };
  }

  // Números de um motorista em um dia
  function diaDe(usosDia, mot, agoraMin) {
    let bruto = 0, corridas = 0, kmT = 0, kmP = 0, horas = 0, semKm = false, semHoras = false, trabalhou = false;
    const porPlat = {};
    for (const u of usosDia) {
      if (u.mot !== mot) continue;
      const km = kmUso(u).km;
      if (u.tipo === 'particular') { kmP += km || 0; continue; }
      const g = ganhosUso(u);
      bruto += g.bruto; corridas += g.corridas;
      for (const p of Object.keys(g.porPlat)) {
        porPlat[p] = porPlat[p] || { valor: 0, corridas: 0 };
        porPlat[p].valor += g.porPlat[p].valor; porPlat[p].corridas += g.porPlat[p].corridas;
      }
      kmT += km || 0;
      const h = horasUso(u, agoraMin).h;
      if (h != null) horas += h;
      if (g.bruto > 0 || (km || 0) > 0) {
        trabalhou = true;
        if (km == null) semKm = true;
        if (h == null) semHoras = true;
      }
    }
    return { bruto, corridas, porPlat, kmT, kmP, horas, semKm, semHoras, trabalhou };
  }

  // Resultado de um motorista num período
  function resultado(ctx, cfg, base, mot, de, ate, opts) {
    opts = opts || {};
    const mots = cfg.motoristas || [];
    const dono = mots.find((m) => m.dono) || mots[0] || { id: mot };
    const isDono = dono.id === mot;
    const acordo = cfg.acordo || {};
    const reembolsa = !!acordo.desgaste;
    const diasMesDono = Math.max(1, parseNum(dono.diasMes) || 26);
    const fixosDia = ctx.fixosMes / diasMesDono, capBolsoDia = ctx.cap.bolso / diasMesDono, capRealDia = ctx.cap.real / diasMesDono;
    const ix = indexar(base);
    const S = { bruto: 0, corridas: 0, kmT: 0, kmP: 0, horas: 0, bolsoComHoras: 0, diasTrab: 0, diasSemKm: 0, diasSemHoras: 0,
      comb: 0, manut: 0, outros: 0, fixos: 0, capBolso: 0, capReal: 0, pagoUso: 0, recebido: 0, desgOutros: 0,
      combP: 0, manutP: 0, bolso: 0, real: 0, kmCarro: 0 };
    const porPlat = {}, serie = [], outros = {};
    const dias = datas(de, ate);
    for (const k of dias) {
      const us = ix.porData[k] || [];
      const am = k === opts.hoje ? opts.agoraMin : null;
      for (const u of us) S.kmCarro += kmUso(u).km || 0;
      const d = diaDe(us, mot, am);
      const outrosG = (ix.gPorData[k] || [])
        .filter((g) => (g.pagoPor || dono.id) === mot && !CALIBRA.includes(g.tipo))
        .reduce((s, g) => s + (g.valor || 0), 0);
      const paga = isDono || reembolsa;
      const comb = d.kmT * ctx.combKm;
      const manut = paga ? d.kmT * ctx.manutKm : 0;
      const fixos = isDono && d.trabalhou ? fixosDia : 0;
      const capB = isDono && d.trabalhou ? capBolsoDia : 0;
      const capR = isDono && d.trabalhou ? capRealDia : 0;
      const pagoUso = isDono ? 0 : taxaUso(acordo, k, d.trabalhou, d.bruto, ix.inicio[mot]);
      let recebido = 0, desgOutros = 0;
      if (isDono) {
        for (const o of mots) {
          if (o.id === mot) continue;
          const od = diaDe(us, o.id, am);
          const tx = taxaUso(acordo, k, od.trabalhou, od.bruto, ix.inicio[o.id]);
          const dg = (od.kmT + od.kmP) * ctx.manutKm;
          recebido += tx;
          if (!reembolsa) desgOutros += dg;
          const O = outros[o.id] = outros[o.id] || { kmT: 0, kmP: 0, diasTrab: 0, taxa: 0, desgaste: 0, bruto: 0 };
          O.kmT += od.kmT; O.kmP += od.kmP; O.taxa += tx; O.desgaste += dg; O.bruto += od.bruto;
          if (od.trabalhou) O.diasTrab++;
        }
      }
      const combP = d.kmP * ctx.combKm, manutP = paga ? d.kmP * ctx.manutKm : 0;
      const bolso = d.bruto - comb - manut - outrosG - fixos - capB - pagoUso + recebido - desgOutros;
      const real = bolso + capB - capR;
      S.bruto += d.bruto; S.corridas += d.corridas; S.kmT += d.kmT; S.kmP += d.kmP;
      S.comb += comb; S.manut += manut; S.outros += outrosG; S.fixos += fixos; S.capBolso += capB; S.capReal += capR;
      S.pagoUso += pagoUso; S.recebido += recebido; S.desgOutros += desgOutros; S.combP += combP; S.manutP += manutP;
      S.bolso += bolso; S.real += real;
      if (d.trabalhou) {
        S.diasTrab++;
        if (d.horas > 0) { S.horas += d.horas; S.bolsoComHoras += bolso; }
        if (d.semHoras) S.diasSemHoras++;
        if (d.semKm) S.diasSemKm++;
      }
      for (const p of Object.keys(d.porPlat)) {
        porPlat[p] = porPlat[p] || { valor: 0, corridas: 0 };
        porPlat[p].valor += d.porPlat[p].valor; porPlat[p].corridas += d.porPlat[p].corridas;
      }
      serie.push({ data: k, bolso, bruto: d.bruto, trabalhou: d.trabalhou, ativo: d.trabalhou || Math.abs(bolso) > 0.005 });
    }
    S.porHoraBolso = S.horas > 0 ? S.bolsoComHoras / S.horas : null;
    S.brutoPorKm = S.kmT > 0 ? S.bruto / S.kmT : null;
    S.custoPorKm = S.kmT > 0 ? (S.bruto - S.bolso) / S.kmT : null;
    S.ticket = S.corridas > 0 ? S.bruto / S.corridas : null;
    return { ...S, porPlat, serie, outros, isDono, reembolsa, nDias: dias.length, donoId: dono.id };
  }

  // Acerto entre os motoristas, desde o início (positivo = tem a receber)
  function acerto(ctx, cfg, base, hoje) {
    const mots = cfg.motoristas || [];
    const dono = mots.find((m) => m.dono) || mots[0];
    const acordo = cfg.acordo || {};
    const ix = indexar(base);
    const R = {};
    for (const m of mots) R[m.id] = { km: 0, pagoComb: 0, parteComb: 0, taxa: 0, desgaste: 0, pagou: 0, recebeu: 0, saldo: 0 };
    for (const u of base.usos) if (R[u.mot]) R[u.mot].km += kmUso(u).km || 0;
    let totalPago = 0;
    for (const g of base.gastos) {
      if (g.tipo !== 'combustivel' || !(g.valor > 0)) continue;
      const q = R[g.pagoPor] ? g.pagoPor : dono && dono.id;
      if (!q || !R[q]) continue;
      R[q].pagoComb += g.valor; totalPago += g.valor;
    }
    const totalKm = Object.values(R).reduce((s, r) => s + r.km, 0);
    for (const id of Object.keys(R)) R[id].parteComb = totalKm > 0 ? totalPago * R[id].km / totalKm : 0;
    if (dono) {
      for (const m of mots) {
        if (m.id === dono.id || !ix.inicio[m.id]) continue;
        let taxa = 0;
        for (const k of datas(ix.inicio[m.id], hoje)) {
          const d = diaDe(ix.porData[k] || [], m.id, null);
          taxa += taxaUso(acordo, k, d.trabalhou, d.bruto, ix.inicio[m.id]);
        }
        R[m.id].taxa = taxa;
        if (acordo.desgaste) R[m.id].desgaste = R[m.id].km * ctx.manutKm;
      }
    }
    for (const p of base.pagamentos || []) {
      if (R[p.de]) R[p.de].pagou += p.valor || 0;
      if (R[p.para]) R[p.para].recebeu += p.valor || 0;
    }
    for (const id of Object.keys(R)) {
      const r = R[id];
      r.saldo = r.pagoComb - r.parteComb - r.taxa - r.desgaste + r.pagou - r.recebeu;
    }
    if (dono && R[dono.id]) {
      for (const id of Object.keys(R)) if (id !== dono.id) R[dono.id].saldo += R[id].taxa + R[id].desgaste;
    }
    const dev = Object.keys(R).filter((id) => R[id].saldo < -0.005).map((id) => ({ id, v: -R[id].saldo })).sort((a, b) => b.v - a.v);
    const rec = Object.keys(R).filter((id) => R[id].saldo > 0.005).map((id) => ({ id, v: R[id].saldo })).sort((a, b) => b.v - a.v);
    const transf = [];
    let i = 0, j = 0;
    while (i < dev.length && j < rec.length) {
      const v = Math.min(dev[i].v, rec[j].v);
      if (v >= 0.01) transf.push({ de: dev[i].id, para: rec[j].id, valor: v });
      dev[i].v -= v; rec[j].v -= v;
      if (dev[i].v < 0.005) i++;
      if (rec[j].v < 0.005) j++;
    }
    return { R, transf, totalPago, totalKm };
  }

  // Km sem dono: o odômetro de um uso começa depois de onde o anterior terminou
  function lacunas(usos) {
    const xs = usos.map((u) => ({ u, a: parseNum(u.odoIni), b: parseNum(u.odoFim) }))
      .filter((x) => x.a != null)
      .sort((x, y) => x.a - y.a || (x.u.data < y.u.data ? -1 : 1));
    const out = [];
    let last = null;
    for (const x of xs) {
      if (last && x.a - last.b > 1) out.push({ de: last.u, ate: x.u, km: x.a - last.b, odoA: last.b, odoB: x.a });
      if (x.b != null && x.b > x.a && (!last || x.b > last.b)) last = x;
    }
    return out;
  }

  return { parseNum, minutos, mesesEntre, taxaImplicita, consumoReal, ultimoPreco, fixosMensal, depreciacaoMensal, jurosMensal, capitalMensal, contexto,
    kmUso, horasUso, ganhosUso, datas, taxaUso, indexar, diaDe, resultado, acerto, lacunas, r2, CALIBRA };
})();

