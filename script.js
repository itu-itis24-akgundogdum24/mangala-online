const socket = io("https://mangala-online.onrender.com");
let board = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
let currentPlayer = 1;
let myPlayerNumber = null;
let isAnimating = false;

// --- YENİ: DOM Elemanları ---
const resetBtn = document.getElementById('reset-btn');
const resetModal = document.getElementById('reset-modal');
const acceptBtn = document.getElementById('accept-reset');
const declineBtn = document.getElementById('decline-reset');

// Oda Yönetimi
let roomId = new URLSearchParams(window.location.search).get('room') || Math.random().toString(36).substring(7);
if (!window.location.search.includes('room')) window.history.pushState({}, '', `?room=${roomId}`);
socket.emit('joinRoom', roomId);

socket.on('playerAssign', (n) => { 
    myPlayerNumber = n;
    if (n === 2) {
        document.querySelector('.board').classList.add('board-reverse');
    } 
    updateStatus(); 
});

socket.on('gameStart', () => { 
    updateStatus(); 
    updateBoardVisuals(); 
});

socket.on('opponentMove', (idx) => executeMove(idx));

// --- YENİ: SIFIRLAMA SOCKET DİNLEYİCİLERİ ---

// 1. Rakip sıfırlama istediğinde modalı göster
socket.on('opponent_requested_reset', () => {
    resetModal.style.display = 'block';
});

// 2. Oyun sıfırlandığında (Her iki tarafa da gelir)
socket.on('game_restarted', () => {
    // Değişkenleri başlangıç haline getir
    board = [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
    currentPlayer = 1;
    isAnimating = false;
    
    // Arayüzü temizle
    resetModal.style.display = 'none';
    updateBoardVisuals();
    updateStatus();
    alert("Oyun başarıyla sıfırlandı!");
});

// 3. Rakip reddettiğinde
socket.on('reset_declined', () => {
    alert("Rakibin sıfırlama isteğini reddetti.");
});

// --- YENİ: BUTON OLAYLARI ---

// Sıfırla butonuna basınca istek gönder
resetBtn.addEventListener('click', () => {
    if(isAnimating) return; // Taşlar hareket ederken istek atılmasın
    socket.emit('request_reset', roomId);
    alert("Sıfırlama isteği rakibe gönderildi...");
});

// "Evet" butonuna basınca onayla
acceptBtn.addEventListener('click', () => {
    socket.emit('confirm_reset', roomId);
    resetModal.style.display = 'none';
});

// "Hayır" butonuna basınca reddet
declineBtn.addEventListener('click', () => {
    socket.emit('decline_reset', roomId);
    resetModal.style.display = 'none';
});


// --- MEVCUT FONKSİYONLARIN (DEĞİŞMEDİ) ---

function updateStatus() {
    const info = document.getElementById("turn-info");
    if (!myPlayerNumber) return;
    info.innerText = (currentPlayer === myPlayerNumber) ? "Sizin Sıranız!" : "Rakip Bekleniyor...";
}

function updateBoardVisuals() {
    board.forEach((count, i) => {
        document.getElementById(`count-${i}`).innerText = count;
        const pit = document.getElementById(`pit-${i}`);
        pit.innerHTML = '';
        for(let j=0; j<count; j++) {
            const stone = document.createElement('div');
            stone.className = 'stone';
            if (i === 6 || i === 13) stone.style.background = "radial-gradient(circle at 30% 30%, #fff, #f44336)";
            pit.appendChild(stone);
        }
    });
}

async function handleInput(index) {
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

updateBoardVisuals();