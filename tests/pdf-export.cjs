const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ASG=require('../dist/asg-core.js'),PDFLib=require('../dist/vendor/pdf-lib.js');
const data=require('../dist/demo-data.json').payload;
const ctx={ASG,PDFLib,console,Date,JSON,Number,Set,Map,sessionStorage:{getItem:()=>null},window:{investAuth:{datasets:[]}},document:{querySelector:()=>({value:'Administrador'})}};
vm.createContext(ctx);let source=fs.readFileSync('dist/app.js','utf8');source=source.slice(0,source.indexOf('const roleName ='))+source.slice(source.indexOf('function competition()'));vm.runInContext(source,ctx);ctx.data=data;vm.runInContext('raw=data;model()',ctx);
(async()=>{
 const directory=process.env.ASG_PDF_TEST_DIRECTORY;
 for(const [name,filters]of [['coletivo',{}],['fornecedor',{company:'CT-014'}],['indicador',{dim:'Social',indicator:'IND-29'}],['comparativo',{period:'previous'}]]){
  ctx.filtersInput=filters;vm.runInContext('filters={company:"",sector:"",uf:"",city:"",dim:"",indicator:"",period:"current",...filtersInput}',ctx);
  const bytes=await vm.runInContext('createPdfBytes()',ctx);const pdf=await PDFLib.PDFDocument.load(bytes);assert(pdf.getPageCount()>=1);
  if(directory){fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(directory+'/'+name+'.pdf',bytes);}
 }
 const datasets = ["2026-07-31","2026-08-31","2026-09-30"].map((date,index)=>{
  const payload=ASG.clone(data);
  payload["Parâmetros"].find(row=>row[1]==="Data-base")[2]=date;
  return {id:String(index),reference_date:date,source_name:"Teste",payload};
 });
 ctx.window.investAuth.datasets=datasets;
 vm.runInContext('filters={...filters,period:"current",company:"CT-005"};extractRange="quarter"',ctx);
 assert.equal(vm.runInContext('extractSections().length',ctx),3);
 const historicalBytes=await vm.runInContext('createPdfBytes()',ctx);
 const historical=await PDFLib.PDFDocument.load(historicalBytes);
 assert(historical.getPageCount()>=1);
 if(directory)fs.writeFileSync(directory+'/trimestre.pdf',historicalBytes);
 console.log('PASS: geração e reabertura de PDF coletivo, fornecedor, indicador filtrado e comparativo sem dados incompatíveis.');
})().catch(e=>{console.error(e);process.exitCode=1;});
