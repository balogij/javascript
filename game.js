const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hexSize = 30; // Egy hatszög oldalhossza
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const radius = 6;

// Hex-koordináta -> Pixel-koordináta
function hexToPixel(q, r) {
    let x = hexSize * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r);
    let y = hexSize * (3/2 * r);
    return { x: x + centerX, y: y + centerY };
}

// Egy hatszög kirajzolása
function drawHex(q, r, color = "#555") {
    const { x, y } = hexToPixel(q, r);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        let angle = Math.PI / 180 * (60 * i - 30);
        ctx.lineTo(x + hexSize * Math.cos(angle), y + hexSize * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#888";
    ctx.stroke();
    
    // Koordináták kiírása (segítség a fejlesztéshez)
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "10px Arial";
    ctx.fillText(`${q},${r}`, x - 10, y + 5);
}

// A teljes rács legenerálása
function drawMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let q = -radius; q <= radius; q++) {
        let r1 = Math.max(-radius, -q - radius);
        let r2 = Math.min(radius, -q + radius);
        
        for (let r = r1; r <= r2; r++) {
            let color = "#444"; // Alap szín (senki földje/közép)
            
            // Térfelek megjelölése
            if (r <= -1) color = "#2a3d52"; // Player 1 területe (kékesszürke)
            if (r >= 1) color = "#522a2a";  // Player 2 területe (vöröses)
            
            drawHex(q, r, color);
        }
    }
}

drawMap();

// Új globális változók
let gamePhase = 'PLACEMENT'; // 'PLACEMENT' vagy 'COMBAT'
let turnQueue = [];          // Az aktuális kör cselekvési sorrendje
let activeUnit = null;       // Aki éppen cselekszik

let selectedUnitType = 'warrior';
let player1UnitsLeft = { warrior: 2, archer: 2, priest: 1, mage: 1, total: 4 };
let player2UnitsLeft = { warrior: 2, archer: 2, priest: 1, mage: 1, total: 4 };
let units = []; // Ebben tároljuk a lerakott egységeket
let currentPlayer = 1;

// 1. Pixel -> Tört Hex koordináta
function pixelToHex(x, y) {
    let q = (Math.sqrt(3) / 3 * (x - centerX) - 1 / 3 * (y - centerY)) / hexSize;
    let r = (2 / 3 * (y - centerY)) / hexSize;
    return hexRound(q, r);
}

// 2. Hex kerekítés (ez kritikus a pontos kattintáshoz)
function hexRound(q, r) {
    let s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    let q_diff = Math.abs(rq - q);
    let r_diff = Math.abs(rr - r);
    let s_diff = Math.abs(rs - s);

    if (q_diff > r_diff && q_diff > s_diff) rq = -rr - rs;
    else if (r_diff > s_diff) rr = -rq - rs;
    else rs = -rq - rr;

    return { q: rq, r: rr };
}

// 3. Egységválasztás
function selectUnit(type) {
    selectedUnitType = type;
    document.getElementById('statusMsg').innerText = `Kiválasztva: ${type}. Kattints a pályára!`;
}

// 4. Kattintás eseménykezelő
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hex = pixelToHex(x, y);

    // Pályán kívülre kattintás szűrése
    if (Math.abs(hex.q) > radius || Math.abs(hex.r) > radius || Math.abs(-hex.q - hex.r) > radius) return;

    if (gamePhase === 'PLACEMENT') {
        handlePlacement(hex.q, hex.r);
    } else if (gamePhase === 'COMBAT') {
        handleCombatAction(hex.q, hex.r);
    }
});

function handlePlacement(q, r) {
    const pData = currentPlayer === 1 ? player1UnitsLeft : player2UnitsLeft;
    
    // Feltételek ellenőrzése
    if (pData.total <= 0) return;
    if (pData[selectedUnitType] <= 0) {
        alert("Ebből az egységből nincs több!");
        return;
    }
    
    // Térfél ellenőrzés
    if (currentPlayer === 1 && r >= 0) { alert("Ez nem a te térfeled! (P1: r < 0)"); return; }
    if (currentPlayer === 2 && r <= 0) { alert("Ez nem a te térfeled! (P2: r > 0)"); return; }

    // Foglalt-e a mező?
    if (units.some(u => u.q === q && u.r === r)) return;

    // Egység hozzáadása
    units.push({
        type: selectedUnitType,
        player: currentPlayer,
        q: q,
        r: r,
        hp: 100,
        color: currentPlayer === 1 ? '#00ccff' : '#ff3300'
    });

    // Készlet csökkentése
    pData[selectedUnitType]--;
    pData.total--;

	// Játékos váltás
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    
    // ELLENŐRZÉS: Elfogyott minden egység? Indul a harc!
    if (player1UnitsLeft.total === 0 && player2UnitsLeft.total === 0) {
        startCombat();
    } else {
        updateUI();
    }
    
    drawAll();
}

function updateUI() {
    if (player1UnitsLeft.total === 0 && player2UnitsLeft.total === 0) {
        document.getElementById('phaseText').innerText = "Fázis: Harc!";
        // Itt indulna a kezdeményezés dobás...
    } else {
        document.getElementById('phaseText').innerText = `Fázis: Lerakás (Játékos ${currentPlayer})`;
    }
}

// Rajzolás frissítése
function drawAll() {
    drawMap(); 
    units.forEach(u => {
        const { x, y } = hexToPixel(u.q, u.r);
        
        // HA ez az aktív egység, rajzoljunk alá egy sárga aurát
        if (activeUnit && u === activeUnit) {
            ctx.beginPath();
            ctx.arc(x, y, hexSize * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 255, 0, 0.5)"; // Sárga áttetsző
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "yellow";
            ctx.stroke();			
        }

        // ... (az eddigi egység kirajzolás változatlan) ...
        ctx.beginPath();
        ctx.arc(x, y, hexSize * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = u.color;
        ctx.fill();
		ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();
        // Egység típusának kezdőbetűje
        ctx.fillStyle = "white";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(u.type[0].toUpperCase(), x, y + 5);
				
		ctx.fillStyle = "white";
		ctx.font = "10px Arial";
		ctx.fillText(`${u.hp} HP`, x, y + 20);

		// HP csík (opcionális extra)
		ctx.fillStyle = "red";
		ctx.fillRect(x - 10, y - 20, 20, 4);
		ctx.fillStyle = "lime";
		ctx.fillRect(x - 10, y - 20, 20 * (u.hp / 100), 4);
    });
}


// 1. A harc elindítása (ezt hívjuk meg, ha elfogytak a lerakható egységek)
function startCombat() {
    gamePhase = 'COMBAT';
    document.getElementById('unitSelector').style.display = 'none'; // Eltüntetjük a lerakó gombokat
    document.getElementById('combatInfo').style.display = 'block';  // Megjelenítjük a harci infókat
    startNewRound();
}

// 2. Új kör generálása (Mindenki dob)
function startNewRound() {
    console.log("--- ÚJ KÖR KEZDŐDIK ---");
    
    // Minden élő egység dob kezdeményezést (1-20)
    units.forEach(unit => {
        unit.initiative = Math.floor(Math.random() * 20) + 1;
        // Reseteljük az egység akciópontjait (ha lennének), itt most csak jelöljük, hogy még nem lépett
        unit.hasActed = false; 
    });

    // Sorba rendezés (csökkenő sorrend: a legnagyobb dobás kezd)
    turnQueue = [...units].sort((a, b) => b.initiative - a.initiative);
    
    updateTurnOrderUI();
    nextUnit();
}

// 3. A következő egység kiválasztása
function nextUnit() {
    // Megnézzük, van-e még hátra valaki a listában ebben a körben
    if (turnQueue.length === 0) {
        startNewRound(); // Ha mindenki lépett, új kör, új dobás
        return;
    }

    activeUnit = turnQueue.shift(); // Kivesszük az elsőt a sorból
    
    document.getElementById('phaseText').innerText = 
        `Aktív: Játékos ${activeUnit.player} - ${activeUnit.type} (Init: ${activeUnit.initiative})`;
    
    drawAll(); // Újrarajzoljuk a pályát, hogy látszódjon a kijelölés
    updateTurnOrderUI();
}

// 4. A sorrend lista frissítése a képernyőn
function updateTurnOrderUI() {
    const list = document.getElementById('turnOrderList');
    list.innerHTML = '';
    
    // Az aktív egység
    if(activeUnit) {
        const li = document.createElement('li');
        li.style.color = activeUnit.player === 1 ? '#00ccff' : '#ff3300';
        li.style.fontWeight = 'bold';
        li.innerText = `➤ ${activeUnit.type} (P${activeUnit.player}) - ${activeUnit.initiative}`;
        list.appendChild(li);
    }

    // A várakozók
    turnQueue.forEach(u => {
        const li = document.createElement('li');
        li.style.color = '#888';
        li.innerText = `${u.type} (P${u.player}) - ${u.initiative}`;
        list.appendChild(li);
    });
}

// 5. Manuális kör vége gombhoz (egyelőre)
function endTurn() {
    if (gamePhase === 'COMBAT') {
        nextUnit();
    }
}

function getDistance(a, b) {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

function getNeighbors(hex) {
    const directions = [
        {q: 1, r: 0}, {q: 1, r: -1}, {q: 0, r: -1},
        {q: -1, r: 0}, {q: -1, r: 1}, {q: 0, r: 1}
    ];
    return directions.map(d => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

function handleCombatAction(targetQ, targetR) {
    if (!activeUnit) return; // Ha nincs aktív egység, nem csinálunk semmit

    // 1. Megkeressük, van-e ott valaki
    const targetUnit = units.find(u => u.q === targetQ && u.r === targetR);
    const dist = getDistance(activeUnit, {q: targetQ, r: targetR});

    // --- MOZGÁS ---
    // Ha üres a mező és szomszédos (távolság == 1)
    if (!targetUnit && dist === 1) {
        moveUnit(activeUnit, targetQ, targetR);
        return;
    }

    // --- AKCIÓ (Támadás / Gyógyítás) ---
    if (targetUnit) {
        performAction(activeUnit, targetUnit, dist);
    }
}

function moveUnit(unit, q, r) {
    console.log(`${unit.type} mozgott ide: ${q},${r}`);
    unit.q = q;
    unit.r = r;
    
    // Mozgás után vége a körnek? (Házszabály: Általában mozgás + akció van)
    // Most egyszerűsítsünk: Mozgás VAGY Támadás = Kör vége.
    endTurn(); 
}

function performAction(attacker, target, dist) {
    let actionDone = false;

    // --- HARCOS ---
    // Csak szomszédot támad
    if (attacker.type === 'warrior' && dist === 1 && attacker.player !== target.player) {
        target.hp -= 30;
        console.log("Harcos támadott: -30 HP");
        actionDone = true;
    }

    // --- ÍJÁSZ ---
    // 2 mező távolságra lő
    else if (attacker.type === 'archer' && dist <= 2 && attacker.player !== target.player) {
        target.hp -= 20;
        console.log("Íjász lőtt: -20 HP");
        actionDone = true;
    }

    // --- PAP ---
    // Szomszédos BARÁTI egységet gyógyít
    else if (attacker.type === 'priest' && dist === 1 && attacker.player === target.player) {
        target.hp = Math.min(100, target.hp + 25);
        console.log("Pap gyógyított: +25 HP");
        actionDone = true;
    }

    // --- MÁGUS ---
    // Területi sebzés (AOE)
    // Itt a kattintott célpont a központ
    else if (attacker.type === 'mage' && dist <= 2) { // Mondjuk 2 lőtávja van a varázslatnak
         applyMageAreaDamage(target);
         actionDone = true;
    }

    if (actionDone) {
        checkDeaths(); // Meghalt valaki?
        endTurn();     // Kör vége
    } else {
        console.log("Érvénytelen célpont vagy hatótáv!");
        alert("Túl messze van vagy érvénytelen célpont!");
    }
}

function applyMageAreaDamage(centerTarget) {
    console.log("Mágus tűzgolyó!");
    
    // Minden egységen végigmegyünk és megnézzük, hol áll a robbanáshoz képest
    units.forEach(u => {
        const d = getDistance(centerTarget, u);
        
        if (d === 0) { // Telitalálat
            u.hp -= 40; 
            console.log(`${u.type} (közép) sérült: -40 HP`);
        } 
        else if (d === 1) { // Szomszédos mező (robbanás széle)
            u.hp -= 20; 
            console.log(`${u.type} (szél) sérült: -20 HP`);
        }
    });
}

function checkDeaths() {
    // Kiszűrjük a halottakat
    const deadUnits = units.filter(u => u.hp <= 0);
    deadUnits.forEach(u => console.log(`${u.type} meghalt!`));

    // Csak az élők maradnak
    units = units.filter(u => u.hp > 0);
    
    // Ha az aktív egység halt meg (pl. mágus felrobbantotta magát), azonnal léptetni kell
    if (activeUnit && activeUnit.hp <= 0) {
        endTurn();
    }
    
    drawAll();
}

