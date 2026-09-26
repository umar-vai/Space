const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');

function resize(){canvas.width=innerWidth;canvas.height=innerHeight;}
resize();
window.onresize=resize;

let score=0, level=1, lives=3, gameOver=false;
let keys={}, bullets=[], enemies=[], particles=[];
let player={x:innerWidth/2,y:innerHeight-100,w:45,h:45,speed:8};

addEventListener('keydown',e=>keys[e.key.toLowerCase()]=true);
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
addEventListener('click',shoot);

function shoot(){if(!gameOver) bullets.push({x:player.x,y:player.y-30});}

setInterval(()=>{
 if(!gameOver) enemies.push({x:Math.random()*canvas.width,y:-40,size:35+level*3,speed:2+level});
},700);

function explode(x,y){for(let i=0;i<15;i++)particles.push({x,y,dx:(Math.random()-0.5)*8,dy:(Math.random()-0.5)*8,life:30});}

function update(){
 if(gameOver)return;
 if(keys['a']||keys['arrowleft'])player.x-=player.speed;
 if(keys['d']||keys['arrowright'])player.x+=player.speed;
 player.x=Math.max(25,Math.min(canvas.width-25,player.x));
 bullets.forEach(b=>b.y-=12);
 enemies.forEach(e=>e.y+=e.speed);
 particles.forEach(p=>{p.x+=p.dx;p.y+=p.dy;p.life--;});
 bullets.forEach((b,bi)=>enemies.forEach((e,ei)=>{
  if(Math.abs(b.x-e.x)<30&&Math.abs(b.y-e.y)<30){explode(e.x,e.y);enemies.splice(ei,1);bullets.splice(bi,1);score+=10;level=1+Math.floor(score/100);}
 }));
 enemies.forEach((e,i)=>{if(e.y>canvas.height){enemies.splice(i,1);lives--;if(lives<=0)gameOver=true;}});
 document.getElementById('score').innerText=`Score: ${score} | Lives: ${lives} | Level: ${level}`;
}

function draw(){
 ctx.clearRect(0,0,canvas.width,canvas.height);
 for(let i=0;i<120;i++){ctx.fillStyle='#fff';ctx.fillRect((i*83)%canvas.width,(i*47)%canvas.height,2,2);}
 ctx.fillStyle='#00ffff';ctx.beginPath();ctx.moveTo(player.x,player.y-30);ctx.lineTo(player.x-25,player.y+25);ctx.lineTo(player.x+25,player.y+25);ctx.fill();
 ctx.fillStyle='#ffe600';bullets.forEach(b=>ctx.fillRect(b.x-3,b.y,6,18));
 ctx.fillStyle='#ff3344';enemies.forEach(e=>{ctx.beginPath();ctx.arc(e.x,e.y,e.size/2,0,Math.PI*2);ctx.fill();});
 particles.forEach(p=>{ctx.fillStyle='#ff9900';ctx.fillRect(p.x,p.y,4,4);});
 if(gameOver){ctx.fillStyle='white';ctx.font='48px Arial';ctx.fillText('GAME OVER',canvas.width/2-150,canvas.height/2);}
}
function loop(){update();draw();requestAnimationFrame(loop)}
loop();