const $ = id => document.getElementById(id);
const canvas = $("game"), ctx = canvas.getContext("2d");
let ws, self = null, roomCode = "", players = new Map(), running = false;
let world = {speed: 7, distance: 0, obstacles: [], next: 0};
let me = {x:120,y:390,vy:0,w:34,h:44,alive:true};
let remote = new Map();
let last = performance.now(), ready = false, jumpQueued = false;

function socketURL(){
  const proto = location.protocol === "https:" ? "wss://" : "ws://";
  return proto + location.host;
}
function connect(onOpen){
  ws = new WebSocket(socketURL());
  ws.onopen = onOpen;
  ws.onmessage = e => handle(JSON.parse(e.data));
  ws.onclose = () => $("status").textContent = "Disconnected";
}
function send(x){ if(ws?.readyState===1) ws.send(JSON.stringify(x)); }

function handle(m){
  if(m.type==="error"){ $("error").textContent=m.message; return; }
  if(m.type==="joined"){
    roomCode=m.code; self=m.self;
    $("lobby").classList.add("hidden"); $("gamePanel").classList.remove("hidden");
    $("roomCode").textContent=roomCode; $("status").textContent="Waiting for players…";
  }
  if(m.type==="players"){
    players.clear(); m.players.forEach(p=>players.set(p.id,p));
    renderPlayers();
    if(!running) $("status").textContent=players.size<2 ? "Need at least 2 players" : "All players must press Ready";
  }
  if(m.type==="start"){
    startGame(m.seed);
  }
  if(m.type==="state" && m.player.id!==self?.id){
    remote.set(m.player.id,m.player);
  }
  if(m.type==="eliminated"){
    const p=players.get(m.id); if(p) p.alive=false;
    renderPlayers();
  }
  if(m.type==="winner"){
    running=false;
    const winner = m.name ? `🏆 ${m.name} survives!` : "Nobody survived.";
    $("message").textContent=winner;
    $("status").textContent="Round over";
    $("ready").textContent="Restart";
  }
}
function renderPlayers(){
  $("playerList").innerHTML=[...players.values()].map(p =>
    `<div class="playerRow"><span class="dot" style="background:${p.color}"></span><strong>${escapeHtml(p.name)}</strong><span class="${p.alive?'alive':'dead'}">${p.alive?'ALIVE':'OUT'}</span></div>`
  ).join("");
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

$("create").onclick=()=>{
  const name=$("name").value.trim()||"Player";
  connect(()=>send({type:"create",name}));
};
$("join").onclick=()=>{
  const name=$("name").value.trim()||"Player";
  const code=$("room").value.trim().toUpperCase();
  if(code.length<4){$("error").textContent="Enter a valid room code.";return}
  connect(()=>send({type:"join",name,code}));
};
$("ready").onclick=()=>{
  if($("ready").textContent==="Restart"){ send({type:"restart"}); $("ready").textContent="Ready"; $("message").textContent=""; return; }
  ready=!ready; $("ready").textContent=ready?"Not Ready":"Ready"; send({type:"ready",ready});
};

function queueJump(){ if(running && me.alive) jumpQueued=true; }
addEventListener("keydown",e=>{if(e.code==="Space"||e.code==="ArrowUp"){e.preventDefault();queueJump()}});
canvas.addEventListener("pointerdown",queueJump);

function startGame(seed){
  running=true; ready=false; $("ready").textContent="Ready"; $("message").textContent="";
  me={x:120,y:390,vy:0,w:34,h:44,alive:true};
  remote.clear(); world={speed:7,distance:0,obstacles:[],next:35};
  $("status").textContent="RUN!";
  for(const p of players.values()) p.alive=true;
}

function spawnObstacle(){
  const h=34+Math.random()*70, w=28+Math.random()*34;
  world.obstacles.push({x:canvas.width+40,y:434-h,w,h});
  world.next=Math.max(30,82-world.speed*4)+Math.random()*40;
}
function rectsHit(a,b){
  return a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;
}
function eliminate(){
  if(!me.alive)return;
  me.alive=false; running=false;
  send({type:"eliminated"});
  $("message").textContent="💥 OUT — wait for the winner";
  $("status").textContent="Eliminated";
}

function update(dt){
  if(!running)return;
  world.speed=Math.min(16,7+world.distance/1200);
  world.distance += world.speed*dt*0.06;
  world.next-=dt;
  if(world.next<=0) spawnObstacle();
  for(const o of world.obstacles) o.x-=world.speed*dt*0.06;
  world.obstacles=world.obstacles.filter(o=>o.x+o.w>-20);

  me.vy += 0.72*dt;
  if(jumpQueued && me.y>=390){ me.vy=-14.5; jumpQueued=false; }
  me.y+=me.vy*dt;
  if(me.y>390){me.y=390;me.vy=0}
  for(const o of world.obstacles){
    const hit={x:me.x+6,y:me.y+7,w:me.w-12,h:me.h-8};
    if(rectsHit(hit,o)){eliminate();break}
  }
  send({type:"state",x:me.x,y:me.y,vy:me.vy,alive:me.alive});
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const g=ctx.createLinearGradient(0,0,0,canvas.height);g.addColorStop(0,"#071a29");g.addColorStop(1,"#061017");ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);
  // stars
  ctx.fillStyle="#b7e8ff"; for(let i=0;i<60;i++){const x=(i*197)%canvas.width,y=(i*83)%300;ctx.globalAlpha=.2+((i%5)/10);ctx.fillRect(x,y,2,2)}ctx.globalAlpha=1;
  // moon
  ctx.fillStyle="#eaffff";ctx.beginPath();ctx.arc(1000,95,38,0,Math.PI*2);ctx.fill();
  // ground
  ctx.fillStyle="#132733";ctx.fillRect(0,434,canvas.width,86);
  ctx.strokeStyle="#5ee7ff";ctx.globalAlpha=.3;ctx.beginPath();ctx.moveTo(0,434);ctx.lineTo(canvas.width,434);ctx.stroke();ctx.globalAlpha=1;

  for(const o of world.obstacles){
    ctx.fillStyle="#ff5c78";ctx.beginPath();ctx.roundRect(o.x,o.y,o.w,o.h,7);ctx.fill();
    ctx.fillStyle="#ffb0bb";ctx.fillRect(o.x+6,o.y+7,5,Math.min(18,o.h-10));
  }

  // remote players
  for(const [id,p] of remote){
    if(!p.alive)continue; drawDragon(p.x,p.y,players.get(id)?.color||"#8cff66",players.get(id)?.name||"");
  }
  if(me.alive) drawDragon(me.x,me.y,self?.color||"#5ee7ff",self?.name||"You");

  ctx.fillStyle="#d8f5ff";ctx.font="700 20px system-ui";ctx.fillText(`DISTANCE ${Math.floor(world.distance)}m`,24,36);
  ctx.fillStyle="#7f9cac";ctx.font="14px system-ui";ctx.fillText(`Speed ${world.speed.toFixed(1)} • Don't blink.`,24,59);
}
function drawDragon(x,y,color,name){
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(0,7,34,37,10);ctx.fill();
  ctx.beginPath();ctx.moveTo(5,12);ctx.lineTo(0,-4);ctx.lineTo(13,7);ctx.fill();
  ctx.beginPath();ctx.moveTo(26,12);ctx.lineTo(38,-4);ctx.lineTo(30,18);ctx.fill();
  ctx.fillStyle="#071018";ctx.fillRect(22,14,5,5);
  ctx.fillStyle="#eef7ff";ctx.font="11px system-ui";ctx.fillText(name,-2,-10);
  ctx.restore();
}
function loop(t){
  const dt=Math.min(2,(t-last)/16.67);last=t;
  update(dt);draw();requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
