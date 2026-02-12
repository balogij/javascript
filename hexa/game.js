/* ============================================================
   HEXA TACTICAL GAME – JAVÍTOTT VERZIÓ
   ============================================================ */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hexSize = 35;
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const radius  = 6; 

const unitIcons = {
  warrior: "🗡️",
  archer : "🏹",
  priest : "✝️",
  mage   : "🔥"
};

// --- Segédfüggvények ---
function hexToPixel(q, r) {
  const x = hexSize * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const y = hexSize * ((3 / 2) * r);
  return { x: x + centerX, y: y + centerY };
}

function pixelToHex(x, y) {
  const q = (Math.sqrt(3)/3 * (x - centerX) - 1/3 * (y - centerY)) / hexSize;
  const r = (2/3 * (y - centerY)) / hexSize;
  return hexRound(q, r);
}

function hexRound(q, r) {
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(-q - r);
  const qd = Math.abs(rq - q);
  const rd = Math.abs(rr - r);
  const sd = Math.abs(rs - (-q - r));
  if (qd > rd && qd > sd) rq = -rr - rs;
  else if (rd > sd) rr = -rq - rs;
  return { q: rq, r: rr };
}

function hexDistance(a, b) {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

// --- Pálya ---
function drawMap() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min( radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      let color = "#333";
      if (r <= -1) color = "#2a3d52"; 
      if (r >=  1) color = "#522a2a";
      drawHex(q, r, color);
    }
  }
}

function drawHex(q, r, color) {
  const { x, y } = hexToPixel(q, r);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI/180 * (60 * i - 30);
    const px = x + hexSize * Math.cos(angle);
    const py = y + hexSize * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#555";
  ctx.stroke();
}

// --- Játék állapot ---
let gamePhase = "PLACEMENT";
let units = [];
let turnQueue = [];
let activeUnit = null;
let selectedUnitType = "warrior";
let currentPlayer = 1;

// Javított kvóta (2+2+1+1 = 6 összesen)
let player1UnitsLeft = { warrior: 2, archer: 2, priest: 1, mage: 1, total: 4 };
let player2UnitsLeft = { warrior: 2, archer: 2, priest: 1, mage: 1, total: 4 };

function updateUI() {
  const pData = (currentPlayer === 1) ? player1UnitsLeft : player2UnitsLeft;
  document.getElementById("playerText").innerText = `Játékos ${currentPlayer} köre`;
  document.getElementById("cnt-warrior").innerText = pData.warrior;
  document.getElementById("cnt-archer").innerText = pData.archer;
  document.getElementById("cnt-priest").innerText = pData.priest;
  document.getElementById("cnt-mage").innerText = pData.mage;
}

function selectUnit(type) {
  selectedUnitType = type;
  document.getElementById("statusMsg").innerText = `Kiválasztva: ${type}`;
}

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const hex = pixelToHex(e.clientX - rect.left, e.clientY - rect.top);
  if (gamePhase === "PLACEMENT") handlePlacement(hex.q, hex.r);
  else handleCombatAction(hex.q, hex.r);
});

function handlePlacement(q, r) {
  const pData = (currentPlayer === 1) ? player1UnitsLeft : player2UnitsLeft;
  if (pData.total <= 0) return;
  if (pData[selectedUnitType] <= 0) return;
  if (currentPlayer === 1 && r >= 0) return;
  if (currentPlayer === 2 && r <= 0) return;
  if (units.some(u => u.q === q && u.r === r)) return;

  units.push({
    type: selectedUnitType,
    player: currentPlayer,
    q, r, hp: 100,
    color: (currentPlayer === 1) ? "#00aaff" : "#ff4444"
  });

  pData[selectedUnitType]--;
  pData.total--;

  if (player1UnitsLeft.total === 0 && player2UnitsLeft.total === 0) {
    startCombat();
  } else {
    currentPlayer = (currentPlayer === 1) ? 2 : 1;
    updateUI();
  }
  drawAll();
}

function startCombat() {
  gamePhase = "COMBAT";
  document.getElementById("phaseText").innerText = "🔥 Fázis: Harc!";
  document.getElementById("unitSelector").style.display = "none";
  document.getElementById("combatInfo").style.display = "block";
  startNewRound();
}

function startNewRound() {
  if (units.length === 0) return;
  units.forEach(u => u.initiative = Math.floor(Math.random() * 20) + 1);
  turnQueue = [...units].sort((a, b) => b.initiative - a.initiative);
  nextUnit();
}

function nextUnit() {
  // Megtisztítjuk a queue-t a közben meghalt egységektől
  turnQueue = turnQueue.filter(tq => units.some(u => u === tq));
  
  if (turnQueue.length === 0) {
    startNewRound();
    return;
  }
  activeUnit = turnQueue.shift();
  updateTurnOrderUI();
  drawAll();
}

function updateTurnOrderUI() {
  const list = document.getElementById("turnOrderList");
  list.innerHTML = "";
  if (activeUnit) {
    const li = document.createElement("li");
    li.style.color = "#ffff00";
    li.innerHTML = `➡️ ${unitIcons[activeUnit.type]} (P${activeUnit.player})`;
    list.appendChild(li);
  }
  turnQueue.forEach(u => {
    const li = document.createElement("li");
    li.innerHTML = `${unitIcons[u.type]} (P${u.player})`;
    list.appendChild(li);
  });
}

function handleCombatAction(q, r) {
  if (!activeUnit) return;
  const target = units.find(u => u.q === q && u.r === r);
  const dist = hexDistance(activeUnit, { q, r });

  if (!target && dist === 1) {
    activeUnit.q = q;
    activeUnit.r = r;
    endTurn();
  } else if (target) {
    performAction(activeUnit, target, dist);
  }
}

function performAction(attacker, target, dist) {
  let success = false;
  if (attacker.type === "warrior" && dist === 1 && attacker.player !== target.player) {
    target.hp -= 35; success = true;
  } else if (attacker.type === "archer" && dist <= 2 && attacker.player !== target.player) {
    target.hp -= 20; success = true;
  } else if (attacker.type === "priest" && dist === 1 && attacker.player === target.player) {
    target.hp = Math.min(100, target.hp + 25); success = true;
  } else if (attacker.type === "mage" && dist <= 2 && attacker.player !== target.player) {
    units.forEach(u => {
      if (hexDistance(u, target) <= 1) u.hp -= 25;
    });
    success = true;
  }

  if (success) {
    units = units.filter(u => u.hp > 0);
    checkWin();
    endTurn();
  }
}

function checkWin() {
  const p1 = units.filter(u => u.player === 1).length;
  const p2 = units.filter(u => u.player === 2).length;
  if (p1 === 0) alert("Játékos 2 győzött!");
  else if (p2 === 0) alert("Játékos 1 győzött!");
}

function endTurn() {
  nextUnit();
}

function drawAll() {
  drawMap();
  units.forEach(u => {
    const { x, y } = hexToPixel(u.q, u.r);
    ctx.beginPath();
    ctx.arc(x, y, hexSize * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = u.color;
    if (u === activeUnit) {
        ctx.strokeStyle = "white";
        ctx.lineWidth = 4;
        ctx.stroke();
    }
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(unitIcons[u.type], x, y + 7);
    ctx.font = "10px Arial";
    ctx.fillText(u.hp, x, y + 22);
  });
}

// Start
drawMap();
updateUI();