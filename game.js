const canvas = document.getElementById('gameScreen');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });

let gameRunning = false;
let score = 0;
let player = { x: canvas.width / 2, y: canvas.height / 2, radius: 18, color: '#66fcf1', speed: 4.5, health: 100, maxHealth: 100 };
let inputKeys = {};
let playerBullets = [];
let localBots = [];

// Tactical Weapon Constraints
let ammo = 30;
let maxAmmo = 30;
let isReloading = false;
let lastShotTime = 0;
let fireRate = 150; // Delay in milliseconds between rifle rounds

window.addEventListener('keydown', e => { inputKeys[e.key.toLowerCase()] = true; if(e.key.toLowerCase() === 'r') reloadWeapon(); });
window.addEventListener('keyup', e => { inputKeys[e.key.toLowerCase()] = false; });

// Mouse Tracking for Soldier Direction
let mousePos = { x: 0, y: 0 };
window.addEventListener('mousemove', e => { mousePos.x = e.clientX; mousePos.y = e.clientY; });

// Continuous Automatic Firing States
let isFiring = false;
window.addEventListener('mousedown', () => isFiring = true);
window.addEventListener('mouseup', () => isFiring = false);

function shootBullet() {
    if (!gameRunning || isReloading || ammo <= 0) return;
    let currentTime = Date.now();
    if (currentTime - lastShotTime < fireRate) return;

    let targetAngle = Math.atan2(mousePos.y - player.y, mousePos.x - player.x);
    playerBullets.push({
        x: player.x + Math.cos(targetAngle) * player.radius,
        y: player.y + Math.sin(targetAngle) * player.radius,
        vectorX: Math.cos(targetAngle) * 14, 
        vectorY: Math.sin(targetAngle) * 14,
        radius: 3
    });

    ammo--;
    document.getElementById('ammo-val').innerText = ammo;
    lastShotTime = currentTime;

    if (ammo <= 0) reloadWeapon();
}

function reloadWeapon() {
    if (isReloading || ammo === maxAmmo) return;
    isReloading = true;
    document.getElementById('weapon-name').innerText = "RELOADING...";
    setTimeout(() => {
        ammo = maxAmmo;
        document.getElementById('ammo-val').innerText = ammo;
        document.getElementById('weapon-name').innerText = "M4A1 TACTICAL";
        isReloading = false;
    }, 1500); 
}

function triggerHitmarker() {
    let hm = document.getElementById('hitmarker');
    hm.style.transform = "translate(-50%, -50%) scale(1)";
    setTimeout(() => { hm.style.transform = "translate(-50%, -50%) scale(0)"; }, 50);
}

function damagePlayer(amount) {
    player.health -= amount;
    if (player.health < 0) player.health = 0;
    
    document.getElementById('health-bar').style.width = player.health + "%";
    document.getElementById('health-text').innerText = `HEALTH: ${player.health}%`;
    document.getElementById('damage-flash').style.boxShadow = "inset 0 0 100px rgba(255,0,0,0.8)";
    setTimeout(() => { document.getElementById('damage-flash').style.boxShadow = "inset 0 0 100px rgba(255,0,0,0)"; }, 100);

    if (player.health <= 0) {
        alert("MISSION FAILED. You were eliminated from the area.");
        location.reload();
    }
}

// Call of Duty Style Auto-Regeneration System
setInterval(() => {
    if (gameRunning && player.health < player.maxHealth && player.health > 0) {
        player.health = Math.min(player.maxHealth, player.health + 5);
        document.getElementById('health-bar').style.width = player.health + "%";
        document.getElementById('health-text').innerText = `HEALTH: ${player.health}%`;
    }
}, 1000);

function launchSoloMatch() {
    document.getElementById('menu-container').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    gameRunning = true;
    for(let i = 0; i < 5; i++) { spawnNewBot(); }
    runEngineLoop();
}

// Custom Party System Trigger Link
function launchPartyMatch() {
    const code = document.getElementById('partyCodeInput').value;
    if(!code || code.trim() === "") { 
        alert("CRITICAL: Input a tactical party code first!"); 
        return; 
    }
    
    // Connect directly to the network architecture in server.js
    const connectionSuccess = MultiplayerNetwork.connectToLobby(code);
    
    if(connectionSuccess) {
        document.getElementById('menu-container').style.display = 'none';
        document.getElementById('hud').style.display = 'block';
        gameRunning = true;
        for(let i = 0; i < 3; i++) { spawnNewBot(); } // Fewer bots since teammates are here
        runEngineLoop();
    }
}

function spawnNewBot() {
    localBots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 16,
        color: '#ff3333',
        speed: 1.8,
        lastShot: 0
    });
}

function runEngineLoop() {
    if (!gameRunning) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isFiring) shootBullet();

    // Player Movement Vectors
    if (inputKeys['w'] || inputKeys['arrowup']) player.y -= player.speed;
    if (inputKeys['s'] || inputKeys['arrowdown']) player.y += player.speed;
    if (inputKeys['a'] || inputKeys['arrowleft']) player.x -= player.speed;
    if (inputKeys['d'] || inputKeys['arrowright']) player.x += player.speed;

    // Window edge clamps
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

    // Send your real-time coordinates out to the networking stream inside server.js
    let lookAngle = Math.atan2(mousePos.y - player.y, mousePos.x - player.x);
    if (typeof MultiplayerNetwork !== 'undefined') {
        MultiplayerNetwork.broadcastTacticalTelemetry(player.x, player.y, lookAngle);
    }

    // Render User Soldier Graphics
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(lookAngle);
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, -3, player.radius + 12, 6);
    ctx.restore();

    // Render Connected Teammates / Friends from server.js database values
    if (typeof MultiplayerNetwork !== 'undefined') {
        MultiplayerNetwork.renderMultiplayerPeers(ctx);
    }

    // Bullet Coordinates Tracking
    playerBullets.forEach((bullet, bIndex) => {
        bullet.x += bullet.vectorX;
        bullet.y += bullet.vectorY;
        
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#66fcf1';
        ctx.fill();
        ctx.closePath();

        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            playerBullets.splice(bIndex, 1);
        }
    });

    // Enemy AI Movement Loops
    localBots.forEach((bot, botIndex) => {
        let dx = player.x - bot.x;
        let dy = player.y - bot.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 150) {
            bot.x += (dx / dist) * bot.speed;
            bot.y += (dy / dist) * bot.speed;
        }

        // AI Threat Engagement Routine
        let now = Date.now();
        if (dist < 400 && now - bot.lastShot > 1500) {
            damagePlayer(15); 
            bot.lastShot = now;
        }

        ctx.beginPath();
        ctx.arc(bot.x, bot.y, bot.radius, 0, Math.PI * 2);
        ctx.fillStyle = bot.color;
        ctx.fill();
        ctx.closePath();

        // Hit Detection Scanning loops
        playerBullets.forEach((bullet, bulletIndex) => {
            let hDx = bullet.x - bot.x;
            let hDy = bullet.y - bot.y;
            let hDist = Math.sqrt(hDx * hDx + hDy * hDy);

            if (hDist < bot.radius + bullet.radius) {
                localBots.splice(botIndex, 1);
                playerBullets.splice(bulletIndex, 1);
                triggerHitmarker();
                score += 100; 
                document.getElementById('scoreBox').innerText = score;
                setTimeout(spawnNewBot, 2000);
            }
        });
    });

    requestAnimationFrame(runEngineLoop);
}
