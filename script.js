// Render linkinin sonuna "/" işareti koymadığından emin ol!
const socket = io("https://mangala-online.onrender.com", {
    transports: ["websocket", "polling"]
});

let board = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
let currentPlayer = 1;
let myPlayerNumber = null;
let isAnimating = false;
let isGameOver = false;

// --- DOM Elemanları ---
const resetBtn = document.getElementById('reset-btn');
const resetModal = document.getElementById('reset-modal');
const acceptBtn = document.getElementById('accept-reset');
const declineBtn = document.getElementById('decline-reset');
const turnInfo = document.getElementById("turn-info");

// Lobi Elemanları
const roomIdDisplay = document.getElementById('display-room-id');
const copyBtn = document.getElementById('copy-link-btn');
const joinInput = document.getElementById('join-room-input');
const joinBtn = document.getElementById('join-btn');

// YENİ: Skor ve Oyun Sonu Elemanları
const myScoreEl = document.getElementById('my-score');
const opponentScoreEl = document.getElementById('opponent-score');
const gameOverModal = document.getElementById('game-over-modal');
const gameOverEmoji = document.getElementById('game-over-emoji');
const gameOverTitle = document.getElementById('game-over-title');
const gameOverMessage = document.getElementById('game-over-message');
const finalMyScore = document.getElementById('final-my-score');
const finalOpponentScore = document.getElementById('final-opponent-score');
const playAgainBtn = document.getElementById('play-again-btn');

// --- Oda Yönetimi ---
let roomId = new URLSearchParams(window.location.search).get('room') || Math.random().toString(36).substring(7);

if (!window.location.search.includes('room')) {
    window.history.pushState({}, '', `?room=${roomId}`);
}

if (roomIdDisplay) roomIdDisplay.innerText = roomId;

socket.emit('joinRoom', roomId);

// --- Bağlantı Kontrolü ---
socket.on('connect', () => {
    console.log("Sunucuya bağlandık! Oda:", roomId);
});

socket.on('connect_error', () => {
    turnInfo.innerText = "Sunucu uyanıyor... Lütfen bekleyin.";
});

// --- Socket Dinleyicileri ---
socket.on('playerAssign', (n) => { 
    myPlayerNumber = n;
    if (n === 2) {
        document.querySelector('.board').classList.add('board-reverse');
    } 
    updateStatus(); 
    updateScoreDisplay();
});

socket.on('gameStart', () => { 
    isGameOver = false;
    gameOverModal.style.display = 'none';
    updateStatus(); 
    updateBoardVisuals();
    updateScoreDisplay();
});

socket.on('opponentMove', (idx) => executeMove(idx));

socket.on('opponent_disconnected', () => {
    turnInfo.innerText = "⚠️ Rakip oyundan ayrıldı!";
    turnInfo.classList.add('disconnected');
    isGameOver = true;
});

// --- Sıfırlama Sistemi ---
socket.on('opponent_requested_reset', () => {
    resetModal.style.display = 'flex';
});

socket.on('game_restarted', () => {
    board = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
    currentPlayer = 1;
    isAnimating = false;
    isGameOver = false;
    resetModal.style.display = 'none';
    gameOverModal.style.display = 'none';
    turnInfo.className = '';
    updateBoardVisuals();
    updateStatus();
    updateScoreDisplay();
});

socket.on('reset_declined', () => {
    alert("Rakibin oyunu sıfırlama isteğini reddetti.");
});

socket.on('error', (msg) => {
    alert(msg);
});

// --- Buton Olayları ---
copyBtn.addEventListener('click', () => {
    const fullLink = window.location.href;
    navigator.clipboard.writeText(fullLink).then(() => {
        alert("Davet linki kopyalandı! Arkadaşına gönder.");
    });
});

joinBtn.addEventListener('click', () => {
    const targetRoom = joinInput.value.trim();
    if (!targetRoom) {
        alert("Lütfen geçerli bir oda kodu girin.");
        return;
    }
    
    if (targetRoom === roomId) {
        alert("Zaten bu odadasınız!");
        return;
    }
    
    // Eski odadan ayrıl (sunucu tarafında disconnect ile otomatik olur)
    // Yeni odaya katılmak için sayfayı yenile
    // Bu durumda sayfa yenilemesi GEREKLI çünkü:
    // 1. Eski socket bağlantısını temizlemek lazım
    // 2. Oyun durumunu sıfırlamak lazım
    // 3. URL'i güncellemek lazım
    window.location.href = `?room=${targetRoom}`;
});

resetBtn.addEventListener('click', () => {
    if(isAnimating) return;
    socket.emit('request_reset', roomId);
    alert("Sıfırlama isteği gönderildi, rakip onayı bekleniyor...");
});

acceptBtn.addEventListener('click', () => {
    socket.emit('confirm_reset', roomId);
    resetModal.style.display = 'none';
});

declineBtn.addEventListener('click', () => {
    socket.emit('decline_reset', roomId);
    resetModal.style.display = 'none';
});

// YENİ: Tekrar Oyna Butonu
playAgainBtn.addEventListener('click', () => {
    socket.emit('request_reset', roomId);
    gameOverModal.style.display = 'none';
    alert("Tekrar oynama isteği gönderildi, rakip onayı bekleniyor...");
});

// --- Oyun Mantığı ---

function updateStatus() {
    if (!myPlayerNumber) return;
    if (isGameOver) return;
    turnInfo.className = '';
    turnInfo.innerText = (currentPlayer === myPlayerNumber) ? "🎯 Sizin Sıranız!" : "⏳ Rakip Bekleniyor...";
}

// YENİ: Skor Göstergesini Güncelle
function updateScoreDisplay() {
    if (!myPlayerNumber) return;
    
    const myTreasure = myPlayerNumber === 1 ? board[6] : board[13];
    const opponentTreasure = myPlayerNumber === 1 ? board[13] : board[6];
    
    if (myScoreEl) myScoreEl.innerText = myTreasure;
    if (opponentScoreEl) opponentScoreEl.innerText = opponentTreasure;
}

function updateBoardVisuals() {
    board.forEach((count, i) => {
        const countEl = document.getElementById(`count-${i}`);
        if(countEl) countEl.innerText = count;
        
        const pit = document.getElementById(`pit-${i}`);
        if(!pit) return;
        
        pit.innerHTML = '';
        for(let j=0; j<count; j++) {
            const stone = document.createElement('div');
            stone.className = 'stone';
            if (i === 6 || i === 13) stone.style.background = "radial-gradient(circle at 30% 30%, #fff, #f44336)";
            pit.appendChild(stone);
        }
    });
    
    updateScoreDisplay();
}

async function handleInput(index) {
    if (isGameOver) return;
    if (isAnimating || currentPlayer !== myPlayerNumber) return;
    if (myPlayerNumber === 1 && (index > 5 || index < 0)) return;
    if (myPlayerNumber === 2 && (index > 12 || index < 7)) return;
    if (board[index] === 0) return;

    socket.emit('makeMove', { roomId, moveIndex: index });
    await executeMove(index);
}

async function executeMove(index) {
    isAnimating = true;
    let stones = board[index];
    board[index] = 0;
    let curr = index;

    if (stones === 1) {
        curr = (curr + 1) % 14;
        board[curr]++;
    } else {
        board[index] = 1; stones--;
        while (stones > 0) {
            curr = (curr + 1) % 14;
            if ((currentPlayer === 1 && curr === 13) || (currentPlayer === 2 && curr === 6)) continue;
            board[curr]++; stones--;
            updateBoardVisuals();
            await new Promise(r => setTimeout(r, 400));
        }
    }

    applyMangalaRules(curr);
    updateBoardVisuals();
    
    if (checkGameEnd()) {
        isAnimating = false;
        return;
    }
    
    isAnimating = false;
    updateStatus();
}

function applyMangalaRules(lastIdx) {
    let extraTurn = (currentPlayer === 1 && lastIdx === 6) || (currentPlayer === 2 && lastIdx === 13);
    
    if (currentPlayer === 1 && lastIdx >= 7 && lastIdx <= 12 && board[lastIdx] % 2 === 0) {
        board[6] += board[lastIdx]; board[lastIdx] = 0;
    } else if (currentPlayer === 2 && lastIdx >= 0 && lastIdx <= 5 && board[lastIdx] % 2 === 0) {
        board[13] += board[lastIdx]; board[lastIdx] = 0;
    }

    if (currentPlayer === 1 && lastIdx <= 5 && board[lastIdx] === 1 && board[12-lastIdx] > 0) {
        board[6] += board[12-lastIdx] + 1; board[12-lastIdx] = 0; board[lastIdx] = 0;
    } else if (currentPlayer === 2 && lastIdx >= 7 && lastIdx <= 12 && board[lastIdx] === 1 && board[12-lastIdx] > 0) {
        board[13] += board[12-lastIdx] + 1; board[12-lastIdx] = 0; board[lastIdx] = 0;
    }

    if (!extraTurn) currentPlayer = currentPlayer === 1 ? 2 : 1;
}

function checkGameEnd() {
    const player1Pits = board.slice(0, 6);
    const player1Empty = player1Pits.every(pit => pit === 0);
    
    const player2Pits = board.slice(7, 13);
    const player2Empty = player2Pits.every(pit => pit === 0);
    
    if (player1Empty || player2Empty) {
        isGameOver = true;
        
        if (player1Empty) {
            for (let i = 7; i <= 12; i++) {
                board[13] += board[i];
                board[i] = 0;
            }
        } else {
            for (let i = 0; i <= 5; i++) {
                board[6] += board[i];
                board[i] = 0;
            }
        }
        
        updateBoardVisuals();
        announceWinner();
        return true;
    }
    
    return false;
}

function announceWinner() {
    const player1Score = board[6];
    const player2Score = board[13];
    
    const myScore = myPlayerNumber === 1 ? player1Score : player2Score;
    const oppScore = myPlayerNumber === 1 ? player2Score : player1Score;
    
    // Final skorlarını güncelle
    if (finalMyScore) finalMyScore.innerText = myScore;
    if (finalOpponentScore) finalOpponentScore.innerText = oppScore;
    
    if (myScore > oppScore) {
        // Kazandın
        gameOverEmoji.innerText = "🏆";
        gameOverTitle.innerText = "TEBRİKLER!";
        gameOverMessage.innerText = "Oyunu kazandınız!";
        turnInfo.innerText = "🎉 KAZANDINIZ!";
        turnInfo.classList.add('winner');
    } else if (oppScore > myScore) {
        // Kaybettin
        gameOverEmoji.innerText = "😔";
        gameOverTitle.innerText = "Oyun Bitti";
        gameOverMessage.innerText = "Maalesef kaybettiniz.";
        turnInfo.innerText = "😔 Kaybettiniz";
        turnInfo.classList.add('loser');
    } else {
        // Beraberlik
        gameOverEmoji.innerText = "🤝";
        gameOverTitle.innerText = "BERABERE!";
        gameOverMessage.innerText = "Oyun berabere bitti.";
        turnInfo.innerText = "🤝 BERABERE!";
        turnInfo.classList.add('draw');
    }
    
    // Oyun bittiğinde tekrar oyna butonunu göster
    playAgainBtn.style.display = 'block';
    
    // Modalı göster
    gameOverModal.style.display = 'flex';
}

// Başlangıçta tahtayı güncelle
updateBoardVisuals();