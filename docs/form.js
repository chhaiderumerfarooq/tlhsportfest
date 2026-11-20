const $=id=>document.getElementById(id),form=$('form'),webApp=window.SPORTSFEST_WEB_APP;
const option=(value,label)=>new Option(label,value);
const money=n=>'PKR '+Number(n).toLocaleString('en-PK');
let catalog, lastPayload, token;
function field(parent,title,el){let label=document.createElement('label');label.append(title,el);parent.append(label);return el;}
function input(type,max){const el=document.createElement('input');el.type=type;el.required=true;if(max)el.maxLength=max;return el;}
function removeButton(box,after){
  const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent='Remove';b.onclick=()=>{box.remove();after();};box.append(b);
}
function player(){
  const box=document.createElement('fieldset');box.dataset.id=crypto.randomUUID();
  field(box,'Player name',input('text',100)).oninput=refreshMembers;
  field(box,'Date of birth (required)',input('date')).max=catalog.today;removeButton(box,refreshMembers);$('players').append(box);refreshMembers();
}
function refreshMembers(){
  [...$('players').children].forEach((box,i)=>{const legend=box.querySelector('legend')||box.insertBefore(document.createElement('legend'),box.firstChild);legend.textContent='Player '+(i+1);});
  for(const sel of document.querySelectorAll('.member')){
    const old=sel.value;sel.replaceChildren(option('','Select player'));
    [...$('players').children].forEach((b,i)=>sel.add(option(b.dataset.id,b.querySelector('input').value||'Player '+(i+1))));
    sel.value=old;
  }
}
function gameFor(box){return catalog.games.find(g=>g.id===box.querySelector('select').value);}
function entry(){
 const box=document.createElement('fieldset'),game=field(box,'Game and format',document.createElement('select')),body=document.createElement('div');
 for(const category of new Set(catalog.games.map(g=>g.category))){
   const group=document.createElement('optgroup');group.label=category;
   catalog.games.filter(g=>g.category===category).forEach(g=>group.append(option(g.id,g.name+' · '+g.format)));game.append(group);
 }
 box.append(body);$('entries').append(box);
 function draw(){
   body.replaceChildren();const g=gameFor(box);
   const age=field(body,'Age group',document.createElement('select'));age.className='age';g.ages.forEach(a=>age.add(option(a,a)));
   if(g.format!=='single')field(body,'Team or pair name',input('text',100)).className='team';
   for(let i=0;i<g.main+g.extras;i++){const el=document.createElement('select');el.className='member';el.required=i<g.main;field(body,i<g.main?'Player '+(i+1):'Optional substitute '+(i-g.main+1),el);}
   refreshMembers();review();
 }
 game.onchange=draw;removeButton(box,review);draw();
}
function review(){
 let total=0;$('prices').replaceChildren();
 for(const box of $('entries').children){
  const g=gameFor(box),line=document.createElement('p');line.append(g.name+' · '+g.format+' ');
  if(catalog.early&&g.regular>g.fee){const old=document.createElement('del');old.textContent=money(g.regular);line.append(old,'Early bird ');}
  line.append(money(g.fee));$('prices').append(line);total+=g.fee;
 }$('total').textContent='Net total · '+money(total);return total;
}
$('addPlayer').onclick=player;$('addEntry').onclick=entry;
form.onsubmit=async e=>{
 e.preventDefault();$('error').textContent='';$('continue').disabled=true;
 try{
  const boxes=[...$('players').children],players=boxes.map(b=>({name:b.querySelector('input').value,dob:b.querySelector('[type=date]').value}));
  const entries=[...$('entries').children].map(b=>({game:gameFor(b).id,age:b.querySelector('.age').value,team:b.querySelector('.team')?.value||'',members:[...b.querySelectorAll('.member')].filter(s=>s.value).map(s=>boxes.findIndex(p=>p.dataset.id===s.value))}));
  const feedback=(input,message)=>{
    input.setCustomValidity(message);input.reportValidity();input.setCustomValidity('');
    throw Error(message);
  };
  for(const input of form.querySelectorAll('input[type=text],input:not([type])')){
    if(!input.value.trim())feedback(input,'Please enter a value here.');
  }
  if(!entries.length||!players.length)throw Error('Add at least one player and one game.');
  const assigned=new Set(), rosters=[...$('entries').children];
  for(const [n,entry] of entries.entries()){
    const chosen=new Set();
    for(const select of rosters[n].querySelectorAll('.member')){
      if(!select.value)continue;
      const i=boxes.findIndex(b=>b.dataset.id===select.value), dob=players[i].dob;
      if(chosen.has(i))feedback(select,players[i].name+' appears twice on this roster.');
      chosen.add(i);assigned.add(i);
      const years=Number(catalog.cutoff.slice(0,4))-Number(dob.slice(0,4))-(catalog.cutoff.slice(5)<dob.slice(5)?1:0);
      if(years<0||years>=Number(entry.age.slice(1)))feedback(select,players[i].name+' is ineligible for '+entry.age+' on '+catalog.cutoff+'.');
    }
  }
  const unused=boxes.findIndex((_,i)=>!assigned.has(i));
  if(unused!==-1)feedback(boxes[unused].querySelector('input'),'Assign this player to a game or remove them.');
  const payload = JSON.stringify({...Object.fromEntries(new FormData(form)), players, entries, total: review()});
  if (payload !== lastPayload) {
    token = crypto.randomUUID();
    lastPayload = payload;
  }
  const post = document.createElement('form');
  post.method = 'POST';
  post.action = webApp;
  for (const [name, value] of Object.entries({payload, token})) {
    const field = document.createElement('input');
    field.type = 'hidden';
    field.name = name;
    field.value = value;
    post.append(field);
  }
  document.body.append(post);
  post.submit();
  post.remove();
 }catch(err){$('error').textContent=err.message;}
 finally{$('continue').disabled=false;}
};
let clockBase=0,clockStart=0,formReady=false,refreshing=false,boundary=null;
function serverNow(){return clockBase+performance.now()-clockStart;}
function drawTimers(){
 if(!catalog?.deadlines)return;
 const now=serverNow();
 for(const key of ['early','close']){
   const left=Math.max(0,Math.ceil((catalog.deadlines[key]-now)/1000));
   const hh=Math.floor(left/3600)%24,mm=Math.floor(left/60)%60,ss=left%60;
   $(key+'Timer').textContent=left?Math.floor(left/86400)+'d '+[hh,mm,ss].map(n=>String(n).padStart(2,'0')).join(':'):'Ended';
 }
 if(now>=catalog.deadlines.close&&formReady){form.hidden=true;$('status').textContent='Registration is closed.';}
 if(catalog.early&&now>=catalog.deadlines.early&&boundary!==catalog.deadlines.early){
   boundary=catalog.deadlines.early;refreshCatalog();
 }
}
function loadPublicCatalog() {
  return new Promise((resolve, reject) => {
    if (!webApp) throw Error('Registration setup is in progress.');
    const url = new URL(webApp);
    if (url.origin !== 'https://script.google.com' || !url.pathname.endsWith('/exec')) {
      throw Error('Registration setup is incomplete. Check the deployed web app URL.');
    }
    url.searchParams.set('view', 'catalog');
    url.searchParams.set('time', Date.now());
    const script = document.createElement('script');
    const fail = () => reject(Error('Game details could not load. Refresh to retry.'));
    const cleanup = () => {
      clearTimeout(timer);
      script.remove();
      delete window.tlhReceiveGames;
    };
    const timer = setTimeout(() => { cleanup(); fail(); }, 30000);
    window.tlhReceiveGames = data => {
      cleanup();
      if (data && Array.isArray(data.games)) resolve(data);
      else fail();
    };
    script.onerror = () => { cleanup(); fail(); };
    script.src = url.href;
    document.head.append(script);
  });
}
async function refreshCatalog(){
 if(refreshing)return;refreshing=true;
 try{
  const next = await loadPublicCatalog();
  if(formReady){
    const schema=c=>JSON.stringify(c.games.map(({fee,regular,...g})=>g));
    if(schema(next)!==schema(catalog)){
      form.hidden=true;$('status').textContent='Game options changed. Reload to see the latest list.';return;
    }
  }
  catalog=next;clockBase=Number(next.serverTime);clockStart=performance.now();
  $('timers').hidden=!next.deadlines;
  if(next.deadlines){
    for(const key of ['early','close']){
      const day=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Karachi',dateStyle:'long'}).format(next.deadlines[key]-1);
      $(key+'Date').textContent=day+' · end of day PKT';
    }
    drawTimers();
  }
  if(!catalog.open||!catalog.games.length){form.hidden=true;$('status').textContent='Registration is currently closed.';return;}
  $('status').textContent=catalog.early?'Early-bird registration is open.':'Regular registration is open.';
  $('notice').textContent=catalog.notice;form.hidden=false;
  if(formReady){review();return;}
  player();entry();formReady=true;
 }catch(e){$('status').textContent=e.message;}finally{refreshing=false;}
}
refreshCatalog();
setInterval(drawTimers,1000);
setInterval(()=>{if(!document.hidden)refreshCatalog();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCatalog();});
