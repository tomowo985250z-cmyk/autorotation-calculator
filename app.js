(() => {
'use strict';
const get=id=>document.getElementById(id), calculator=globalThis.AutorotationCalculator;
const {fields,create}=globalThis.AutorotationInputs, model=create(calculator);
const chartView=globalThis.AutorotationChartView.create({image:get('performance-chart'),dot:get('chart-dot'),status:get('chart-view-status'),frame:get('chart-frame')},globalThis.AutorotationChartViewConfig);
const format=v=>new Intl.NumberFormat('ja-JP',{maximumFractionDigits:1}).format(v);
const crewKg=lb=>'（'+calculator.lbToKg(lb).toFixed(1)+' kg）';
const display=(id,v)=>{get(id).textContent=v;};
const dialog=get('wheel-dialog'),wheel=get('value-wheel'),base=get('aircraftWeight');
let active=null,selected=0;
function render(){
 const s=model.snapshot();
 for(const id of ['weight-preview','wheel-total','totalWeight']) display(id,format(s.totalWeight));
 display('densityAltitude',format(s.densityAltitude));
 display('aircraftWeight-error',s.error);
 base.setAttribute('aria-invalid',String(Boolean(s.error)));
 for(const key of ['aircraftWeight',...Object.keys(fields)]){
  display(key+'-state',s.confirmed[key]?'確定済み':'未確定');
  get(key==='aircraftWeight'?'aircraftWeight-row':key+'-trigger').classList.toggle('confirmed',s.confirmed[key]);
  if(fields[key]) display(key+'-value',format(s.values[key]));
 }
 display('crewKg',crewKg(s.values.crewWeight));
 const r=calculator.rotorSpeed({densityAltitudeFt:s.densityAltitude,grossWeightLb:s.error?null:s.totalWeight},globalThis.AutorotationChart);
 chartView.update(r.point);
 display('referenceRpm',r.status==='ok'?format(r.referenceRpm):'—');
 display('rpmRange',r.status==='ok'?format(r.minRpm)+' ～ '+format(r.maxRpm):'未算出');
 const messages={
 ok:['暫定算出','赤点と同じ画像座標で左右のRPM線を補間した基準値と±5 RPMです。参考境界を超えても数値を制限・補正しません。'],
 incomplete:['入力待ち','基本重量の入力値を確認してください。'],
 'out-of-range':['補間データ範囲外','画像上で確認できたRPM線の間だけを補間します。外挿せず、計算点と参考境界の判定を保持します。'],
 unavailable:['チャート未登録','実チャートのデータが未登録です。'],
 error:['算出エラー','チャートデータまたは算出処理を確認してください。']};
 display('chart-badge',messages[r.status][0]);display('chart-status',messages[r.status][1]);
 const warnings=[r.boundary.minimum,r.boundary.maximum].filter(v=>['below-minimum','above-maximum'].includes(v?.status)).map(v=>v.message);
 display('boundary-status',!r.point?'入力待ち':warnings.length?warnings.join(' ／ '):r.boundary.status==='within-boundaries'?'参考境界内（暫定）':'境界判定未確定');
 document.querySelector('.data-note').hidden=false;
}
function select(index,scroll=false){
 if(!active)return;
 const f=fields[active];selected=Math.max(0,Math.min(f.options.length-1,index));model.select(f.options[selected]);
 Array.from(wheel.children).forEach((v,i)=>v.setAttribute('aria-selected',String(i===selected)));
 wheel.setAttribute('aria-activedescendant','wheel-option-'+selected);
 display('wheel-selection-value',format(f.options[selected])+' '+f.unit+(active==='crewWeight'?crewKg(f.options[selected]):''));
 if(scroll)wheel.scrollTop=selected*52;
 render();
}
function close(confirm){
 if(!active)return;
 const trigger=get(active+'-trigger');
 if(confirm){select(Math.round(wheel.scrollTop/52));model.confirm();}else model.cancel();
 active=null;dialog.close();render();trigger.focus({preventScroll:true});
}
for(const [key,f] of Object.entries(fields))get(key+'-trigger').addEventListener('click',()=>{
 if(!model.open(key))return;active=key;
 display('wheel-title',f.label+'（'+f.unit+'）');
 wheel.replaceChildren(...f.options.map((value,i)=>{
  const option=document.createElement('div');option.className='wheel-option';option.id='wheel-option-'+i;
  option.setAttribute('role','option');option.textContent=format(value);
  option.addEventListener('click',()=>select(i,true));return option;
 }));
 dialog.showModal();select(f.options.indexOf(model.snapshot().values[key]),true);wheel.focus({preventScroll:true});
});
wheel.addEventListener('scroll',()=>select(Math.round(wheel.scrollTop/52)));
wheel.addEventListener('keydown',e=>{
 if(!active)return;
 const indices={ArrowUp:selected-1,ArrowDown:selected+1,Home:0,End:fields[active].options.length-1};
 if(e.key in indices){e.preventDefault();select(indices[e.key],true);}
 if(e.key==='Enter'){e.preventDefault();close(true);}
});
get('confirm-wheel').addEventListener('click',()=>close(true));get('cancel-wheel').addEventListener('click',()=>close(false));
dialog.addEventListener('cancel',e=>{e.preventDefault();close(false);});
dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))close(false);});
base.addEventListener('input',()=>{model.setBase(base.validity.badInput?'invalid':base.value);render();});
get('confirm-base').addEventListener('click',()=>{if(model.confirmBase())base.value=model.snapshot().baseText;else base.focus();render();});
get('reset-inputs').addEventListener('click',()=>{model.reset();base.value='';render();});
get('conditions').addEventListener('submit',e=>e.preventDefault());
render();
})();
