/* Regras puras compartilhadas pelo painel, importações, exportações e testes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ASG = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const finite = n => typeof n === "number" && Number.isFinite(n);
  const clone = x => JSON.parse(JSON.stringify(x));
  const dims = {"Ambiental (E)":"Ambiental", "Social (S)":"Social", "Governança (G)":"Governança"};
  const parameters = d => Object.fromEntries((d["Parâmetros"] || []).filter(r => r[1]).map(r => [r[1],r[2]]));
  const rows = (d, name, prefix) => (d[name] || []).filter(r => typeof r[0] === "string" && r[0].startsWith(prefix));
  const isoDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  function status(row, value = row[10]) {
    if (!finite(value) || !finite(row[13]) || !finite(row[14])) return "Não calculável";
    if (row[12] === "Maior é melhor") return value >= row[13] ? "Atende" : value >= row[14] ? "Atenção" : "Crítico";
    if (row[12] === "Menor é melhor") return value <= row[13] ? "Atende" : value <= row[14] ? "Atenção" : "Crítico";
    return "Não calculável";
  }
  function calculate(row) {
    if (!finite(row[7])) return null;
    if (row[5] === "A") return row[7];
    if (!finite(row[9]) || row[9] === 0) return null;
    const factors = {"A ÷ B":1, "A ÷ B × 1.000":1000, "A ÷ B × 1.000.000":1000000};
    if (!(row[5] in factors)) return null;
    const result = row[7] / row[9] * factors[row[5]];
    return finite(result) ? result : null;
  }
  function score(items, p, overrides = {}) {
    let numerator = 0, denominator = 0;
    for (const item of items) {
      const row = item.r || item;
      const weight = overrides[row[0]] ?? row[19];
      const points = p[status(row)];
      if (!dims[row[26]] || !finite(row[10]) || !finite(weight) || weight <= 0 || !finite(points)) continue;
      numerator += weight * points; denominator += weight;
    }
    return denominator ? numerator / denominator : null;
  }
  function normalizeFilters(f = {}) {
    const next={company:"",sector:"",uf:"",city:"",dim:"",indicator:"",period:"current"};
    for(const key of Object.keys(next))if(typeof f[key]==="string")next[key]=f[key];
    if(next.period==="2026")next.period="current";
    if(next.period==="2025")next.period="previous";
    if(!["current","previous"].includes(next.period))next.period="current";
    return next;
  }
  function corporate(filters) {
    return (!filters.company || filters.company === "aurora") && !filters.sector && !filters.uf && !filters.city;
  }
  function suppliers(d, f, includeUnavailable = false) {
    if (f.company === "aurora" || f.city || f.search || (!includeUnavailable && (f.period === "previous" || f.dim || f.indicator || f.search))) return [];
    return rows(d,"Contratos_ASG","CT-").filter(r => (!f.company || r[0] === f.company) && (!f.sector || r[2] === f.sector) && (!f.uf || r[3] === f.uf));
  }
  function indicators(d, f, search = "") {
    if (!corporate(f)) return [];
    return rows(d,"Indicadores","IND-").filter(r => (!f.dim || (dims[r[26]] || "Validar classificação") === f.dim) && (!f.indicator || r[0] === f.indicator) && (!search || (r[0]+" "+r[3]).toLowerCase().includes(search.toLowerCase())));
  }
  function pearson(pairs) {
    const data = pairs.filter(p => p.length === 2 && p.every(finite));
    if (data.length < 3) return {n:data.length, r:null, reason:"Ao menos 3 pares válidos são necessários para este cálculo descritivo."};
    const n=data.length, mx=data.reduce((s,p)=>s+p[0],0)/n, my=data.reduce((s,p)=>s+p[1],0)/n;
    const xx=data.reduce((s,p)=>s+(p[0]-mx)**2,0), yy=data.reduce((s,p)=>s+(p[1]-my)**2,0);
    if (!xx || !yy) return {n,r:null,reason:"Variância nula em pelo menos uma variável."};
    return {n,r:Math.max(-1,Math.min(1,data.reduce((s,p)=>s+(p[0]-mx)*(p[1]-my),0)/Math.sqrt(xx*yy))),reason:"Correlação descritiva; não demonstra causalidade nem significância estatística."};
  }
  function validate(d, {auxiliary = true, checkCalculated = true} = {}) {
    if (!d || typeof d !== "object") throw Error("Base inválida.");
    const required = ["Indicadores","Contratos_ASG","Parâmetros"];
    if (auxiliary) required.push("Investidores","Canal_Denuncias","Riscos_Integridade","Comparativo_Empresas","Matriz_Materialidade");
    for (const name of required) if (!Array.isArray(d[name]) || d[name].some(r=>!Array.isArray(r))) throw Error("Aba obrigatória inválida: "+name);
    if (d.Contratos_ASG[3]?.[0] !== "ID contrato" || d.Contratos_ASG[3]?.[1] !== "Fornecedor") throw Error("Cabeçalho de Contratos_ASG fora do modelo suportado.");
    const parameterNames=d["Parâmetros"].filter(r=>r[1]).map(r=>r[1]);
    if(new Set(parameterNames).size!==parameterNames.length)throw Error("Parâmetros duplicados.");
    for(const [sheet,prefix] of [["Indicadores","IND"],["Contratos_ASG","CT"]]) for(const r of d[sheet]) if(typeof r[0]==="string" && r[0].startsWith(prefix) && !r[0].startsWith(prefix+"-"))throw Error("Identificador inválido em "+sheet+": "+r[0]);
    const p=parameters(d);
    if (!p["Organização (fictícia)"] || !p["Período de referência"] || !isoDate(p["Data-base"])) throw Error("Organização, período e data-base ISO são obrigatórios.");
    for (const key of ["Atende","Atenção","Crítico","Total de colaboradores","Receita líquida do período (R$ milhões)","Membros do conselho de administração","Horas trabalhadas no período","Médio a partir de (score residual)","Alto a partir de (score residual)","Crítico a partir de (score residual)","Prazo máximo de apuração (dias)","Prazo crítico / backlog (dias)"])
      if (!finite(p[key]) || p[key]<0) throw Error("Parâmetro numérico inválido: "+key);
    const sets = {};
    for (const [name,prefix] of [["Indicadores","IND-"],["Contratos_ASG","CT-"],["Investidores","INV-"],["Canal_Denuncias","DN-"],["Riscos_Integridade","RI-"],["Comparativo_Empresas","CT-"],["Matriz_Materialidade","TM-"]]) {
      const values=rows(d,name,prefix), ids=values.map(r=>r[0]);
      if (new Set(ids).size!==ids.length) throw Error("IDs duplicados em "+name);
      sets[name]=values;
    }
    if (!sets.Indicadores.length) throw Error("Nenhum indicador válido.");
    for (const r of sets.Indicadores) {
      if (!/^IND-\d+$/.test(r[0]) || !r[3] || !r[4] || !["A","A ÷ B","A ÷ B × 1.000","A ÷ B × 1.000.000"].includes(r[5]) || !["Maior é melhor","Menor é melhor"].includes(r[12])) throw Error("Definição de indicador inválida: "+r[0]);
      for (const k of [7,9,10,11,13,14,19]) if (r[k]!=null && !finite(r[k])) throw Error("Número inválido em "+r[0]+", coluna "+(k+1));
      if (![13,14,19].every(k=>finite(r[k])) || r[19]<0) throw Error("Meta, limite ou peso inválido: "+r[0]);
      if ((r[12]==="Maior é melhor" && r[13]<r[14]) || (r[12]==="Menor é melhor" && r[13]>r[14])) throw Error("Meta e limite invertidos: "+r[0]);
      if (r[26]!=null && !dims[r[26]]) throw Error("Classificação ASG inválida: "+r[0]);
      if(checkCalculated) {
        const calculated=calculate(r);
        if ((calculated===null)!==(r[10]===null) || (finite(calculated) && (!finite(r[10]) || Math.abs(calculated-r[10])>1e-9*(1+Math.abs(calculated))))) throw Error("Resultado divergente de A/B em "+r[0]);
        if(r[15]!==status(r) || r[18] !== (finite(r[10]) ? (p[status(r)]??null) : null))throw Error("Status ou pontos divergentes em "+r[0]);
      }
    }
    for (const r of sets.Contratos_ASG) {
      if (!/^CT-[\w-]+$/.test(r[0]) || !r[1] || !r[2] || !["Alto","Médio","Baixo"].includes(r[5]) || !/^[A-Z]{2}$/.test(r[3]) || !finite(r[4]) || r[4]<0 || (r[14]!=null && (!finite(r[14]) || r[14]<0 || r[14]>100)) || (r[15]!=null && (!Number.isInteger(r[15]) || r[15]<0)) || !isoDate(r[16])) throw Error("Contrato inválido: "+r[0]);
      for (let k=6;k<=13;k++) if (!["Sim","Não",null].includes(r[k])) throw Error("Resposta contratual inválida: "+r[0]);
    }
    const contracts=new Map(sets.Contratos_ASG.map(r=>[r[0],r]));
    for (const r of sets.Comparativo_Empresas) {
      const c=contracts.get(r[0]);
      if (!c) throw Error("Comparativo sem contrato correspondente: "+r[0]);
      for (const [a,b] of [[1,1],[2,2],[3,3],[4,4],[5,14],[7,6],[8,12],[9,13],[10,5]]) if (r[a]!==c[b]) throw Error("Comparativo divergente do contrato: "+r[0]);
      const expected=finite(c[14]) ? c[14]>=85 ? "Excelente" : c[14]>=70 ? "Adequado" : "Crítico" : null;
      if (r[6]!==expected) throw Error("Classificação divergente do score: "+r[0]);
    }
    if (auxiliary && sets.Comparativo_Empresas.length!==sets.Contratos_ASG.length) throw Error("Comparativo incompleto.");
    for (const r of sets.Matriz_Materialidade) {
      if (!r[1] || ![4,5].every(k=>finite(r[k]) && r[k]>=1 && r[k]<=5) || !dims[r[8]]) throw Error("Tema material inválido: "+r[0]);
      if(r[6] !== (r[4]*r[5]>=20?"Alta":r[4]*r[5]>=12?"Média":"Baixa")) throw Error("Prioridade material divergente: "+r[0]);
    }
    for (const r of sets.Investidores) {
      if (!r[1] || ![3,4,9].every(k=>finite(r[k]) && r[k]>=0) || !isoDate(r[10]) || r[10]>p["Data-base"]) throw Error("Investidor inválido: "+r[0]);
      for (const k of [5,6,7,8]) if (!["Sim","Não",null].includes(r[k])) throw Error("Resposta de investidor inválida: "+r[0]);
    }
    for (const r of sets.Canal_Denuncias) {
      if(!["Concluída","Em apuração"].includes(r[6]) || !["Procedente","Pendente","Improcedente"].includes(r[9]) || !["Sim","Não",null].includes(r[4]) || !["Sim","Não",null].includes(r[11]) || (r[6]==="Em apuração" && r[7]!=null) || (r[6]==="Concluída" && r[9]==="Pendente"))throw Error("Estado do caso inválido: "+r[0]);
      if (!isoDate(r[1]) || r[1]>p["Data-base"] || (r[7]!=null && (!isoDate(r[7]) || r[7]<r[1] || r[7]>p["Data-base"])) || (r[6]==="Concluída" && !r[7])) throw Error("Datas do caso inválidas: "+r[0]);
    }
    for (const r of sets.Riscos_Integridade) if (![3,4].every(k=>finite(r[k]) && r[k]>=1 && r[k]<=5) || !finite(r[6]) || r[6]<0 || r[6]>1 || !isoDate(r[11]) || !["Sim","Não",null].includes(r[9])) throw Error("Risco inválido: "+r[0]);
    if(checkCalculated && auxiliary) {
      const recalculated=recalc(clone(d));
      const byId=new Map(rows(recalculated,"Indicadores","IND-").map(r=>[r[0],r]));
      for(const r of sets.Indicadores) for(const column of [7,9,10]) {
        const expected=byId.get(r[0])[column],actual=r[column];
        if(expected!==actual && !(finite(expected)&&finite(actual)&&Math.abs(expected-actual)<=1e-9*(1+Math.abs(expected)))) throw Error("Vínculo com abas auxiliares divergente em "+r[0]+", coluna "+(column+1));
      }
    }
    return {indicators:sets.Indicadores.length, contracts:sets.Contratos_ASG.length};
  }
  function checkXlsxArchive(bytes) {
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    let end=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) if(view.getUint32(i,true)===0x06054b50){end=i;break;}
    if(end<0)throw Error("Arquivo XLSX não é um ZIP válido.");
    if(view.getUint16(end+4,true)||view.getUint16(end+6,true))throw Error("ZIP multipartes não suportado.");
    const entries=view.getUint16(end+10,true),offset=view.getUint32(end+16,true);
    if(entries>2000 || entries===65535 || offset===0xffffffff)throw Error("Arquivo contém entradas demais ou utiliza ZIP64.");
    let at=offset,total=0;
    for(let i=0;i<entries;i++) {
      if(at+46>bytes.length || view.getUint32(at,true)!==0x02014b50)throw Error("Diretório ZIP inválido.");
      if(view.getUint16(at+8,true)&1)throw Error("Planilha criptografada não suportada.");
      const size=view.getUint32(at+24,true);total+=size;
      if(size>10*1024*1024 || total>25*1024*1024)throw Error("Planilha excede o limite de expansão (25 MiB total; 10 MiB por entrada).");
      at+=46+view.getUint16(at+28,true)+view.getUint16(at+30,true)+view.getUint16(at+32,true);
    }
    return {entries,uncompressedBytes:total};
  }
  function parseCSV(text) {
    text=text.replace(/^\uFEFF/,"");
    const delimiter=text.split(/\r?\n/)[0].includes(";") ? ";" : ",";
    let records=[],row=[],cell="",quoted=false;
    for(let i=0;i<text.length;i++) {
      const c=text[i];
      if(c==='"') { if(quoted && text[i+1]==='"') {cell+='"';i++;} else quoted=!quoted; }
      else if(c===delimiter && !quoted) {row.push(cell);cell="";}
      else if((c==='\n'||c==='\r') && !quoted) {if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==""))records.push(row);row=[];cell="";}
      else cell+=c;
    }
    if(quoted)throw Error("CSV com aspas não fechadas.");
    if(cell || row.length){row.push(cell);records.push(row);}
    if(!records.length)throw Error("CSV vazio.");
    const head=records[0];
    if(head[0]!=="ID" || head[3]!=="Indicador" || ![24,27].includes(head.length))throw Error("CSV exige cabeçalho original com 24 ou 27 colunas.");
    const numeric=new Set([7,9,10,11,13,14,16,18,19]);
    return records.map((r,index)=>{
      if(r.length!==head.length)throw Error("Quantidade de colunas inválida na linha "+(index+1));
      if(!index)return r;
      return r.map((v,k)=>{
        v=v.trim();if(!v)return null;
        if(numeric.has(k)) {
          if(delimiter===";" && /^-?\d+,\d+$/.test(v))v=v.replace(",",".");
          if(!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v))throw Error("Número inválido no CSV, linha "+(index+1)+", coluna "+(k+1));
          const n=Number(v);if(!finite(n))throw Error("Número fora do limite.");return n;
        }
        if(/^[=+@]/.test(v))throw Error("CSV aceita valores, não fórmulas.");
        return v;
      });
    });
  }
  // Um retrato por data-base: reimportações são versões, não novos períodos.
  function snapshots(datasets) {
    const dates=new Map();
    for(const d of [...datasets].sort((a,b)=>(b.created_at||"").localeCompare(a.created_at||""))) if(!dates.has(d.reference_date))dates.set(d.reference_date,d);
    return [...dates.values()].sort((a,b)=>a.reference_date.localeCompare(b.reference_date));
  }
function recalc(d) {
  let p = api.parameters(d),
    c = d.Contratos_ASG.filter((r) => /^CT-/.test(r[0])),
    v = (d.Investidores || []).filter((r) => /^INV-/.test(r[0])),
    n = (d.Canal_Denuncias || []).filter((r) => /^DN-/.test(r[0])),
    risks = (d.Riscos_Integridade || []).filter((r) => /^RI-/.test(r[0])),
    date = p["Data-base"],
    days = (a, b) => Math.floor((new Date(a) - new Date(b)) / 86400000),
    sum = (rows, k) => rows.every(r=>api.finite(r[k])) ? rows.reduce((s,r)=>s+r[k],0) : null,
    count = (rows, k, x) => rows.filter((r) => r[k] === x).length;
  n.forEach((r) => (r[8] = days(r[7] || date, r[1])));
  v.forEach((r) => {
    let a = new Date(r[10]),
      b = new Date(date);
    r[7] =
      a.getUTCFullYear() === b.getUTCFullYear() &&
      Math.floor(a.getUTCMonth() / 3) === Math.floor(b.getUTCMonth() / 3)
        ? "Sim"
        : "Não";
  });
  risks.forEach((r) => {
    r[5] = r[3] * r[4];
    r[7] = Math.round(r[5] * (1 - r[6]) * 10) / 10;
    r[8] =
      r[7] >= p["Crítico a partir de (score residual)"]
        ? "Crítico"
        : r[7] >= p["Alto a partir de (score residual)"]
          ? "Alto"
          : r[7] >= p["Médio a partir de (score residual)"]
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
    37: [c.filter(r=>api.finite(r[14])).reduce((s,r)=>s+r[4]*r[14],0), sum(c.filter(r=>api.finite(r[14])),4)],
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
    53: [n.length, p["Total de colaboradores"]],
    54: [
      n.filter((r) => r[6] === "Concluída" && r[8] <= p["Prazo máximo de apuração (dias)"]).length,
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
      n.filter((r) => r[6] === "Em apuração" && r[8] > p["Prazo crítico / backlog (dias)"]).length,
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
    if ([1, 2, 5].includes(k)) r[9] = p["Membros do conselho de administração"];
    if ([9, 10, 11, 14, 19, 60].includes(k)) r[9] = p["Total de colaboradores"];
    if (k === 46) r[9] = p["Receita líquida do período (R$ milhões)"];
    if (k === 48) r[9] = p["Horas trabalhadas no período"];
    // Fontes auxiliares ausentes não equivalem a respostas negativas.
    if (k>=27 && k<=33 && c.some(row=>row[k-21]==null)) r[7]=null;
    if (k===34 && c.some(row=>row[7]==null)) r[7]=null;
    if (k===35 && c.some(row=>row[5]==="Alto" && row[13]==null)) r[7]=null;
    if([39,41].includes(k) && v.some(row=>row[k===39?6:8]==null)) r[7]=null;
    if(k===44 && v.some(row=>row[5]==null))r[7]=null;
    if(k===15 && n.some(row=>row[9]==="Procedente" && row[10]==null))r[7]=null;
    if(k===57 && n.some(row=>row[6]==="Concluída" && row[11]==null))r[7]=null;
    if(k===68 && risks.some(row=>["Alto","Crítico"].includes(row[8]) && row[9]==null))r[7]=null;
    r[10] = api.calculate(r);
    r[15] = api.status(r);
    r[18] = api.finite(r[10]) ? (p[r[15]] ?? null) : null;
  });
  return d;
}

  const api = {finite,clone,dims,parameters,rows,isoDate,status,calculate,score,normalizeFilters,corporate,suppliers,indicators,pearson,validate,parseCSV,checkXlsxArchive,snapshots,recalc};
  return api;
});
