const canvas=document.getElementById('game');
const ctx=canvas.getContext('2d');
canvas.width=window.innerWidth;
canvas.height=window.innerHeight;

let score=0;
let keys={};
let bullets=[];
let enemies=[];
let player={x:canvas.width/2,y:canvas.height-80,w:40,h:40,speed:7};

window.addEventListener('keydown',e=>keys[e.key]=true);
window.addEventListener('keyup',e=>keys[e.key]=false);
window.addEventListener('click',()=>shoot());

function shoot(){
 bullets.push({x:player.x,y:player.y});
}

setInterval(()=>{
 enemies.push({x:Math.random()*canvas.width,y:-40,size:35});
},700);

function update(){
 if(keys['ArrowLeft']||keys['a']) player.x-=player.speed;
 if(keys['ArrowRight']||keys['d']) player.x+=player.speed;
 bullets.forEach(b=>b.y-=10);
 enemies.forEach(e=>e.y+=3);
 bullets.forEach((b,bi)=>{
  enemies.forEach((e,ei)=>{
   if(Math.abs(b.x-e.x)<30&&Math.abs(b.y-e.y)<30){
    enemies.splice(ei,1); bullets.splice(bi,1); score+=10;
   }
  });
 });
 document.getElementById('score').innerText=score;
}

function draw(){
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle='white';
 for(let i=0;i<80;i++)ctx.fillRect((i*97)%canvas.width,(i*53)%canvas.height,2,2);
 ctx.fillStyle='#00ffcc';
 ctx.beginPath();
 ctx.moveTo(player.x,player.y-25);
 ctx.lineTo(player.x-20,player.y+20);
 ctx.lineTo(player.x+20,player.y+20);
 ctx.fill();
 ctx.fillStyle='#ffff00';
 bullets.forEach(b=>ctx.fillRect(b.x-3,b.y,6,15));
 ctx.fillStyle='#ff3333';
 enemies.forEach(e=>ctx.fillRect(e.x-20,e.y-20,40,40));
}

function loop(){update();draw();requestAnimationFrame(loop)}
loop();
