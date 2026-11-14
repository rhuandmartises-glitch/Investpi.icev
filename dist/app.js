function readSession(key, fallback) {
  try { const value=JSON.parse(sessionStorage.getItem(key)||"null"); return value && typeof value === "object" && Array.isArray(value)===Array.isArray(fallback) ? value : fallback; }
  catch { return fallback; }
}
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
    "Diagnóstico e evolução ASG",
    "Matriz de materialidade",
  ],
  icons = ["▦", "◈", "▤", "◫", "⇄", "◷", "◎", "▥", "⚙", "↗", "◉"];
let raw,
  ind,
  contracts,
  params,
  page = 0,
  filters = { company: "", sector: "", uf: "", dim: "", period: "current", city: "", indicator: "" },
  search = "",
  versions = [],
  weights = readSession("asg-weights",{}),
  pending = null;
let activeDatasetId = null;
let historyIndicator = "";
let historyMonth = "all";
let extractRange = "active";
let extractMonth = "";
let extractAnchor = "";
let mapUF = "";

function latestDataset() {
  return ASG.snapshots(window.investAuth.datasets).at(-1);
}

function monthName(month) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(month + "-01T00:00:00Z"));
}

function monthOptions(selected) {
  const months = [...new Set(ASG.snapshots(window.investAuth.datasets)
    .filter(dataset => sameOrganization(dataset.payload))
    .map(dataset => dataset.reference_date.slice(0, 7)))].reverse();
  return months.map(month => `<option value="${month}" ${month === selected ? "selected" : ""}>${esc(monthName(month))}</option>`).join("");
}

function periodDatasets(range, month, reference, datasets = window.investAuth.datasets) {
  const snapshots = ASG.snapshots(datasets);
  if (range === "all") return snapshots;
  if (range === "month") return snapshots.filter(dataset => dataset.reference_date.startsWith(month + "-"));
  const months = { quarter: 3, year: 12, threeYears: 36 }[range];
  if (!months) return [];
  const [year, monthNumber] = reference.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - months, 1)).toISOString().slice(0, 10);
  return snapshots.filter(dataset => dataset.reference_date >= start && dataset.reference_date <= reference);
}

function normalizedSearch(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();
}

function searchField(id, placeholder, label) {
  return `<input type="search" data-search-select="${id}" placeholder="${placeholder}" aria-label="${label}"><small class="choice-feedback" role="status"></small>`;
}

function bindSelectSearch() {
  document.querySelectorAll("[data-search-select]").forEach(input => {
    const select = $("#" + input.dataset.searchSelect);
    const original = Array.from(select.options);
    const feedback = input.nextElementSibling;
    let matches = original;
    input.oninput = () => {
      const query = normalizedSearch(input.value);
      const selected = Array.from(select.selectedOptions, option => option.value);
      matches = original.filter(option => normalizedSearch(option.text).includes(query));
      const visible = query ? original.filter(option => matches.includes(option) || selected.includes(option.value)) : original;
      select.replaceChildren(...visible);
      for (const option of visible) option.selected = selected.includes(option.value);
      feedback.textContent = query ? (matches.length ? `${matches.length} opções encontradas` : "Nenhuma opção encontrada") : "";
    };
    input.onkeydown = event => {
      if (event.key !== "Enter" && event.key !== "ArrowDown") return;
      event.preventDefault();
      if (event.key === "Enter" && !select.multiple && normalizedSearch(input.value) && matches.length === 1) {
        select.value = matches[0].value;
        select.dispatchEvent(new Event("change", {bubbles: true}));
        return;
      }
      select.focus();
    };
  });
}
let analysis = { mode: "suppliers", x: "4", y: "14", indicators: [] };
function model() {
  params = ASG.parameters(raw);
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
      status: ASG.status(r),
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
  const available = (ignore) => contracts.filter(r =>
    (ignore === "company" || !filters.company || r[0] === filters.company) &&
    (ignore === "sector" || !filters.sector || r[2] === filters.sector) &&
    (ignore === "uf" || !filters.uf || r[3] === filters.uf));
  const companies = available("company");
  const companyOptions = companies.map(r => `<option value="${esc(r[0])}" ${filters.company === r[0] ? "selected" : ""}>${esc(r[1])}</option>`).join("");
  const latest = latestDataset();
  const label = ASG.parameters(latest.payload)["Período de referência"];
  const past = ASG.snapshots(window.investAuth.datasets).filter(d=>d.id!==latest.id).reverse();
  $("#filters").innerHTML = `<div class="searchable-filter">${searchField("filter-company", "Digite parte do nome", "Buscar empresa") }<label>Empresa / entidade<select id="filter-company" data-filter="company"><option value="">Visão coletiva</option><option value="aurora" ${filters.company === "aurora" ? "selected" : ""}>${esc(params["Organização (fictícia)"])}</option>${companyOptions}${filters.company && filters.company !== "aurora" && !companies.some(r=>r[0]===filters.company) ? `<option value="${esc(filters.company)}" selected>Seleção sem correspondência (${esc(filters.company)})</option>` : ""}</select></label></div>
    <div class="searchable-filter">${searchField("filter-sector", "Digite parte do setor", "Buscar setor")}<label>Setor do fornecedor<select id="filter-sector" data-filter="sector">${options([...available("sector").map(r=>r[2]),filters.sector],filters.sector)}</select></label></div>
    <label>UF do fornecedor<select data-filter="uf">${options([...available("uf").map(r=>r[3]),filters.uf],filters.uf)}</select></label>
    <label>Cidade<select disabled aria-describedby="city-help"><option>Não informada na base</option></select></label>
    <label>Dimensão<select data-filter="dim">${options(["Ambiental","Social","Governança","Validar classificação"],filters.dim)}</select></label>
    <div class="searchable-filter">${searchField("filter-indicator", "Digite nome ou código", "Buscar opção de indicador")}<label>Indicador corporativo<select id="filter-indicator" data-filter="indicator"><option value="">Todos</option>${ind.filter(i=>!filters.dim || i.dim===filters.dim || i.id===filters.indicator).map(i=>`<option value="${esc(i.id)}" ${filters.indicator===i.id ? "selected" : ""}>${esc(i.id+" · "+i.name)}</option>`).join("")}</select></label></div>
    <label>Período<select data-filter="period"><option value="current" ${filters.period==="current" && activeDatasetId===latest.id?"selected":""}>${esc(label)} · versão mais recente</option>${past.map(d=>`<option value="snapshot:${esc(d.id)}" ${filters.period==="current" && activeDatasetId===d.id?"selected":""}>${esc(d.reference_date+" · "+d.source_name)}</option>`).join("")}<option value="previous" ${filters.period==="previous"?"selected":""}>Comparativo da fonte · abrangência não informada</option></select></label>
    <button class="btn" id="clear">Limpar</button><small id="city-help">A fonte não informa municípios. Filtros de fornecedor não atribuem indicadores corporativos a empresas individuais.${search ? " Busca de indicador ativa: "+esc(search)+". Use Limpar para remover." : ""}</small>`;
  document.querySelectorAll("[data-filter]").forEach(e => e.onchange = () => {
    if(e.dataset.filter==="period" && e.value!=="previous") {
      const id=e.value==="current"?latest.id:e.value.slice("snapshot:".length);
      const dataset=window.investAuth.datasets.find(d=>d.id===id);
      if(!dataset)return;
      if(activeDatasetId!==dataset.id){weights={};try{sessionStorage.removeItem("asg-weights");sessionStorage.removeItem("asg-weight-context");}catch{}}
      raw=dataset.payload;activeDatasetId=dataset.id;filters.period="current";
      try{sessionStorage.setItem("asg-source",dataset.source_name);}catch{}
      model();
    } else filters[e.dataset.filter]=e.value;
    if (e.dataset.filter === "period") {
      historyMonth = "all";
      extractRange = "active";
      extractAnchor = "";
    }
    mapUF = "";
    render();
    if (e.id) document.getElementById(e.id)?.focus();
  });
  $("#clear").onclick = () => {
    filters={company:"",sector:"",uf:"",city:"",dim:"",indicator:"",period:"current"};
    search="";
    if (activeDatasetId !== latest.id) weights = {};
    raw = latest.payload; activeDatasetId = latest.id; model();
    historyMonth = "all"; extractRange = "active"; extractMonth = ""; extractAnchor = ""; mapUF = "";
    try { sessionStorage.setItem("asg-source", latest.source_name); } catch {}
    render();
  };
}

function cs(includeUnavailable = false) {
  return ASG.suppliers(raw, {...filters,search}, includeUnavailable);
}

function corporate() { return ASG.corporate(filters); }

function inds() {
  const ids = new Set(ASG.indicators(raw,filters,search).map(r=>r[0]));
  return ind.filter(i=>ids.has(i.id));
}

function val(i, period = filters.period) {
  return period === "previous" ? i.prev : i.value;
}
function fmt(i, v) {
  return v == null
    ? "Não informado"
    : i.unit === "%"
      ? num(v * 100) + "%"
      : num(v, 2);
}
function score(items, old = false) {
  // A fonte não fornece metas, pesos e limites históricos específicos.
  return old ? null : ASG.score(items, params, weights);
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
        `<div class="barrow"><span>${esc(k)}</span><div class="bar" role="img" aria-label="${esc(k)}: ${num(v)}"><i style="width:${(v / max) * 100}%"></i></div><b>${num(v)}</b></div>`,
    )
    .join("");
}
function group(rows, col) {
  const counts=new Map();
  rows.forEach(r=>counts.set(r[col]??"Não informado",(counts.get(r[col]??"Não informado")||0)+1));
  return [...counts].sort((a,b)=>b[1]-a[1]);
}

function table(head, rows) {
  return `<div class="tablewrap"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${head.length}" class="empty">Sem dados para esta seleção.</td></tr>`}</tbody></table></div>`;
}
function trend(i) {
  if (!i) return '<p>Histórico insuficiente para esta seleção.</p>';
  return `<div class="quality">Comparativo da fonte: <b>${fmt(i,i.prev)}</b> · Retrato atual (${esc(params["Data-base"])}): <b>${fmt(i,i.value)}</b> · Unidade: ${esc(i.unit)}.</div><p>A abrangência do comparativo não foi especificada. Não é possível calcular crescimento ou conectar estes valores como uma série temporal equivalente.</p>`;
}

function indicatorTable(a) {
  return table(
    ["INDICADOR", "DIMENSÃO", "RESULTADO", "META", "STATUS"],
    a.map(
      (i) =>
        `<tr class="clickable" tabindex="0" role="button" data-ind="${esc(i.id)}"><td><small class="muted">${esc(i.id)}</small><br>${esc(i.name)}</td><td>${esc(i.dim)}</td><td><b>${fmt(i, val(i))}</b></td><td>${filters.period === "current" ? fmt(i, i.target) : "Meta histórica não informada"}</td><td>${filters.period === "current" ? badge(i.status) : badge("Comparativo")}</td></tr>`,
    ),
  );
}
function supplierDashboard() {
  const rows = cs(true);
  const intro = `<section class="panel full"><h2>${filters.company ? "Painel da empresa selecionada" : "Painel dos fornecedores"}</h2><p>Os indicadores corporativos pertencem a ${esc(params["Organização (fictícia)"])}. Para os fornecedores, a planilha informa score ASG geral, contratos, cláusulas e verificações de integridade; não há notas individuais por dimensão E/S/G.</p><div class="toolbar"><button class="btn" data-page="9">Ver diagnóstico ASG →</button><button class="btn" id="corporate-view">Ver organização principal →</button></div></section>`;
  if (!rows.length) return intro + '<section class="panel full"><h2>Nenhuma empresa neste recorte</h2><p>Os filtros ativos não encontram observações compatíveis de fornecedores. Use Limpar para escolher novamente.</p></section>';
  if (filters.period !== "current") return intro + '<section class="panel full"><h2>Sem dados de fornecedores no comparativo</h2><p>Selecione o período atual para consultar os dados individuais. O comparativo da fonte existe apenas para os indicadores corporativos.</p></section>';
  if (filters.dim || filters.indicator) return intro + '<section class="panel full"><h2>Score geral disponível</h2><p>Selecione Todos nos filtros Dimensão e Indicador para consultar os fornecedores. A fonte não informa scores separados de Ambiental, Social e Governança por empresa.</p></section>';
  const classes = new Map((raw.Comparativo_Empresas || []).filter(r => /^CT-/.test(r[0])).map(r => [r[0], r[6]]));
  const r = rows.length === 1 ? rows[0] : null;
  const valid = rows.filter(r => typeof r[14] === "number" && Number.isFinite(r[14]));
  const average = valid.length ? valid.reduce((sum, r) => sum + r[14], 0) / valid.length : null;
  return intro + `<div class="cards">${card("Fornecedores selecionados", rows.length, "Registros identificados pelo contrato")}${card(r ? "Score ASG da empresa" : "Score ASG médio dos fornecedores", num(r ? r[14] : average), "0–100 · score geral original da planilha")}${card(r ? "Classificação informada" : "Fornecedores com score", r ? esc(classes.get(r[0]) || "Não informada") : valid.length, "Diagnóstico individual · sem classificação entre empresas")}${card("Valor anual contratado", "R$ " + num(rows.reduce((sum, r) => sum + r[4], 0) / 1000, 2) + " mi", "Valor contratual · não representa receita")}</div><section class="panel full"><h2>Dados dos fornecedores selecionados</h2>${table(["EMPRESA", "CATEGORIA / UF", "SCORE ASG", "CLASSIFICAÇÃO", "RISCO CONTRATUAL", "NÃO CONFORMIDADES"], rows.map(r => `<tr><td><a href="#" data-company="${esc(r[0])}">${esc(r[1])}</a></td><td>${esc(r[2])} · ${esc(r[3])}</td><td>${num(r[14])} / 100</td><td>${esc(classes.get(r[0]) || "Não informada")}</td><td>${esc(r[5])}</td><td>${num(r[15])}</td></tr>`))}<p>Fonte: Contratos_ASG e Comparativo_Empresas · data-base ${esc(params["Data-base"])}. O score geral e o risco contratual são medidas distintas.</p></section>${r ? `<section class="panel full"><h2>Cláusulas e verificações · ${esc(r[1])}</h2>${table(["CRITÉRIO", "RESPOSTA NA PLANILHA"], raw.Contratos_ASG[3].slice(6,14).map((h,j) => `<tr><td>${esc(h)}</td><td>${esc(r[j+6])}</td></tr>`))}<p>Contrato ${esc(r[0])} · fim da vigência: ${esc(r[16])}. As respostas contratuais não constituem notas por dimensão ASG.</p></section>` : ""}<section class="panel full"><h2>Evolução da empresa</h2><p>Histórico insuficiente para calcular crescimento: a planilha contém apenas um período por fornecedor. Consulte o diagnóstico para acompanhar cada empresa, sem ranking.</p></section>`;
}
function dashboard() {
  if (!corporate()) return supplierDashboard();
  let a = inds(),
    c = cs(),
    counts = ["Atende", "Atenção", "Crítico"].map((s) => [
      s,
      a.filter((i) => i.status === s).length,
    ]);
  return `<div class="cards">${card("Registros no recorte", corporate() ? 1 + c.length : c.length, "Organização principal + registros contratuais filtrados")}${card("Indicadores corporativos", a.length, "Catálogo com origem e critérios")}${card("Pontuação ASG parcial", num(score(a, filters.period === "previous")), "/ 100 · dimensões classificadas")}${card("Valor anual contratado", filters.period === "current" ? "R$ " + num(c.reduce((s, r) => s + r[4], 0) / 1000, 2) + " mi" : "Não disponível", "Fornecedores · não representa receita")}</div><div class="grid"><section class="panel"><h2>Panorama das dimensões ASG</h2><p>Indicadores corporativos por classificação analítica</p>${bars(["Ambiental", "Social", "Governança", "Validar classificação"].map((d) => [d, a.filter((i) => i.dim === d).length]))}<small class="muted">Classificação informada na coluna AA da planilha atual; os eixos originais foram preservados.</small></section><section class="panel"><h2>Acompanhamento das metas</h2><p>Posição corporativa · ${filters.period === "current" ? esc(params["Data-base"]) : "status histórico indisponível"}</p>${filters.period === "current" ? bars(counts) : '<div class="empty">Selecione o período atual para consultar o status registrado.</div>'}<div class="toolbar"><button class="btn" data-page="1">Explorar inteligência ASG →</button></div></section></div><div class="grid"><section class="panel"><h2>Composição setorial</h2><p>Quantidade de fornecedores por categoria contratual</p>${bars(group(c, 2))}</section><section class="panel"><h2>Indicador em perspectiva</h2><p>${esc(a.find((i) => i.id === "IND-47")?.name || a[0]?.name || "Sem indicadores corporativos nesta seleção")}</p>${a.length ? trend(a.find((i) => i.id === "IND-47") || a[0]) : '<div class="empty">Sem indicadores corporativos para o recorte selecionado.</div>'}</section></div><section class="panel full"><h2>Indicadores em acompanhamento</h2><p>Consulte os critérios, valores e a rastreabilidade de cada indicador.</p>${indicatorTable(a.filter((i) => i.status !== "Atende").slice(0, 6))}</section>`;
}
function intelligence() {
  if (!corporate()) return supplierDashboard();
  let a = inds();
  return `<div class="dimgrid">${["Ambiental", "Social", "Governança"]
    .map((d) => {
      let is = a.filter((i) => i.dim === d);
      return `<section class="dim"><span class="eyebrow">${d}</span><div class="score">${num(score(is, filters.period === "previous"))}<small style="font-size:13px"> / 100</small></div><p>${is.length} indicadores classificados</p>${filters.period === "current" ? bars(["Atende", "Atenção", "Crítico"].map((s) => [s, is.filter((i) => i.status === s).length])) : "<p>Sem metas e pesos históricos: pontuação não calculável.</p>"}</section>`;
    })
    .join(
      "",
    )}</div><section class="panel full"><h2>Metodologia transparente</h2><p>Pontuação parcial = Σ(pontos × peso) ÷ Σ(pesos) dos indicadores disponíveis e classificados. Pontos por status informados em Parâmetros: Atende = ${num(params["Atende"])}; Atenção = ${num(params["Atenção"])}; Crítico = ${num(params["Crítico"])}. Limites e polaridade são individuais por indicador. Ausências são excluídas; sem dados, a dimensão é não calculável. Indicadores transversais aguardam validação e não compõem a pontuação. Os scores não geram ranking entre empresas.</p><p>As notas por dimensão são uma extensão analítica do protótipo; não são uma certificação ASG. O indicador IND-37 e os scores dos fornecedores são valores originais sem metodologia individual informada.</p><div class="toolbar"><button class="btn" id="method">Configurar pesos</button></div>${indicatorTable(a)}</section>`;
}
function companies() {
  let c = cs();
  return `<section class="panel full"><h2>Contexto da base</h2><p>${esc(params["Organização (fictícia)"])} · Energia e infraestrutura (conforme denominação) · Município e UF não informados</p><p>Os ${ind.length} indicadores pertencem à organização principal. As empresas abaixo são fornecedores, não unidades da organização.</p></section><section class="panel full"><h2>Fornecedores e contratos</h2><p>Selecione uma empresa para consultar seu perfil. Marque duas ou mais para comparação analítica.</p><div class="toolbar"><button class="btn" id="compare">Comparar selecionadas</button></div>${table(
    ["", "EMPRESA", "CATEGORIA", "UF", "VALOR ANUAL", "SCORE ORIGINAL"],
    c.map(
      (r) =>
        `<tr><td><input type="checkbox" class="compare" value="${esc(r[0])}" aria-label="Comparar ${esc(r[1])}"></td><td><a href="#" data-company="${esc(r[0])}">${esc(r[1])}</a><br><small class="muted">${esc(r[0])}</small></td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>R$ ${num(r[4])} mil</td><td>${filters.period === "current" ? num(r[14]) : "Não informado"}</td></tr>`,
    ),
  )}</section>`;
}
function indicators() {
  return `<section class="panel full"><h2>Catálogo de indicadores</h2><p>Valores em suas unidades originais · clique para abrir os detalhes.</p><div class="toolbar"><input id="search" placeholder="Buscar nome ou código" value="${esc(search)}" aria-label="Buscar indicador"><button class="btn" id="searchbtn">Buscar</button></div>${indicatorTable(inds())}</section>`;
}
function crossings() {
  return `<section class="panel full"><h2>Relações entre variáveis</h2><label>Origem da análise<select id="analysis-mode"><option value="suppliers" ${analysis.mode==="suppliers"?"selected":""}>Variáveis do mesmo fornecedor</option><option value="corporate" ${analysis.mode==="corporate"?"selected":""}>Indicadores corporativos E/S/G e econômicos</option></select></label><p>Todos os resultados respeitam o recorte ativo. Observações corporativas e de fornecedores são populações distintas.</p>${analysis.mode==="suppliers" ? `<div class="toolbar"><label>Eixo X<select id="x">${[[4,"Valor anual (R$ mil)"],[14,"Score ASG (0–100)"],[15,"Não conformidades (nº)"]].map(([v,t])=>`<option value="${v}" ${analysis.x===String(v)?"selected":""}>${t}</option>`).join("")}</select></label><label>Eixo Y<select id="y">${[[4,"Valor anual (R$ mil)"],[14,"Score ASG (0–100)"],[15,"Não conformidades (nº)"]].map(([v,t])=>`<option value="${v}" ${analysis.y===String(v)?"selected":""}>${t}</option>`).join("")}</select></label></div>` : `<div class="searchable-filter">${searchField("cross-indicators", "Digite nome ou código", "Buscar indicadores para cruzamento")}<label>Selecione dois ou mais indicadores (Ctrl ou seleção múltipla)<select id="cross-indicators" multiple size="7">${inds().map(i=>`<option value="${esc(i.id)}" ${analysis.indicators.includes(i.id)?"selected":""}>${esc(i.id+" · "+i.dim+" · "+i.name+" ("+i.unit+")")}</option>`).join("")}</select></label></div>`}<div class="toolbar"><button class="btn primary" id="cross">Gerar análise</button><button class="btn" id="savecross">Salvar análise</button></div><div id="crossresult"></div><h3>Análises salvas nesta sessão</h3><div id="saved"></div><p>Coeficientes são descritivos. Correlação não estabelece causalidade. Não são criados vínculos entre indicadores corporativos e fornecedores sem uma chave na fonte.</p></section>`;
}

function history() {
  const datasets=periodDatasets(historyMonth === "all" ? "all" : "month", historyMonth).filter(d => sameOrganization(d.payload));
  const selected = historyIndicators(datasets);
  const periodPicker = `<label>Data-base no histórico<select id="history-month"><option value="all">Todo o histórico disponível</option>${monthOptions(historyMonth)}</select></label><p>${datasets.length} datas-base disponíveis neste período.</p>`;
  let content;
  if (filters.period==="previous") content='<p>O comparativo armazenado não tem datas de início/fim ou metas históricas. Use o período atual para consultar retratos por data-base; o comparativo continua disponível nos detalhes de cada indicador.</p>';
  else if (!datasets.length) content = '<p>Não há datas-base para o mês escolhido.</p>';
  else if(corporate()) {
    const chosen=selected.find(i=>i.id===historyIndicator)||selected[0];
    historyIndicator=chosen?.id||"";
    content=`<div class="searchable-filter">${searchField("hist", "Digite nome ou código", "Buscar indicador no histórico")}<label>Indicador em acompanhamento<select id="hist">${selected.map(i=>`<option value="${esc(i.id)}" ${i.id===historyIndicator?"selected":""}>${esc(i.id+" · "+i.name)}</option>`).join("")}</select></label></div><div id="histchart">${chosen?indicatorHistory(chosen.id,datasets):"Sem indicadores neste recorte."}</div><h3>Dimensões e índice corporativo por data-base</h3>${table(["DATA-BASE","PERÍODO DA FONTE","AMBIENTAL","SOCIAL","GOVERNANÇA","ÍNDICE ASG"],datasets.map(d=>{const rs=ASG.indicators(d.payload,filters,search),p=ASG.parameters(d.payload);return `<tr><td>${esc(d.reference_date)}</td><td>${esc(p["Período de referência"])}</td>${["Ambiental","Social","Governança",null].map(dim=>`<td>${num(ASG.score(rs.filter(r=>!dim||ASG.dims[r[26]]===dim),p))}</td>`).join("")}</tr>`;}))}<p>Pontuações por retrato usam os parâmetros e pesos daquele retrato, sem aplicar ajustes locais atuais ao passado. Uma única data-base não permite evolução.</p>`;
  } else {
    const selectedCompany=contracts.find(r=>r[0]===filters.company);
    content=table(["DATA-BASE","PERÍODO DA FONTE","EMPRESA","SCORE GERAL (0–100)","FONTE"],datasets.flatMap(d=>ASG.suppliers(d.payload,{...filters,search}).filter(r=>!selectedCompany||selectedCompany[1]===r[1]).map(r=>`<tr><td>${esc(d.reference_date)}</td><td>${esc(ASG.parameters(d.payload)["Período de referência"])}</td><td>${esc(r[1])}</td><td>${num(r[14])}</td><td>${esc(d.source_name)}</td></tr>`)))+'<p>Mesmos identificador e nome contratual, respeitando setor e UF de cada retrato. Sem dimensões individuais. Sem períodos comparáveis adicionais, crescimento não calculável.</p>';
  }
  return `<section class="panel full"><h2>Histórico por data-base</h2>${periodPicker}${content}<p>Retratos cronológicos não comprovam períodos equivalentes nem metodologia de score constante. Nenhuma linha de tendência ou taxa de crescimento é calculada sem essa confirmação.</p></section><section class="panel full"><h2>Histórico de importações e recuperação</h2><p>Data de importação e data-base são informações diferentes. Consultar uma versão não altera a base. Recuperar cria uma nova versão e preserva as demais.</p>${versionTable()}</section>`;
}
function sameOrganization(payload) {
  return ASG.parameters(payload)["Organização (fictícia)"] === params["Organização (fictícia)"];
}

function historyIndicators(datasets) {
  const choices = new Map();
  for (const dataset of datasets.filter(d => sameOrganization(d.payload))) {
    for (const row of ASG.indicators(dataset.payload, filters, search)) {
      choices.set(row[0], {id: row[0], name: row[3], unit: row[4], dimension: row[26]});
    }
  }
  return Array.from(choices.values());
}

function indicatorHistory(id, datasets = periodDatasets(historyMonth === "all" ? "all" : "month", historyMonth)) {
  const current = historyIndicators(datasets).find(i => i.id === id);
  if(!current)return '<p>Indicador não encontrado.</p>';
  const rows=datasets.filter(d=>sameOrganization(d.payload)).flatMap(d=>{
    const r=ASG.indicators(d.payload,{...filters,indicator:id},search).find(r=>r[0]===id);
    if(!r || r[4]!==current.unit || r[26]!==current.dimension)return [];
    return [`<tr><td>${esc(d.reference_date)}</td><td>${esc(ASG.parameters(d.payload)["Período de referência"])}</td><td>${fmt(current,r[10])}</td><td>${esc(d.source_name)}</td></tr>`];
  });
  return table(["DATA-BASE","PERÍODO DA FONTE","VALOR ("+current.unit+")","FONTE"],rows);
}

let ufMapPromise;
const mapLegend = [
  {label: "Sem registros", max: 0, color: "#e6eef8"},
  {label: "Até 5%", max: 0.05, color: "#8db0de"},
  {label: "Até 10%", max: 0.10, color: "#3f6baa"},
  {label: "Até 20%", max: 0.20, color: "#2b5597"},
  {label: "Acima de 20%", max: 1, color: "#16345f"},
];

function geography() {
  const suppliers = cs();
  if (!suppliers.length) return '<section class="panel full"><h2>Fornecedores por UF</h2><p>Sem observações de fornecedores para os filtros e período selecionados.</p></section>';
  const counts = group(suppliers, 3);
  if (!counts.some(([uf]) => uf === mapUF)) mapUF = "";
  const visible = mapUF ? suppliers.filter(row => row[3] === mapUF) : suppliers;
  return `<div class="grid"><section class="panel"><h2>Fornecedores por UF</h2>
    <p>O azul indica a participação de cada UF no recorte. Selecione um estado para consultar seus fornecedores.</p>
    <div id="supplier-map" aria-busy="true"><p role="status">Carregando mapa do Brasil…</p></div>
    <div class="toolbar map-states" aria-label="Selecionar UF no mapa">
      <button type="button" class="btn" data-map-uf="" aria-pressed="${!mapUF}">Todas as UFs</button>
      ${counts.filter(([uf]) => /^[A-Z]{2}$/.test(uf)).map(([uf, count]) => `<button type="button" class="btn" data-map-uf="${esc(uf)}" aria-pressed="${mapUF === uf}">${esc(uf)} · ${count}</button>`).join("")}
    </div><ul class="map-legend" aria-label="Escala de participação">${mapLegend.map(step => `<li><span aria-hidden="true" style="background:${step.color}"></span>${step.label}</li>`).join("")}</ul>${bars(counts)}</section>
    <section class="panel"><h2>${mapUF ? "Fornecedores · " + esc(mapUF) : "Fornecedores no recorte"}</h2>
    <p>${visible.length} de ${suppliers.length} fornecedores · ${num(100 * visible.length / suppliers.length)}% do recorte.</p>
    ${table(["FORNECEDOR", "UF", "CATEGORIA"], visible.map(row => `<tr><td><a href="#" data-company="${esc(row[0])}">${esc(row[1])}</a></td><td>${esc(row[3])}</td><td>${esc(row[2])}</td></tr>`))}
    <p>UF cadastrada para o fornecedor. A planilha não informa município nem local de execução do contrato.</p></section></div>`;
}

function bindSupplierMap(container) {
  const suppliers = cs();
  const counts = new Map(group(suppliers, 3));
  const shade = count => mapLegend.find(step => count / suppliers.length <= step.max).color;
  const choose = (uf, focusSource) => {
    mapUF = uf;
    render();
    if (focusSource === "button") Array.from(document.querySelectorAll("[data-map-uf]"))
      .find(button => button.dataset.mapUf === uf)?.focus();
  };
  document.querySelectorAll("[data-map-uf]").forEach(button => {
    button.onclick = () => choose(button.dataset.mapUf, "button");
  });
  const request = ufMapPromise ??= fetch("brasil-uf.json").then(response => {
    if (!response.ok) throw new Error("Mapa indisponível");
    return response.json();
  });
  request.then(map => {
    if (!container.isConnected) return;
    container.innerHTML = `<svg class="uf-map" viewBox="${esc(map.viewBox)}" aria-label="Mapa do Brasil por unidade da federação">
      ${map.states.map(({uf, name, path}) => {
        const count = counts.get(uf) || 0;
        const label = `${name} (${uf}): ${count} de ${suppliers.length} fornecedores (${num(100 * count / suppliers.length)}%)`;
        return `<path d="${esc(path)}" fill="${shade(count)}" class="${uf === mapUF ? "selected" : ""}" ${count ? `data-map-state="${esc(uf)}" role="button" tabindex="0" aria-pressed="${uf === mapUF}" aria-label="${esc(label)}"` : ""}><title>${esc(label)}</title></path>`;
      }).join("")}</svg><p class="muted">Limites estaduais · <a href="https://www.ibge.gov.br/geociencias/organizacao-do-territorio/estrutura-territorial/15774-malhas.html">Malha territorial do IBGE</a></p>`;
    container.setAttribute("aria-busy", "false");
    container.querySelectorAll("[data-map-state]").forEach(state => {
      const activate = () => {
        const uf = state.dataset.mapState;
        choose(uf, "map");
        request.then(() => {
          Array.from(document.querySelectorAll("[data-map-state]"))
            .find(path => path.dataset.mapState === uf)?.focus();
        });
      };
      state.onclick = activate;
      state.onkeydown = event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activate();
      };
    });
  }).catch(() => {
    if (ufMapPromise === request) ufMapPromise = null;
    if (!container.isConnected) return;
    container.setAttribute("aria-busy", "false");
    container.textContent = "Mapa indisponível no momento. Use os botões de UF e a lista de fornecedores.";
  });
}

const extractRanges = {
  active: "Período atual do painel",
  quarter: "Últimos 3 meses",
  year: "Último ano",
  threeYears: "Últimos 3 anos",
  all: "Todo o histórico disponível",
  month: "Mês e ano específicos",
};

function reports() {
  return `<section class="panel full"><span class="eyebrow">EXTRATO ASG</span><h2>Informações para acompanhamento</h2>
    <p>Os filtros do painel são mantidos. Cada data-base é apresentada separadamente, com o período informado na fonte.</p>
    <div class="toolbar"><label>Período do extrato<select id="extract-range">${Object.entries(extractRanges).map(([key, label]) =>
      `<option value="${key}" ${key === extractRange ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      ${extractRange === "month" ? `<label>Mês e ano<select id="extract-month">${monthOptions(extractMonth)}</select></label>` : ""}
    </div>
    <div class="toolbar"><button class="btn primary" id="pdf">Baixar PDF</button><button class="btn" id="excel">Exportar Excel</button><button class="btn" id="print">Imprimir</button></div><div id="report">${report()}</div></section>`;
}

function extractData(dataset) {
  const payload = dataset?.payload ?? raw;
  const sourceParams = ASG.parameters(payload);
  const selection = {...filters, search, period: dataset ? "current" : filters.period};
  const localWeights = payload === raw ? weights : {};
  const rows = ASG.indicators(payload, selection, search);
  const current = selection.period === "current";
  const selectedSupplier = contracts.find(row => row[0] === filters.company);
  return {
    source: dataset?.source_name ?? (sessionStorage.getItem("asg-source") || "Painel_ASG_Compliance_Integridade_Completo.xlsx"),
    reference: sourceParams["Data-base"],
    datasetId: dataset?.id ?? activeDatasetId,
    period: current ? sourceParams["Período de referência"] : "Comparativo da fonte · abrangência não informada",
    filters: selection,
    companyName: filters.company === "aurora" ? sourceParams["Organização (fictícia)"]
      : (selectedSupplier?.[1] ?? (filters.company || "Visão coletiva")),
    points: current ? ASG.score(rows, sourceParams, localWeights) : null,
    statusPoints: {Atende: sourceParams.Atende, Atenção: sourceParams["Atenção"], Crítico: sourceParams["Crítico"]},
    localWeights,
    indicators: rows.map(row => [row[0], row[3], ASG.dims[row[26]] || "Validar classificação",
      row[4], current ? row[10] : row[11], current ? row[13] : null,
      current ? ASG.status(row) : "Comparativo sem metas históricas", localWeights[row[0]] ?? row[19], row[23]]),
    supplierHeader: payload.Contratos_ASG[3],
    suppliers: ASG.suppliers(payload, selection).filter(row =>
      !dataset || !selectedSupplier || selectedSupplier[1] === row[1]),
  };
}

function extractSections() {
  if (extractRange === "active") return [extractData()];
  return periodDatasets(extractRange, extractMonth, extractAnchor || params["Data-base"])
    .filter(dataset => sameOrganization(dataset.payload)).map(dataset => extractData(dataset));
}

function extractScope(data) {
  const f = data?.filters ?? {...filters, search};
  return `Empresa: ${data?.companyName ?? (f.company || "Visão coletiva")} · Cidade: ${f.city || "Não informada na base"} · Setor: ${f.sector || "Todos"} · UF: ${f.uf || "Todas"} · Dimensão: ${f.dim || "Todas"} · Indicador: ${f.indicator || "Todos"} · Busca: ${f.search || "Sem busca"}`;
}

function extractSummary(sections) {
  const count = sections.length;
  const range = extractRange === "month" && extractMonth ? monthName(extractMonth) : extractRanges[extractRange];
  const anchored = ["quarter", "year", "threeYears"].includes(extractRange);
  return `${range}${anchored ? " · até " + (extractAnchor || params["Data-base"]) : ""} · ${count === 1 ? "1 data-base disponível" : count + " datas-base disponíveis"}`;
}

function report() {
  const sections = extractSections();
  return `<h2>Extrato ASG</h2><p>${esc(extractSummary(sections))}</p><p>Gerado em ${new Date().toLocaleString("pt-BR")}</p><p>${esc(extractScope(sections[0]))}</p>
    ${sections.map(data => `<section class="extract-snapshot"><h3>${esc(data.reference)} · ${esc(data.period)}</h3>
      <p>Fonte: ${esc(data.source)} · Pontuação corporativa: ${num(data.points)} / 100. Ajustes locais de peso: ${Object.keys(data.localWeights).length ? "sim" : "não"}.</p>
      ${extractRange === "active" ? indicatorTable(inds()) : table(["INDICADOR","DIMENSÃO","RESULTADO","META","STATUS"], data.indicators.map(row =>
        `<tr><td>${esc(row[0] + " · " + row[1])}</td><td>${esc(row[2])}</td><td>${fmt({unit: row[3]}, row[4])}</td><td>${fmt({unit: row[3]}, row[5])}</td><td>${badge(row[6])}</td></tr>`))}
      <h4>Fornecedores no mesmo recorte</h4>${table(["EMPRESA","UF","VALOR ANUAL (R$ MIL)","SCORE GERAL (0–100)"],data.suppliers.map(row =>
        `<tr><td>${esc(row[1])}</td><td>${esc(row[3])}</td><td>${num(row[4])}</td><td>${num(row[14])}</td></tr>`))}</section>`).join("")}
    ${sections.length ? "" : "<p>Não há datas-base para o período solicitado.</p>"}
    <p>Pontos por status e pesos da fonte. Ausências não equivalem a zero. As notas por dimensão são corporativas. Comparação e crescimento requerem períodos equivalentes.</p>`;
}

function versionTable() {
  return table(["IMPORTAÇÃO","DATA-BASE","FONTE","AÇÃO"],window.investAuth.datasets.map((v,n)=>`<tr><td>${v.created_at?new Date(v.created_at).toLocaleString("pt-BR"):"Não informada na versão inicial"}</td><td>${esc(v.reference_date)}</td><td>${esc(v.source_name)}</td><td><button class="btn" data-version="${n}">Consultar versão</button>${window.investAuth.profile.role==="admin"?`<button class="btn" data-restore="${n}">Recuperar como nova versão</button>`:""}</td></tr>`));
}

function management() {
  return `<section class="panel full"><h2>Qualidade e rastreabilidade</h2><div class="quality">Base explicitamente fictícia. 1 organização principal; ${contracts.length} fornecedores, ${ind.length} indicadores corporativos. Identificadores duplicados: ${ind.length - new Set(ind.map((i) => i.id)).size} indicadores; ${contracts.length - new Set(contracts.map((r) => r[0])).size} contratos.</div><div class="quality">${ind.filter((i) => i.value == null).length} resultados atuais ausentes; ${ind.filter((i) => !i.r[23]).length} indicadores sem fonte; ${ind.filter((i) => i.dim === "Validar classificação").length} classificações ASG pendentes.</div><p>Municípios e coordenadas ausentes. Unidade monetária dos contratos: R$ mil; aportes e receita: R$ milhões. Não somar grandezas de unidades distintas. Fim da vigência contratual não é período de observação. Atualização da fonte não informada; data-base ${esc(params["Data-base"])}.</p><h3>Proveniência</h3><p>Resultados: coluna K de Indicadores; comparativo L; metas N; pesos T. A linha exata está nos detalhes de cada indicador. Classificação ASG: coluna AA da nova planilha. Dados originais e vínculos entre abas permanecem identificados. O protótipo lê valores armazenados e recalcula indicadores compatíveis na importação; não executa fórmulas Excel arbitrárias.</p></section><section class="panel full"><h2>Importar e validar dados</h2><p>Excel: mesmo modelo da planilha original. CSV: substituição do catálogo com 24 ou 27 colunas originais, na mesma ordem, cabeçalho na primeira linha e números em formato decimal; as outras entidades são preservadas. O CSV deve conter valores, sem fórmulas.</p>${$("#role").value === "Administrador" ? '<div class="filebox"><input type="file" id="file" accept=".xlsx,.csv"><div id="preview"></div></div>' : "<p>Seu perfil permite consulta. Solicite o perfil de administrador ao responsável.</p>"}<p>${window.investAuth.demo ? "Demonstração: importações e versões ficam somente nesta sessão do navegador. Não envie dados reais. O banco institucional não é acessado." : "Base e versões no banco protegido; importações exigem permissão de administrador. Preferências temporárias ficam nesta sessão."}</p><h3>Registro das atualizações</h3>${versionTable()}</section>`;
}
function render() {
  controls();
  $("footer span").textContent="Fonte: "+(sessionStorage.getItem("asg-source")||"Base carregada")+" · data-base "+params["Data-base"];

  $("#nav").innerHTML = pages
    .map(
      (n, i) =>
        `<button data-page="${i}" class="${i === page ? "active" : ""}"${i === page ? ' aria-current="page"' : ""}><b>${icons[i]}</b>${n}</button>`,
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
    filters = { company: "aurora", sector: "", uf: "", dim: "", period: "current", city: "", indicator: "" };
    search="";
    render();
  };
}
function modal(html) {
  $("#detail").innerHTML = html;
  $("#dialog").showModal();
}
function detail(id) {
  const i=inds().find(i=>i.id===id);if(!i)return;
  modal(`<span class="eyebrow">${esc(i.id)} · ${esc(i.dim)}</span><h1>${esc(i.name)}</h1><p>Organização: ${esc(params["Organização (fictícia)"])} · Unidade: ${esc(i.unit)} · Polaridade: ${esc(i.r[12])}</p>${indicatorTable([i])}${trend(i)}<p>Cálculo original: ${esc(i.r[5])} · A: ${esc(i.r[6])} = ${num(i.r[7],3)} · B: ${esc(i.r[8])} = ${num(i.r[9],3)}.</p><p>Fonte: ${esc(i.r[23])} · Indicadores!K${i.row}, L${i.row} · Responsável: ${esc(i.r[21])} · Frequência: ${esc(i.r[20])} · Data-base atual ${esc(params["Data-base"])}. Metas e limites históricos não informados.</p>`);
}

function companyHtml(r) {
  if (!r) return "<p>Empresa não encontrada no recorte.</p>";
  if (filters.period !== "current" || filters.dim || filters.indicator) return '<p>Sem observações individuais para o período, dimensão ou indicador selecionado.</p>';
  return `<div><h2>${esc(r[1])}</h2><p>${esc(r[2])} · ${esc(r[3])} · ${esc(r[0])}</p><h3>Score ASG original: ${num(r[14])} / 100</h3><p>Score informado pela fonte; não equivale à pontuação corporativa. A base não fornece scores E/S/G individuais.</p>${table(["CRITÉRIO","RESPOSTA"],raw.Contratos_ASG[3].slice(6,14).map((h,j)=>`<tr><td>${esc(h)}</td><td>${esc(r[j+6])}</td></tr>`))}<p>Valor anual: R$ ${num(r[4])} mil · Não conformidades: ${num(r[15])} · Fim da vigência: ${esc(r[16])}.</p><p>Fonte: Contratos_ASG, contrato ${esc(r[0])} · Data-base ${esc(params["Data-base"])}. Município e série histórica individual não informados.</p></div>`;
}

function cross() {
  if (analysis.mode === "corporate") {
    analysis.indicators = [...$("#cross-indicators").selectedOptions].map(o=>o.value);
    const selected = inds().filter(i=>analysis.indicators.includes(i.id));
    $("#crossresult").innerHTML = selected.length<2 ? '<p>Selecione ao menos dois indicadores disponíveis neste recorte.</p>' : `${table(["INDICADOR","DIMENSÃO","UNIDADE","VALOR NO PERÍODO","DATA-BASE"],selected.map(i=>`<tr><td>${esc(i.id+" · "+i.name)}</td><td>${esc(i.dim)}</td><td>${esc(i.unit)}</td><td>${fmt(i,val(i))}</td><td>${filters.period==="current"?esc(params["Data-base"]):"Abrangência do comparativo não informada"}</td></tr>`))}<p>Relação por organização e período, com unidades preservadas. Há apenas uma observação por indicador neste recorte; não há pares temporais equivalentes suficientes para correlação, tendência ou inferência de padrões.</p>`;
    return;
  }
  analysis.x=$("#x").value; analysis.y=$("#y").value;
  const x=+analysis.x,y=+analysis.y,c=cs(),points=c.filter(r=>ASG.finite(r[x])&&ASG.finite(r[y]));
  const result=x===y ? {n:points.length,r:null,reason:"Escolha variáveis diferentes; a correlação de uma variável consigo mesma não é uma relação exploratória."} : ASG.pearson(points.map(r=>[r[x],r[y]]));
  const maxX=Math.max(...points.map(r=>r[x]),1), maxY=Math.max(...points.map(r=>r[y]),1);
  const labels={4:"Valor anual (R$ mil)",14:"Score ASG (0–100)",15:"Não conformidades (nº)"};
  $("#crossresult").innerHTML = !points.length ? '<p>Sem pares válidos para os filtros e período selecionados. A base não tem variáveis individuais por dimensão ou indicador corporativo dos fornecedores.</p>' : `<p>X: ${esc(labels[x])} · Y: ${esc(labels[y])} · Data-base ${esc(params["Data-base"])}</p><svg viewBox="0 0 650 265" role="img" aria-label="Dispersão dos fornecedores: ${esc(labels[x])} por ${esc(labels[y])}"><path d="M65 25V215H615" stroke="#c9d6e8" fill="none"/>${points.map(r=>`<circle cx="${65+r[x]/maxX*530}" cy="${215-r[y]/maxY*170}" r="6" fill="#2b5597"><title>${esc(r[1])}: ${esc(labels[x])} = ${num(r[x])}; ${esc(labels[y])} = ${num(r[y])}</title></circle>`).join("")}<text x="65" y="235" font-size="11" fill="#1e2b40">0</text><text x="560" y="235" font-size="11">${num(maxX)}</text><text x="0" y="40" font-size="11">${num(maxY)}</text><text x="180" y="257" font-size="11">X: ${esc(labels[x])}</text></svg><p>${result.n} pares válidos · Pearson: ${num(result.r,3)}. ${esc(result.reason)}</p>${table(["FORNECEDOR",labels[x],labels[y]],points.map(r=>`<tr><td>${esc(r[1])}</td><td>${num(r[x])}</td><td>${num(r[y])}</td></tr>`))}<h3>Matriz das três variáveis contratuais</h3>${table(["VARIÁVEIS","PARES VÁLIDOS","PEARSON"],[[4,14],[4,15],[14,15]].map(([a,b])=>{const q=ASG.pearson(c.map(r=>[r[a],r[b]]));return `<tr><td>${esc(labels[a])} × ${esc(labels[b])}</td><td>${q.n}</td><td>${num(q.r,3)}</td></tr>`;}))}`;
}

function saved() {
  const a = readSession("asg-analyses",[]);
  $("#saved").innerHTML=a.map((v,i)=>`<button class="btn" data-analysis="${i}">${esc(v.name)} · ${new Date(v.at).toLocaleDateString("pt-BR")}</button>`).join("")||"<p>Nenhuma análise salva.</p>";
  document.querySelectorAll("[data-analysis]").forEach(b=>b.onclick=()=>{
    const v=a[+b.dataset.analysis];
    const dataset=window.investAuth.datasets.find(d=>d.id===v.datasetId);
    if(v.datasetId && !dataset){alert("A versão usada nesta análise não está disponível nesta sessão.");return;}
    if(dataset){raw=dataset.payload;activeDatasetId=dataset.id;model();try{sessionStorage.setItem("asg-source",dataset.source_name);}catch{}}
    filters=ASG.normalizeFilters({...filters,...v.filters});search=v.search||"";
    analysis={mode:"suppliers",x:v.x||"4",y:v.y||"14",indicators:[],...v.analysis};
    render();
  });
}

function exportWorkbook() {
  const sections = extractSections(), wb = XLSX.utils.book_new();
  const context = [["Extrato ASG"], ["Recorte", extractSummary(sections)], ["Gerado em", new Date().toISOString()],
    ["Filtros", extractScope(sections[0])], ["Limite", "Comparações exigem períodos equivalentes; ausências não equivalem a zero."],
    ["Data-base", "Período da fonte", "Fonte", "Versão", "Pontuação corporativa", "Pontos por status", "Pesos locais"],
    ...sections.map(data => [data.reference, data.period, data.source, data.datasetId, data.points,
      JSON.stringify(data.statusPoints), JSON.stringify(data.localWeights)])];
  const periodColumns = ["Data-base", "Período da fonte"];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(context), "Contexto");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["ID","Indicador","Dimensão","Unidade","Valor no período","Meta do período","Status","Peso diagnóstico","Origem",...periodColumns],
    ...sections.flatMap(data => data.indicators.map(row => [...row, data.reference, data.period])),
  ]), "Indicadores");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    [...(sections[0]?.supplierHeader ?? raw.Contratos_ASG[3]), ...periodColumns],
    ...sections.flatMap(data => data.suppliers.map(row => [...row, data.reference, data.period])),
  ]), "Fornecedores");
  return wb;
}
let pdfLibraryPromise;
async function loadPdfLibrary() {
  if(typeof PDFLib!=="undefined")return;
  if(!pdfLibraryPromise)pdfLibraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement("script");script.src="vendor/pdf-lib.js";
    script.onload=resolve;script.onerror=()=>{pdfLibraryPromise=null;reject(Error("Biblioteca PDF indisponível. Tente novamente."));};document.body.append(script);
  });
  return pdfLibraryPromise;
}
async function createPdfBytes() {
  const sections = extractSections();
  const summary = extractSummary(sections);
  const scope = extractScope(sections[0]);
  await loadPdfLibrary();
  const pdf=await PDFLib.PDFDocument.create();
  const font=await pdf.embedFont(PDFLib.StandardFonts.Helvetica);
  const bold=await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
  let sheet,y;
  const clean=value=>Array.from(String(value??"Não informado")).map(c=>{try{font.encodeText(c);return c;}catch{return "?";}}).join("");
  const newPage=()=>{sheet=pdf.addPage();y=798;};
  newPage();
  const line=(text,title=false)=>{
    const size=title?12:9, face=title?bold:font;
    const words=clean(text).split(/\s+/);let current="";
    const draw=()=>{if(y<48)newPage();sheet.drawText(current,{x:40,y,size,font:face});y-=title?19:14;};
    for(const word of words){
      if(face.widthOfTextAtSize((current?current+" ":"")+word,size)>510 && current){draw();current="";}
      // Long identifiers are split by character to preserve page width.
      if(face.widthOfTextAtSize(word,size)>510){for(const ch of word){if(face.widthOfTextAtSize(current+ch,size)>510){draw();current="";}current+=ch;}}
      else current+=(current?" ":"")+word;
    }
    if(current)draw();y-=3;
  };
  line("INVEST PI - Extrato ASG",true);
  line(summary);
  line("Gerado em " + new Date().toLocaleString("pt-BR"));
  line(scope);
  if (!sections.length) line("Não há datas-base para o período solicitado.");
  for (const data of sections) {
    line(data.reference + " | " + data.period, true);
    line("Fonte: " + data.source + " | Versão: " + (data.datasetId || "não informada"));
    line("Pontuação corporativa: " + num(data.points) + " / 100. Pontos por status: " + JSON.stringify(data.statusPoints));
    if (Object.keys(data.localWeights).length) line("Pesos locais: " + JSON.stringify(data.localWeights));
    line("Indicadores no período", true);
    if (!data.indicators.length) line("Sem dados para esta seleção.");
    for (const row of data.indicators) {
      const unit = {unit: row[3]};
      line(row[0] + " - " + row[1], true);
      line("Dimensão: " + row[2] + " | Unidade: " + row[3] + " | Resultado: " + fmt(unit, row[4])
        + " | Meta: " + fmt(unit, row[5]) + " | Status: " + row[6]);
      line("Peso: " + num(row[7]) + " | Origem: " + (row[8] || "não informada"));
    }
    line("Fornecedores no mesmo recorte", true);
    if (!data.suppliers.length) line("Sem dados para esta seleção.");
    for (const row of data.suppliers) line(row[0] + " - " + row[1] + " | UF: " + row[3]
      + " | Valor anual (R$ mil): " + num(row[4]) + " | Score geral (0-100): " + num(row[14]));
  }
  line("Limitações",true);
  line("Ausências não equivalem a zero. Sem metas históricas, pontuação histórica não calculável. Não há municípios, notas E/S/G individuais por fornecedor ou períodos comparativos equivalentes confirmados. Não há ranking. Correlação não é causalidade.");
  const total=pdf.getPageCount();pdf.getPages().forEach((p,i)=>p.drawText("INVEST PI | "+(i+1)+" / "+total,{x:40,y:25,size:8,font}));
  return pdf.save();
}
async function exportPdf() {
  const bytes=await createPdfBytes(),url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"}));
  const link=document.createElement("a");link.href=url;link.download="Extrato_ASG.pdf";link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportExcel() { XLSX.writeFile(exportWorkbook(),"Extrato_ASG.xlsx"); }

function bind() {
  bindSelectSearch();
  if (page === 6 && $("#supplier-map")) bindSupplierMap($("#supplier-map"));
  if (page === 5 && $("#history-month")) $("#history-month").onchange = event => {
    historyMonth = event.target.value;
    render();
    $("#history-month").focus();
  };
  if (page === 7 && $("#extract-range")) $("#extract-range").onchange = event => {
    extractRange = event.target.value;
    if (extractRange === "month" && !extractMonth) extractMonth = params["Data-base"].slice(0, 7);
    render();
    $("#extract-range").focus();
  };
  if (page === 7 && $("#extract-month")) $("#extract-month").onchange = event => {
    extractMonth = event.target.value;
    extractAnchor = periodDatasets("month", extractMonth)
      .filter(dataset => sameOrganization(dataset.payload)).at(-1)?.reference_date ?? "";
    render();
    $("#extract-month").focus();
  };
  document.querySelectorAll("[data-page]").forEach(
    (b) =>
      (b.onclick = () => {
        const nextPage = +b.dataset.page;
        if (page !== 7 && nextPage === 7) {
          extractRange = "active";
          extractMonth = "";
          extractAnchor = "";
          if (page === 5 && filters.period !== "previous") {
            extractRange = historyMonth === "all" ? "all" : "month";
            extractMonth = historyMonth === "all" ? "" : historyMonth;
            extractAnchor = periodDatasets("month", extractMonth)
              .filter(dataset => sameOrganization(dataset.payload)).at(-1)?.reference_date ?? "";
          }
        }
        page = nextPage;
        render();
        window.scrollTo(0, 0);
      }),
  );
  document
    .querySelectorAll("[data-ind]")
    .forEach((b) => {
      b.onclick = () => detail(b.dataset.ind);
      b.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          detail(b.dataset.ind);
        }
      };
    });
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
    $("#analysis-mode").onchange=()=>{analysis.mode=$("#analysis-mode").value;render();};
    cross(); saved();
    $("#cross").onclick=cross;
    $("#savecross").onclick=()=>{
      cross();
      const a=readSession("asg-analyses",[]);
      a.push({datasetId:activeDatasetId,search,name:analysis.mode==="corporate"?analysis.indicators.join(" × "):$("#x").selectedOptions[0].text+" × "+$("#y").selectedOptions[0].text,analysis:ASG.clone(analysis),filters:{...filters},at:new Date().toISOString()});
      try{sessionStorage.setItem("asg-analyses",JSON.stringify(a));saved();}catch{alert("Armazenamento indisponível; análise não salva.");}
    };
  }
  if ($("#hist")) $("#hist").onchange=()=>{historyIndicator=$("#hist").value;$("#histchart").innerHTML=indicatorHistory(historyIndicator);};
  if ($("#excel")) $("#excel").onclick = exportExcel;
  if ($("#pdf")) $("#pdf").onclick = async () => {
    const button=$("#pdf");button.disabled=true;
    try { await exportPdf(); } catch(e){alert("Não foi possível gerar o PDF: "+e.message);} finally{button.disabled=false;}
  };
  if ($("#print")) $("#print").onclick = () => window.print();
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
            if (!el.value.trim() || !Number.isFinite(n) || n < 0 || n > 100)
              return alert("Informe pesos entre 0 e 100.");
            if(n!==ind.find(i=>i.id===el.dataset.weight)?.weight)next[el.dataset.weight] = n;
          }
          try {
            sessionStorage.setItem("asg-weights", JSON.stringify(next));
            sessionStorage.setItem("asg-weight-context",activeDatasetId);
            weights = next;
            $("#dialog").close();
            render();
          } catch {
            alert("Não foi possível salvar os pesos.");
          }
        };
    };
  document.querySelectorAll("[data-version]").forEach(b=>b.onclick=()=>{
    const v=window.investAuth.datasets[+b.dataset.version];
    modal(`<h1>Consulta de versão</h1><p>${esc(v.source_name)} · Data-base ${esc(v.reference_date)} · Importação ${v.created_at?new Date(v.created_at).toLocaleString("pt-BR"):"não informada"} · Consulta sem substituir a base</p>${table(["ID","INDICADOR","VALOR","UNIDADE"],ASG.indicators(v.payload,filters,search).map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[3])}</td><td>${num(filters.period==="previous"?r[11]:r[10],3)}</td><td>${esc(r[4])}</td></tr>`))}<h2>Fornecedores no recorte</h2>${table(["ID","EMPRESA","SCORE"],ASG.suppliers(v.payload,{...filters,search}).map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${num(r[14])}</td></tr>`))}`);
  });
  document.querySelectorAll("[data-restore]").forEach(b=>b.onclick=async()=>{
    const v=window.investAuth.datasets[+b.dataset.restore];
    if(!confirm("Recuperar esta base como nova versão? O histórico existente será preservado."))return;
    b.disabled=true;
    try{await commitDataset(ASG.clone(v.payload),"Recuperação: "+v.source_name);alert("Versão recuperada; histórico preservado.");}catch(e){b.disabled=false;alert(e.message);}
  });
}

function recalc(d) { return ASG.recalc(d); }
let importSequence=0;
async function commitDataset(data,name) {
  if(window.investAuth.profile.role!=="admin")throw Error("Somente administradores podem importar ou recuperar versões.");
  ASG.validate(data);
  if(typeof name!=="string" || !name.trim() || name.length>255)throw Error("O nome da fonte deve ter entre 1 e 255 caracteres.");
  await window.investAuth.saveDataset(data,name);
  const latest = latestDataset();
  raw = latest.payload; activeDatasetId = latest.id;
  versions=window.investAuth.datasets.slice(1).map(v=>({at:v.created_at,name:v.source_name,data:v.payload}));
  try{sessionStorage.setItem("asg-source", latest.source_name);}catch{}
  model(); pending=null;
  filters={company:"",sector:"",uf:"",city:"",dim:"",indicator:"",period:"current"};
  search="";weights={};
  historyMonth = "all"; extractRange = "active"; extractMonth = ""; extractAnchor = ""; mapUF = "";
  try{sessionStorage.removeItem("asg-weights");}catch{}
  render();
}
async function importFile(e) {
  const token=++importSequence;
  pending=null;
  try {
    if(window.investAuth.profile.role!=="admin")throw Error("Perfil sem permissão de importação.");
    const file=e.target.files[0]; if(!file)return;
    if(!/\.(xlsx|csv)$/i.test(file.name))throw Error("Envie somente arquivos XLSX ou CSV.");
    if(file.size>10*1024*1024)throw Error("Limite de arquivo: 10 MiB.");
    $("#preview").textContent="Lendo e validando arquivo…";
    const csv=/\.csv$/i.test(file.name);
    let d;
    if(csv) {
      const rows=ASG.parseCSV(await file.text());
      d=ASG.clone(raw);
      const old=new Map(ASG.rows(raw,"Indicadores","IND-").map(r=>[r[0],r]));
      d.Indicadores=[[],[],[],rows[0],...rows.slice(1).map(r=>{
        if(rows[0].length===24){r=r.slice();r[26]=old.get(r[0])?.[26]??null;}
        return r;
      })];
    } else {
      const buffer=await file.arrayBuffer();
      ASG.checkXlsxArchive(new Uint8Array(buffer));
      const wb=XLSX.read(buffer,{type:"array",cellDates:true,sheetRows:10001});
      if(wb.SheetNames.length>32)throw Error("Limite de 32 abas por planilha.");
      d={};let cells=0;
      for(const name of wb.SheetNames) {
        const ref=wb.Sheets[name]["!fullref"]||wb.Sheets[name]["!ref"];
        if(ref) {const range=XLSX.utils.decode_range(ref);cells+=(range.e.r+1)*(range.e.c+1);}
        if(cells>500000)throw Error("A planilha excede 500 mil células; reduza o arquivo antes de importar.");
        d[name]=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:null,raw:true,blankrows:true}).map(row=>row.map(v=>v instanceof Date?v.toISOString().slice(0,10):v));
      }
    }
    ASG.validate(d,{checkCalculated:false});
    const before=ASG.rows(d,"Indicadores","IND-").map(r=>[r[0],r[10]]);
    d=recalc(d);
    ASG.validate(d);
    const changed=ASG.rows(d,"Indicadores","IND-").filter((r,i)=>r[10]!==before[i]?.[1] && !(ASG.finite(r[10])&&ASG.finite(before[i]?.[1])&&Math.abs(r[10]-before[i][1])<1e-9));
    if(token!==importSequence || !$("#preview"))return;
    pending={data:d,name:file.name};
    $("#preview").innerHTML=`<h3>Prévia validada · ${esc(file.name)}</h3><p>${ASG.rows(d,"Indicadores","IND-").length} indicadores; ${ASG.rows(d,"Contratos_ASG","CT-").length} contratos. ${changed.length} resultados recalculados diferem dos valores armazenados no arquivo. Os vínculos e fórmulas suportados usam os dados das abas auxiliares. Data-base ${esc(ASG.parameters(d)["Data-base"])}. Nenhuma versão anterior será sobrescrita.</p>${table(["ID","VALOR RECALCULADO"],ASG.rows(d,"Indicadores","IND-").slice(0,5).map(r=>`<tr><td>${esc(r[0])}</td><td>${num(r[10],3)}</td></tr>`))}<button class="btn primary" id="confirmimport">Confirmar atualização</button><button class="btn" id="cancelimport">Cancelar</button>`;
    $("#cancelimport").onclick=()=>{importSequence++;pending=null;$("#preview").textContent="Importação cancelada. A base foi preservada.";};
    $("#confirmimport").onclick=async()=>{
      if(!pending)return;
      const value=pending,button=$("#confirmimport");button.disabled=true;
      $("#cancelimport").disabled=true;$("#file").disabled=true;
      try{await commitDataset(value.data,value.name);alert("Base atualizada e histórico preservado.");}
      catch(error){button.disabled=false;$("#cancelimport").disabled=false;$("#file").disabled=false;alert(error.message+" A base anterior foi preservada.");}
    };
  } catch(error) {
    if(token!==importSequence)return;
    pending=null;
    if($("#preview"))$("#preview").innerHTML='<p class="quality">Importação bloqueada: '+esc(error.message)+'. Base anterior preservada.</p>';
  }
}

window.clearInvestWorkspace = () => {
  raw=null;ind=[];contracts=[];params={};pending=null;versions=[];weights={};
  $("#app").replaceChildren();
};

const roleName = {
  admin: "Administrador",
  analyst: "Analista",
  viewer: "Visualizador",
};
$("#role").value = roleName[window.investAuth.profile.role] || "Visualizador";
$("#role").disabled = true;
try {
  const latest = latestDataset();
  raw = latest.payload;
  activeDatasetId = latest.id;
  if(sessionStorage.getItem("asg-weight-context")!==activeDatasetId)weights={};
  ASG.validate(raw);
  versions = window.investAuth.datasets
    .slice(1)
    .map((v) => ({ at: v.created_at, name: v.source_name, data: v.payload }));
  try { sessionStorage.setItem("asg-source", latest.source_name); } catch {}
  model();
  render();
} catch (e) {
  $("#app").textContent =
    "Não foi possível carregar os dados protegidos: " + e.message;
}

function competition() {
  if (filters.period !== "current" || filters.dim || filters.indicator) return '<section class="panel full"><h2>Diagnóstico dos fornecedores</h2><p>A fonte contém apenas score geral atual por fornecedor. Não há score individual E/S/G, indicador corporativo por fornecedor ou observações de fornecedores no comparativo. Limpe esses filtros para consultar o retrato atual.</p></section>';
  const classes = new Map((raw.Comparativo_Empresas||[]).filter(r=>/^CT-/.test(r[0])).map(r=>[r[0],r[6]]));
  return `<section class="panel full"><h2>Diagnóstico e acompanhamento ASG</h2><p>Score geral original da fonte, sem ordenação por desempenho, competição ou ranking. Classificação informada por empresa na aba Comparativo_Empresas.</p>${table(["EMPRESA","SCORE ATUAL (0–100)","CLASSIFICAÇÃO","DATA-BASE"],cs().map(r=>`<tr><td><a href="#" data-company="${esc(r[0])}">${esc(r[1])}</a></td><td>${num(r[14])}</td><td>${esc(classes.get(r[0])||"Não informada")}</td><td>${esc(params["Data-base"])}</td></tr>`))}<p>Scores ausentes permanecem não informados. Para evolução individual, consulte Análise histórica. Reimportar a mesma data-base cria uma versão, não um novo período.</p></section>`;
}
function materiality() {
  if (!corporate() || filters.period !== "current" || filters.indicator) return '<section class="panel full"><h2>Matriz de materialidade</h2><p>A matriz é corporativa e pertence ao retrato atual. Não há temas vinculados a um fornecedor, cidade ou indicador específico neste recorte.</p></section>';
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
  return `<section class="panel full"><h2>Matriz de materialidade</h2><p>Temas corporativos: relevância para stakeholders × impacto no negócio, em escala de 1 a 5. Não são pontuações de fornecedores. A classificação de prioridade é a informada na fonte.</p><svg viewBox="0 0 650 260" role="img" aria-label="Matriz de materialidade"><path d="M65 20V215H615" fill="none" stroke="#c9d6e8"/>${filtered.map((r) => { const cx = 65 + (r[5] / 5) * 535, cy = 215 - (r[4] / 5) * 185, k = r[8] === "Ambiental (E)" ? 0 : r[8] === "Social (S)" ? 1 : 2, fill = ["#1d3f8f", "#3b7dd8", "#a9c6f0"][k], t = `<title>${esc(r[1])}: impacto ${num(r[5])}; relevância ${num(r[4])}</title>`, st = 'stroke="#16345f" stroke-width="1.5"'; return k === 0 ? `<circle cx="${cx}" cy="${cy}" r="7" fill="${fill}" ${st}>${t}</circle>` : k === 1 ? `<rect x="${cx - 6.5}" y="${cy - 6.5}" width="13" height="13" rx="2" fill="${fill}" ${st}>${t}</rect>` : `<path d="M${cx} ${cy - 8.5}L${cx + 8.5} ${cy}L${cx} ${cy + 8.5}L${cx - 8.5} ${cy}Z" fill="${fill}" ${st}>${t}</path>`; }).join("")}<text x="240" y="250" font-size="12" fill="#1e2b40">Impacto no negócio (1–5)</text><text x="10" y="20" font-size="11" fill="#1e2b40">Relevância (1–5)</text></svg><div class="legend" aria-hidden="true"><span><i class="mk mk-c"></i>Ambiental (E)</span><span><i class="mk mk-s"></i>Social (S)</span><span><i class="mk mk-d"></i>Governança (G)</span></div>${table(
    ["TEMA", "PILAR", "STAKEHOLDERS", "NEGÓCIO", "PRIORIDADE", "GESTÃO"],
    filtered.map(
      (r) =>
        `<tr><td>${esc(r[1])}</td><td>${esc(r[8])}</td><td>${num(r[4])}</td><td>${num(r[5])}</td><td>${esc(r[6])}</td><td>${esc(r[7])}</td></tr>`,
    ),
  )}</section>`;
}
