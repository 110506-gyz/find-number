// server.js —— "找数字"游戏的 WebSocket 中转服务器
//
// 工作原理:
//   1. 房主创建房间(用6位房间号注册一个 room)
//   2. 客人加入房间(连到同一个 room)
//   3. 任何一方发的消息,服务器把它转发给另一方
//   4. 任何一方断开,通知另一方,清理房间

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

// MIME 类型映射(给静态文件用)
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// HTTP 服务器:同时托管前端静态文件 + 显示状态
const httpServer = http.createServer((req, res) => {
    // /status 返回服务状态(给云平台健康检查用)
    if (req.url === '/status' || req.url === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('找数字服务器在运行。房间数: ' + rooms.size);
        return;
    }

    // 其他路径:托管前端文件
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';
    // 防止 ../ 路径穿越
    const safePath = path.normalize(urlPath).replace(/^(\.\.[\\/])+/, '');
    const fullPath = path.join(__dirname, safePath);

    fs.readFile(fullPath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404: ' + urlPath);
            return;
        }
        const ext = path.extname(fullPath).toLowerCase();
        const mime = MIME[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        res.end(data);
    });
});

const wss = new WebSocketServer({ server: httpServer });

// 房间表: roomCode -> { host: ws, guest: ws, hostInfo, guestInfo }
const rooms = new Map();

// 让每个 ws 知道自己属于哪个房间、角色
function clearWsState(ws) {
    ws._roomCode = null;
    ws._role = null;
}

// 给一个 ws 发消息(带错误保护)
function safeSend(ws, obj) {
    if (!ws || ws.readyState !== ws.OPEN) return;
    try { ws.send(JSON.stringify(obj)); } catch (e) {}
}

wss.on('connection', (ws) => {
    clearWsState(ws);
    console.log('[+] 新连接, 当前总连接数:', wss.clients.size);

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); }
        catch (e) { return; }

        // ===== 创建房间 =====
        if (msg.type === 'create-room') {
            const code = msg.roomCode;
            if (!/^\d{6}$/.test(code)) {
                safeSend(ws, { type: 'create-failed', reason: 'BAD_CODE' });
                return;
            }
            if (rooms.has(code)) {
                safeSend(ws, { type: 'create-failed', reason: 'ROOM_TAKEN' });
                return;
            }
            rooms.set(code, {
                host: ws,
                guest: null,
                hostInfo: msg.me || {},
                guestInfo: null
            });
            ws._roomCode = code;
            ws._role = 'host';
            safeSend(ws, { type: 'room-created' });
            console.log('[room]', code, '创建,房主:', msg.me && msg.me.nickname);
            return;
        }

        // ===== 加入房间 =====
        if (msg.type === 'join-room') {
            const code = msg.roomCode;
            const room = rooms.get(code);
            if (!room) {
                safeSend(ws, { type: 'join-failed', reason: 'ROOM_NOT_FOUND' });
                return;
            }
            if (room.guest) {
                safeSend(ws, { type: 'join-failed', reason: 'ROOM_FULL' });
                return;
            }
            room.guest = ws;
            room.guestInfo = msg.me || {};
            ws._roomCode = code;
            ws._role = 'guest';

            // 通知客人:加入成功 + 房主信息
            safeSend(ws, { type: 'join-ok', peerInfo: room.hostInfo });
            // 通知房主:客人来了 + 客人信息
            safeSend(room.host, { type: 'peer-joined', peerInfo: room.guestInfo });
            console.log('[room]', code, '加入,客人:', msg.me && msg.me.nickname);
            return;
        }

        // ===== 中转消息:转发给对方 =====
        if (msg.type === 'relay') {
            const room = rooms.get(ws._roomCode);
            if (!room) return;
            const target = ws._role === 'host' ? room.guest : room.host;
            if (target) {
                safeSend(target, {
                    type: 'relay',
                    subType: msg.subType,
                    payload: msg.payload
                });
            }
            return;
        }

        // ===== 心跳(防止云平台杀连接) =====
        if (msg.type === 'ping') {
            safeSend(ws, { type: 'pong' });
            return;
        }
    });

    ws.on('close', () => {
        const code = ws._roomCode;
        const role = ws._role;
        if (!code) {
            console.log('[-] 一个未入房连接断开');
            return;
        }
        const room = rooms.get(code);
        if (!room) return;

        // 通知另一方:对方离开
        const other = role === 'host' ? room.guest : room.host;
        if (other) {
            safeSend(other, { type: 'peer-left' });
        }

        // 清理房间
        rooms.delete(code);
        console.log('[room]', code, '关闭(', role, '断开)');
    });

    ws.on('error', (err) => {
        console.error('[ws error]', err.message);
    });
});

httpServer.listen(PORT, () => {
    console.log('========================================');
    console.log('  找数字服务器启动成功!');
    console.log('  打开浏览器访问: http://localhost:' + PORT);
    console.log('========================================');
});
