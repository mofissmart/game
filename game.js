const canvas = document.getElementById('gameScreen');
const ctx = canvas.getContext('2d');

// Size setup dynamically
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });

// State parameters
let gameRunning = false;
let score = 0;
let player = { x: canvas.width / 2, y: canvas.height / 2, radius: 16, color: '#00ff00', speed: 5 };
let inputKeys = {};
let playerBullets = [];
let localBots = [];

// Movement Listeners
window.addEventListener('keydown', e => { inputKeys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup', e => { inputKeys[e.key.toLowerCase()] = false; });

// Shooting Engine
window.addEventListener('click', e => {
    if (!gameRunning) return;
    // Track exact angle from canvas player anchor to mouse pointer pixel coordinates
    let targetAngle = Math.atan2(e.clientY - player.y, e.clientX - player.x);
    playerBullets.push({
        x: player.x,
        y: player.y,
        vectorX: Math.cos(targetAngle) * 9,
        vectorY: Math.sin(targetAngle) * 9,
        radius: 4
    });
});

function launchSoloMatch() {
    document.getElementById('menu-container').style.display = 'none';
    gameRunning = true;
    
    // Spawn 4 automated enemy bot entities across random map points
    for(let i = 0; i < 4; i++) { spawnNewBot(); }
    
    runEngineLoop();
}

function launchPartyMatch() {
    const code = document.getElementById('partyCodeInput').value;
    if(!code) { alert("Please input a party code code room string!"); return; }
    // Standalone fallback activation block if external master network socket handshake misses
    launchSoloMatch();
}

function spawnNewBot() {
    localBots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 15,
        color: '#ff3333',
        speed: 2.2
    });
}

function runEngineLoop() {
    if (!gameRunning) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply Player Local Velocity Vector adjustments
    if (inputKeys['w'] || inputKeys['arrowup']) player.y -= player.speed;
    if (inputKeys['s'] || inputKeys['arrowdown']) player.y += player.speed;
    if (inputKeys['a'] || inputKeys['arrowleft']) player.x -= player.speed;
    if (inputKeys['d'] || inputKeys['arrowright']) player.x += player.speed;

    // Boundary constraints lock
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

    // Render User Vector Profile
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.closePath();

    // Loop & Clean Bullet Coordinates arrays
    playerBullets.forEach((bullet, bIndex) => {
        bullet.x += bullet.vectorX;
        bullet.y += bullet.vectorY;
        
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffff00';
        ctx.fill();
        ctx.closePath();

        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            playerBullets.splice(bIndex, 1);
        }
    });

    // Run AI Pathfinder Tracking algorithms
    localBots.forEach((bot, botIndex) => {
        let distanceX = player.x - bot.x;
        let distanceY = player.y - bot.y;
        let vectorLength = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

        if (vectorLength > 2) {
            bot.x += (distanceX / vectorLength) * bot.speed;
            bot.y += (distanceY / vectorLength) * bot.speed;
        }

        // Draw active enemy units
        ctx.beginPath();
        ctx.arc(bot.x, bot.y, bot.radius, 0, Math.PI * 2);
        ctx.fillStyle = bot.color;
        ctx.fill();
        ctx.closePath();

        // Hit registration verification
        playerBullets.forEach((bullet, bulletIndex) => {
            let hitDistX = bullet.x - bot.x;
            let hitDistY = bullet.y - bot.y;
            let hitMagnitude = Math.sqrt(hitDistX * hitDistX + hitDistY * hitDistY);

            if (hitMagnitude < bot.radius + bullet.radius) {
                localBots.splice(botIndex, 1);
                playerBullets.splice(bulletIndex, 1);
                score += 10;
                document.getElementById('scoreBox').innerText = score;
                setTimeout(spawnNewBot, 2000); // Re-instantiate bot in 2 seconds
            }
        });
    });

    requestAnimationFrame(runEngineLoop);
}
