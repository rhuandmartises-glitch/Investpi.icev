const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ASG=require('../dist/asg-core.js'),XLSX=require('../dist/vendor/xlsx.js');
const payload=require('../dist/demo-data.json').payload;
const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'Administrador',disabled:false});return elements.get(id);};
const datasets=[{id:'initial',payload,reference_date:'2026-09-30',source_name:'initial.xlsx',created_at:null}];let fail=false;
const ctx={ASG,XLSX,console,Date,JSON,Number,Set,Map,Uint8Array,DataView,sessionStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},window:{investAuth:{demo:true,profile:{role:'admin'},datasets,async saveDataset(p,n){if(fail)throw Error('quota');const row={payload:p,source_name:n,created_at:new Date().toISOString(),reference_date:ASG.parameters(p)['Data-base']};datasets.unshift(row);return row;}}},document:{querySelector:el,querySelectorAll:()=>[]},alert(){},confirm:()=>true};
vm.createContext(ctx);let source=fs.readFileSync('dist/app.js','utf8');source=source.slice(0,source.indexOf('const roleName ='))+source.slice(source.indexOf('function competition()'));vm.runInContext(source,ctx);ctx.data=payload;vm.runInContext('raw=data;model();render=()=>{}',ctx);
const run=code=>vm.runInContext(code,ctx);
function file(name,bytes){return {name,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),text:async()=>bytes.toString()};}
(async()=>{
 const wb=XLSX.utils.book_new();for(const [name,rows]of Object.entries(payload))XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),name);const bytes=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
 ctx.event={target:{files:[file('base.xlsx',bytes)]}};
 await run('importFile(event)');assert(el('#preview').innerHTML.includes('Prévia validada'));assert(run('pending!==null'));
 el('#cancelimport').onclick();assert.equal(run('pending'),null);assert.equal(datasets.length,1);
 await run('importFile(event)');await el('#confirmimport').onclick();assert.equal(datasets.length,2);assert.equal(run('raw'),datasets[0].payload);assert.equal(datasets[1].payload,payload);
 // Persistência falha antes de alterar o estado da tela.
 const old=run('raw');fail=true;await run('importFile(event)');await el('#confirmimport').onclick();assert.equal(run('raw'),old);assert.equal(datasets.length,2);fail=false;
 // CSV completo com números, conversão decimal PT-BR e AA preservada.
 const header=Array.from({length:27},(_,i)=>'c'+i);header[0]='ID';header[3]='Indicador';const rows=ASG.rows(payload,'Indicadores','IND-');const csv=[header,...rows].map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\n');ctx.event={target:{files:[file('base.csv',Buffer.from(csv))]}};
 await run('importFile(event)');assert(run('pending!==null'));await el('#confirmimport').onclick();assert.equal(datasets.length,3);assert.equal(run('ind.length'),72);
 // Arquivo inválido não altera a base nem o histórico.
 ctx.event={target:{files:[file('erro.csv',Buffer.from('ID;Indicador\n1;2'))]}};await run('importFile(event)');assert.equal(run('pending'),null);assert(el('#preview').innerHTML.includes('bloqueada'));assert.equal(datasets.length,3);
 ctx.event={target:{files:[{name:'grande.xlsx',size:11*1024*1024}]}};await run('importFile(event)');assert.equal(run('pending'),null);assert(el('#preview').innerHTML.includes('10 MiB'));
 ctx.event={target:{files:[file('base.zip',Buffer.from('invalido'))]}};await run('importFile(event)');assert(el('#preview').innerHTML.includes('somente'));
 ctx.window.investAuth.profile.role='viewer';ctx.event={target:{files:[file('base.xlsx',bytes)]}};await run('importFile(event)');assert(el('#preview').innerHTML.includes('permissão'));assert.equal(datasets.length,3);
 ctx.window.investAuth.profile.role='admin';const before=datasets.length;await run('commitDataset(ASG.clone(window.investAuth.datasets.at(-1).payload),"Recuperação")');assert.equal(datasets.length,before+1);assert.equal(datasets.at(-1).payload,payload);
 console.log('PASS: XLSX, prévia/cancelamento, confirmação, falha de persistência, CSV, arquivo inválido/grande, extensão, permissão e recuperação sem sobrescrita.');
})().catch(e=>{console.error(e);process.exitCode=1;});
