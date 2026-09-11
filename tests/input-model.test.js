/* node tests/input-model.test.js */
(() => {
 require('../calculator.js');require('../input-model.js');
 const m=AutorotationInputs.create(AutorotationCalculator),f=AutorotationInputs.fields;
 let passed=0;const check=(name,v)=>{if(!v)throw Error(name);passed++;};
 check('Blank base totals450',m.snapshot().totalWeight===450&&m.snapshot().values.aircraftWeight===0);
 check('Default density uses both inputs',Math.abs(m.snapshot().densityAltitude-3075.2)<1e-9);
 for(const [key,min,max] of [['crewWeight',250,350],['fuelWeight',0,500],['otherWeight',0,3000]]){
  check(key+' ranges',f[key].options.length===(max-min)/10+1&&f[key].options[0]===min&&f[key].options.at(-1)===max);
  check(key+' steps',f[key].options.every((v,i)=>v===min+i*10));
 }
 check('Temperature range',f.oat.options.length===61&&f.oat.options[0]===-20&&f.oat.options[60]===40);
 check('Altitude options',JSON.stringify(f.pressureAltitude.options)==='[2000,1500,1000]');
 m.setBase('1700');check('Basic draft',m.snapshot().totalWeight===2150&&!m.snapshot().confirmed.aircraftWeight);
 m.confirmBase();check('Basic confirm',m.snapshot().confirmed.aircraftWeight);
 m.setBase('1710');check('Basic edit',!m.snapshot().confirmed.aircraftWeight);
 m.open('otherWeight');m.select(100);check('Other draft',m.snapshot().totalWeight===2260);
 m.cancel();check('Cancel restores value',m.snapshot().totalWeight===2160);
 m.open('crewWeight');m.select(350);m.confirm();check('Crew confirmed',m.snapshot().confirmed.crewWeight);
 m.open('crewWeight');m.select(340);m.cancel();check('Cancel restores confirmation',m.snapshot().confirmed.crewWeight&&m.snapshot().values.crewWeight===350);
 m.open('pressureAltitude');check('Reject arbitrary altitude',!m.select(0));m.cancel();
 m.open('fuelWeight');check('Reject off-step fuel',!m.select(151));m.cancel();
 m.setBase('');check('Blank base still totals',m.snapshot().totalWeight===500);
 m.confirmBase();check('Confirm blank is zero',m.snapshot().baseText==='0'&&m.snapshot().confirmed.aircraftWeight);
 m.setBase('-1');check('Invalid base rejected',Boolean(m.snapshot().error)&&!m.confirmBase());
 m.setBase(String(Number.MAX_SAFE_INTEGER));check('Overflow rejected',Boolean(m.snapshot().error));
 m.reset();check('Reset defaults',m.snapshot().totalWeight===450&&Object.values(m.snapshot().confirmed).every(v=>!v));
 globalThis.AutorotationInputTestResults={passed};
})();

