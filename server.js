const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let rooms = {};

io.on('connection', (socket) => {
    // --- ODAYA KATILMA ---
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        socket.roomId = roomId; // Disconnect anında odayı bulmak için odayı socket'e kaydediyoruz

        if (!rooms[roomId]) {
            rooms[roomId] = { players: [socket.id] };
            socket.emit('playerAssign', 1);
        } else if (rooms[roomId].players.length < 2) {
            rooms[roomId].players.push(socket.id);
            socket.emit('playerAssign', 2);
            io.to(roomId).emit('gameStart');
        } else {
            socket.emit('error', 'Oda dolu!');
        }
    });

    // --- HAMLE YÖNETİMİ ---
    socket.on('makeMove', (data) => {
        socket.to(data.roomId).emit('opponentMove', data.moveIndex);
    });

    // --- YENİ: SIFIRLAMA İSTEĞİ (TEKLİF) ---
    socket.on('request_reset', (roomId) => {
        // İsteği gönderen hariç odadaki diğer oyuncuya bildir
        socket.to(roomId).emit('opponent_requested_reset');
    });

    // --- YENİ: SIFIRLAMA ONAYI (KABUL) ---
    socket.on('confirm_reset', (roomId) => {
        // Odadaki HERKESE (istek atan ve onaylayan) oyunun başladığını bildir
        io.to(roomId).emit('game_restarted');
    });

    // --- YENİ: SIFIRLAMA REDDİ (RET) ---
    socket.on('decline_reset', (roomId) => {
        // İsteği atan oyuncuya rakibin reddettiğini bildir
        socket.to(roomId).emit('reset_declined');
    });

    // --- ODA TEMİZLİĞİ (GÜNCELLENDİ) ---
    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        if (rooms[roomId]) {
            // Oyuncuyu listeden çıkar
            rooms[roomId].players = rooms[roomId].players.filter(id => id !== socket.id);
            
            // Eğer odada kimse kalmadıysa odayı tamamen sil (Bellek tasarrufu ve temiz başlangıç)
            if (rooms[roomId].players.length === 0) {
                delete rooms[roomId];
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Sunucu http://localhost:${PORT} üzerinde çalışıyor`));