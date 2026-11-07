// Fixture privada gerada a partir da planilha, não incluída no repositório.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
let source=fs.readFileSync('dist/app.js','utf8');
source=source.slice(0,source.indexOf('const roleName ='))+source.slice(source.indexOf('// Ranking:'));
const ctx={console,sessionStorage:{getItem:()=>null},window:{investAuth:{datasets:[]}},document:{querySelector:()=>({value:'Administrador'})}};
vm.createContext(ctx);vm.runInContext(source,ctx);ctx.fixture=data;
vm.runInContext('raw=fixture;model()',ctx);
assert.equal(vm.runInContext('ind.length',ctx),72);
assert.equal(vm.runInContext('contracts.length',ctx),24);
assert.equal(vm.runInContext('ind.filter(i=>i.dim==="Ambiental").length',ctx),3);
assert.equal(vm.runInContext('ind.filter(i=>i.dim==="Social").length',ctx),3);
assert.equal(vm.runInContext('ind.filter(i=>i.dim==="Governança").length',ctx),66);
assert.equal(vm.runInContext('ind[0].row',ctx),3);
const ranked=vm.runInContext('rankCompanies(contracts)',ctx);
assert.equal(ranked[0].row[14],98);assert.equal(ranked[1].rank,1);
assert.equal(ranked.at(-1).row[14],54);
let row=['CT-test','Empresa'];row[14]=80;
let old=['CT-test','Empresa'];old[14]=70;
ctx.row=row;ctx.snapshots=[{reference_date:'2025-09-30',payload:{Contratos_ASG:[old]}}];
assert.equal(vm.runInContext('growthFor(row,snapshots,"2026-09-30").points',ctx),10);
assert.equal(vm.runInContext('growthFor(row,snapshots,"2025-09-30")',ctx),null);
row[14]=null;ctx.missing=[row];assert.equal(vm.runInContext('rankCompanies(missing).length',ctx),0);
const recalc=vm.runInContext('recalc(JSON.parse(JSON.stringify(fixture)))',ctx);
let original=data.Indicadores.filter(r=>/^IND-/.test(r[0]));
let calculated=recalc.Indicadores.filter(r=>/^IND-/.test(r[0]));
let diffs=original.filter((r,i)=>Math.abs(r[10]-calculated[i][10])>1e-8).map(r=>r[0]);
console.log('Diferenças entre recálculo e valores armazenados:',diffs);
assert.equal(diffs.length,0);
assert(!fs.existsSync('dist/data.json'));
assert(!fs.readFileSync('dist/index.html','utf8').includes('<script src="app.js">'));
console.log('PASS: dados, classificação, linhas de origem, empates, crescimento, ausência, recálculo e ausência de payload público.');

// Selecionar fornecedor deve mostrar seus dados, sem zeros corporativos.
for (const row of data.Contratos_ASG.filter(r => /^CT-/.test(r[0]))) {
  ctx.selectedId = row[0];
  vm.runInContext('filters={company:selectedId,sector:"",uf:"",dim:"",period:"2026"}',ctx);
  const html = vm.runInContext('dashboard()',ctx);
  assert(html.includes(row[1].replace(/&/g,'&amp;')));
  assert(html.includes('Score ASG da empresa'));
  assert(html.includes('Cláusulas e verificações'));
  assert(!html.includes('Panorama das dimensões ASG'));
  assert(!html.includes('Indicadores corporativos</small>'));
  assert(vm.runInContext('intelligence()',ctx).includes('Score ASG da empresa'));
}
vm.runInContext('filters.period="2025"',ctx);
assert(vm.runInContext('dashboard()',ctx).includes('Sem dados de fornecedores para 2025'));
assert(!vm.runInContext('dashboard()',ctx).includes('Cláusulas e verificações'));
vm.runInContext('filters.period="2026";filters.uf="XX"',ctx);
assert(vm.runInContext('dashboard()',ctx).includes('Nenhuma empresa neste recorte'));
vm.runInContext('filters={company:"aurora",sector:"",uf:"",dim:"",period:"2026"}',ctx);
assert(vm.runInContext('dashboard()',ctx).includes('Panorama das dimensões ASG'));
console.log('PASS: seleção dos 24 fornecedores, inteligência, período ausente, filtros conflitantes e retorno corporativo.');
