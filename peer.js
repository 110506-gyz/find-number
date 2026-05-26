// peer.js —— 联机模块(WebSocket 中转,稳定 99%+)
//
// 自动用"当前页面所在域名"作为 WebSocket 服务器地址
//   本地访问 http://localhost:3000  → 自动连 ws://localhost:3000
//   线上访问 https://xxx.onrender.com → 自动连 wss://xxx.onrender.com
// 所以前后端是同一个服务,部署一次搞定,不用改任何配置
const SERVER_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;

const Net = {
    me: { nickname: '', avatar: '', role: '', roomCode: '' },
    peer: { nickname: '', avatar: '' },

    _ws: null,
    _handlers: {},
    _pingTimer: null,

    // 业务消息处理器注册
    on(type, handler) {
        Net._handlers[type] = handler;
    },
    _trigger(type, payload) {
        const h = Net._handlers[type];
        if (h) h(payload);
    },

    // 内部:开 WebSocket 连接(房主、客人都用这个)
    _openSocket(onOpen, onError) {
        try {
            const ws = new WebSocket(SERVER_URL);
            Net._ws = ws;

            ws.onopen = () => {
                console.log('[ws] 已连上服务器');
                // 心跳:每25秒一次,防云平台杀连接
                Net._pingTimer = setInterval(() => {
                    if (ws.readyState === ws.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                    }
                }, 25000);
                if (onOpen) onOpen();
            };

            ws.onmessage = (e) => {
                let msg;
                try { msg = JSON.parse(e.data); } catch (err) { return; }
                Net._handleServerMessage(msg);
            };

            ws.onerror = (e) => {
                console.error('[ws] 错误', e);
                if (onError) onError('NETWORK');
            };

            ws.onclose = () => {
                console.log('[ws] 连接关闭');
                if (Net._pingTimer) {
                    clearInterval(Net._pingTimer);
                    Net._pingTimer = null;
                }
                // 通知上层(如果是异常断开)
                Net._trigger('disconnected', {});
            };
        } catch (e) {
            console.error('[ws] 创建失败', e);
            if (onError) onError('NETWORK');
        }
    },

    // 处理服务器发来的消息
    _handleServerMessage(msg) {
        switch (msg.type) {
            case 'room-created':
                // 房主收到:创建成功
                Net._onRoomCreated && Net._onRoomCreated();
                break;
            case 'create-failed':
                // 房主收到:创建失败
                Net._onCreateFailed && Net._onCreateFailed(msg.reason);
                break;
            case 'join-ok':
                // 客人收到:加入成功 + 房主信息
                Net.peer.nickname = (msg.peerInfo && msg.peerInfo.nickname) || '';
                Net.peer.avatar = (msg.peerInfo && msg.peerInfo.avatar) || '';
                Net._onJoinOk && Net._onJoinOk();
                // 触发业务层的 'peer-info' 进入设置页
                Net._trigger('peer-info', Net.peer);
                break;
            case 'join-failed':
                Net._onJoinFailed && Net._onJoinFailed(msg.reason);
                break;
            case 'peer-joined':
                // 房主收到:客人来了
                Net.peer.nickname = (msg.peerInfo && msg.peerInfo.nickname) || '';
                Net.peer.avatar = (msg.peerInfo && msg.peerInfo.avatar) || '';
                Net._trigger('peer-info', Net.peer);
                break;
            case 'peer-left':
                Net._trigger('disconnected', {});
                break;
            case 'relay':
                // 中转消息,分发给业务处理器
                Net._trigger(msg.subType, msg.payload);
                break;
            case 'pong':
                // 心跳响应,什么都不做
                break;
        }
    },

    // ========== 房主:创建房间 ==========
    createRoom(onReady, onError) {
        Net._onRoomCreated = () => { if (onReady) onReady(); };
        Net._onCreateFailed = (reason) => {
            if (reason === 'ROOM_TAKEN') {
                if (onError) onError('ROOM_TAKEN');
            } else {
                if (onError) onError('UNKNOWN');
            }
        };
        Net._openSocket(
            () => {
                // 连上服务器后,发"创建房间"
                Net._ws.send(JSON.stringify({
                    type: 'create-room',
                    roomCode: Net.me.roomCode,
                    me: { nickname: Net.me.nickname, avatar: Net.me.avatar }
                }));
            },
            onError
        );
    },

    // ========== 客人:加入房间 ==========
    joinRoom(code, onConnected, onError) {
        Net.me.roomCode = code;
        Net._onJoinOk = () => { if (onConnected) onConnected(); };
        Net._onJoinFailed = (reason) => {
            if (reason === 'ROOM_NOT_FOUND') {
                if (onError) onError('ROOM_NOT_FOUND');
            } else if (reason === 'ROOM_FULL') {
                if (onError) onError('ROOM_FULL');
            } else {
                if (onError) onError('UNKNOWN');
            }
        };
        Net._openSocket(
            () => {
                Net._ws.send(JSON.stringify({
                    type: 'join-room',
                    roomCode: code,
                    me: { nickname: Net.me.nickname, avatar: Net.me.avatar }
                }));
            },
            onError
        );
    },

    // ========== 发消息给对方(走服务器中转) ==========
    send(type, payload) {
        if (!Net._ws || Net._ws.readyState !== WebSocket.OPEN) {
            console.warn('[ws] 连接未就绪,无法发送', type);
            return;
        }
        Net._ws.send(JSON.stringify({
            type: 'relay',
            subType: type,
            payload: payload
        }));
    },

    // ========== 主动断开 ==========
    disconnect() {
        if (Net._pingTimer) {
            clearInterval(Net._pingTimer);
            Net._pingTimer = null;
        }
        if (Net._ws) {
            try { Net._ws.close(); } catch (e) {}
            Net._ws = null;
        }
        Net.peer = { nickname: '', avatar: '' };
    }
};
