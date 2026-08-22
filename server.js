// YEH HAI ASLI BACKEND SERVER KA CODE (Render ke liye)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// 🟢 CRON-JOB WALA ROUTE (Server ko zinda rakhne ke liye)
app.get('/', (req, res) => {
    res.send('Ludo Server is Awake and Running!');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

let waitingPlayers = { 2: [], 3: [], 4: [] };
let rooms = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // 1. Quick Matchmaking Logic (FIXED BUG)
    socket.on('find-match', (data) => {
        const reqPlayers = data.playersRequired;
        if(!waitingPlayers[reqPlayers]) waitingPlayers[reqPlayers] = [];
        
        // 🔥 BUG FIX: Check karo ki yeh player pehle se line mein toh nahi khada!
        const isAlreadyWaiting = waitingPlayers[reqPlayers].some(s => s.id === socket.id);
        
        if (!isAlreadyWaiting) {
            waitingPlayers[reqPlayers].push(socket);
        }
        
        if(waitingPlayers[reqPlayers].length === reqPlayers) {
            const roomId = 'ROOM_' + Math.random().toString(36).substr(2, 6);
            const players = waitingPlayers[reqPlayers];
            waitingPlayers[reqPlayers] = []; // queue reset
            
            const colors = ['red', 'green', 'yellow', 'blue'];
            const roomData = [];
            
            players.forEach((p, index) => {
                p.join(roomId);
                const pColor = colors[index];
                roomData.push({ id: p.id, color: pColor });
                p.emit('match-found', { roomId: roomId, color: pColor });
            });
            
            rooms[roomId] = { players: roomData };
            io.to(roomId).emit('start-online-game', { players: roomData });
        }
    });

    // 2. Private Room Create Logic
    socket.on('create-room', (data) => {
        const roomId = 'PRIVATE_' + Math.random().toString(36).substr(2, 6);
        socket.join(roomId);
        socket.emit('room-created', { roomId: roomId, color: 'red' });
        rooms[roomId] = { max: data.maxPlayers, players: [{id: socket.id, color: 'red'}], started: false };
    });

    // 3. Private Room Join Logic
    socket.on('join-room', (data) => {
        const roomId = data.roomId;
        const room = rooms[roomId];
        if(room && !room.started) {
            const colors = ['red', 'green', 'yellow', 'blue'];
            const pColor = colors[room.players.length];
            room.players.push({id: socket.id, color: pColor});
            socket.join(roomId);
            socket.emit('joined-success', { roomId: roomId, color: pColor });
            
            if(room.players.length === room.max) {
                room.started = true;
                io.to(roomId).emit('start-online-game', { players: room.players });
            }
        } else {
            socket.emit('error-msg', 'Room not found or already full!');
        }
    });

    // 4. Dice & Token Move sync Logic
    socket.on('roll-dice-action', (data) => {
        socket.to(data.roomId).emit('remote-dice-rolled', data);
    });

    socket.on('move-token-action', (data) => {
        socket.to(data.roomId).emit('remote-token-moved', data);
    });

    // 🔥 BUG FIX 2: Agar player 'Back' button dabaye, toh queue se hata do
    socket.on('cancel-action', () => {
        for (let size in waitingPlayers) {
            waitingPlayers[size] = waitingPlayers[size].filter(s => s.id !== socket.id);
        }
    });

    // 🔥 BUG FIX 3: Agar player ka internet band ho jaye, toh bhi queue se hatao
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        for (let size in waitingPlayers) {
            waitingPlayers[size] = waitingPlayers[size].filter(s => s.id !== socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Ludo Server running on port ${PORT}`);
});
