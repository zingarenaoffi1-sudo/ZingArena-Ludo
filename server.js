/* =========================================
   ULTRA LUDO PRO - MASTER LOGIC ENGINE + LIVE TIMER + RANKING SYSTEM
   + INTERSTITIAL AD TRIGGER SYSTEM
========================================= */

let activePlayers = []; 
let currentPlayerIndex = 0; 
let gameState = 'WAITING_FOR_ROLL'; 
let currentDiceValue = 0;
let isMoving = false; 
const allTokens = {}; 

let socket;
let myAssignedColor = "";
window.currentRoomId = "";

// 🔥 TIMER & MISSED TURN TRACKING
let turnTimer = null;
let countdownInterval = null;
let timeLeft = 25;
const missedTurns = {}; 

// 🏆 WINNER & RANKING TRACKING
let winnersList = [];
let totalPlayersInGame = 0;

const playersData = {
    'red': { name: "RED'S TURN", class: "red-text", startOffset: 0 },
    'green': { name: "GREEN'S TURN", class: "green-text", startOffset: 13 },
    'yellow': { name: "YELLOW'S TURN", class: "yellow-text", startOffset: 26 },
    'blue': { name: "BLUE'S TURN", class: "blue-text", startOffset: 39 }
};

const masterPath = [
    {r:6, c:1}, {r:6, c:2}, {r:6, c:3}, {r:6, c:4}, {r:6, c:5}, 
    {r:5, c:6}, {r:4, c:6}, {r:3, c:6}, {r:2, c:6}, {r:1, c:6}, {r:0, c:6}, {r:0, c:7}, {r:0, c:8}, 
    {r:1, c:8}, {r:2, c:8}, {r:3, c:8}, {r:4, c:8}, {r:5, c:8}, 
    {r:6, c:9}, {r:6, c:10}, {r:6, c:11}, {r:6, c:12}, {r:6, c:13}, {r:6, c:14}, {r:7, c:14}, {r:8, c:14}, 
    {r:8, c:13}, {r:8, c:12}, {r:8, c:11}, {r:8, c:10}, {r:8, c:9}, 
    {r:9, c:8}, {r:10, c:8}, {r:11, c:8}, {r:12, c:8}, {r:13, c:8}, {r:14, c:8}, {r:14, c:7}, {r:14, c:6}, 
    {r:13, c:6}, {r:12, c:6}, {r:11, c:6}, {r:10, c:6}, {r:9, c:6}, 
    {r:8, c:5}, {r:8, c:4}, {r:8, c:3}, {r:8, c:2}, {r:8, c:1}, {r:8, c:0}, {r:7, c:0} 
];

const safeZones = [
    {r:6, c:1}, {r:8, c:2}, {r:1, c:8}, {r:2, c:6}, 
    {r:8, c:13}, {r:6, c:12}, {r:13, c:6}, {r:12, c:8}  
];

const diceFaces = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// ==========================================
// 🔥 INTERSTITIAL AD CONTROLLER
// ==========================================
let lastAdTime = 0;
function triggerInterstitialAd(reason) {
    console.log("🎬 Interstitial Ad Triggered for:", reason);
    let now = Date.now();
    // 15-second safety lock so fast clicking doesn't cause spam flag
    if (now - lastAdTime < 15000) {
        console.log("⏳ Ad skipped due to quick click safety.");
        return;
    }
    lastAdTime = now;

    // Trigger HilltopAds full-screen ad
    if (typeof window.showAd === 'function') {
        window.showAd();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    createBoard();
    document.getElementById("dice-container").addEventListener("click", rollDice);
});

// --- MENU NAVIGATION FUNCTIONS ---
function showLocalPlayerModal() {
    document.getElementById("mode-selection-modal").classList.add("hidden");
    document.getElementById("startup-modal").classList.remove("hidden");
}

function showOnlineMenu() {
    document.getElementById("mode-selection-modal").classList.add("hidden");
    document.getElementById("online-modal").classList.remove("hidden");
    showOnlineMainOptions();
}

function showOnlineMainOptions() {
    document.getElementById("quick-match-sub").classList.add("hidden");
    document.getElementById("create-room-sub").classList.add("hidden");
    document.getElementById("join-room-sub").classList.add("hidden");
    document.getElementById("online-main-options").classList.remove("hidden");
}

function showQuickMatch() {
    document.getElementById("online-main-options").classList.add("hidden");
    document.getElementById("quick-match-sub").classList.remove("hidden");
}

function showCreateRoomOptions() {
    document.getElementById("online-main-options").classList.add("hidden");
    document.getElementById("create-room-sub").classList.remove("hidden");
}

function showJoinRoomInput() {
    document.getElementById("online-main-options").classList.add("hidden");
    document.getElementById("join-room-sub").classList.remove("hidden");
}

function backToOnlineMain() {
    if (socket) socket.emit('cancel-action'); 
    document.getElementById("quick-match-sub").classList.add("hidden");
    document.getElementById("create-room-sub").classList.add("hidden");
    document.getElementById("join-room-sub").classList.add("hidden");
    document.getElementById("online-main-options").classList.remove("hidden");
    document.getElementById("room-created-display").innerText = "";
    
    const badge = document.getElementById('my-identity-badge');
    if(badge) badge.classList.add('hidden');
}

function backToModeSelect() {
    if (socket) socket.emit('cancel-action');
    document.getElementById("startup-modal").classList.add("hidden");
    document.getElementById("online-modal").classList.add("hidden");
    document.getElementById("mode-selection-modal").classList.remove("hidden");
    
    const badge = document.getElementById('my-identity-badge');
    if(badge) badge.classList.add('hidden');
}

function findOnlineMatch(count) { 
    connectToServer();
    document.getElementById("quick-match-display").innerText = "Matchmaking pls wait sometime... ⏳";
    socket.emit('find-match', { playersRequired: count });
    // 🔥 TRIGGER AD ON MATCHMAKING
    triggerInterstitialAd("Matchmaking Started");
}

// --- SOCKET.IO CONNECTION & SYNC LISTENERS ---
function connectToServer() {
    if (!socket) {
        socket = io('https://zingarenaoffi1-sudo-github-io.onrender.com');

        socket.on('connect', () => {
            console.log("🔥 Ludo Server se connection jud gaya! ID:", socket.id);
        });

        socket.on('room-created', (data) => {
            window.currentRoomId = data.roomId;
            myAssignedColor = data.color;
            showMyIdentity(data.color);
            document.getElementById("room-created-display").innerText = 
                `Make the room successfully! ID: ${data.roomId}\n(Your Color: Red) Waiting for players join the room by room id...`;
        });

        socket.on('joined-success', (data) => {
            window.currentRoomId = data.roomId;
            myAssignedColor = data.color;
            showMyIdentity(data.color);
            alert(`Successfully join the room click ok to join the room ! Room ID: ${data.roomId} | Your Color: ${data.color}`);
        });

        socket.on('match-found', (data) => {
            window.currentRoomId = data.roomId;
            myAssignedColor = data.color;
            showMyIdentity(data.color);
        });

        socket.on('start-online-game', (data) => {
            console.log("🚀 Game Start Signal Mil Gaya!", data.players);
            
            document.getElementById("online-modal").classList.add("hidden");
            document.getElementById("mode-selection-modal").classList.add("hidden");
            document.getElementById("startup-modal").classList.add("hidden");

            activePlayers = data.players.map(p => p.color);
            
            let me = data.players.find(p => p.id === socket.id);
            if (me) {
                showMyIdentity(me.color);
            }

            initGameSession();
        });

        socket.on('remote-dice-rolled', (data) => {
            clearTurnTimer(); 
            currentDiceValue = data.diceValue;
            currentPlayerIndex = data.playerIndex;
            
            const diceContainer = document.getElementById("dice-container");
            diceContainer.innerText = diceFaces[currentDiceValue];
            diceContainer.style.color = currentDiceValue === 6 ? "#ff2a2a" : "#111";

            gameState = 'WAITING_FOR_MOVE';
            startTurnTimer(); 
            checkAvailableMoves();
        });

        socket.on('remote-token-moved', (data) => {
            clearTurnTimer();
            let color = data.color;
            let tokenIndex = data.tokenIndex;
            let diceVal = data.diceVal;

            let tokenObj = allTokens[color][tokenIndex];
            allTokens[color].forEach(t => t.element.classList.remove('highlight-move'));

            if (tokenObj.state === 'home' && diceVal === 6) {
                tokenObj.state = 'active';
                tokenObj.pathPosition = 0; 
                updateTokenUI(color, tokenIndex);
                switchTurn(true); 
            } else {
                moveTokenStepByStepRemote(color, tokenIndex, diceVal);
            }
        });

        socket.on('player-finished', (data) => {
            console.log(`${data.color} won rank: ${data.rank}`);
        });

        socket.on('error-msg', (msg) => {
            alert("❌ " + msg);
        });
    }
}

function showMyIdentity(color) {
    const badge = document.getElementById('my-identity-badge');
    if (!badge) return;
    
    badge.classList.remove('hidden');
    
    let playerNum = "";
    let bgColor = "";
    if (color === 'red') { playerNum = "Player 1"; bgColor = "#ff2a2a"; }
    else if (color === 'green') { playerNum = "Player 2"; bgColor = "#00cc00"; }
    else if (color === 'yellow') { playerNum = "Player 3"; bgColor = "#ffcc00"; }
    else if (color === 'blue') { playerNum = "Player 4"; bgColor = "#1a53ff"; }

    badge.innerHTML = `👉 YOU ARE: ${playerNum} (${color}) 👈`;
    badge.style.background = bgColor;
    badge.style.color = (color === 'yellow') ? '#000' : '#fff';

    document.querySelectorAll('.player-profile').forEach(p => {
        p.style.border = "1px solid rgba(255, 255, 255, 0.1)";
        p.style.boxShadow = "none";
        p.style.opacity = "0.3";
    });
    
    const myProfile = document.getElementById(`profile-${color}`);
    if (myProfile) {
        myProfile.style.border = `2px solid ${bgColor}`;
        myProfile.style.boxShadow = `0 0 15px ${bgColor}`;
        myProfile.style.opacity = "1";
    }
}

function createPrivateRoom(count) {
    connectToServer();
    document.getElementById("room-created-display").innerText = "Making the room...";
    socket.emit('create-room', { maxPlayers: count });
    // 🔥 TRIGGER AD ON ROOM CREATE
    triggerInterstitialAd("Room Created");
}

function joinPrivateRoom() {
    let id = document.getElementById("room-id-input").value.trim();
    if (id) {
        connectToServer();
        socket.emit('join-room', { roomId: id });
        // 🔥 TRIGGER AD ON ROOM JOIN
        triggerInterstitialAd("Joining Room");
    } else {
        alert("Enter the valid room id to join room!");
    }
}

// --- GAME INITIALIZATION ---
function initGameSession() {
    winnersList = []; 
    totalPlayersInGame = activePlayers.length; 

    activePlayers.forEach(c => document.getElementById(`profile-${c}`).style.opacity = "1");
    activePlayers.forEach(c => missedTurns[c] = 0);

    currentPlayerIndex = 0;
    gameState = 'WAITING_FOR_ROLL';
    isMoving = false;
    updateTurnText();
    spawnTokens();
    startTurnTimer(); 
}

function startLocalGame(playerCount) {
    window.currentRoomId = ""; 
    document.getElementById("startup-modal").classList.add("hidden");

    if (playerCount === 2) activePlayers = ['red', 'yellow'];
    else if (playerCount === 3) activePlayers = ['red', 'green', 'yellow'];
    else activePlayers = ['red', 'green', 'yellow', 'blue'];

    showMyIdentity(activePlayers[0]);
    initGameSession();
    // 🔥 TRIGGER AD ON LOCAL GAME START
    triggerInterstitialAd("Local Game Started");
}

// ==========================================
// 🏆 RANKING & MATCH OVER LOGIC
// ==========================================
function handlePlayerWin(playerColor) {
    if (!winnersList.includes(playerColor)) {
        winnersList.push(playerColor);
        let rank = winnersList.length; 
        
        let rankText = "";
        if (rank === 1) rankText = "1st 🥇";
        else if (rank === 2) rankText = "2nd 🥈";
        else if (rank === 3) rankText = "3rd 🥉";

        let profileEl = document.getElementById(`profile-${playerColor}`);
        if (profileEl) {
            let rankDiv = document.createElement("div");
            rankDiv.style.color = "#FFD700"; 
            rankDiv.style.fontWeight = "bold";
            rankDiv.innerText = rankText;
            profileEl.appendChild(rankDiv);
        }

        if (socket && window.currentRoomId) {
            socket.emit("player-finished", { color: playerColor, rank: rankText });
        }

        activePlayers = activePlayers.filter(c => c !== playerColor);

        if (winnersList.length >= totalPlayersInGame - 1) {
            endMatchAndGoToMenu();
        }
    }
}

function endMatchAndGoToMenu() {
    clearTurnTimer();
    // 🔥 TRIGGER AD EVERY TIME A MATCH ENDS
    triggerInterstitialAd("Match Finished");

    setTimeout(() => {
        let winMessage = "🏆 MATCH FINISHED! 🏆\n\n";
        winnersList.forEach((color, index) => {
            winMessage += `Rank ${index + 1}: ${color.toUpperCase()} \n`;
        });
        
        if (activePlayers.length > 0) {
            winMessage += `Eliminated: ${activePlayers[0].toUpperCase()}\n`;
        }
        
        alert(winMessage);
        
        if (socket) socket.emit("leave-room");
        
        window.location.reload(); 
    }, 1500);
}

// --- 🔥 LIVE 25-SECOND TIMER & ELIMINATION LOGIC ---
function startTurnTimer() {
    clearTurnTimer(); 
    timeLeft = 25;
    updateTimerUI();

    countdownInterval = setInterval(() => {
        timeLeft--;
        updateTimerUI();
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);

    let currentColor = activePlayers[currentPlayerIndex];
    turnTimer = setTimeout(() => {
        handleTurnTimeout(currentColor);
    }, 25000); 
}

function clearTurnTimer() {
    if (turnTimer) {
        clearTimeout(turnTimer);
        turnTimer = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

function updateTimerUI() {
    let timerEl = document.getElementById("timer-text");
    if (timerEl) {
        timerEl.innerText = `⏳ Time left: ${timeLeft}s`;
    }
}

function handleTurnTimeout(color) {
    if (!missedTurns[color]) missedTurns[color] = 0;
    missedTurns[color]++;

    if (missedTurns[color] >= 3) {
        clearTurnTimer();
        alert(`🚨 ${color.toUpperCase()} missed 3 turns, eliminated from the game!`);
        
        if (allTokens[color]) {
            allTokens[color].forEach(t => {
                if (t.element && t.element.parentNode) {
                    t.element.parentNode.removeChild(t.element);
                }
            });
        }

        let profileEl = document.getElementById(`profile-${color}`);
        if (profileEl) profileEl.style.opacity = "0.1";

        activePlayers = activePlayers.filter(c => c !== color);

        if (activePlayers.length === 1) {
            endMatchAndGoToMenu();
            return;
        }

        if (currentPlayerIndex >= activePlayers.length) {
            currentPlayerIndex = 0;
        }

        updateTurnText();
        gameState = 'WAITING_FOR_ROLL';
        startTurnTimer();
        return;
    }

    alert(`⚠️ ${color.toUpperCase()} skips turn because player is inactive (${missedTurns[color]}/3).`);
    switchTurn(false);
}

// --- BOARD CREATION ---
function createBoard() {
    const board = document.getElementById("ludo-board");
    board.innerHTML = ""; 
    
    createBase(board, 'red-base', 'red');
    createBase(board, 'green-base', 'green');
    createBase(board, 'blue-base', 'blue');
    createBase(board, 'yellow-base', 'yellow');

    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            if ((r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c < 6) || (r > 8 && c > 8)) continue; 

            const cell = document.createElement("div");
            cell.classList.add("ludo-cell");
            cell.id = `cell-${r}-${c}`; 
            cell.style.gridArea = `${r + 1} / ${c + 1} / span 1 / span 1`;

            if (r === 7 && c > 0 && c < 6) cell.style.backgroundColor = "#ff4d4d"; 
            if (c === 7 && r > 0 && r < 6) cell.style.backgroundColor = "#4dff4d"; 
            if (r === 7 && c > 8 && c < 14) cell.style.backgroundColor = "#ffff4d"; 
            if (c === 7 && r > 8 && r < 14) cell.style.backgroundColor = "#4d4dff"; 

            let isSafe = safeZones.some(zone => zone.r === r && zone.c === c);
            if (isSafe) {
                cell.style.backgroundColor = "#e0e0e0"; 
                let star = document.createElement("span");
                star.className = "safe-zone-icon";
                star.innerHTML = "⭐"; 
                cell.appendChild(star);
            }

            if (r >= 6 && r <= 8 && c >= 6 && c <= 8) cell.style.background = "#222";
            board.appendChild(cell);
        }
    }
}

function createBase(board, colorClass, colorId) {
    const base = document.createElement("div");
    base.classList.add("base", colorClass);
    base.id = colorId + "-base";
    
    const innerBox = document.createElement("div");
    innerBox.classList.add("inner-base");
    
    for(let i = 0; i < 4; i++) {
        const slot = document.createElement("div");
        slot.classList.add("token-slot");
        slot.id = `${colorId}-slot-${i}`;
        innerBox.appendChild(slot);
    }
    base.appendChild(innerBox);
    board.appendChild(base);
}

function spawnTokens() {
    activePlayers.forEach(color => {
        allTokens[color] = [];
        for (let i = 0; i < 4; i++) {
            let token = document.createElement("div");
            token.className = `token token-${color}`;
            token.id = `token-${color}-${i}`;
            token.addEventListener('click', () => handleTokenClick(color, i));
            
            document.getElementById(`${color}-slot-${i}`).appendChild(token);
            allTokens[color].push({ element: token, state: 'home', pathPosition: -1 });
        }
    });
}

// --- DICE ROLL ---
function rollDice() {
    if (socket && window.currentRoomId) {
        let currentTurnColor = activePlayers[currentPlayerIndex];
        if (myAssignedColor !== currentTurnColor) {
            alert("Wait! This is not your turn.");
            return;
        }
    }

    if (activePlayers.length === 0 || gameState !== 'WAITING_FOR_ROLL' || isMoving) return;

    clearTurnTimer(); 
    gameState = 'ROLLING';
    const diceContainer = document.getElementById("dice-container");
    diceContainer.classList.add("rolling");

    setTimeout(() => {
        diceContainer.classList.remove("rolling");
        currentDiceValue = Math.floor(Math.random() * 6) + 1; 
        
        diceContainer.innerText = diceFaces[currentDiceValue];
        diceContainer.style.color = currentDiceValue === 6 ? "#ff2a2a" : "#111";

        gameState = 'WAITING_FOR_MOVE';
        startTurnTimer(); 

        if (socket && window.currentRoomId) {
            socket.emit('roll-dice-action', {
                roomId: window.currentRoomId,
                diceValue: currentDiceValue,
                playerIndex: currentPlayerIndex
            });
        }

        checkAvailableMoves();
    }, 500); 
}

function checkAvailableMoves() {
    let currentPlayerColor = activePlayers[currentPlayerIndex];
    let movableTokens = [];

    allTokens[currentPlayerColor].forEach((tokenObj, index) => {
        if (tokenObj.state === 'home' && currentDiceValue === 6) movableTokens.push(index); 
        else if (tokenObj.state === 'active') movableTokens.push(index); 
    });

    if (movableTokens.length === 0) {
        setTimeout(() => switchTurn(false), 500);
    } else {
        movableTokens.forEach(idx => allTokens[currentPlayerColor][idx].element.classList.add('highlight-move'));
        if (movableTokens.length === 1) {
            setTimeout(() => handleTokenClick(currentPlayerColor, movableTokens[0]), 300);
        }
    }
}

// --- TOKEN CLICK ---
function handleTokenClick(color, tokenIndex) {
    if (socket && window.currentRoomId) {
        if (myAssignedColor !== activePlayers[currentPlayerIndex] || color !== myAssignedColor) {
            return; 
        }
    }

    if (gameState !== 'WAITING_FOR_MOVE' || color !== activePlayers[currentPlayerIndex] || isMoving) return;

    clearTurnTimer(); 
    let tokenObj = allTokens[color][tokenIndex];
    if (!tokenObj.element.classList.contains('highlight-move')) return; 

    allTokens[color].forEach(t => t.element.classList.remove('highlight-move'));

    if (socket && window.currentRoomId) {
        socket.emit('move-token-action', {
            roomId: window.currentRoomId,
            color: color,
            tokenIndex: tokenIndex,
            diceVal: currentDiceValue
        });
    }

    if (tokenObj.state === 'home' && currentDiceValue === 6) {
        tokenObj.state = 'active';
        tokenObj.pathPosition = 0; 
        updateTokenUI(color, tokenIndex);
        switchTurn(true); 
    } else {
        moveTokenStepByStep(color, tokenIndex, currentDiceValue);
    }
}

function moveTokenStepByStep(color, tokenIndex, stepsToMove) {
    isMoving = true; 
    let tokenObj = allTokens[color][tokenIndex];
    let stepsTaken = 0;

    let moveInterval = setInterval(() => {
        stepsTaken++;
        tokenObj.pathPosition++;
        updateTokenUI(color, tokenIndex);

        if (stepsTaken >= stepsToMove) {
            clearInterval(moveInterval);
            
            setTimeout(() => {
                let cutHappened = checkCapture(color, tokenIndex);
                isMoving = false; 
                switchTurn(cutHappened || currentDiceValue === 6);
            }, 300);
        }
    }, 250); 
}

function moveTokenStepByStepRemote(color, tokenIndex, stepsToMove) {
    isMoving = true; 
    let tokenObj = allTokens[color][tokenIndex];
    let stepsTaken = 0;

    let moveInterval = setInterval(() => {
        stepsTaken++;
        tokenObj.pathPosition++;
        updateTokenUI(color, tokenIndex);

        if (stepsTaken >= stepsToMove) {
            clearInterval(moveInterval);
            
            setTimeout(() => {
                let cutHappened = checkCapture(color, tokenIndex);
                isMoving = false; 
                switchTurn(cutHappened || currentDiceValue === 6);
            }, 300);
        }
    }, 250); 
}

function updateTokenUI(color, tokenIndex) {
    let tokenObj = allTokens[color][tokenIndex];
    let startOffset = playersData[color].startOffset;
    let globalPos = (startOffset + tokenObj.pathPosition) % 52;
    let targetCoords = masterPath[globalPos];
    
    let targetCell = document.getElementById(`cell-${targetCoords.r}-${targetCoords.c}`);
    if (targetCell) {
        targetCell.appendChild(tokenObj.element); 
        tokenObj.element.classList.add('moving');
        setTimeout(() => tokenObj.element.classList.remove('moving'), 200); 
    }
}

function checkCapture(color, tokenIndex) {
    let attacker = allTokens[color][tokenIndex];
    let startOffset = playersData[color].startOffset;
    let globalPos = (startOffset + attacker.pathPosition) % 52;
    
    let targetCoords = masterPath[globalPos];
    let isSafe = safeZones.some(zone => zone.r === targetCoords.r && zone.c === targetCoords.c);
    
    if (isSafe) return false; 

    let cutHappened = false;

    for (let enemyColor of activePlayers) {
        if (enemyColor === color) continue; 

        allTokens[enemyColor].forEach((enemyToken, enemyIndex) => {
            if (enemyToken.state === 'active') {
                let enemyGlobalPos = (playersData[enemyColor].startOffset + enemyToken.pathPosition) % 52;
                
                if (enemyGlobalPos === globalPos) {
                    cutHappened = true;
                    enemyToken.state = 'home';
                    enemyToken.pathPosition = -1;
                    let homeSlot = document.getElementById(`${enemyColor}-slot-${enemyIndex}`);
                    homeSlot.appendChild(enemyToken.element);
                }
            }
        });
    }
    return cutHappened;
}

function switchTurn(gotExtraTurn) {
    clearTurnTimer(); 
    if (!gotExtraTurn) {
        currentPlayerIndex = (currentPlayerIndex + 1) % activePlayers.length;
    }
    updateTurnText();
    gameState = 'WAITING_FOR_ROLL';
    startTurnTimer(); 
}

function updateTurnText() {
    let currentPlayerColor = activePlayers[currentPlayerIndex];
    const turnText = document.getElementById("turn-text");
    turnText.innerText = playersData[currentPlayerColor].name;
    turnText.className = playersData[currentPlayerColor].class;
}