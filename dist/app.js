const $ = (s) => document.querySelector(s),
  esc = (x) =>
    String(x ?? "Não informado").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  num = (x, d = 1) =>
    typeof x === "number" && isFinite(x)
      ? x.toLocaleString("pt-BR", { maximumFractionDigits: d })
      : "Não informado";
const pages = [
    "Dashboard geral",
    "Inteligência ASG",
    "Empresas",
    "Indicadores",
    "Interseções e cruzamentos",
    "Análise histórica",
    "Mapa empresarial e econômico",
    "Relatórios e extratos",
    "Gestão e importação de dados",
    "Competição e evolução ASG",
    "Matriz de materialidade",
  ],
  icons = ["▦", "◈", "▤", "◫", "⇄", "◷", "◎", "▥", "⚙", "↗", "◉"];
let raw,
  ind,
  contracts,
  params,
  page = 0,
  filters = { company: "", sector: "", uf: "", dim: "", period: "2026" },
  search = "",
  versions = JSON.parse(sessionStorage.getItem("asg-versions") || "[]"),
  weights = JSON.parse(sessionStorage.getItem("asg-weights") || "{}"),
  pending = null;
const dimOf = (id) =>
  [30, 46, 47].includes(+id.slice(4))
    ? "Ambiental"
    : [2, 29, 48, 49].includes(+id.slice(4))
      ? "Social"
      : [28, 34, 35, 36, 37, 38, 39, 40, 41, 44, 45, 50, 51, 52].includes(
            +id.slice(4),
          )
        ? "Validar classificação"
        : "Governança";
function model() {
  params = Object.fromEntries(
    raw["Parâmetros"].filter((r) => r[1]).map((r) => [r[1], r[2]]),
  );
  ind = raw.Indicadores.map((r, index) => ({ r, sourceRow: index + 1 }))
    .filter(({ r }) => /^IND-\d+$/.test(r[0]))
    .map(({ r, sourceRow }) => ({
      r,
      id: r[0],
      name: r[3],
      unit: r[4],
      value: r[10],
      prev: r[11],
      target: r[13],
      critical: r[14],
      status: r[15],
      score: r[18],
      weight: r[19],
      dim:
        {
          "Ambiental (E)": "Ambiental",
          "Social (S)": "Social",
          "Governança (G)": "Governança",
        }[r[26]] || "Validar classificação",
      row: sourceRow,
    }));
  contracts = raw.Contratos_ASG.filter((r) => /^CT-/.test(r[0]));
}
const options = (arr, sel) =>
  '<option value="">Todos</option>' +
  [...new Set(arr)]
    .filter(Boolean)
    .sort()
    .map(
      (x) =>
        `<option ${sel === x ? "selected" : ""} value="${esc(x)}">${esc(x)}</option>`,
    )
    .join("");
function controls() {
  $("#filters").innerHTML =
    `<label>Empresa / entidade<select data-filter="company"><option value="">Visão coletiva</option><option value="aurora" ${filters.company === "aurora" ? "selected" : ""}>${esc(params["Organização (fictícia)"])}</option>${contracts.map((r) => `<option value="${esc(r[0])}" ${filters.company === r[0] ? "selected" : ""}>${esc(r[1])}</option>`).join("")}</select></label><label>Setor do fornecedor<select data-filter="sector">${options(
      contracts.map((r) => r[2]),
      filters.sector,
    )}</select></label><label>UF do fornecedor<select data-filter="uf">${options(
      contracts.map((r) => r[3]),
      filters.uf,
    )}</select></label><label>Dimensão<select data-filter="dim">${options(["Ambiental", "Social", "Governança", "Validar classificação"], filters.dim)}</select></label><label>Período<select data-filter="period"><option value="2026" ${filters.period === "2026" ? "selected" : ""}>2026 · T3 acumulado</option><option value="2025" ${filters.period === "2025" ? "selected" : ""}>2025 · comparativo</option></select></label><button class="btn" id="clear">Limpar</button>`;
  document.querySelectorAll("[data-filter]").forEach(
    (e) =>
      (e.onchange = () => {
        filters[e.dataset.filter] = e.value;
        if (e.dataset.filter === "company") {
          filters.sector = "";
          filters.uf = "";
          filters.dim = "";
        }
        render();
      }),
  );
  $("#clear").onclick = () => {
    filters = { company: "", sector: "", uf: "", dim: "", period: "2026" };
    render();
  };
}
function cs() {
  return filters.company === "aurora"
    ? []
    : contracts.filter(
        (r) =>
          (!filters.company ||
            filters.company === "aurora" ||
            r[0] === filters.company) &&
          (!filters.sector || r[2] === filters.sector) &&
          (!filters.uf || r[3] === filters.uf),
      );
}
function corporate() {
  return (
    (!filters.company || filters.company === "aurora") &&
    !filters.sector &&
    !filters.uf
  );
}
function inds() {
  return corporate()
    ? ind.filter(
        (i) =>
          (!filters.dim || i.dim === filters.dim) &&
          (!search ||
            `${esc(i.id)} ${i.name}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      )
    : [];
}
function val(i, period = filters.period) {
  return period === "2025" ? i.prev : i.value;
}
function fmt(i, v) {
  return v == null
    ? "Não informado"
    : i.unit === "%"
      ? num(v * 100) + "%"
      : num(v, 2);
}
function score(items, old = false) {
  let a = items.filter(
    (i) =>
      typeof (old ? i.prev : i.value) === "number" &&
      i.dim !== "Validar classificação",
  );
  let den = 0,
    total = 0;
  a.forEach((i) => {
    let w = weights[i.id] ?? i.weight;
    if (w <= 0) return;
    let v = old ? i.prev : i.value,
      s =
        i.r[12] === "Maior é melhor"
          ? v >= i.target
            ? 100
            : v >= i.critical
              ? 60
              : 20
          : v <= i.target
            ? 100
            : v <= i.critical
              ? 60
              : 20;
    den += w;
    total += s * w;
  });
  return den ? total / den : null;
}
function badge(s) {
  return `<span class="pill ${s === "Crítico" ? "bad" : s === "Atenção" ? "warn" : s === "Atende" ? "" : "neutral"}">${esc(s)}</span>`;
}
function card(label, v, note) {
  return `<div class="card"><small>${label}</small><div class="value">${v}</div><small>${note}</small></div>`;
}
function bars(entries) {
  let max = Math.max(...entries.map((e) => e[1]), 1);
  return entries
    .map(
      ([k, v]) =>
        `<div class="barrow"><span>${esc(k)}</span><div class="bar"><i style="width:${(v / max) * 100}%"></i></div><b>${num(v)}</b></div>`,
    )
    .join("");
}
function group(rows, col) {
  let o = {};
  rows.forEach((r) => (o[r[col]] = (o[r[col]] || 0) + 1));
  return Object.entries(o).sort((a, b) => b[1] - a[1]);
}
function table(head, rows) {
  return `<div class="tablewrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${head.length}" class="empty">Sem dados para esta seleção.</td></tr>`}</tbody></table></div>`;
}
function trend(i) {
  let a = val(i, "2025"),
    b = val(i, "2026");
  if (a == null || b == null) return "<p>Histórico insuficiente.</p>";
  let max = Math.max(Math.abs(a), Math.abs(b), 1),
    y = (v) => 180 - (v / max) * 140;
  return `<svg viewBox="0 0 560 230" role="img" aria-label="Comparativo entre 2025 e 2026"><path d="M70 30V185H500" fill="none" stroke="#dce6e1"/><path d="M120 ${y(a)} L450 ${y(b)}" fill="none" stroke="#16826a" stroke-width="3"/>${[
    [120, a, "2025"],
    [450, b, "2026 · T3"],
  ]
    .map(
      ([x, v, t]) =>
        `<circle cx="${x}" cy="${y(v)}" r="6" fill="#16826a"/><text x="${x}" y="${y(v) - 15}" text-anchor="middle" font-size="13" fill="#173a3e">${fmt(i, v)}</text><text x="${x}" y="215" text-anchor="middle" font-size="12" fill="#718580">${t}</text>`,
    )
    .join(
      "",
    )}</svg><small class="muted">2025: comparativo sem trimestre identificado. 2026: acumulado jan–set; a comparabilidade temporal requer validação.</small>`;
}
function indicatorTable(a) {
  return table(
    ["INDICADOR", "DIMENSÃO", "RESULTADO", "META", "STATUS"],
    a.map(
      (i) =>
        `<tr class="clickable" data-ind="${esc(i.id)}"><td><small class="muted">${esc(i.id)}</small><br>${esc(i.name)}</td><td>${esc(i.dim)}</td><td><b>${fmt(i, val(i))}</b></td><td>${fmt(i, i.target)}</td><td>${filters.period === "2026" ? badge(i.status) : badge("Comparativo")}</td></tr>`,
    ),
  );
}
function supplierDashboard() {
  const rows = cs();
  const intro = `<section class="panel full"><h2>${filters.company ? "Painel da empresa selecionada" : "Painel dos fornecedores"}</h2><p>Os indicadores corporativos pertencem a ${esc(params["Organização (fictícia)"])}. Para os fornecedores, a planilha informa score ASG geral, contratos, cláusulas e verificações de integridade; não há notas individuais por dimensão E/S/G.</p><div class="toolbar"><button class="btn" data-page="9">Ver competição ASG →</button><button class="btn" id="corporate-view">Ver organização principal →</button></div></section>`;
  if (!rows.length) return intro + '<section class="panel full"><h2>Nenhuma empresa neste recorte</h2><p>Os filtros de empresa, setor e UF não encontram um fornecedor. Use Limpar para escolher novamente.</p></section>';
  if (filters.period !== "2026") return intro + '<section class="panel full"><h2>Sem dados de fornecedores para 2025</h2><p>Selecione 2026 · T3 acumulado para consultar os dados individuais. O comparativo de 2025 existe apenas para os indicadores corporativos.</p></section>';
  if (filters.dim) return intro + '<section class="panel full"><h2>Score geral disponível</h2><p>Selecione Todos no filtro Dimensão para consultar os fornecedores. A fonte não informa scores separados de Ambiental, Social e Governança por empresa.</p></section>';
  const ranked = rankCompanies(contracts);
  const classes = new Map((raw.Comparativo_Empresas || []).filter(r => /^CT-/.test(r[0])).map(r => [r[0], r[6]]));
  const r = rows.length === 1 ? rows[0] : null;
  const valid = rows.filter(r => typeof r[14] === "number" && Number.isFinite(r[14]));
  const average = valid.length ? valid.reduce((sum, r) => sum + r[14], 0) / valid.length : null;
  const rank = r ? ranked.find(item => item.row[0] === r[0])?.rank : null;
  return intro + `<div class="cards">${card("Fornecedores selecionados", rows.length, "Empresas com contratos na base")}${card(r ? "Score ASG da empresa" : "Score ASG médio dos fornecedores", num(r ? r[14] : average), "0–100 · score geral original da planilha")}${card(r ? "Posição na base completa" : "Fornecedores com score", r ? (rank ? rank + "º" : "Não informada") : valid.length, r ? esc(classes.get(r[0]) || "Classificação não informada") : "Média simples dos scores disponíveis")}${card("Valor anual contratado", "R$ " + num(rows.reduce((sum, r) => sum + r[4], 0) / 1000, 2) + " mi", "Valor contratual · não representa receita")}</div><section class="panel full"><h2>Dados dos fornecedores selecionados</h2>${table(["EMPRESA", "CATEGORIA / UF", "SCORE ASG", "CLASSIFICAÇÃO", "RISCO CONTRATUAL", "NÃO CONFORMIDADES"], rows.map(r => `<tr><td><a href="#" data-company="${esc(r[0])}">${esc(r[1])}</a></td><td>${esc(r[2])} · ${esc(r[3])}</td><td>${num(r[14])} / 100</td><td>${esc(classes.get(r[0]) || "Não informada")}</td><td>${esc(r[5])}</td><td>${num(r[15])}</td></tr>`))}<p>Fonte: Contratos_ASG e Comparativo_Empresas · data-base ${esc(params["Data-base"])}. O score geral e o risco contratual são medidas distintas.</p></section>${r ? `<section class="panel full"><h2>Cláusulas e verificações · ${esc(r[1])}</h2>${table(["CRITÉRIO", "RESPOSTA NA PLANILHA"], raw.Contratos_ASG[3].slice(6,14).map((h,j) => `<tr><td>${esc(h)}</td><td>${esc(r[j+6])}</td></tr>`))}<p>Contrato ${esc(r[0])} · fim da vigência: ${esc(r[16])}. As respostas contratuais não constituem notas por dimensão ASG.</p></section>` : ""}<section class="panel full"><h2>Evolução da empresa</h2><p>Histórico insuficiente para calcular crescimento: a planilha contém apenas um período por fornecedor. Consulte a competição para comparar o desempenho atual entre empresas.</p></section>`;
}
function dashboard() {
  if (!corporate()) return supplierDashboard();
  let a = inds(),
    c = cs(),
    counts = ["Atende", "Atenção", "Crítico"].map((s) => [
      s,
      a.filter((i) => i.status === s).length,
    ]);
  return `<div class="cards">${card("Organizações na base", corporate() ? 1 + c.length : c.length, "1 organização principal + fornecedores filtrados")}${card("Indicadores corporativos", a.length, "Catálogo com origem e critérios")}${card("Pontuação ASG parcial", num(score(a, filters.period === "2025")), "/ 100 · dimensões classificadas")}${card("Valor anual contratado", filters.period === "2026" ? "R$ " + num(c.reduce((s, r) => s + r[4], 0) / 1000, 2) + " mi" : "Não disponível", "Fornecedores · não representa receita")}</div><div class="grid"><section class="panel"><h2>Panorama das dimensões ASG</h2><p>Indicadores corporativos por classificação analítica</p>${bars(["Ambiental", "Social", "Governança", "Validar classificação"].map((d) => [d, a.filter((i) => i.dim === d).length]))}<small class="muted">Classificação informada na coluna AA da planilha atual; os eixos originais foram preservados.</small></section><section class="panel"><h2>Acompanhamento das metas</h2><p>Posição corporativa · ${filters.period === "2026" ? "30 de setembro de 2026" : "status indisponível para 2025"}</p>${filters.period === "2026" ? bars(counts) : '<div class="empty">Selecione 2026 para consultar o status registrado.</div>'}<div class="toolbar"><button class="btn" data-page="1">Explorar inteligência ASG →</button></div></section></div><div class="grid"><section class="panel"><h2>Composição setorial</h2><p>Quantidade de fornecedores por categoria contratual</p>${bars(group(c, 2).slice(0, 7))}</section><section class="panel"><h2>Indicador em perspectiva</h2><p>${esc(a.find((i) => i.id === "IND-47")?.name || a[0]?.name || "Sem indicadores corporativos nesta seleção")}</p>${a.length ? trend(a.find((i) => i.id === "IND-47") || a[0]) : '<div class="empty">Os filtros de fornecedores não se aplicam aos indicadores corporativos.</div>'}</section></div><section class="panel full"><h2>Indicadores em acompanhamento</h2><p>Consulte os critérios, valores e a rastreabilidade de cada indicador.</p>${indicatorTable(a.filter((i) => i.status !== "Atende").slice(0, 6))}</section>`;
}
function intelligence() {
  if (!corporate()) return supplierDashboard();
  let a = inds();
  return `<div class="dimgrid">${["Ambiental", "Social", "Governança"]
    .map((d) => {
      let is = a.filter((i) => i.dim === d);
      return `<section class="dim"><span class="eyebrow">${d}</span><div class="score">${num(score(is, filters.period === "2025"))}<small style="font-size:13px"> / 100</small></div><p>${is.length} indicadores classificados</p>${bars(["Atende", "Atenção", "Crítico"].map((s) => [s, is.filter((i) => i.status === s).length]))}</section>`;
    })
    .join(
      "",
    )}</div><section class="panel full"><h2>Metodologia transparente</h2><p>Pontuação parcial = Σ(pontos × peso) ÷ Σ(pesos) dos indicadores disponíveis e classificados. Atende = 100; Atenção = 60; Crítico = 20, conforme os limites e a polaridade da planilha. Ausências são excluídas; sem dados, a dimensão é não calculável. Indicadores transversais aguardam validação e não compõem a pontuação. Não há ranking.</p><p>As notas por dimensão são uma extensão analítica do protótipo; não são uma certificação ASG. O indicador IND-37 e os scores dos fornecedores são valores originais sem metodologia individual informada.</p><div class="toolbar"><button class="btn" id="method">Configurar pesos</button></div>${indicatorTable(a)}</section>`;
}
function companies() {
  let c = cs();
  return `<section class="panel full"><h2>Organização principal</h2><p>${esc(params["Organização (fictícia)"])} · Energia e infraestrutura (conforme denominação) · Município e UF não informados</p><p>Os ${ind.length} indicadores pertencem à organização principal. As empresas abaixo são fornecedores, não unidades da organização.</p></section><section class="panel full"><h2>Fornecedores e contratos</h2><p>Selecione uma empresa para consultar seu perfil. Marque duas ou mais para comparação analítica.</p><div class="toolbar"><button class="btn" id="compare">Comparar selecionadas</button></div>${table(
    ["", "EMPRESA", "CATEGORIA", "UF", "VALOR ANUAL", "SCORE ORIGINAL"],
    c.map(
      (r) =>
        `<tr><td><input type="checkbox" class="compare" value="${esc(r[0])}" aria-label="Comparar ${esc(r[1])}"></td><td><a href="#" data-company="${esc(r[0])}">${esc(r[1])}</a><br><small class="muted">${esc(r[0])}</small></td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>R$ ${num(r[4])} mil</td><td>${filters.period === "2026" ? num(r[14]) : "Não informado"}</td></tr>`,
    ),
  )}</section>`;
}
function indicators() {
  return `<section class="panel full"><h2>Catálogo de indicadores</h2><p>Valores em suas unidades originais · clique para abrir os detalhes.</p><div class="toolbar"><input id="search" placeholder="Buscar nome ou código" value="${esc(search)}" aria-label="Buscar indicador"><button class="btn" id="searchbtn">Buscar</button></div>${indicatorTable(inds())}</section>`;
}
function crossings() {
  return `<section class="panel full"><h2>Explore relações entre variáveis</h2><p>Uma observação por fornecedor, no retrato contratual da base. O período 2025 não contém microdados de fornecedores.</p><div class="toolbar"><label>Eixo X <select id="x"><option value="4">Valor anual (R$ mil)</option><option value="14">Score ASG original (0–100)</option><option value="15">Não conformidades abertas</option></select></label><label>Eixo Y <select id="y"><option value="14">Score ASG original (0–100)</option><option value="15">Não conformidades abertas</option><option value="4">Valor anual (R$ mil)</option></select></label><button class="btn primary" id="cross">Gerar análise</button><button class="btn" id="savecross">Salvar análise</button></div><div id="crossresult"></div><h3>Análises salvas neste navegador</h3><div id="saved"></div><p>Sugestão: score ASG × não conformidades compartilha os mesmos contratos. Correlação não estabelece causalidade. Dois valores corporativos de períodos diferentes não sustentam inferência estatística.</p></section>`;
}
function history() {
  let a = inds();
  return `<section class="panel full"><h2>Comparação temporal</h2><p>2025 é o comparativo da planilha; 2026 corresponde ao terceiro trimestre acumulado. Não existem séries mensais ou trimestrais completas.</p><select id="hist">${a.map((i) => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join("")}</select><div id="histchart">${a[0] ? trend(a[0]) : "<p>Sem histórico para os filtros selecionados.</p>"}</div>${table(
    ["INDICADOR", "2025", "2026 · T3", "VARIAÇÃO RELATIVA"],
    a.map(
      (i) =>
        `<tr><td>${esc(i.name)}</td><td>${fmt(i, i.prev)}</td><td>${fmt(i, i.value)}</td><td>${typeof i.prev === "number" && i.prev !== 0 && typeof i.value === "number" ? num((i.value / i.prev - 1) * 100) + "%" : "Não calculável"}</td></tr>`,
    ),
  )}</section><section class="panel full"><h2>Versões importadas</h2><p>Histórico de importação separado dos períodos dos indicadores. As versões são preservadas neste navegador.</p>${versionTable()}</section>`;
}
function geography() {
  let c = cs();
  return `<div class="grid"><section class="panel"><h2>Distribuição territorial por UF</h2><p>A base informa a UF dos fornecedores, sem município, região ou coordenadas. Mapa pontual indisponível.</p>${bars(group(c, 3))}</section><section class="panel"><h2>Recorte Piauí</h2><p>${c.filter((r) => r[3] === "PI").length} fornecedores com UF = PI no recorte selecionado.</p>${table(
    ["FORNECEDOR", "CATEGORIA"],
    c
      .filter((r) => r[3] === "PI")
      .map((r) => `<tr><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`),
  )}<p>UF do fornecedor não indica localização dos projetos ou dos impactos ASG.</p></section></div>`;
}
function reports() {
  return `<section class="panel full"><span class="eyebrow">EXTRATO ASG</span><h2 style="margin-top:12px">Informações para acompanhamento</h2><p>O extrato respeita os filtros de empresa, setor, UF, dimensão e período. Inclui fonte, metodologia e data de geração.</p><div class="toolbar"><button class="btn primary" id="pdf">Gerar PDF / imprimir</button><button class="btn" id="excel">Exportar Excel</button></div><div id="report">${report()}</div></section>`;
}
function report() {
  let a = inds();
  return `<h2>Extrato ASG · ${esc(filters.company ? (filters.company === "aurora" ? params["Organização (fictícia)"] : contracts.find((r) => r[0] === filters.company)?.[1]) : "Visão coletiva")}</h2><p>Gerado em ${new Date().toLocaleString("pt-BR")} · Base fictícia · Período: ${filters.period === "2026" ? "2026 · T3 acumulado" : "2025 · comparativo"}<br>Setor: ${esc(filters.sector || "Todos")} · UF: ${esc(filters.uf || "Todas")} · Dimensão: ${esc(filters.dim || "Todas")}</p><p>Pontuação ASG parcial: ${num(score(a, filters.period === "2025"))} / 100. Média ponderada por status (100, 60 ou 20). Ausências e classificação pendente excluídas.</p>${a[0] ? trend(a[0]) : ""}${indicatorTable(a)}<h3>Fornecedores no recorte</h3>${table(
    ["EMPRESA", "UF", "VALOR ANUAL (R$ MIL)", "SCORE ORIGINAL"],
    cs().map(
      (r) =>
        `<tr><td>${esc(r[1])}</td><td>${esc(r[3])}</td><td>${filters.period === "2026" ? num(r[4]) : "Não informado"}</td><td>${filters.period === "2026" ? num(r[14]) : "Não informado"}</td></tr>`,
    ),
  )}<p>Fonte: ${esc(sessionStorage.getItem("asg-source") || "Painel_ASG_Compliance_Integridade.xlsx")}; abas Indicadores, Contratos_ASG e Parâmetros. Data-base: ${esc(params["Data-base"])}. Comparativos 2025 e 2026 exigem validação de abrangência. Valores e scores de fornecedores pertencem ao retrato 2026.</p>`;
}
function versionTable() {
  return table(
    ["IMPORTAÇÃO", "FONTE", "AÇÃO"],
    versions.map(
      (v, n) =>
        `<tr><td>${new Date(v.at).toLocaleString("pt-BR")}</td><td>${esc(v.name)}</td><td><button class="btn" data-version="${n}">Consultar versão</button></td></tr>`,
    ),
  );
}
function management() {
  return `<section class="panel full"><h2>Qualidade e rastreabilidade</h2><div class="quality">Base explicitamente fictícia. 1 organização principal; ${contracts.length} fornecedores, ${ind.length} indicadores corporativos. Identificadores duplicados: ${ind.length - new Set(ind.map((i) => i.id)).size} indicadores; ${contracts.length - new Set(contracts.map((r) => r[0])).size} contratos.</div><div class="quality">${ind.filter((i) => i.value == null).length} resultados atuais ausentes; ${ind.filter((i) => !i.r[23]).length} indicadores sem fonte; ${ind.filter((i) => i.dim === "Validar classificação").length} classificações ASG pendentes.</div><p>Municípios e coordenadas ausentes. Unidade monetária dos contratos: R$ mil; aportes e receita: R$ milhões. Não somar grandezas de unidades distintas. Fim da vigência contratual não é período de observação. Atualização da fonte não informada; data-base ${esc(params["Data-base"])}.</p><h3>Proveniência</h3><p>Resultados: coluna K de Indicadores; comparativo L; metas N; pesos T. A linha exata está nos detalhes de cada indicador. Classificação ASG: coluna AA da nova planilha. Dados originais e vínculos entre abas permanecem identificados. O protótipo lê valores armazenados e recalcula indicadores compatíveis na importação; não executa fórmulas Excel arbitrárias.</p></section><section class="panel full"><h2>Importar e validar dados</h2><p>Excel: mesmo modelo da planilha original. CSV: substituição do catálogo com 24 ou 27 colunas originais, na mesma ordem, cabeçalho na primeira linha e números em formato decimal; as outras entidades são preservadas. O CSV deve conter valores, sem fórmulas.</p>${$("#role").value === "Administrador" ? '<div class="filebox"><input type="file" id="file" accept=".xlsx,.csv"><div id="preview"></div></div>' : "<p>Seu perfil permite consulta. Solicite o perfil de administrador ao responsável.</p>"}<p>${window.investAuth.demo ? "Demonstração: importações e versões ficam somente nesta sessão do navegador. Não envie dados reais. O banco institucional não é acessado." : "Base e versões no banco protegido; importações exigem permissão de administrador. Preferências temporárias ficam nesta sessão."}</p><h3>Registro das atualizações</h3>${versionTable()}</section>`;
}
function render() {
  controls();
  $("#nav").innerHTML = pages
    .map(
      (n, i) =>
        `<button data-page="${i}" class="${i === page ? "active" : ""}"><b>${icons[i]}</b>${n}</button>`,
    )
    .join("");
  $("#heading").innerHTML =
    `<div><span class="eyebrow">VISÃO ESTRATÉGICA · ASG</span><h1>${pages[page]}</h1><p>Informação para acompanhar o desenvolvimento sustentável.</p></div><button class="btn primary" data-page="7">↗ Gerar extrato ASG</button>`;
  $("#app").innerHTML = [
    dashboard,
    intelligence,
    companies,
    indicators,
    crossings,
    history,
    geography,
    reports,
    management,
    competition,
    materiality,
  ][page]();
  bind();
  const corporateButton = $("#corporate-view");
  if (corporateButton) corporateButton.onclick = () => {
    filters = { company: "aurora", sector: "", uf: "", dim: "", period: "2026" };
    render();
  };
}
function modal(html) {
  $("#detail").innerHTML = html;
  $("#dialog").showModal();
}
function detail(id) {
  let i = ind.find((i) => i.id === id);
  modal(
    `<span class="eyebrow">${esc(i.id)} · ${esc(i.dim)}</span><h1>${esc(i.name)}</h1>${badge(i.status)}<p>Unidade: ${esc(i.unit)} · Polaridade: ${esc(i.r[12])}<br>Cálculo original: ${esc(i.r[5])} · A: ${esc(i.r[6])} = ${num(i.r[7], 3)} · B: ${esc(i.r[8])} = ${num(i.r[9], 3)}</p>${trend(i)}${table(["2025", "2026 · T3", "META", "LIMITE CRÍTICO"], [`<tr><td>${fmt(i, i.prev)}</td><td>${fmt(i, i.value)}</td><td>${fmt(i, i.target)}</td><td>${fmt(i, i.critical)}</td></tr>`])}<p>Mínimo observado: ${fmt(i, Math.min(...[i.prev, i.value].filter((x) => typeof x === "number")))} · Máximo: ${fmt(i, Math.max(...[i.prev, i.value].filter((x) => typeof x === "number")))}<br>Variação relativa: ${i.prev ? num((i.value / i.prev - 1) * 100) + "%" : "Não calculável"}</p><p>Fonte: ${esc(i.r[23])} · Indicadores!K${i.row}, L${i.row}<br>Responsável: ${esc(i.r[21])} · Frequência: ${esc(i.r[20])}<br>Referência original: ${esc(i.r[22])} · Data-base: ${esc(params["Data-base"])}. Última atualização específica: não informada.</p>`,
  );
}
function companyHtml(r) {
  let e = r[9] === "Sim" ? 100 : r[9] === "Não" ? 20 : null,
    s = r[8] === "Sim" ? 100 : r[8] === "Não" ? 20 : null,
    g = [6, 10, 11, 12]
      .map((k) => (r[k] === "Sim" ? 100 : r[k] === "Não" ? 20 : null))
      .filter((x) => x !== null);
  return `<div><h2>${esc(r[1])}</h2><p>${esc(r[2])} · ${esc(r[3])} · ${esc(r[0])}<br>Município não informado · Fim da vigência: ${esc(r[16])}</p><h3>Score ASG original: ${filters.period === "2026" ? num(r[14]) : "Não informado"}</h3><p>Score informado pela fonte; metodologia não documentada. Não equivale à pontuação corporativa.</p>${filters.period === "2026" ? `<p>Proxy contratual proposta (não certifica desempenho): Ambiental ${num(e)}; Social ${num(s)}; Governança ${num(g.length ? g.reduce((a, b) => a + b) / g.length : null)}. Sim = 100, Não = 20; ausências excluídas. Governança: média das cláusulas anticorrupção, auditoria, código e due diligence. ASG geral: ${num([e, s, ...(g.length ? [g.reduce((a, b) => a + b) / g.length] : [])].filter((x) => x !== null).reduce((a, b) => a + b, 0) / (2 + (g.length ? 1 : 0)))}.</p>` : "<p>Não há observações individuais em 2025.</p>"}${table(
    ["CRITÉRIO", "RESPOSTA"],
    raw.Contratos_ASG[3]
      .slice(6, 14)
      .map(
        (h, j) =>
          `<tr><td>${esc(h)}</td><td>${filters.period === "2026" ? esc(r[j + 6]) : "Não informado"}</td></tr>`,
      ),
  )}<p>Fonte: Contratos_ASG, contrato ${esc(r[0])}. Valor anual: ${filters.period === "2026" ? "R$ " + num(r[4]) + " mil" : "não informado"}. Não conformidades: ${filters.period === "2026" ? num(r[15]) : "não informado"}. Série histórica individual não disponível.</p></div>`;
}
function cross() {
  let x = +$("#x").value,
    y = +$("#y").value,
    c = filters.period === "2026" ? cs() : [],
    points = c.filter(
      (r) => typeof r[x] === "number" && typeof r[y] === "number",
    ),
    n = points.length,
    mx = points.reduce((a, r) => a + r[x], 0) / n,
    my = points.reduce((a, r) => a + r[y], 0) / n,
    cov = points.reduce((a, r) => a + (r[x] - mx) * (r[y] - my), 0),
    den = Math.sqrt(
      points.reduce((a, r) => a + (r[x] - mx) ** 2, 0) *
        points.reduce((a, r) => a + (r[y] - my) ** 2, 0),
    ),
    corr = den ? cov / den : null,
    maxX = Math.max(...points.map((r) => r[x]), 1),
    maxY = Math.max(...points.map((r) => r[y]), 1);
  $("#crossresult").innerHTML = points.length
    ? `<svg viewBox="0 0 650 235"><path d="M60 15V200H625" stroke="#cbdcd3" fill="none"/>${points.map((r) => `<circle cx="${65 + (r[x] / maxX) * 535}" cy="${195 - (r[y] / maxY) * 165}" r="5" fill="#16826a" opacity=".7"><title>${esc(r[1])}: X ${num(r[x])}, Y ${num(r[y])}</title></circle>`).join("")}<text x="65" y="225" font-size="11">0</text><text x="570" y="225" font-size="11">${num(maxX)}</text><text x="0" y="30" font-size="11">${num(maxY)}</text></svg><p>${n} pares válidos · Pearson: ${num(corr, 3)}${corr === null ? " (variância nula ou dados insuficientes)" : ""}. ${x === y ? "Mesma variável nos dois eixos; correlação trivial." : ""} Associação descritiva, sem inferência causal.</p>${table(
        ["FORNECEDOR", "X", "Y"],
        points.map(
          (r) =>
            `<tr><td>${esc(r[1])}</td><td>${num(r[x])}</td><td>${num(r[y])}</td></tr>`,
        ),
      )}`
    : "<p>Sem pares válidos no período selecionado.</p>";
}
function saved() {
  let a = JSON.parse(sessionStorage.getItem("asg-analyses") || "[]");
  $("#saved").innerHTML =
    a
      .map(
        (v, i) =>
          `<button class="btn" data-analysis="${i}">${esc(v.name)} · ${new Date(v.at).toLocaleDateString("pt-BR")}</button>`,
      )
      .join("") || "<p>Nenhuma análise salva.</p>";
  document.querySelectorAll("[data-analysis]").forEach(
    (b) =>
      (b.onclick = () => {
        let v = a[+b.dataset.analysis];
        filters = v.filters;
        render();
        $("#x").value = v.x;
        $("#y").value = v.y;
        cross();
      }),
  );
}
function exportExcel() {
  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Extrato ASG · base fictícia"],
      ["Gerado em", new Date().toLocaleString("pt-BR")],
      ["Período", filters.period],
      [
        "Fonte",
        sessionStorage.getItem("asg-source") ||
          "Painel_ASG_Compliance_Integridade.xlsx",
      ],
      [
        "Metodologia",
        "Média ponderada; Atende 100, Atenção 60, Crítico 20; ausências e classificações pendentes excluídas",
      ],
      ["Filtros", JSON.stringify(filters)],
      [
        "ID",
        "Indicador",
        "Dimensão",
        "Unidade",
        "Valor",
        "2025",
        "2026 T3",
        "Meta",
        "Peso",
        "Origem",
      ],
      ...inds().map((i) => [
        i.id,
        i.name,
        i.dim,
        i.unit,
        val(i),
        i.prev,
        i.value,
        i.target,
        weights[i.id] ?? i.weight,
        i.r[23],
      ]),
    ]),
    "Indicadores",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      raw.Contratos_ASG[3],
      ...cs().map((r) =>
        filters.period === "2026" ? r : r.map((v, j) => (j < 4 ? v : null)),
      ),
    ]),
    "Fornecedores",
  );
  XLSX.writeFile(wb, "Extrato_ASG.xlsx");
}
function bind() {
  document.querySelectorAll("[data-page]").forEach(
    (b) =>
      (b.onclick = () => {
        page = +b.dataset.page;
        search = "";
        render();
        window.scrollTo(0, 0);
      }),
  );
  document
    .querySelectorAll("[data-ind]")
    .forEach((b) => (b.onclick = () => detail(b.dataset.ind)));
  document.querySelectorAll("[data-company]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.preventDefault();
        modal(companyHtml(contracts.find((r) => r[0] === b.dataset.company)));
      }),
  );
  if ($("#searchbtn"))
    $("#searchbtn").onclick = () => {
      search = $("#search").value;
      render();
    };
  if ($("#search"))
    $("#search").onkeydown = (e) => {
      if (e.key === "Enter") $("#searchbtn").click();
    };
  if ($("#compare"))
    $("#compare").onclick = () => {
      let ids = [...document.querySelectorAll(".compare:checked")].map(
        (e) => e.value,
      );
      if (ids.length < 2) return alert("Selecione ao menos duas empresas.");
      modal(
        '<h1>Comparação analítica</h1><div class="comparison">' +
          contracts
            .filter((r) => ids.includes(r[0]))
            .map(companyHtml)
            .join("") +
          "</div>",
      );
    };
  if ($("#cross")) {
    cross();
    saved();
    $("#cross").onclick = cross;
    $("#savecross").onclick = () => {
      let a = JSON.parse(sessionStorage.getItem("asg-analyses") || "[]");
      a.push({
        name:
          $("#x").selectedOptions[0].text +
          " × " +
          $("#y").selectedOptions[0].text,
        x: $("#x").value,
        y: $("#y").value,
        filters: { ...filters },
        at: new Date().toISOString(),
      });
      try {
        sessionStorage.setItem("asg-analyses", JSON.stringify(a));
        saved();
      } catch {
        alert("Não foi possível salvar: armazenamento indisponível.");
      }
    };
  }
  if ($("#hist"))
    $("#hist").onchange = () =>
      ($("#histchart").innerHTML = trend(
        ind.find((i) => i.id === $("#hist").value),
      ));
  if ($("#excel")) $("#excel").onclick = exportExcel;
  if ($("#pdf")) $("#pdf").onclick = () => window.print();
  if ($("#file")) $("#file").onchange = importFile;
  if ($("#method"))
    $("#method").onclick = () => {
      modal(
        `<h1>Pesos da metodologia</h1><p>Pesos não negativos; zero exclui o indicador. Classificações transversais permanecem fora do cálculo. Alteração local com efeito imediato.</p>${
          $("#role").value === "Administrador"
            ? table(
                ["INDICADOR", "PESO"],
                ind.map(
                  (i) =>
                    `<tr><td>${esc(i.name)}</td><td><input type="number" min="0" max="100" step="0.1" data-weight="${esc(i.id)}" value="${weights[i.id] ?? i.weight}"></td></tr>`,
                ),
              ) +
              '<button class="btn primary" id="saveweights">Salvar pesos</button>'
            : "<p>Somente o Administrador simulado pode alterar pesos.</p>"
        }`,
      );
      if ($("#saveweights"))
        $("#saveweights").onclick = () => {
          let next = {};
          for (let el of document.querySelectorAll("[data-weight]")) {
            let n = Number(el.value);
            if (!Number.isFinite(n) || n < 0 || n > 100)
              return alert("Informe pesos entre 0 e 100.");
            next[el.dataset.weight] = n;
          }
          try {
            sessionStorage.setItem("asg-weights", JSON.stringify(next));
            weights = next;
            $("#dialog").close();
            render();
          } catch {
            alert("Não foi possível salvar os pesos.");
          }
        };
    };
  document.querySelectorAll("[data-version]").forEach(
    (b) =>
      (b.onclick = () => {
        let v = versions[+b.dataset.version];
        modal(
          `<h1>Versão de ${new Date(v.at).toLocaleString("pt-BR")}</h1><p>${esc(v.name)} · Consulta sem substituir a versão atual</p>${table(
            ["ID", "INDICADOR", "RESULTADO ARMAZENADO"],
            v.data.Indicadores.filter((r) => /^IND-/.test(r[0])).map(
              (r) =>
                `<tr><td>${esc(r[0])}</td><td>${esc(r[3])}</td><td>${num(r[10], 3)} ${esc(r[4])}</td></tr>`,
            ),
          )}`,
        );
      }),
  );
}
function recalc(d) {
  let p = d["Parâmetros"],
    c = d.Contratos_ASG.filter((r) => /^CT-/.test(r[0])),
    v = (d.Investidores || []).filter((r) => /^INV-/.test(r[0])),
    n = (d.Canal_Denuncias || []).filter((r) => /^DN-/.test(r[0])),
    risks = (d.Riscos_Integridade || []).filter((r) => /^RI-/.test(r[0])),
    date = p[5][2],
    days = (a, b) => Math.floor((new Date(a) - new Date(b)) / 86400000),
    sum = (rows, k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0),
    count = (rows, k, x) => rows.filter((r) => r[k] === x).length;
  n.forEach((r) => (r[8] = days(r[7] || date, r[1])));
  v.forEach((r) => {
    let a = new Date(r[10]),
      b = new Date(date);
    r[7] =
      a.getFullYear() === b.getFullYear() &&
      Math.floor(a.getMonth() / 3) === Math.floor(b.getMonth() / 3)
        ? "Sim"
        : "Não";
  });
  risks.forEach((r) => {
    r[5] = r[3] * r[4];
    r[7] = Math.round(r[5] * (1 - r[6]) * 10) / 10;
    r[8] =
      r[7] >= p[19][2]
        ? "Crítico"
        : r[7] >= p[18][2]
          ? "Alto"
          : r[7] >= p[17][2]
            ? "Médio"
            : "Baixo";
  });
  let input = {
    15: [
      n.filter((r) => r[9] === "Procedente" && r[10] !== "Nenhuma").length,
      count(n, 9, "Procedente"),
    ],
    34: [
      sum(
        c.filter((r) => r[7] === "Sim"),
        4,
      ),
      sum(c, 4),
    ],
    35: [
      c.filter((r) => r[5] === "Alto" && r[13] === "Sim").length,
      count(c, 5, "Alto"),
    ],
    36: [sum(c, 15), null],
    37: [c.reduce((s, r) => s + r[4] * r[14], 0), sum(c, 4)],
    39: [count(v, 6, "Sim"), v.length],
    40: [count(v, 7, "Sim"), v.length],
    41: [count(v, 8, "Sim"), v.length],
    43: [sum(v, 9), null],
    44: [
      sum(
        v.filter((r) => r[5] === "Sim"),
        3,
      ),
      sum(v, 3),
    ],
    53: [n.length, p[6][2]],
    54: [
      n.filter((r) => r[6] === "Concluída" && r[8] <= p[21][2]).length,
      count(n, 6, "Concluída"),
    ],
    55: [
      sum(
        n.filter((r) => r[6] === "Concluída"),
        8,
      ),
      count(n, 6, "Concluída"),
    ],
    56: [
      n.filter((r) => r[6] === "Em apuração" && r[8] > p[22][2]).length,
      count(n, 6, "Em apuração"),
    ],
    57: [
      n.filter((r) => r[6] === "Concluída" && r[11] === "Sim").length,
      count(n, 6, "Concluída"),
    ],
    59: [
      n.filter((r) => r[2] === "Corrupção/Suborno" && r[9] === "Procedente")
        .length,
      null,
    ],
    68: [
      risks.filter((r) => ["Alto", "Crítico"].includes(r[8]) && r[9] === "Sim")
        .length,
      risks.filter((r) => ["Alto", "Crítico"].includes(r[8])).length,
    ],
    69: [sum(risks, 7), risks.length],
  };
  for (let k = 27; k <= 33; k++) input[k] = [count(c, k - 21, "Sim"), c.length];
  d.Indicadores.filter((r) => /^IND-/.test(r[0])).forEach((r) => {
    let k = +r[0].slice(4);
    if (input[k]) {
      r[7] = input[k][0];
      r[9] = input[k][1];
    }
    if ([1, 2, 5].includes(k)) r[9] = p[8][2];
    if ([9, 10, 11, 14, 19, 60].includes(k)) r[9] = p[6][2];
    if (k === 46) r[9] = p[7][2];
    if (k === 48) r[9] = p[9][2];
    r[10] =
      r[5] === "A"
        ? r[7]
        : typeof r[7] === "number" && typeof r[9] === "number" && r[9] !== 0
          ? (r[7] / r[9]) *
            (r[5].includes("1.000.000")
              ? 1000000
              : r[5].includes("1.000")
                ? 1000
                : 1)
          : null;
    r[15] =
      r[10] == null
        ? "Não calculável"
        : r[12] === "Maior é melhor"
          ? r[10] >= r[13]
            ? "Atende"
            : r[10] >= r[14]
              ? "Atenção"
              : "Crítico"
          : r[10] <= r[13]
            ? "Atende"
            : r[10] <= r[14]
              ? "Atenção"
              : "Crítico";
    r[18] =
      r[15] === "Atende"
        ? 100
        : r[15] === "Atenção"
          ? 60
          : r[15] === "Crítico"
            ? 20
            : null;
  });
  return d;
}
async function importFile(e) {
  try {
    let file = e.target.files[0];
    if (!file) return;
    let wb = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: true,
      }),
      d = {};
    for (let name of wb.SheetNames)
      d[name] = XLSX.utils
        .sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true })
        .map((row) =>
          row.map((v) =>
            v instanceof Date ? v.toISOString().slice(0, 10) : v,
          ),
        );
    let csv = file.name.toLowerCase().endsWith(".csv");
    if (csv) {
      let rows = d[wb.SheetNames[0]];
      if (
        rows[0][0] !== "ID" ||
        rows[0][3] !== "Indicador" ||
        ![24, 27].includes(rows[0].length)
      )
        throw Error(
          "CSV deve conter o cabeçalho original com 24 ou 27 colunas.",
        );
      d = JSON.parse(JSON.stringify(raw));
      d.Indicadores = [[], [], [], rows[0], ...rows.slice(1)];
    }
    for (let k of ["Indicadores", "Contratos_ASG", "Parâmetros"])
      if (!d[k]) throw Error("Aba obrigatória ausente: " + k);
    let rows = d.Indicadores.filter((r) => /^IND-\d+$/.test(r[0]));
    if (!rows.length) throw Error("Nenhum indicador válido.");
    if (new Set(rows.map((r) => r[0])).size !== rows.length)
      throw Error("IDs de indicadores duplicados.");
    let ct = d.Contratos_ASG.filter((r) => /^CT-/.test(r[0]));
    if (new Set(ct.map((r) => r[0])).size !== ct.length)
      throw Error("Contratos duplicados.");
    for (let r of rows) {
      if (
        !r[3] ||
        !["A", "A ÷ B", "A ÷ B × 1.000", "A ÷ B × 1.000.000"].includes(r[5]) ||
        !["Maior é melhor", "Menor é melhor"].includes(r[12])
      )
        throw Error("Cálculo ou polaridade inválida em " + r[0]);
      for (let k of [7, 9, 10, 11, 13, 14, 19])
        if (r[k] != null && (typeof r[k] !== "number" || !isFinite(r[k])))
          throw Error("Valor não numérico em " + r[0] + ", coluna " + (k + 1));
      if (r[13] == null || r[14] == null || r[19] == null || r[19] < 0)
        throw Error("Meta, limite e peso obrigatórios em " + r[0]);
    }
    for (let r of ct) {
      if (
        typeof r[4] !== "number" ||
        r[4] < 0 ||
        typeof r[14] !== "number" ||
        r[14] < 0 ||
        r[14] > 100
      )
        throw Error("Valor ou score contratual inválido: " + r[0]);
      for (let k = 6; k <= 13; k++)
        if (!["Sim", "Não", null].includes(r[k]))
          throw Error("Resposta contratual inválida: " + r[0]);
    }
    if (!csv) {
      for (let k of ["Investidores", "Canal_Denuncias", "Riscos_Integridade"])
        if (!d[k]) throw Error("Aba necessária ao recálculo ausente: " + k);
      d = recalc(d);
    } else
      rows.forEach((r) => {
        r[15] =
          r[10] == null
            ? "Não calculável"
            : r[12] === "Maior é melhor"
              ? r[10] >= r[13]
                ? "Atende"
                : r[10] >= r[14]
                  ? "Atenção"
                  : "Crítico"
              : r[10] <= r[13]
                ? "Atende"
                : r[10] <= r[14]
                  ? "Atenção"
                  : "Crítico";
      });
    pending = { data: d, name: file.name };
    $("#preview").innerHTML =
      `<h3>Prévia validada · ${esc(file.name)}</h3><p>${rows.length} indicadores; ${ct.length} contratos. ${csv ? "Valores do CSV; entidades auxiliares preservadas." : "Recálculo das razões e vínculos conhecidos concluído."} A confirmação preservará a versão anterior.</p>${table(
        ["ID", "INDICADOR", "RESULTADO"],
        d.Indicadores.filter((r) => /^IND-/.test(r[0]))
          .slice(0, 5)
          .map(
            (r) =>
              `<tr><td>${esc(r[0])}</td><td>${esc(r[3])}</td><td>${num(r[10], 3)}</td></tr>`,
          ),
      )}<button class="btn primary" id="confirmimport">Confirmar atualização</button><button class="btn" id="cancelimport">Cancelar</button>`;
    $("#cancelimport").onclick = () => {
      pending = null;
      $("#preview").innerHTML = "Importação cancelada.";
    };
    $("#confirmimport").onclick = async () => {
      let next = [
        ...versions,
        {
          at: new Date().toISOString(),
          name: sessionStorage.getItem("asg-source") || "Base inicial",
          data: raw,
        },
      ];
      try {
        await window.investAuth.saveDataset(pending.data, pending.name);
        let snapshot = JSON.stringify({
          data: pending.data,
          versions: next,
          source: pending.name,
        });
        sessionStorage.setItem("asg-state", snapshot);
        sessionStorage.setItem("asg-source", pending.name);
        raw = pending.data;
        versions = next;
        pending = null;
        model();
        filters = { company: "", sector: "", uf: "", dim: "", period: "2026" };
        render();
        alert("Base atualizada. A versão anterior foi preservada.");
      } catch {
        alert(
          window.investAuth.demo
            ? "Não foi possível salvar nesta sessão. Use somente a planilha fictícia e verifique o armazenamento do navegador."
            : "Não foi possível salvar a importação no servidor. Verifique sua permissão e conexão.",
        );
      }
    };
  } catch (err) {
    pending = null;
    $("#preview").innerHTML =
      '<p class="quality">Importação bloqueada: ' + esc(err.message) + "</p>";
  }
}

const roleName = {
  admin: "Administrador",
  analyst: "Analista",
  viewer: "Visualizador",
};
$("#role").value = roleName[window.investAuth.profile.role] || "Visualizador";
$("#role").disabled = true;
try {
  raw = window.investAuth.datasets[0].payload;
  versions = window.investAuth.datasets
    .slice(1)
    .map((v) => ({ at: v.created_at, name: v.source_name, data: v.payload }));
  sessionStorage.setItem(
    "asg-source",
    window.investAuth.datasets[0].source_name,
  );
  model();
  render();
} catch (e) {
  $("#app").textContent =
    "Não foi possível carregar os dados protegidos: " + e.message;
}

// Ranking: o empate mantém a mesma colocação. Ordem alfabética é só apresentação.
function rankCompanies(rows) {
  const sorted = rows
    .filter((r) => typeof r[14] === "number" && Number.isFinite(r[14]))
    .slice()
    .sort(
      (a, b) =>
        b[14] - a[14] || String(a[1]).localeCompare(String(b[1]), "pt-BR"),
    );
  return sorted
    .map((row, index) => ({
      row,
      rank: index && row[14] === sorted[index - 1][14] ? null : index + 1,
    }))
    .map((item, index, list) => {
      if (item.rank === null) {
        let n = index - 1;
        while (list[n].rank === null) n--;
        item.rank = list[n].rank;
      }
      return item;
    });
}
function growthFor(row, datasets, date) {
  const previous = datasets
    .filter((v) => v.reference_date < date)
    .slice()
    .sort((a, b) => b.reference_date.localeCompare(a.reference_date));
  for (const snapshot of previous) {
    const old = snapshot.payload.Contratos_ASG?.find((r) => r[0] === row[0]);
    if (old && typeof old[14] === "number")
      return {
        points: row[14] - old[14],
        relative: old[14] === 0 ? null : (row[14] / old[14] - 1) * 100,
        date: snapshot.reference_date,
      };
  }
  return null;
}
function competition() {
  if (filters.period !== "2026" || filters.dim)
    return '<section class="panel full"><h2>Competição ASG</h2><p>A base possui apenas o score geral atual dos fornecedores. Limpe o filtro de dimensão e selecione 2026 para consultar. Não há notas individuais E/S/G nem ranking de 2025 na fonte.</p></section>';
  const ranks = rankCompanies(cs()),
    current = String(params["Data-base"]).slice(0, 10);
  const classes = new Map(
    (raw.Comparativo_Empresas || [])
      .filter((r) => /^CT-/.test(r[0]))
      .map((r) => [r[0], r[6]]),
  );
  return `<section class="panel full"><span class="eyebrow">COMPETIÇÃO ENTRE EMPRESAS</span><h2 style="margin-top:12px">Desempenho atual e evolução ASG</h2><p>Ranking pelo score geral original da planilha, de 0 a 100. Empates recebem a mesma colocação; valores ausentes ficam sem colocação. Classificação informada pela aba Comparativo_Empresas. A metodologia de formação do score original não é detalhada na fonte.</p>${table(
    [
      "POSIÇÃO",
      "EMPRESA",
      "SCORE ATUAL",
      "CLASSIFICAÇÃO",
      "EVOLUÇÃO",
      "BASE ANTERIOR",
    ],
    ranks.map(({ row: r, rank }) => {
      let g = growthFor(r, window.investAuth.datasets, current);
      return `<tr><td><b>${rank}º</b></td><td><a href="#" data-company="${esc(r[0])}">${esc(r[1])}</a><br><small>${esc(r[2])}</small></td><td>${num(r[14])} / 100</td><td>${esc(classes.get(r[0]) || "Não informada")}</td><td>${g ? (g.points > 0 ? "+" : "") + num(g.points) + " pontos" + (g.relative !== null ? " (" + num(g.relative) + "%)" : "") : "Histórico insuficiente"}</td><td>${g ? esc(g.date) : "Sem período anterior por empresa"}</td></tr>`;
    }),
  )}<p>Dados ausentes: ${cs().length - ranks.length} fornecedores sem score. Datas de importação não representam crescimento. Comparações futuras exigem a mesma metodologia e datas-base distintas; a variação numérica não comprova impacto ambiental ou social.</p></section>`;
}
function materiality() {
  const rows = (raw.Matriz_Materialidade || []).filter((r) =>
    /^TM-/.test(r[0]),
  );
  const filtered = rows.filter(
    (r) =>
      !filters.dim ||
      {
        "Ambiental (E)": "Ambiental",
        "Social (S)": "Social",
        "Governança (G)": "Governança",
      }[r[8]] === filters.dim,
  );
  return `<section class="panel full"><h2>Matriz de materialidade</h2><p>Temas corporativos: relevância para stakeholders × impacto no negócio, em escala de 1 a 5. Não são pontuações de fornecedores. A classificação de prioridade é a informada na fonte.</p><svg viewBox="0 0 650 260" role="img" aria-label="Matriz de materialidade"><path d="M65 20V215H615" fill="none" stroke="#b5cfc1"/>${filtered.map((r) => `<circle cx="${65 + (r[5] / 5) * 535}" cy="${215 - (r[4] / 5) * 185}" r="7" fill="${r[8] === "Ambiental (E)" ? "#1e8c66" : r[8] === "Social (S)" ? "#b78d38" : "#39748a"}"><title>${esc(r[1])}: impacto ${num(r[5])}; relevância ${num(r[4])}</title></circle>`).join("")}<text x="240" y="250" font-size="12">Impacto no negócio (1–5)</text><text x="10" y="20" font-size="11">Relevância (1–5)</text></svg>${table(
    ["TEMA", "PILAR", "STAKEHOLDERS", "NEGÓCIO", "PRIORIDADE", "GESTÃO"],
    filtered.map(
      (r) =>
        `<tr><td>${esc(r[1])}</td><td>${esc(r[8])}</td><td>${num(r[4])}</td><td>${num(r[5])}</td><td>${esc(r[6])}</td><td>${esc(r[7])}</td></tr>`,
    ),
  )}</section>`;
}
