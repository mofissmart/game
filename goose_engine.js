/**
 * GOOSESHOT.IO MAIN 3D GAMEPLAY ENGINE (PART 1)
 * Handles PointerLock Controls, Custom Goose Avatars, and Explosive Rocket Jumps
 */
let scene, camera, renderer, controls, activeWeaponMesh;
let gameRunning = false, score = 0, playerHealth = 100;

// LOLShot Weapon Configuration Profile
const WEAPONS = [
    { name: "NAILGUN REPLICA", fireRate: 110, ammo: Infinity, color: 0x7f8c8d, size: 0.03 },
    { name: "GOOSE ROCKET LAUNCHER", fireRate: 850, ammo: 15, color: 0xd35400, size: 0.08 },
    { name: "RAILGUN SNIPER", fireRate: 1200, ammo: 10, color: 0x2980b9, size: 0.05 }
];
let currentWeaponIndex = 0, lastFireTimestamp = 0;

// Aerial Physics Mapping Profiles
let moveF = false, moveB = false, moveL = false, moveR = false;
let velocity = new THREE.Vector3(), inputDirection = new THREE.Vector3(), isGrounded = true;
let prevTime = performance.now();

let activeProjectiles = [], arenaGeeseList = [], launchPads = [];

function launch3DArena() {
    // Setup 3D Scene framework
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0412); // Neon cyber background
    scene.fog = new THREE.FogExp2(0x0a0412, 0.015);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Wire PointerLock camera configuration setup
    controls = new THREE.PointerLockControls(camera, document.body);
    scene.add(controls.getObject());
    controls.getObject().position.set(0, 3, 0); // Clear ground plane spawning

    document.addEventListener('click', () => { if(gameRunning) controls.lock(); });
    controls.addEventListener('lock', () => { document.getElementById('hint-banner').style.display = 'none'; });
    controls.addEventListener('unlock', () => { if(gameRunning) document.getElementById('hint-banner').style.display = 'block'; });

    // Environment Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    let sun = new THREE.DirectionalLight(0xff33aa, 0.5); sun.position.set(20, 50, 10); scene.add(sun);

    // Equip default weapon mesh model
    let gunData = WEAPONS[currentWeaponIndex];
    activeWeaponMesh = new THREE.Mesh(new THREE.BoxGeometry(gunData.size, gunData.size, gunData.size * 6), new THREE.MeshStandardMaterial({ color: gunData.color, roughness: 0.2 }));
    activeWeaponMesh.position.set(0.18, -0.22, -0.38);
    camera.add(activeWeaponMesh);

    buildMapInfrastructure();
    generateFlockAvatars();
    bindMovementListeners();

    gameRunning = true;
    prevTime = performance.now();
    animate();
}

function buildMapInfrastructure() {
    // Combat floor geometry tracking
    let arenaFloor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: 0x11131c, roughness: 0.9 }));
    arenaFloor.rotation.x = -Math.PI / 2; scene.add(arenaFloor);
    scene.add(new THREE.GridHelper(240, 48, 0xff33aa, 0x1d2436));

    // Yellow Jump-pads configurations
    let padGeo = new THREE.CylinderGeometry(3.5, 3.5, 0.3, 16);
    let padMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    [{x: 0, z: -30}, {x: -45, z: 20}, {x: 45, z: 15}].forEach(pos => {
        let pad = new THREE.Mesh(padGeo, padMat); pad.position.set(pos.x, 0.15, pos.z);
        scene.add(pad); launchPads.push(pad);
    });
}

// Programmatic Construction of 3D Goose Models
function assembleGooseAvatar(beakHex, bodyHex) {
    let gooseGroup = new THREE.Group();

    // Body capsule mesh configuration
    let bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.9, 4, 8), new THREE.MeshStandardMaterial({ color: bodyHex, roughness: 0.4 }));
    bodyMesh.position.y = 0.5; gooseGroup.add(bodyMesh);

    // Neck vertical cylinder structure
    let neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.7, 8), new THREE.MeshStandardMaterial({ color: bodyHex }));
    neckMesh.position.set(0, 1.1, 0.2); neckMesh.rotation.x = 0.2; gooseGroup.add(neckMesh);

    // Head sphere mesh model asset element
    let headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshStandardMaterial({ color: bodyHex }));
    headMesh.position.set(0, 1.4, 0.3); gooseGroup.add(headMesh);

    // Orange threat beacon beak cone extension geometry
    let beakMesh = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 8), new THREE.MeshStandardMaterial({ color: beakHex }));
    beakMesh.position.set(0, 1.4, 0.45); beakMesh.rotation.x = Math.PI / 2; gooseGroup.add(beakMesh);

    return gooseGroup;
}

function generateFlockAvatars() {
    // Spawns varied goose factions across coordinate map arrays
    const factions = [
        { beak: 0xff6600, body: 0xffffff }, // Guard Goose (White)
        { beak: 0xffaa00, body: 0x4a5357 }, // Mallard Mercenary (Grey)
        { beak: 0xe65c00, body: 0x6e503b }  // Canada Commando (Brown)
    ];

    for(let i = 0; i < 6; i++) {
        let profile = factions[i % factions.length];
        let gooseAvatar = assembleGooseAvatar(profile.beak, profile.body);
        
        gooseAvatar.position.set((Math.random() - 0.5) * 110, 0, (Math.random() - 0.5) * 110);
        gooseAvatar.lastShotStamp = 0;
        
        scene.add(gooseAvatar);
        arenaGeeseList.push(gooseAvatar);
    }
}
function bindMovementListeners() {
    document.addEventListener('keydown', e => {
        if(!controls.isLocked) return;
        switch(e.code) {
            case 'KeyW': moveF = true; break; case 'KeyS': moveB = true; break;
            case 'KeyA': moveL = true; break; case 'KeyD': moveR = true; break;
            case 'Space': if(isGrounded) { velocity.y += 18; isGrounded = false; } break;
            case 'Digit1': currentWeaponIndex = 0; refreshEquippedWeapon(); break;
            case 'Digit2': currentWeaponIndex = 1; refreshEquippedWeapon(); break;
            case 'Digit3': currentWeaponIndex = 2; refreshEquippedWeapon(); break;
        }
    });
    document.addEventListener('keyup', e => {
        switch(e.code) { case 'KeyW': moveF = false; break; case 'KeyS': moveB = false; break; case 'KeyA': moveL = false; break; case 'KeyD': moveR = false; break; }
    });
    document.addEventListener('wheel', e => {
        if(!controls.isLocked) return;
        currentWeaponIndex = e.deltaY > 0 ? (currentWeaponIndex + 1) % WEAPONS.length : (currentWeaponIndex - 1 + WEAPONS.length) % WEAPONS.length;
        refreshEquippedWeapon();
    });
    document.addEventListener('mousedown', e => { if(controls.isLocked && e.button === 0) fireActiveWeapon(); });
}

function refreshEquippedWeapon() {
    let data = WEAPONS[currentWeaponIndex];
    activeWeaponMesh.geometry.dispose();
    activeWeaponMesh.geometry = new THREE.BoxGeometry(data.size, data.size, data.size * 6);
    activeWeaponMesh.material.color.setHex(data.color);
    document.getElementById('weapon-lbl').innerText = `${data.name} (${currentWeaponIndex + 1})`;
    document.getElementById('ammo-num').innerText = data.ammo === Infinity ? "∞" : data.ammo;
}

function fireActiveWeapon() {
    let gun = WEAPONS[currentWeaponIndex]; let now = Date.now();
    if(now - lastFireTimestamp < gun.fireRate || (gun.ammo !== Infinity && gun.ammo <= 0)) return;
    if(gun.ammo !== Infinity) { gun.ammo--; document.getElementById('ammo-num').innerText = gun.ammo; }
    lastFireTimestamp = now;

    // Recoil action vector transform
    activeWeaponMesh.position.z = -0.26; setTimeout(() => { activeWeaponMesh.position.z = -0.38; }, 50);

    let travelVector = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    let projectileMesh = new THREE.Mesh(new THREE.SphereGeometry(gun.name.includes("ROCKET") ? 0.16 : 0.04, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    
    projectileMesh.position.copy(controls.getObject().position);
    projectileMesh.velocityVector = travelVector.multiplyScalar(gun.name.includes("ROCKET") ? 1.9 : 4.2);
    projectileMesh.isRocketProjectile = gun.name.includes("ROCKET");
    
    scene.add(projectileMesh);
    activeProjectiles.push(projectileMesh);
}

function renderHitmarkerOverlay() {
    let targetElement = document.getElementById('hitmarker'); targetElement.style.transform = "translate(-50%, -50%) scale(1)";
    setTimeout(() => { targetElement.style.transform = "translate(-50%, -50%) scale(0)"; }, 55);
}

function processExplosionSplash(blastPoint) {
    let playerDistance = controls.getObject().position.distanceTo(blastPoint);
    
    // LOLShot Rocket Jump Acceleration math: launches player high into the sky if close to floor blast
    if (playerDistance < 8.5) {
        let launchIntensity = (8.5 - playerDistance) * 4.6;
        velocity.y += launchIntensity; 
        isGrounded = false;
    }

    arenaGeeseList.forEach(goose => {
        if(goose.position.distanceTo(blastPoint) < 9.0) {
            renderHitmarkerOverlay(); score += 50;
            document.getElementById('scoreVal').innerText = score;
            goose.position.set((Math.random() - 0.5) * 110, 0, (Math.random() - 0.5) * 110);
        }
    });
}

function animate() {
    if (!gameRunning) return; requestAnimationFrame(animate);
    const clockTime = performance.now(); const delta = (clockTime - prevTime) / 1000;

    if(!isGrounded) velocity.y -= 42 * delta; // Heavy arcade aerial fall values
    velocity.x -= velocity.x * 8.0 * delta; velocity.z -= velocity.z * 8.0 * delta;

    inputDirection.z = Number(moveF) - Number(moveB); inputDirection.x = Number(moveR) - Number(moveL); inputDirection.normalize();
    let forwardSpeed = isGrounded ? 180.0 : 65.0;
    if(moveF || moveB) velocity.z -= inputDirection.z * forwardSpeed * delta;
    if(moveL || moveR) velocity.x -= inputDirection.x * forwardSpeed * delta;

    controls.moveRight(-velocity.x * delta); controls.moveForward(-velocity.z * delta);
    controls.getObject().position.y += velocity.y * delta;

    // Standard floor boundaries lock clamping
    if (controls.getObject().position.y <= 2.0) { velocity.y = 0; controls.getObject().position.y = 2.0; isGrounded = true; }

    // Intersecting Jump pads
    launchPads.forEach(pad => {
        let flatDistance = Math.hypot(controls.getObject().position.x - pad.position.x, controls.getObject().position.z - pad.position.z);
        if(flatDistance < 3.6 && controls.getObject().position.y <= 2.3) { velocity.y = 32; isGrounded = false; }
    });

    // Handle projectile tracking arrays
    for(let i = activeProjectiles.length - 1; i >= 0; i--) {
        let b = activeProjectiles[i]; b.position.add(b.velocityVector); let clearNode = false;
        
        if(b.position.y <= 0.1 || Math.abs(b.position.x) > 130 || Math.abs(b.position.z) > 130) {
            if(b.isRocketProjectile) processExplosionSplash(b.position); clearNode = true;
        }
        
        if(!clearNode) {
            for(let j = arenaGeeseList.length - 1; j >= 0; j--) {
                let currentGoose = arenaGeeseList[j];
                let checkPos = currentGoose.position.clone().add(new THREE.Vector3(0, 0.7, 0));
                if(b.position.distanceTo(checkPos) < 1.4) {
                    if(b.isRocketProjectile) {
                        processExplosionSplash(b.position);
                    } else {
                        renderHitmarkerOverlay(); score += 100;
                        document.getElementById('scoreVal').innerText = score;
                        currentGoose.position.set((Math.random() - 0.5) * 110, 0, (Math.random() - 0.5) * 110);
                    }
                    clearNode = true; break;
                }
            }
        }
        if(clearNode) { scene.remove(b); activeProjectiles.splice(i, 1); }
    }

    // AI Goose Navigation behaviors loops
    arenaGeeseList.forEach(goose => {
        let hunterDirection = new THREE.Vector3().subVectors(controls.getObject().position, goose.position);
        hunterDirection.y = 0; hunterDirection.normalize();
        goose.position.add(hunterDirection.multiplyScalar(0.04));
        goose.rotation.y = Math.atan2(hunterDirection.x, hunterDirection.z);
    });

    renderer.render(scene, camera); prevTime = clockTime;
}

window.addEventListener('resize', () => {
    if(!gameRunning) return;
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
