const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const ROW_GAP = 35;
const COLUMN_GAP = 40;
const COMBAT_ROOM_LENGTH = 130;
const PLAYER_FOV = Math.PI/3;
const PLAYER_VIEW_DISTANCE = 150;
const RAY_COUNT = 80;
const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const keys = {
    up: false,
    down: false,
    left: false,
    right: false
};
const player = {
    x: 20,
    y: 20,
    radius: 8,
    health: 100,
    speed: 2.5,
    damage: 20,
    gold: 0
};
const ENEMY_TYPES = [
  {
    movementType: 'patrol',
    health: 40,
    maxHealth: 40,
    damage: 5,
    speed: 0.5,
    firingSpeed: 4,         
    detectionRange: 120,
    attackPattern: 'straight',
    fov: Math.PI / 3,
    firingRate: 60,
    radius: 10
  },
  {
    movementType:    'chase',
    health:          20,
    maxHealth:       20,
    speed:           1.5,
    damage: 7,
    firingSpeed:     5,
    detectionRange:  200,
    attackPattern:   'spread',
    fov: Math.PI / 3,
    firingRate:      50,
    radius: 10
  },
  {
    movementType:    'strafe',
    health:          40,
    maxHealth:       40,
    speed:           2,
    damage: 10,
    firingSpeed:     6,
    detectionRange:  180,
    attackPattern:   'straight',
    fov: Math.PI / 3,
    firingRate:      40,
    radius: 10
  },
  {
    movementType:    'dash',
    health:          20,
    maxHealth:       20,
    speed:           5,
    damage: 12,
    firingSpeed:     3,
    detectionRange:  90,
    attackPattern:   'spread',
    fov: Math.PI / 3,
    firingRate:      80,
    radius: 10
  },
  {
    movementType:    'turret',
    health:          60,
    maxHealth:       60,
    speed:           0,
    damage: 15,
    firingSpeed:     7,       
    detectionRange:  350,
    attackPattern:   'straight',
    fov: Math.PI / 3,
    firingRate:      90,
    radius: 10
  }
];
let mouseX = 0;
let mouseY = 0;
let timer = null;
let startTime = 0;
let elapsedTime = 0;
let isRunning = false;
let doors = [];
let enemies = [];
let rooms = [];
let bullets = [];
let wallSegments = [];
let lootDrops = [];

function start(){
    if(!isRunning){
        startTime = Date.now()-elapsedTime;
        timer = setInterval(update,10);
        isRunning = true;
    }
}

function stop(){
    if(isRunning){
        clearInterval(timer);
        elapsedTime = Date.now()-startTime;
        isRunning = false;
    }
}

function update(){
    const currentTime = Date.now();
    elapsedTime = currentTime - startTime;
}

function drawTimer(){
    let minutes = Math.floor(elapsedTime/(1000*60));
    let seconds = Math.floor((elapsedTime/1000)%60);
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText(
        `Time: ${minutes.toString()}:${seconds.toString().padStart(2,'0')}`,
        GAME_WIDTH - 150,
        30
    );
}

function createBullet(shooter, targetX, targetY, team="player"){
    const dx = targetX - shooter.x;
    const dy = targetY - shooter.y;
    const angle = Math.atan2(dy,dx);
    const speed = 6;
    bullets.push({
        x: shooter.x,
        y: shooter.y,
        vx: Math.cos(angle)*speed,
        vy: Math.sin(angle)*speed,
        radius: 4,
        team: team,
        damage: shooter.damage
    });
}

function drawBullets(){
    for(const bullet of bullets){
        ctx.beginPath();
        ctx.fillStyle = "yellow";
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function updateBullets(){
    for(let i=bullets.length-1; i>=0; i--){
        const bullet = bullets[i];
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        if(bullet.team === "player"){
            for(let j=0; j<4; j++){
            for(let k=0; k<7; k++){
                const enemy = enemies[j][k];
                if(!enemy.alive)
                    continue;

                if(circleCollision(enemy, bullet)){
                    enemy.health -= bullet.damage;
                    bullets.splice(i,1);
                    if(enemy.health <= 0){
                        enemy.alive = false;
                    }
                    break;
                }
            }
        }
    }
    if(bullet.team === "enemy"){
        if(circleCollision(bullet,player)){
            player.health -= bullet.damage;
            bullets.splice(i,1);
            if(player.health <= 0){
                console.log("Game Over!");
            }
        }
    }
        let collided = false;
        for(let j=0; j<4;j++){
            for(let k=0; k<7;k++){
                const walls = getRoomWalls(rooms[j][k], doors[j][k]);
                for(const wall of walls){
                    if(circleRectCollision(bullet, wall)){
                        reflectBullet(bullet, wall);
                        collided = true;
                        break;
                    }
                }
                if(collided)
                    break;
            }
            if(collided)
                break;
        }
    }
}

function reflectBullet(bullet, wall){
    if(wall.width < wall.height){
        bullet.vx *= -1;

        if(bullet.vx > 0)
            bullet.x = wall.x + wall.width + bullet.radius;
        else
            bullet.x = wall.x - bullet.radius;
    }
    else{
        bullet.vy *= -1;
        if(bullet.vy > 0)
            bullet.y = wall.y + wall.height + bullet.radius;
        else
            bullet.y = wall.y - bullet.radius;
    }
}

function normalizeAngle(angle){
    while(angle>Math.PI)
        angle -= Math.PI*2;
    while(angle<-Math.PI)
        angle += Math.PI*2;
    return angle;
}

function enemyVision(enemy){
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.sqrt(dx*dx+dy*dy);

    if(dist>enemy.detectionRange)
        return false;

    const playerAngle = Math.atan2(dy,dx);

    const angleDiff = normalizeAngle(playerAngle - enemy.facingAngle);
    if(Math.abs(angleDiff) > (enemy.fov)/2)
        return false;

    const segments = wallSegments;
    const rayDx = Math.cos(playerAngle);
    const rayDy = Math.sin(playerAngle);
    
    for(const seg of segments){
        const hit = raySegmentIntersection(
            enemy.x, enemy.y, 
            rayDx, rayDy, 
            seg[0], seg[1], seg[2], seg[3]
        );
        
        if(hit && hit.dist < dist){
            return false; 
        }
    }
    return true;
}

function circleRectCollision(circle, rect){
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return (dx * dx + dy * dy) < (circle.radius * circle.radius);
}

function circleCollision(a,b){
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    return dist < a.radius+b.radius;
}

function playerInRoom(room){
    if(player.x>room.x+player.radius&&player.x<room.x+room.width-player.radius
        &&player.y>room.y+player.radius
        &&player.y<room.y+room.height-player.radius
    ) return true;
    else
        return false;
}

function getWallSegments(){
    const wall_segments = [];
    for(let j=0; j<4;j++){
        for(let i=0; i<7; i++){
            const walls = getRoomWalls(rooms[j][i], doors[j][i]);
            for(let wall of walls){
                wall_segments.push([
                    wall.x, wall.y,
                    wall.x+wall.width, wall.y
                ]);
                wall_segments.push([
                    wall.x+wall.width, wall.y,
                    wall.x+wall.width, wall.y+wall.height
                ]);
                wall_segments.push([
                    wall.x+wall.width, wall.y+wall.height,
                    wall.x, wall.y+wall.height
                ]);
                wall_segments.push([
                    wall.x, wall.y+wall.height,
                    wall.x, wall.y
                ]);
            }
        }
    }
    return wall_segments;
}

function getVisiblePoints(){
    const segments = wallSegments;
    const facingAngle = Math.atan2(mouseY-player.y, mouseX-player.x);
    const startAngle = facingAngle - PLAYER_FOV/2;
    const endAngle = facingAngle + PLAYER_FOV/2;
    const points = [];
    for(let i=0; i<=RAY_COUNT; i++){
        const angle = startAngle+PLAYER_FOV*i/RAY_COUNT;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        let closest = {
            x: player.x + dx*PLAYER_VIEW_DISTANCE,
            y: player.y + dy*PLAYER_VIEW_DISTANCE,
            dist: PLAYER_VIEW_DISTANCE
        };
        for(let seg of segments){
            const hit = raySegmentIntersection(player.x, player.y, dx, dy, seg[0], seg[1], seg[2], seg[3]);
            if(hit && hit.dist<closest.dist){
                closest = hit;
            }
        }
        points.push(closest);
    }
    return points;
}

function raySegmentIntersection(px, py, dx, dy, x1, y1, x2, y2){
    const rxs = dx*(y2-y1)-dy*(x2-x1);

    if(Math.abs(rxs)<0.00001){
        return null;
    }

    const t = ((x1-px)*(y2-y1)-(y1-py)*(x2-x1))/rxs;
    const u = ((x1-px)*dy-(y1-py)*dx)/rxs;

    if(t>=0&&u>=0&&u<=1){
        return{
            x: px + dx*t,
            y: py + dy*t,
            dist: t
        };
    }
    return null;
}

function drawVisionMask(){
    const points = getVisiblePoints();
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.95)";
    ctx.beginPath();
    ctx.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.moveTo(player.x, player.y);
    for(const point of points){
        ctx.lineTo(point.x, point.y);
    }
    ctx.closePath();
    ctx.fill("evenodd");
    ctx.restore();
}

function getRoomWalls(room, door){
    const walls = [];
    const wallThickness = 4;

    if(door.edge === 0){
        walls.push({
            x: room.x,
            y: room.y,
            width: wallThickness,
            height: door.y - room.y
        });
        walls.push({
            x: room.x,
            y: door.y + door.height,
            width: wallThickness,
            height: (room.y+room.height) - (door.y+door.height)
        });
    }
    else{
        walls.push({
            x: room.x,
            y: room.y,
            width: wallThickness,
            height: room.height
        });
    }

    if(door.edge === 1){
        walls.push({
            x: room.x,
            y: room.y,
            width: door.x - room.x,
            height: wallThickness
        });

        walls.push({
            x: door.x + door.width,
            y: room.y,
            width: (room.x+room.width)-(door.x+door.width),
            height: wallThickness
        });
    }
    else{
        walls.push({
            x: room.x,
            y: room.y,
            width: room.width,
            height: wallThickness
        });
    }

    if(door.edge === 2){
        walls.push({
            x: room.x + room.width - wallThickness,
            y: room.y,
            width: wallThickness,
            height: door.y-room.y
        });
        walls.push({
            x: room.x+room.width-wallThickness,
            y: door.y+door.height,
            width: wallThickness,
            height: (room.y+room.height)-(door.y+door.height)
        });
    }
    else{
        walls.push({
            x: room.x + room.width - wallThickness,
            y: room.y,
            width: wallThickness,
            height: room.height
        });
    }

    if(door.edge === 3){
        walls.push({
            x: room.x,
            y: room.y + room.height - wallThickness,
            width: door.x-room.x,
            height: wallThickness
        });
        walls.push({
            x: door.x + door.width,
            y: room.y + room.height - wallThickness,
            width: (room.x+room.width)-(door.x+door.width),
            height: wallThickness
        });
    }
    else{
        walls.push({
            x: room.x,
            y: room.y + room.height - wallThickness,
            width: room.width,
            height: wallThickness
        });
    }
    return walls;
}

function drawWalls(){
    for(let j=0; j<4; j++){
        for(let i=0; i<7; i++){
            const walls = getRoomWalls(rooms[j][i], doors[j][i]);
            for(const wall of walls){
                ctx.fillStyle = "#444";
                ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
            }
        }
    }
}


function createRooms(){
    for(let j = 0; j < 4; j++){
        let rowRooms = [];
        for(let i = 0; i < 7; i++){
            rowRooms.push({
                x: 50 + i*(COLUMN_GAP+COMBAT_ROOM_LENGTH),
                y: 70 + j*(ROW_GAP+COMBAT_ROOM_LENGTH),
                width: COMBAT_ROOM_LENGTH,
                height: COMBAT_ROOM_LENGTH
            });
        }
        rooms.push(rowRooms);
    }
}

function drawCombatZones(){
    for(let j=0; j<4; j++){
        for(let i=0; i<7; i++){
            ctx.fillStyle = "green";
            ctx.fillRect(50 + i*(COLUMN_GAP+COMBAT_ROOM_LENGTH), 70 + j*(ROW_GAP+COMBAT_ROOM_LENGTH), COMBAT_ROOM_LENGTH, COMBAT_ROOM_LENGTH);
            ctx.lineWidth = 4;
            ctx.strokeRect(50 + i*(COLUMN_GAP+COMBAT_ROOM_LENGTH), 70 + j*(ROW_GAP+COMBAT_ROOM_LENGTH), COMBAT_ROOM_LENGTH, COMBAT_ROOM_LENGTH);
            ctx.fillStyle = "yellow";
            ctx.fillRect(doors[j][i].x, doors[j][i].y, doors[j][i].width, doors[j][i].height);
        }
    }
}

function createEnemies(){
    for(let j=0; j<4; j++){
        let rowEnemies=[];
        for(let i=0; i<7; i++){
            const type = ENEMY_TYPES[Math.floor(Math.random()*ENEMY_TYPES.length)];
            const posX = 50+i*(COLUMN_GAP+COMBAT_ROOM_LENGTH);
            const posY = 70+j*(ROW_GAP+COMBAT_ROOM_LENGTH);
            rowEnemies.push({
               x: Math.max(posX+type.radius, Math.min(posX+COMBAT_ROOM_LENGTH-40, Math.random()*COMBAT_ROOM_LENGTH+posX)),
               y: Math.max(posY+type.radius, Math.min(posY+COMBAT_ROOM_LENGTH-40, Math.random()*COMBAT_ROOM_LENGTH+posY)),
               ...type,                      
               alive: true,
               active: false,
               facingAngle: 0           
             });
        }
        enemies.push(rowEnemies);
    }
}

function drawEnemies(){
    for(let j=0; j<4; j++){
        for(let i=0; i<7; i++){
            const enemy = enemies[j][i];
            if(!enemy.alive)
                continue;
            ctx.beginPath();
            ctx.fillStyle = "red";
            ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = "black";
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}

function updateEnemies(){
    for(let j=0; j<4; j++){
        for(let i=0; i<7; i++){
            const enemy = enemies[j][i];
            const room = rooms[j][i];

            if(!enemy.alive)
                continue;

            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const dist = Math.sqrt(dx*dx+dy*dy);

            if(enemy.movementType !== "patrol"){
                enemy.facingAngle = Math.atan2(dy, dx);
            }

            if(enemy.movementType === 'patrol'){
                if(enemy.patrolDir === undefined)
                    enemy.patrolDir = 1;

                if(enemy.patrolDir === 1)
                    enemy.facingAngle = 0;
                 else
                    enemy.facingAngle = Math.PI;

                enemy.x += enemy.speed*enemy.patrolDir;

                if(enemy.x>=room.x+room.width-enemy.radius)
                    enemy.patrolDir=-1;
                if(enemy.x<room.x+enemy.radius)
                    enemy.patrolDir=1;
            }            
            enemy.active = enemyVision(enemy) && playerInRoom(room);
            if(!enemy.active)
                continue;
            if(enemy.firingGap === undefined)
                enemy.firingGap = enemy.firingRate;

            enemy.firingGap--;

            if(enemy.firingGap <= 0){
                createBullet(
                    enemy,
                    player.x,
                    player.y,
                    "enemy"
                );
            enemy.firingGap = enemy.firingRate;
            }
            if (enemy.movementType === 'chase') {
                enemy.x += (dx/dist)*enemy.speed;
                enemy.y += (dy/dist)*enemy.speed;
            }
            if(enemy.movementType === 'strafe'){
                enemy.x += Math.cos(enemy.facingAngle+Math.PI/2)*enemy.speed;
                enemy.y += Math.sin(enemy.facingAngle+Math.PI/2)*enemy.speed;
                if(dist>80){
                    enemy.x += (dx/dist)*0.5;
                    enemy.y += (dy/dist)*0.5;
                }
            }
            if(enemy.movementType === 'dash'){
                if(enemy.dashTimer === undefined)
                    enemy.dashTimer=90;
                if(enemy.dashVx === undefined)
                    enemy.dashVx= 0;
                if(enemy.dashVy === undefined)
                    enemy.dashVy= 0;
                if(enemy.isDashing === undefined)
                    enemy.isDashing = false;

                if(enemy.isDashing){
                    enemy.x += enemy.dashVx;
                    enemy.y += enemy.dashVy;
                    enemy.dashVx *= 0.9;
                    enemy.dashVy *= 0.9;

                    if(Math.abs(enemy.dashVx)<0.2){
                        enemy.isDashing = false;
                        enemy.dashTimer = 90;
                    }
                }
                else{
                    enemy.dashTimer--;
                    if(enemy.dashTimer<=0){
                        enemy.isDashing = true;
                        enemy.dashVx = (dx/dist)*8;
                        enemy.dashVy = (dy/dist)*8;
                    }
                }
            }
            enemy.x = Math.max(room.x + enemy.radius, Math.min(room.x+room.width-enemy.radius, enemy.x));
            enemy.y = Math.max(room.y + enemy.radius, Math.min(room.y+room.height-enemy.radius, enemy.y));
        }
    }
}


function createDoors(){
    for(let j = 0; j<4; j++){
        let rowDoors = [];
        for(let i=0; i<7; i++){
            let edge = Math.floor(Math.random() * 4);
            let doorPosn = {};
            switch(edge){
                case 0:
                    doorPosn = {
                        x: (50+i*(COLUMN_GAP+COMBAT_ROOM_LENGTH))-2,
                        y: Math.max(70+j*(ROW_GAP+COMBAT_ROOM_LENGTH), Math.min(70+j*(ROW_GAP+COMBAT_ROOM_LENGTH)+COMBAT_ROOM_LENGTH-40, Math.random()*COMBAT_ROOM_LENGTH+70+j*(ROW_GAP+COMBAT_ROOM_LENGTH))),
                        height: 40,
                        width: 4,
                        edge: 0
                    }
                    rowDoors.push(doorPosn);
                    break;
                case 1:
                    doorPosn = {
                        x: Math.max(50+i*(COLUMN_GAP+COMBAT_ROOM_LENGTH), Math.min(50+i*(COLUMN_GAP+COMBAT_ROOM_LENGTH)+COMBAT_ROOM_LENGTH-40, Math.random()*COMBAT_ROOM_LENGTH+50+i*(COLUMN_GAP+COMBAT_ROOM_LENGTH))),
                        y: (70+j*(ROW_GAP+COMBAT_ROOM_LENGTH))-2,
                        width: 40,
                        height: 4,
                        edge: 1
                    }
                    rowDoors.push(doorPosn);
                    break;
                case 2:
                    doorPosn = {
                        x: (50+i*(COLUMN_GAP+COMBAT_ROOM_LENGTH)+COMBAT_ROOM_LENGTH)-2,
                        y: Math.max(70+j*(ROW_GAP+COMBAT_ROOM_LENGTH), Math.min(70+j*(ROW_GAP+COMBAT_ROOM_LENGTH)+COMBAT_ROOM_LENGTH-40, Math.random()*COMBAT_ROOM_LENGTH+70+j*(ROW_GAP+COMBAT_ROOM_LENGTH))),
                        height: 40,
                        width: 4,
                        edge: 2
                    }
                    rowDoors.push(doorPosn);
                    break;
                case 3:
                    doorPosn = {
                        x: Math.max(50+i*(COLUMN_GAP+COMBAT_ROOM_LENGTH), Math.min(50+i*(COLUMN_GAP+COMBAT_ROOM_LENGTH)+COMBAT_ROOM_LENGTH-40, Math.random()*COMBAT_ROOM_LENGTH+50+i*(COLUMN_GAP+COMBAT_ROOM_LENGTH))),
                        y: (70+j*(ROW_GAP+COMBAT_ROOM_LENGTH)+COMBAT_ROOM_LENGTH)-2,
                        width: 40,
                        height: 4,
                        edge: 3
                    }
                    rowDoors.push(doorPosn);
                    break;
            }
        }
        doors.push(rowDoors);
    }
}

function drawPlayer(){
    ctx.beginPath();
    ctx.arc(parseInt(player.x),parseInt(player.y), parseInt(player.radius), 0, Math.PI * 2, true);
    ctx.fillStyle = "Red";
    ctx.fill();
    ctx.strokeStyle = "Black";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText("Health: " + player.health, 20, 30);
}

function movePlayer(){

    let nextX = player.x;
    let nextY = player.y;

    if(keys.up)
        nextY -= player.speed;
    if(keys.down)
        nextY += player.speed;
    if(keys.left)
        nextX -= player.speed;
    if(keys.right)
        nextX += player.speed;

    const tempPlayer = {
        x: nextX,
        y: nextY,
        radius: player.radius
    };

    let blocked = false;

    for(let j = 0; j < 4; j++){
        for(let i = 0; i < 7; i++){
            const walls = getRoomWalls(
                rooms[j][i],
                doors[j][i]
            );
            for(const wall of walls){
                if(circleRectCollision(tempPlayer, wall)){
                    blocked = true;
                }
            }
        }
    }
    if(!blocked){
        player.x = nextX;
        player.y = nextY;
    }

    player.x = Math.max(player.radius,
        Math.min(GAME_WIDTH - player.radius, player.x));

    player.y = Math.max(player.radius,
        Math.min(GAME_HEIGHT - player.radius, player.y));
}

function scaleCanvas(){
    const scaleX = window.innerWidth/GAME_WIDTH;
    const scaleY = window.innerHeight/GAME_HEIGHT;
    const scalingFactor = Math.min(scaleX, scaleY);

    canvas.style.height = GAME_HEIGHT*scalingFactor + 'px';
    canvas.style.width = GAME_WIDTH*scalingFactor + 'px';

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
}

function getGameCoordinates(e){
    const rect = canvas.getBoundingClientRect();
    const scale = GAME_WIDTH/rect.width;
    const mouseX = (e.clientX - rect.left)*scale;
    const mouseY = (e.clientY - rect.top)*scale;
    return{
        x: mouseX,
        y: mouseY
    }
}

function gameLoop(){
    if(isRunning){
        movePlayer();
        updateEnemies();
        updateBullets();
    }
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    drawCombatZones();
    drawWalls();
    drawEnemies();
    drawBullets();
    drawVisionMask();
    drawPlayer();
    drawTimer();
    requestAnimationFrame(gameLoop);
}

canvas.addEventListener('mousemove', (e) => {
    const pos = getGameCoordinates(e);
    mouseX = pos.x;
    mouseY = pos.y;
});

canvas.addEventListener('click', (e) => {
    const pos = getGameCoordinates(e);
    createBullet(player, pos.x, pos.y, "player");
})

window.addEventListener("keydown", (e) => {
    if(e.key === 'w' || e.key === "ArrowUp")
        keys.up = true;
    if(e.key === 'a' || e.key === "ArrowLeft")
        keys.left = true;
    if(e.key === 's' || e.key === "ArrowDown")
        keys.down = true;
    if(e.key === 'd' || e.key === "ArrowRight")
        keys.right = true;
});

window.addEventListener("keyup", (e) => {
    if(e.key === 'w' || e.key === "ArrowUp")
        keys.up = false;
    if(e.key === 'a' || e.key === "ArrowLeft")
        keys.left = false;
    if(e.key === 's' || e.key === "ArrowDown")
        keys.down = false;
    if(e.key === 'd' || e.key === "ArrowRight")
        keys.right = false;
});

window.addEventListener('resize', scaleCanvas);

window.addEventListener("keydown", (e)=>{
    if(e.key.toLowerCase() === 'p'){
        stop();
    }
});

window.addEventListener("keydown", (e)=>{
    if(e.key.toLowerCase() === 'r'){
        start();
    }
})

scaleCanvas();
createRooms();
createEnemies();
createDoors();
wallSegments = getWallSegments();
start();
gameLoop();