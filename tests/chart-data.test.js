/* node tests/chart-data.test.js — image-space calibration and regression checks. */
(() => {
  'use strict';
  if (typeof require === 'function') {
    require('../calculator.js'); require('../rpm-calibration.js');
    require('../rpm-image-data.js'); require('../chart-data.js');
  }
  const c=globalThis.AutorotationCalculator, chart=globalThis.AutorotationChart;
  const config=globalThis.AutorotationRpmCalibration;
  let passed=0;
  function check(name, ok) { if(!ok) throw Error(name); passed++; }
  const near=(a,b)=>Math.abs(a-b)<1e-8;
  function axisValue(pixel, ticks) {
    for(let i=1;i<ticks.length;i++) {
      const a=ticks[i-1],b=ticks[i];
      if(pixel>=a.pixel && pixel<=b.pixel) return a.value+(pixel-a.pixel)/(b.pixel-a.pixel)*(b.value-a.value);
    }
    throw Error('Outside image axis');
  }
  function physical(x,y) { return {grossWeightLb:axisValue(x,config.axes.grossWeightLb.ticks),densityAltitudeFt:axisValue(y,config.axes.densityAltitudeFt.ticks)}; }
  check('Density sea level',c.densityAltitude(0,15)===0);
  check('Density uses OAT and pressure altitude',near(c.densityAltitude(3000,20),4312.8));
  check('Total weight unchanged',c.totalWeight(1800,170,200)===2170);
  check('Kg unchanged',near(c.lbToKg(170),77.1107029));
  check('No guessed ordinary 385',!chart.lines.some(line=>line.rpm===385));
  check('332 and 385 separate boundaries',chart.boundaries.minimum.rpm===332 && chart.boundaries.maximum.rpm===385);
  const all=[...chart.references,chart.boundaries.maximum];
  check('13 image lines',all.length===13);
  for(const line of all) {
    check('Multiple observed points '+line.rpm,line.points.length>=10);
    for(const p of line.points) {
      check('Measured knot '+line.rpm+'/'+p.y,near(chart.lineXAtY(line,p.y),p.x));
      if(line.rpm!==385) {
        const result=c.rotorSpeed(physical(p.x,p.y),chart);
        check('Exact line RPM '+line.rpm+'/'+p.y,result.status==='ok'&&near(result.referenceRpm,line.rpm));
      }
    }
    check('No upper extrapolation '+line.rpm,chart.lineXAtY(line,line.points[0].y-1)===null);
    check('No lower extrapolation '+line.rpm,chart.lineXAtY(line,line.points.at(-1).y+1)===null);
  }
  // Independent image rows not used as calibration knots.
  const holdouts=[[332,200,110.5],[335,200,134],[340,200,164.5],[345,200,197],[350,200,228],[355,200,264.5],[360,200,295.5],[365,200,326],[375,200,389.5],[380,200,429],[390,200,490.5],[335,360,175],[340,360,203.5],[345,360,238.5],[350,360,269],[355,360,305],[360,360,336],[365,360,368.5],[370,360,403.5],[375,360,434],[380,360,470],[385,360,500.5],[390,360,535],[335,860,320],[340,860,344],[345,860,382],[350,860,411],[355,860,443.5],[360,860,477.5],[370,860,543.5],[380,860,611.5],[390,860,688],[335,1080,387.5],[340,1080,409.5],[345,1080,448],[350,1080,477],[360,1080,541],[365,1080,572.5],[370,1080,606.5],[375,1080,641.5],[380,1080,675.5]];
  let maxError=0;
  for(const [rpm,y,x] of holdouts) {
    const error=Math.abs(chart.lineXAtY(all.find(line=>line.rpm===rpm),y)-x);
    maxError=Math.max(maxError,error);
    check('Held-out observed pixel '+rpm+'/'+y,error<=1.5);
  }
  const reference=c.rotorSpeed({grossWeightLb:2200,densityAltitudeFt:0},chart);
  check('Requested point',reference.imagePoint.x===437.5&&reference.imagePoint.y===803);
  check('Requested bracket',reference.interpolation.leftRpm===355&&reference.interpolation.rightRpm===360&&near(reference.interpolation.leftX,427.75)&&near(reference.interpolation.rightX,461.4));
  check('Requested fraction',near(reference.interpolation.fraction,9.75/33.65));
  check('Requested RPM',near(reference.referenceRpm,356.4487369985141));
  for(const y of [240,420,803,900]) {
    for(let i=1;i<chart.references.length;i++) {
      const left=chart.references[i-1],right=chart.references[i];
      const a=chart.lineXAtY(left,y),b=chart.lineXAtY(right,y);
      const p=physical((a+b)/2,y), result=c.rotorSpeed(p,chart);
      check('Adjacent midpoint '+left.rpm+'/'+right.rpm+'/'+y,near(result.referenceRpm,(left.rpm+right.rpm)/2));
      check('Unclipped ±5 '+y+'/'+i,near(result.minRpm,result.referenceRpm-5)&&near(result.maxRpm,result.referenceRpm+5));
      check('Same dot coordinate '+y+'/'+i,near(result.imagePoint.x,(a+b)/2)&&near(result.imagePoint.y,y)&&result.point.grossWeightLb===p.grossWeightLb&&result.point.densityAltitudeFt===p.densityAltitudeFt);
    }
    for(const [kind,line] of Object.entries(chart.boundaries)) {
      const x=chart.lineXAtY(line,y);
      for(const delta of [-1,0,1]) {
        const result=c.rotorSpeed(physical(x+delta,y),chart);
        const expected=kind==='minimum'&&delta<0?'below-minimum':kind==='maximum'&&delta>0?'above-maximum':'within-boundary';
        check('Boundary '+kind+'/'+delta+'/'+y,result.boundary[kind].status===expected);
        check('Warnings independent '+kind+'/'+delta+'/'+y,result.status===(kind==='minimum'&&delta<0?'out-of-range':'ok'));
      }
    }
  }
  const beyond=c.rotorSpeed(physical(651.9,803),chart);
  check('387.5 survives MAXIMUM',near(beyond.referenceRpm,387.5)&&near(beyond.minRpm,382.5)&&near(beyond.maxRpm,392.5)&&beyond.boundary.maximum.status==='above-maximum');
  const maxX=chart.lineXAtY(chart.boundaries.maximum,803),onMax=c.rotorSpeed(physical(maxX,803),chart);
  check('385 warning line does not force scalar 385',Math.abs(onMax.referenceRpm-385)>0.1&&onMax.interpolation.leftRpm===380&&onMax.interpolation.rightRpm===390);
  check('Image edge not extrapolated',c.rotorSpeed({grossWeightLb:2200,densityAltitudeFt:5000},chart).status==='out-of-range');
  check('Outside chart not extrapolated',c.rotorSpeed({grossWeightLb:2601,densityAltitudeFt:0},chart).status==='out-of-range');
  const precise={grossWeightLb:2200.123456789,densityAltitudeFt:123.456789};
  const result=c.rotorSpeed(precise,chart),direct=globalThis.AutorotationRpmCoordinates.project(precise,config);
  check('Dot and lookup share transform',near(result.imagePoint.x,direct.leftPercent/100*750)&&near(result.imagePoint.y,direct.topPercent/100*1334));
  check('Raw point frozen',Object.isFrozen(result.point)&&result.point.grossWeightLb===precise.grossWeightLb&&result.point.densityAltitudeFt===precise.densityAltitudeFt);
  check('Incomplete point',c.rotorSpeed({densityAltitudeFt:null,grossWeightLb:2200},chart).point===null);
  const synthetic=c.rotorSpeed({grossWeightLb:1900,densityAltitudeFt:0},{lookup:()=>({status:'ok',referenceRpm:330}),checkBoundaries:chart.checkBoundaries});
  check('Future below332 unclipped',synthetic.referenceRpm===330&&synthetic.minRpm===325&&synthetic.maxRpm===335);
  globalThis.AutorotationTestResults={passed,holdoutPoints:holdouts.length,maxPixelError:maxError};
  if(typeof console!=='undefined')console.log(globalThis.AutorotationTestResults);
})();
