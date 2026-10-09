// Painel web do parceiro (associações, nutrição, insumos): uma página só, servida pelo próprio
// backend e falando com a mesma API do app (/auth/login e /parceiros/*). Sem dependências externas.
//
// Segurança: o helmet bloqueia script/handler inline, então o JS é um arquivo à parte
// (/painel-parceiro/app.js) e tudo usa addEventListener. Todo texto vindo do servidor entra na
// página por textContent (nunca como HTML): nomes e anotações são digitados por terceiros.

export function paginaPainel(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>AgroTotal — Painel do parceiro</title>
<style>
  :root { --verde:#115414; --verde2:#2E7D32; --fundo:#f1f7f2; --txt:#1b1b1b; --suave:#5b6b5d; --linha:#dbe6dc; --erro:#b3261e; }
  @media (prefers-color-scheme: dark) { :root { --fundo:#101a11; --txt:#eef3ee; --suave:#a3b3a5; --linha:#2a3b2c; --card:#17241a; } }
  * { box-sizing:border-box; }
  body { margin:0; font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--fundo); color:var(--txt); }
  .card { background:var(--card,#fff); border:1px solid var(--linha); border-radius:12px; padding:16px; margin:0 0 16px; }
  header { background:var(--verde); color:#fff; padding:12px 16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  header h1 { font-size:18px; margin:0; flex:1; }
  main { max-width:1100px; margin:0 auto; padding:16px; }
  h2 { font-size:17px; margin:0 0 10px; }
  label { display:block; font-weight:600; margin:10px 0 4px; font-size:13px; }
  input, select, button { font:inherit; }
  input[type=text], input[type=email], input[type=password], input[type=number], input[type=search], select {
    width:100%; padding:9px 10px; border:1px solid var(--linha); border-radius:8px; background:var(--card,#fff); color:var(--txt); }
  button { cursor:pointer; border:0; border-radius:8px; padding:9px 14px; background:var(--verde2); color:#fff; font-weight:700; }
  button.sec { background:transparent; color:var(--verde2); border:1px solid var(--verde2); }
  button.perigo { background:var(--erro); }
  header button, header select { width:auto; }
  header select { padding:7px 8px; border-radius:8px; }
  nav { display:flex; gap:8px; margin:0 0 16px; flex-wrap:wrap; }
  nav button { background:transparent; color:var(--txt); border:1px solid var(--linha); }
  nav button[aria-selected=true] { background:var(--verde2); color:#fff; border-color:var(--verde2); }
  .grid { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); }
  .kpi b { display:block; font-size:24px; }
  .kpi span { color:var(--suave); font-size:13px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:8px 6px; border-bottom:1px solid var(--linha); vertical-align:top; }
  th { color:var(--suave); font-size:12px; text-transform:uppercase; letter-spacing:.03em; }
  .tabela { overflow-x:auto; }
  .msg { color:var(--erro); margin:8px 0 0; min-height:1.2em; }
  .ok { color:var(--verde2); }
  .suave { color:var(--suave); font-size:13px; }
  .linha { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .chk { display:flex; gap:8px; align-items:flex-start; font-weight:400; margin:6px 0; }
  .chk input { margin-top:4px; }
  code { background:rgba(0,0,0,.06); padding:2px 6px; border-radius:6px; font-size:14px; }
  .oculto { display:none !important; }
  .login { max-width:380px; margin:48px auto; }
</style>
</head>
<body>
<header class="oculto" id="topo">
  <h1>AgroTotal · Painel do parceiro</h1>
  <select id="sel-parceiro" aria-label="Parceiro"></select>
  <button class="sec" id="btn-sair" type="button" style="color:#fff;border-color:#fff">Sair</button>
</header>
<main>
  <section class="card login" id="tela-login">
    <h2>Entrar</h2>
    <p class="suave">Use o mesmo e-mail e senha da sua conta AgroTotal. Seu acesso precisa ter sido liberado como parceiro.</p>
    <form id="form-login">
      <label for="email">E-mail</label>
      <input id="email" type="email" autocomplete="username" required>
      <label for="senha">Senha</label>
      <input id="senha" type="password" autocomplete="current-password" required>
      <p class="msg" id="msg-login" role="alert"></p>
      <button type="submit">Entrar</button>
    </form>
  </section>
  <div id="app" class="oculto">
    <nav id="abas" role="tablist"></nav>
    <div id="conteudo"></div>
  </div>
</main>
<script src="/painel-parceiro/app.js" defer></script>
</body>
</html>`;
}

export function scriptPainel(): string {
  return String.raw`(function () {
  'use strict';
  var ROTULO_ESCOPO = {
    rebanho: 'Tamanho do rebanho (nº de animais ativos)',
    desempenho: 'Ganho de peso médio (GMD) do rebanho',
    area: 'Área em hectares (invernadas e lavouras)',
    localizacao: 'Município e estado da propriedade',
    contato: 'Nome e e-mail do produtor'
  };
  var PLANOS = { basico: 'Essencial (sem patrocínio)', intermediario: 'Produtor', avancado: 'Pro' };
  var TIPOS = { associacao: 'Associação', nutricao: 'Nutrição animal', insumos: 'Sementes e insumos' };

  var estado = { token: null, parceiros: [], parceiro: null, aba: 'carteira', carteira: null };

  function guardar(t) { try { if (t) sessionStorage.setItem('agt_tok', t); else sessionStorage.removeItem('agt_tok'); } catch (e) {} }
  function lembrado() { try { return sessionStorage.getItem('agt_tok'); } catch (e) { return null; } }

  // cria elemento só com texto seguro (textContent), sem montar HTML
  function h(tag, attrs, filhos) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'texto') el.textContent = attrs[k];
      else if (k === 'on') Object.keys(attrs.on).forEach(function (ev) { el.addEventListener(ev, attrs.on[ev]); });
      else if (attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== false) el.setAttribute(k, attrs[k] === true ? '' : String(attrs[k]));
    });
    (filhos || []).forEach(function (f) { if (f) el.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
    return el;
  }
  function $(id) { return document.getElementById(id); }
  function limpar(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function api(metodo, caminho, corpo) {
    var opt = { method: metodo, headers: { 'content-type': 'application/json' } };
    if (estado.token) opt.headers.authorization = 'Bearer ' + estado.token;
    if (corpo !== undefined) opt.body = JSON.stringify(corpo);
    return fetch(caminho, opt).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (r.status === 401) { sair(); throw new Error('Sessão expirada. Entre novamente.'); }
        if (!r.ok) {
          var m = j && j.message;
          throw new Error(Array.isArray(m) ? m.join(' · ') : (m || ('Erro ' + r.status)));
        }
        return j;
      });
    });
  }

  function dataBR(v) { if (!v) return '—'; var d = new Date(v); return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR'); }
  function num(v, casas) { return typeof v === 'number' ? v.toLocaleString('pt-BR', { maximumFractionDigits: casas === undefined ? 0 : casas }) : '—'; }

  // ----------------------------------------------------------------- login / sessão
  function sair() {
    estado.token = null; estado.parceiros = []; estado.parceiro = null; estado.carteira = null; guardar(null);
    $('topo').classList.add('oculto'); $('app').classList.add('oculto'); $('tela-login').classList.remove('oculto');
  }

  function entrar(e) {
    e.preventDefault();
    $('msg-login').textContent = '';
    api('POST', '/auth/login', { email: $('email').value.trim(), senha: $('senha').value })
      .then(function (r) { estado.token = r.token; guardar(r.token); $('senha').value = ''; return iniciar(); })
      .catch(function (err) { $('msg-login').textContent = err.message === 'Credenciais inválidas' ? 'E-mail ou senha incorretos.' : err.message; });
  }

  function iniciar() {
    return api('GET', '/parceiros/meus').then(function (lista) {
      if (!lista.length) { sair(); $('msg-login').textContent = 'Esta conta não está vinculada a nenhum parceiro. Peça ao AgroTotal para liberar o seu acesso.'; return; }
      estado.parceiros = lista;
      estado.parceiro = lista[0];
      var sel = $('sel-parceiro'); limpar(sel);
      lista.forEach(function (p) { sel.appendChild(h('option', { value: p.id, texto: p.nome + ' · ' + (TIPOS[p.tipo] || p.tipo) })); });
      $('tela-login').classList.add('oculto'); $('topo').classList.remove('oculto'); $('app').classList.remove('oculto');
      desenharAbas(); abrir('carteira');
    }).catch(function (err) { if (!estado.token) return; $('msg-login').textContent = err.message; });
  }

  function ehAdmin() { return estado.parceiro && estado.parceiro.papel === 'admin'; }

  function desenharAbas() {
    var nav = $('abas'); limpar(nav);
    [['carteira', 'Produtores'], ['convites', 'Convites'], ['equipe', 'Equipe']].forEach(function (a) {
      nav.appendChild(h('button', { type: 'button', role: 'tab', 'aria-selected': estado.aba === a[0] ? 'true' : 'false', texto: a[1], on: { click: function () { abrir(a[0]); } } }));
    });
  }

  function abrir(aba) {
    estado.aba = aba; desenharAbas();
    var c = $('conteudo'); limpar(c); c.appendChild(h('p', { class: 'suave', texto: 'Carregando…' }));
    var p = aba === 'carteira' ? telaCarteira() : aba === 'convites' ? telaConvites() : telaEquipe();
    p.catch(function (err) { limpar(c); c.appendChild(h('p', { class: 'msg', texto: err.message })); });
  }

  // ----------------------------------------------------------------- carteira
  function celulaCartao(it) {
    var c = it.cartao || {};
    return {
      animais: c.rebanho ? c.rebanho.animaisAtivos : null,
      gmd: c.desempenho ? c.desempenho.gmdMedioKgDia : null,
      area: c.area ? c.area.areaHa : null,
      local: c.localizacao ? (c.localizacao.cidade + '/' + c.localizacao.estado) : null,
      nome: c.contato ? c.contato.nome : null,
      email: c.contato ? c.contato.email : null
    };
  }

  function telaCarteira() {
    return api('GET', '/parceiros/' + estado.parceiro.id + '/carteira').then(function (r) {
      estado.carteira = r;
      var itens = r.itens;
      var linhas = itens.map(function (it) { return { it: it, c: celulaCartao(it) }; });
      var somaAnimais = 0, somaArea = 0, comAnimais = 0, comArea = 0;
      linhas.forEach(function (l) {
        if (typeof l.c.animais === 'number') { somaAnimais += l.c.animais; comAnimais++; }
        if (typeof l.c.area === 'number') { somaArea += l.c.area; comArea++; }
      });

      var c = $('conteudo'); limpar(c);
      c.appendChild(h('div', { class: 'grid card' }, [
        h('div', { class: 'kpi' }, [h('b', { texto: num(r.total) }), h('span', { texto: 'produtores acompanhados' })]),
        h('div', { class: 'kpi' }, [h('b', { texto: comAnimais ? num(somaAnimais) : '—' }), h('span', { texto: 'animais ativos (' + comAnimais + ' autorizaram)' })]),
        h('div', { class: 'kpi' }, [h('b', { texto: comArea ? num(somaArea, 1) + ' ha' : '—' }), h('span', { texto: 'área (' + comArea + ' autorizaram)' })])
      ]));
      c.appendChild(h('p', { class: 'suave', texto: 'Cada produtor aparece só com o que autorizou. Os totais somam apenas quem compartilhou aquele dado. Nunca há dados financeiros nem CPF.' }));

      var busca = h('input', { type: 'search', placeholder: 'Filtrar por identificação, município ou nome…', 'aria-label': 'Filtrar' });
      var corpo = h('tbody');
      function desenhar() {
        limpar(corpo);
        var q = busca.value.trim().toLowerCase();
        var vistas = linhas.filter(function (l) {
          if (!q) return true;
          return [l.it.rotulo, l.it.fazenda, l.c.local, l.c.nome, l.c.email].join(' ').toLowerCase().indexOf(q) >= 0;
        });
        if (!vistas.length) corpo.appendChild(h('tr', null, [h('td', { colspan: 8, class: 'suave', texto: itens.length ? 'Nenhum resultado.' : 'Ainda não há produtores. Crie um convite na aba Convites.' })]));
        vistas.forEach(function (l) {
          var plano = l.it.planoConcedido ? (PLANOS[l.it.planoConcedido] || l.it.planoConcedido) + (l.it.planoAteEm ? ' até ' + dataBR(l.it.planoAteEm) : '') : '—';
          corpo.appendChild(h('tr', null, [
            h('td', { texto: l.it.rotulo }),
            h('td', { texto: l.it.fazenda || l.c.nome || '—' }),
            h('td', { texto: l.c.local || '—' }),
            h('td', { texto: num(l.c.animais) }),
            h('td', { texto: l.c.gmd === null || l.c.gmd === undefined ? '—' : num(l.c.gmd, 3) + ' kg/dia' }),
            h('td', { texto: l.c.area === null || l.c.area === undefined ? '—' : num(l.c.area, 1) + ' ha' }),
            h('td', { texto: dataBR(l.it.desde) }),
            h('td', { texto: plano })
          ]));
        });
      }
      busca.addEventListener('input', desenhar);

      var cab = h('tr', null, ['Identificação', 'Fazenda / produtor', 'Local', 'Animais', 'GMD', 'Área', 'Desde', 'Plano patrocinado'].map(function (t) { return h('th', { texto: t }); }));
      c.appendChild(h('div', { class: 'card' }, [
        h('div', { class: 'linha' }, [h('div', { style: 'flex:1;min-width:220px' }, [busca]), h('button', { class: 'sec', type: 'button', texto: 'Exportar CSV', on: { click: function () { exportar(linhas); } } })]),
        h('div', { class: 'tabela', style: 'margin-top:12px' }, [h('table', null, [h('thead', null, [cab]), corpo])])
      ]));
      desenhar();
    });
  }

  // CSV: células que começam com = + - @ viram texto (evita fórmula em planilha: os dados são de terceiros)
  function celulaCsv(v) {
    var s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function exportar(linhas) {
    var cab = ['Identificação', 'Fazenda', 'Produtor', 'E-mail', 'Município/UF', 'Animais ativos', 'GMD kg/dia', 'Área ha', 'Desde', 'Plano patrocinado'];
    var rows = [cab].concat(linhas.map(function (l) {
      return [l.it.rotulo, l.it.fazenda, l.c.nome, l.c.email, l.c.local, l.c.animais, l.c.gmd, l.c.area, dataBR(l.it.desde), l.it.planoConcedido];
    }));
    var csv = '﻿' + rows.map(function (r) { return r.map(celulaCsv).join(';'); }).join('\r\n');
    var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    var a = document.createElement('a'); a.href = url; a.download = 'produtores-agrototal.csv'; document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  // ----------------------------------------------------------------- convites
  function estadoConvite(cv) {
    if (!cv.ativo) return 'Cancelado';
    if (new Date(cv.validoAte) < new Date()) return 'Vencido';
    if (cv.usos >= cv.usosMax) return 'Esgotado';
    return 'Ativo';
  }

  function telaConvites() {
    return api('GET', '/parceiros/' + estado.parceiro.id + '/convites').then(function (lista) {
      var c = $('conteudo'); limpar(c);

      var nota = h('input', { type: 'text', maxlength: 80, placeholder: 'Ex.: Fazenda do João (só você vê)' });
      var plano = h('select', null, Object.keys(PLANOS).map(function (k) { return h('option', { value: k, texto: PLANOS[k] }); }));
      var meses = h('input', { type: 'number', min: 1, max: 36, value: 3 });
      var usos = h('input', { type: 'number', min: 1, max: 10000, value: 1 });
      var dias = h('input', { type: 'number', min: 1, max: 365, value: 30 });
      var boxes = Object.keys(ROTULO_ESCOPO).map(function (k) {
        var cb = h('input', { type: 'checkbox', value: k, checked: k === 'rebanho' || k === 'localizacao' });
        return { k: k, cb: cb, el: h('label', { class: 'chk' }, [cb, h('span', { texto: ROTULO_ESCOPO[k] })]) };
      });
      var blocoMeses = h('div', null, [h('label', { texto: 'Meses de plano patrocinado' }), meses]);
      function mostrarMeses() { blocoMeses.classList.toggle('oculto', plano.value === 'basico'); }
      plano.addEventListener('change', mostrarMeses); mostrarMeses();
      var msg = h('p', { class: 'msg', role: 'alert' });

      var form = h('form', { class: 'card' }, [
        h('h2', { texto: 'Novo convite' }),
        h('p', { class: 'suave', texto: 'O produtor decide, no app, o que de fato compartilha: você só recebe o que ele autorizar dentro do que pedir aqui.' }),
        h('label', { texto: 'Identificação (anotação sua)' }), nota,
        h('label', { texto: 'Plano que você patrocina' }), plano, blocoMeses,
        h('label', { texto: 'Dados que você quer acompanhar' })
      ].concat(boxes.map(function (b) { return b.el; })).concat([
        h('div', { class: 'grid' }, [h('div', null, [h('label', { texto: 'Quantas pessoas podem usar' }), usos]), h('div', null, [h('label', { texto: 'Validade (dias)' }), dias])]),
        msg,
        h('button', { type: 'submit', texto: 'Gerar convite' })
      ]));
      form.addEventListener('submit', function (e) {
        e.preventDefault(); msg.textContent = ''; msg.className = 'msg';
        var escopos = boxes.filter(function (b) { return b.cb.checked; }).map(function (b) { return b.k; });
        if (!escopos.length) { msg.textContent = 'Escolha ao menos um dado.'; return; }
        var corpo = { escopos: escopos, plano: plano.value, usosMax: Number(usos.value) || 1, diasValidade: Number(dias.value) || 30 };
        if (nota.value.trim()) corpo.nota = nota.value.trim();
        if (plano.value !== 'basico') corpo.mesesPlano = Number(meses.value) || 0;
        api('POST', '/parceiros/' + estado.parceiro.id + '/convites', corpo)
          .then(function (cv) { msg.className = 'msg ok'; msg.textContent = 'Convite criado: ' + cv.codigo; abrirDepois(); })
          .catch(function (err) { msg.textContent = err.message; });
      });
      function abrirDepois() { setTimeout(function () { abrir('convites'); }, 1200); }
      c.appendChild(form);

      var corpo = h('tbody');
      if (!lista.length) corpo.appendChild(h('tr', null, [h('td', { colspan: 6, class: 'suave', texto: 'Nenhum convite ainda.' })]));
      lista.forEach(function (cv) {
        var st = estadoConvite(cv);
        var link = 'agrototal://mais/parceiros?codigo=' + cv.codigo;
        var acoes = [h('button', { class: 'sec', type: 'button', texto: 'Copiar texto', on: { click: function (ev) { copiar(estado.parceiro.nome + ' convidou você para o AgroTotal.\nNo app, vá em Mais → Parceiros e digite o código: ' + cv.codigo + '\nOu abra no celular: ' + link, ev.target); } } })];
        if (st === 'Ativo') acoes.push(h('button', { class: 'perigo', type: 'button', texto: 'Cancelar', on: { click: function () { if (confirm('Cancelar o convite ' + cv.codigo + '?')) api('DELETE', '/parceiros/' + estado.parceiro.id + '/convites/' + cv.id).then(function () { abrir('convites'); }).catch(function (err) { alert(err.message); }); } } }));
        corpo.appendChild(h('tr', null, [
          h('td', null, [h('code', { texto: cv.codigo })]),
          h('td', { texto: cv.nota || '—' }),
          h('td', { texto: (PLANOS[cv.plano] || cv.plano) + (cv.plano !== 'basico' ? ' · ' + cv.mesesPlano + ' mês(es)' : '') }),
          h('td', { texto: cv.usos + '/' + cv.usosMax + ' · até ' + dataBR(cv.validoAte) }),
          h('td', { texto: st }),
          h('td', { class: 'linha' }, acoes)
        ]));
      });
      c.appendChild(h('div', { class: 'card' }, [h('h2', { texto: 'Convites' }), h('div', { class: 'tabela' }, [h('table', null, [h('thead', null, [h('tr', null, ['Código', 'Identificação', 'Plano', 'Usos / validade', 'Situação', ''].map(function (t) { return h('th', { texto: t }); }))]), corpo])])]));
    });
  }

  function copiar(texto, botao) {
    var antes = botao.textContent;
    var fim = function (ok) { botao.textContent = ok ? 'Copiado ✓' : 'Não consegui copiar'; setTimeout(function () { botao.textContent = antes; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(function () { fim(true); }, function () { fim(false); });
    else fim(false);
  }

  // ----------------------------------------------------------------- equipe
  function telaEquipe() {
    var c = $('conteudo'); limpar(c);
    var msg = h('p', { class: 'msg', role: 'alert' });
    if (!ehAdmin()) {
      c.appendChild(h('div', { class: 'card' }, [h('h2', { texto: 'Equipe' }), h('p', { class: 'suave', texto: 'Só o administrador do parceiro adiciona pessoas.' })]));
      return Promise.resolve();
    }
    var email = h('input', { type: 'email', placeholder: 'email@empresa.com.br', required: true });
    var papel = h('select', null, [h('option', { value: 'representante', texto: 'Representante (vê produtores e cria convites)' }), h('option', { value: 'admin', texto: 'Administrador (também adiciona pessoas)' })]);
    var form = h('form', { class: 'card' }, [
      h('h2', { texto: 'Adicionar pessoa à equipe' }),
      h('p', { class: 'suave', texto: 'A pessoa precisa já ter conta no AgroTotal (baixar o app e criar a conta com este e-mail).' }),
      h('label', { texto: 'E-mail' }), email, h('label', { texto: 'Papel' }), papel, msg, h('button', { type: 'submit', texto: 'Adicionar' })
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault(); msg.textContent = ''; msg.className = 'msg';
      api('POST', '/parceiros/' + estado.parceiro.id + '/membros', { email: email.value.trim(), papel: papel.value })
        .then(function () { msg.className = 'msg ok'; msg.textContent = 'Pessoa adicionada.'; email.value = ''; })
        .catch(function (err) { msg.textContent = err.message; });
    });
    c.appendChild(form);
    return Promise.resolve();
  }

  // ----------------------------------------------------------------- partida
  $('form-login').addEventListener('submit', entrar);
  $('btn-sair').addEventListener('click', sair);
  $('sel-parceiro').addEventListener('change', function (e) {
    var p = estado.parceiros.filter(function (x) { return x.id === e.target.value; })[0];
    if (p) { estado.parceiro = p; abrir(estado.aba); }
  });
  var t = lembrado();
  if (t) { estado.token = t; iniciar(); }
})();
`;
}
