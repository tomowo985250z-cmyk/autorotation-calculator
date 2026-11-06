/* Shared swipe / confirm / cancel operation for all six input cards. */
(() => {
  'use strict';
  const get=id=>document.getElementById(id), model=globalThis.PowerAssuranceInputs;
  const dialog=get('wheel-dialog'), wheel=get('value-wheel');
  let active=null, original=null, options=[], selected=0, trigger=null;
  function select(index,scroll=false,preview=true) {
    if(!active)return;
    selected=Math.max(0,Math.min(options.length-1,index));
    [...wheel.children].forEach((node,i)=>node.setAttribute('aria-selected',String(i===selected)));
    wheel.setAttribute('aria-activedescendant','wheel-option-'+selected);
    get('wheel-selection-value').textContent=options[selected].label+' '+model.fields[active].unit;
    if(scroll)wheel.scrollTop=selected*52;
    if(preview)model.preview(active,options[selected].value);
  }
  function close(confirm) {
    if(!active)return;
    if(confirm){select(Math.round(wheel.scrollTop/52),false,false);model.preview(active,options[selected].value);model.confirm(active);}
    else model.restore(active,original);
    active=null;dialog.close();trigger.focus({preventScroll:true});
  }
  for(const button of document.querySelectorAll('[data-picker]'))button.addEventListener('click',()=>{
    active=button.dataset.picker;trigger=button;original=model.snapshot(active);
    const f=model.fields[active];
    options=f.options??Array.from({length:Math.floor((f.max-f.min)/f.step)+1},(_,i)=>{
      const value=f.min+i*f.step;return {value,label:new Intl.NumberFormat('ja-JP').format(value)};
    });
    wheel.replaceChildren(...options.map((option,index)=>{
      const node=document.createElement('div');node.id='wheel-option-'+index;node.className='wheel-option';
      node.setAttribute('role','option');node.textContent=option.label;
      node.addEventListener('click',()=>select(index,true));return node;
    }));
    get('wheel-title').textContent=f.label+(f.unit?'（'+f.unit+'）':'');
    get('wheel-help').textContent='上下にスワイプして選択'+(active==='n1'?'。範囲は入力用で、運用限界を示しません。':'');
    dialog.showModal();
    select(options.findIndex(option=>String(option.value)===original.value),true,false);
    wheel.focus({preventScroll:true});
  });
  wheel.addEventListener('scroll',()=>{
    if(active&&Math.round(wheel.scrollTop/52)!==selected)select(Math.round(wheel.scrollTop/52));
  });
  wheel.addEventListener('keydown',event=>{
    if(!active)return;
    const indices={ArrowUp:selected-1,ArrowDown:selected+1,Home:0,End:options.length-1};
    if(event.key in indices){event.preventDefault();select(indices[event.key],true);}
    if(event.key==='Enter'){event.preventDefault();close(true);}
  });
  get('confirm-wheel').addEventListener('click',()=>close(true));
  get('cancel-wheel').addEventListener('click',()=>close(false));
  dialog.addEventListener('cancel',event=>{event.preventDefault();close(false);});
  dialog.addEventListener('click',event=>{
    const r=dialog.getBoundingClientRect();
    if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))close(false);
  });
})();
