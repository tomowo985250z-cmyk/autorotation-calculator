/* Input confirmation is independent from the provisional calculation assessment. */
(() => {
  'use strict';
  const get = id => document.getElementById(id), data = globalThis.PowerAssuranceData;
  const calculator = globalThis.PowerAssuranceCalculator;
  const fields = Object.freeze({
    pressureAltitude: { label:'気圧高度', unit:'ft', min:data.altitudes[0].value, max:data.altitudes.at(-1).value, step:10, initial:330 },
    oat: { label:'OAT', unit:'℃', min:data.temperatures[0].value, max:data.temperatures.at(-1).value, step:1, initial:20 },
    torque: { label:'トルク', unit:'PSI', min:data.torqueTicks[0][0], max:data.torqueTicks.at(-1)[0], step:1, initial:50 },
    actualTot: { label:'実測TOT', unit:'℃', min:data.totTicks[0][0], max:data.totTicks.at(-1)[0], step:10, initial:500 },
    // This selection range is a UI range, not an operational limit.
    n1: { label:'N1', unit:'%', min:0, max:110, step:1, initial:90 },
    bleedValve: { label:'ブリードバルブ全閉確認', unit:'', initial:'unconfirmed',
      options:[{value:'unconfirmed',label:'未確認'},{value:'confirmed',label:'確認済'}] }
  });
  const confirmed = Object.fromEntries(Object.keys(fields).map(id => [id,false]));
  const format = value => Number.isFinite(value) ? value.toFixed(1) : '—';
  function valid(id) {
    const f=fields[id], value=get(id).value, n=Number(value);
    return f.options ? f.options.some(o=>o.value===value)
      : value!=='' && Number.isFinite(n) && n>=f.min && n<=f.max && Math.abs((n-f.min)/f.step-Math.round((n-f.min)/f.step))<1e-8;
  }
  function render() {
    for(const [id,f] of Object.entries(fields)){
      const value=get(id).value;
      get(id+'-value').textContent=f.options ? f.options.find(o=>o.value===value)?.label ?? '—' : value;
      get(id+'-state').textContent=confirmed[id] ? '確定済' : '未確定';
      get(id+'-trigger').classList.toggle('confirmed',confirmed[id]);
    }
    const input=Object.fromEntries(Object.keys(fields).map(id=>[id,get(id).value]));
    const result=calculator.calculate(input), all=Object.keys(fields).every(id=>confirmed[id]&&valid(id));
    get('chart-tot').textContent=format(result.chartTotC);
    get('actual-tot').textContent=format(result.actualTotC);
    get('margin').textContent=result.marginC===null ? '—' : (result.marginC>0?'+':'')+format(result.marginC);
    const totConfirmed=['pressureAltitude','oat','torque','actualTot'].every(id=>confirmed[id]&&valid(id));
    const resultTone=totConfirmed&&result.status==='ok'&&Number.isFinite(result.marginC)
      ? (result.marginC<0?'negative':'nonnegative') : 'neutral';
    get('assessment-label').dataset.tone=resultTone;
    get('margin').dataset.tone=resultTone;
    get('margin').style.color=resultTone==='neutral'?'var(--muted)':resultTone==='negative'?'#bd3f4a':'#25774c';
    get('results').dataset.inputsConfirmed=String(all);
    const error=result.status==='ok' ? '' : result.status==='out-of-range'
      ? '登録データの範囲外です。外挿は行いません。' : '入力値を確認してください。';
    get('calculation-status').textContent=(all?'全入力確定済み（参考値）。':'未確定の入力があります。')+error;
    const n1=Number(input.n1), low=n1<94;
    get('n1-note').textContent=low
      ? 'N1は暫定参考帯未満です。全閉・未閉は断定できません。'
      : 'N1は暫定参考帯以上です。ただし、全閉は断定できません。';
    const valveConfirmed=confirmed.bleedValve, closed=input.bleedValve==='confirmed';
    const tone=!valveConfirmed?'neutral':closed||!low?'success':'caution';
    get('condition-status').classList.remove('neutral','success','caution');
    get('condition-status').classList.add(tone);
    get('bleedValve-trigger').classList.toggle('valve-caution',tone==='caution');
    get('bleedValve-trigger').classList.toggle('valve-success',tone==='success');
    get('n1-note').classList.toggle('caution',valveConfirmed&&!closed&&low);
    get('n1-note').classList.toggle('success',valveConfirmed&&!closed&&!low);
    get('condition-status').textContent=!valveConfirmed ? 'ブリードバルブ確認は未確定です。'
      : closed ? 'ブリードバルブ全閉確認済' : '全閉未確認：測定条件を確認してください';
  }
  function preview(id,value) {
    if(get(id).value!==String(value)) confirmed[id]=false;
    get(id).value=value; render();
  }
  function confirm(id) { if(valid(id)) confirmed[id]=true; render(); }
  function snapshot(id) { return {value:get(id).value,confirmed:confirmed[id]}; }
  function restore(id,state) { get(id).value=state.value;confirmed[id]=state.confirmed;render(); }
  function reset() {
    for(const [id,f] of Object.entries(fields)){get(id).value=f.initial;confirmed[id]=false;}
    render();
  }
  globalThis.PowerAssuranceInputs=Object.freeze({fields,preview,confirm,snapshot,restore});
  get('conditions').addEventListener('submit',event=>event.preventDefault());
  get('reset').addEventListener('click',reset);
  reset();
})();
