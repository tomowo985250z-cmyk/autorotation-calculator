/* node tests/input-storage.test.js */
(() => {
  require('../calculator.js'); require('../input-model.js');
  require('../chart-view-config.js'); require('../chart-view.js');
  require('../rpm-image-data.js'); require('../chart-data.js');
  const c=AutorotationCalculator, {create,storageKey}=AutorotationInputs;
  let passed=0;
  const check=(name,ok)=>{if(!ok)throw Error(name);passed++;};
  let record=null;
  const storage={getItem:key=>{check('Namespaced read',key===storageKey);return record;},setItem:(key,value)=>{check('Namespaced write',key===storageKey);record=value;}};
  const defaults=create(c).snapshot();
  let m=create(c,storage);
  check('No saved data uses defaults',JSON.stringify(m.snapshot())===JSON.stringify(defaults));
  m.setBase('1650.25');m.confirmBase();
  for(const [key,value,confirm] of [['crewWeight',320,true],['fuelWeight',200,false],['otherWeight',30,true],['oat',18,false],['pressureAltitude',1500,true]]) {
    m.open(key);m.select(value);
    const draft=JSON.parse(record);
    check('Draft saved '+key,draft.values[key]===value&&!draft.confirmed[key]);
    if(confirm)m.confirm();else m=create(c,storage);
  }
  // A simple mixed confirmed/unconfirmed state, persisted through the same actions.
  const mixed=create(c,storage);mixed.setBase('1650.25');mixed.confirmBase();mixed.open('oat');mixed.select(19);
  const restored=create(c,storage), before=mixed.snapshot(), after=restored.snapshot();
  check('All input values restored',JSON.stringify(after.values)===JSON.stringify(before.values)&&after.baseText===before.baseText);
  check('All confirmation states restored',JSON.stringify(after.confirmed)===JSON.stringify(before.confirmed));
  check('Modal itself not restored',after.editing===null);
  check('Only input fields saved',Object.keys(JSON.parse(record)).sort().join(',')==='baseText,confirmed,values,version');
  check('No computed weight saved',!('aircraftWeight' in JSON.parse(record).values));
  check('Total recalculated',after.totalWeight===c.totalWeight(after.values.aircraftWeight,after.values.crewWeight,after.values.fuelWeight+after.values.otherWeight));
  check('DA recalculated',after.densityAltitude===c.densityAltitude(after.values.pressureAltitude,after.values.oat));
  const rpm=c.rotorSpeed({grossWeightLb:after.totalWeight,densityAltitudeFt:after.densityAltitude},AutorotationChart);
  const prior=c.rotorSpeed({grossWeightLb:before.totalWeight,densityAltitudeFt:before.densityAltitude},AutorotationChart);
  check('RPM and range recalculated',rpm.status==='ok'&&JSON.stringify(rpm)===JSON.stringify(prior));
  const valid=record;
  for(const invalid of ['{','null','[]','{}',JSON.stringify({...JSON.parse(valid),version:2}),...[
    s=>{s.values.crewWeight=240;},s=>{s.values.fuelWeight=510;},s=>{s.values.oat=41;},s=>{s.values.otherWeight=-10;},s=>{s.values.pressureAltitude=0;},s=>{s.baseText='NaN';},s=>{s.baseText='-1';},s=>{s.baseText=123;},s=>{s.confirmed.oat='true';},s=>{delete s.values.crewWeight;},s=>{s.baseText=String(Number.MAX_SAFE_INTEGER);}
  ].map(change=>{const s=JSON.parse(valid);change(s);return JSON.stringify(s);})]) {
    record=invalid;check('Invalid record falls back',JSON.stringify(create(c,storage).snapshot())===JSON.stringify(defaults));
  }
  record=valid;const cancel=create(c,storage);cancel.open('crewWeight');cancel.select(350);cancel.cancel();
  check('Cancel persists original state',create(c,storage).snapshot().values.crewWeight===320);
  cancel.reset();check('Reset persists defaults',JSON.stringify(create(c,storage).snapshot())===JSON.stringify(defaults));
  const unavailable=create(c,{getItem(){throw Error('Denied');},setItem(){throw Error('Quota');}});
  unavailable.setBase('1600');check('Storage failure leaves app usable',unavailable.snapshot().totalWeight===2050);
  globalThis.AutorotationStorageTestResults={passed};
})();
