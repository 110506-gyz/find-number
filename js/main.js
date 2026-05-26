// main.js —— 主入口,绑定事件、串联各模块

// ========== Chat 模块:游戏页悬浮聊天框 ==========
const Chat = {
    unread: 0,

    open() {
        document.getElementById('chat-body').hidden = false;
        document.getElementById('chat-toggle').hidden = true;
        Chat.unread = 0;
        document.getElementById('chat-toggle').classList.remove('has-unread');
        document.getElementById('chat-badge').textContent = '0';
        const messages = document.getElementById('chat-messages');
        messages.scrollTop = messages.scrollHeight;
        setTimeout(() => document.getElementById('chat-input').focus(), 50);
    },

    close() {
        document.getElementById('chat-body').hidden = true;
        document.getElementById('chat-toggle').hidden = false;
    },

    // from: 'me' / 'peer' / 'system'
    append(text, from) {
        const messages = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = 'chat-msg ' + (from === 'me' ? 'mine' : from === 'peer' ? 'theirs' : 'system');
        div.textContent = text;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
    },

    // 收到对方消息时调用
    receivePeer(text) {
        Chat.append(text, 'peer');
        const body = document.getElementById('chat-body');
        if (body.hidden) {
            Chat.unread++;
            document.getElementById('chat-badge').textContent =
                Chat.unread > 99 ? '99+' : Chat.unread;
            document.getElementById('chat-toggle').classList.add('has-unread');
        }
    },

    // 断开连接时清空(下次进房从干净状态)
    reset() {
        document.getElementById('chat-messages').innerHTML = '';
        Chat.unread = 0;
        document.getElementById('chat-toggle').classList.remove('has-unread');
        document.getElementById('chat-badge').textContent = '0';
        Chat.close();
    }
};

document.addEventListener('DOMContentLoaded', () => {

    // ========== 玩法说明弹窗(每次进入都弹,关闭按钮可隐藏) ==========
    const howToOverlay = document.getElementById('how-to-overlay');
    document.getElementById('how-to-close').addEventListener('click', () => {
        howToOverlay.hidden = true;
    });
    document.getElementById('how-to-ok').addEventListener('click', () => {
        howToOverlay.hidden = true;
    });
    // 点击遮罩区域(卡片外)也关闭
    howToOverlay.addEventListener('click', (e) => {
        if (e.target === howToOverlay) howToOverlay.hidden = true;
    });

    // ========== 欢迎页:创建房间 ==========
    document.getElementById('btn-goto-create').addEventListener('click', () => {
        const nick = document.getElementById('nickname-input').value.trim();
        if (!nick) {
            UI.toast('请先输入昵称');
            return;
        }

        Net.me.nickname = nick;
        Net.me.avatar = UI.randomAvatar();
        Net.me.role = 'host';
        Net.me.roomCode = UI.randomRoomCode();

        document.getElementById('create-avatar').textContent = Net.me.avatar;
        document.getElementById('create-nick').textContent = Net.me.nickname;
        document.getElementById('room-code').textContent = Net.me.roomCode;
        document.getElementById('create-status').textContent = '正在创建房间...';

        UI.showPage('page-create');

        document.getElementById('create-status').textContent = '正在连接信令服务器...';
        Net.createRoom(
            () => {
                document.getElementById('create-status').textContent = '✅ 房间已创建,等待对方加入...';
            },
            (errCode) => {
                if (errCode === 'ROOM_TAKEN') {
                    Net.me.roomCode = UI.randomRoomCode();
                    document.getElementById('room-code').textContent = Net.me.roomCode;
                    Net.disconnect();
                    setTimeout(() => Net.createRoom(() => {
                        document.getElementById('create-status').textContent = '✅ 房间已创建,等待对方加入...';
                    }), 300);
                } else if (errCode === 'NETWORK') {
                    document.getElementById('create-status').innerHTML =
                        '❌ 连不上服务器<br><span style="font-size:12px;color:#888;">' +
                        '服务器可能在启动中(免费云需要30秒唤醒),请稍等再试。' +
                        '若仍失败,检查网络是否畅通。</span>';
                } else {
                    document.getElementById('create-status').textContent = '❌ 创建失败:' + errCode;
                }
            }
        );
    });

    // ========== 欢迎页:加入房间 ==========
    document.getElementById('btn-goto-join').addEventListener('click', () => {
        const nick = document.getElementById('nickname-input').value.trim();
        if (!nick) {
            UI.toast('请先输入昵称');
            return;
        }

        Net.me.nickname = nick;
        Net.me.avatar = UI.randomAvatar();
        Net.me.role = 'guest';

        document.getElementById('join-avatar').textContent = Net.me.avatar;
        document.getElementById('join-nick').textContent = Net.me.nickname;
        document.getElementById('join-status').textContent = '';
        document.getElementById('room-code-input').value = '';

        UI.showPage('page-join');
    });

    // ========== 加入页:确认加入 ==========
    document.getElementById('btn-do-join').addEventListener('click', () => {
        const code = document.getElementById('room-code-input').value.trim();
        const status = document.getElementById('join-status');
        if (!/^\d{6}$/.test(code)) {
            status.textContent = '房间号必须是6位数字';
            status.className = 'join-status error';
            return;
        }
        status.textContent = '连接中...';
        status.className = 'join-status';

        Net.joinRoom(code,
            () => {
                status.textContent = '已连接,等待握手...';
                status.className = 'join-status success';
            },
            (errCode) => {
                if (errCode === 'ROOM_NOT_FOUND') {
                    status.textContent = '房间号不存在或房主已离开';
                } else if (errCode === 'ROOM_FULL') {
                    status.textContent = '这个房间已经有两个人了';
                } else if (errCode === 'NETWORK') {
                    status.innerHTML = '❌ 连不上服务器<br><span style="font-size:12px;">' +
                        '服务器可能在启动中(免费云需要30秒唤醒),请稍等再试</span>';
                } else {
                    status.textContent = '连接失败:' + errCode;
                }
                status.className = 'join-status error';
            }
        );
    });

    // ========== 复制房间号 ==========
    document.getElementById('btn-copy-code').addEventListener('click', () => {
        const code = document.getElementById('room-code').textContent;
        navigator.clipboard.writeText(code).then(() => {
            UI.toast('房间号已复制');
        }).catch(() => {
            UI.toast('复制失败,请手动复制:' + code);
        });
    });

    // ========== 各种返回 / 退出(都用同一个函数:清网络+清聊天+回欢迎页) ==========
    function quitToWelcome() {
        Net.disconnect();
        Chat.reset();
        UI.showPage('page-welcome');
    }
    document.getElementById('btn-create-back').addEventListener('click', quitToWelcome);
    document.getElementById('btn-join-back').addEventListener('click', quitToWelcome);
    document.getElementById('btn-setup-back').addEventListener('click', () => {
        if (!confirm('确定退出房间吗?')) return;
        quitToWelcome();
    });
    document.getElementById('btn-game-quit').addEventListener('click', () => {
        if (!confirm('退出当前对局?对方将无法继续。')) return;
        quitToWelcome();
    });

    // ========== 联机消息:对方 peer-info ==========
    Net.on('peer-info', () => {
        enterSetupPage();
    });

    // ========== 联机消息:对方调整了配置(客人端) ==========
    Net.on('config', (cfg) => {
        if (Net.me.role !== 'guest') return;
        applyConfigToUI(cfg);
        Game.config = Object.assign(Game.config, cfg);
    });

    // ========== 联机消息:游戏开始 ==========
    Net.on('game-start', (data) => {
        // data: { firstQuestioner, pool, poolHeight, rows, cols, density }
        Game.config.rows = data.rows;
        Game.config.cols = data.cols;
        if (data.density) Game.config.density = data.density;
        Game.state.numberPool = data.pool;
        Game.state.poolHeight = data.poolHeight || 300;
        const meFirst = data.firstQuestioner === Net.me.role;
        startGame(meFirst);
    });

    // ========== 联机消息:对方出了题 ==========
    Net.on('question', (data) => {
        // 我是找数字方
        Game.state.currentNumber = data.value;
        Game.state.phase = 'finding';
        UI.setQuestion(data.value);
        UI.setRoleIndicator('快找数字!', 'finder');
        UI.setPeerStatus('对方在画叉...', 'questioner');
        UI.setMyGridClickable(false);
    });

    // ========== 联机消息:对方画了一个叉(对方的格子图状态) ==========
    Net.on('mark', (data) => {
        // 对方在自己的格子上画叉(对方=出题方)
        const { row, col } = data;
        Game.state.peerGrid[row][col] = true;
        UI.markGridCell('peer', row, col);
        UI.setPeerProgress();
        // 检查是否对方满了
        if (Game.isGridFull(Game.state.peerGrid)) {
            endGame('peer');
        }
    });

    // ========== 联机消息:我作为出题方时,对方找到了我的题 ==========
    Net.on('found', () => {
        // 我之前是出题方,对方点中了
        UI.setRoleIndicator('等对方出题...', 'waiting');
        UI.setPeerStatus('对方在选题...', 'questioner');
        Game.state.currentQuestioner = 'peer';
        Game.state.currentNumber = null;
        Game.state.phase = 'waiting-question';
        UI.setQuestion(null);
        UI.setMyGridClickable(false);
    });

    // ========== 联机消息:三个随机化 ==========
    Net.on('shuffle', (data) => {
        Game.state.numberPool = data.pool;
        Game.state.poolHeight = data.poolHeight;
        UI.renderNumberPool();
    });
    Net.on('resize', (data) => {
        Game.state.numberPool = data.pool;
        Game.state.poolHeight = data.poolHeight;
        UI.renderNumberPool();
    });
    Net.on('rotate', (data) => {
        Game.state.numberPool = data.pool;
        Game.state.poolHeight = data.poolHeight;
        UI.renderNumberPool();
    });

    // ========== 联机消息:再来一局 ==========
    Net.on('rematch-request', () => {
        // 对方点了再来一局,回到设置页
        Game.state.phase = 'idle';
        Game.state.winner = null;
        enterSetupPage();
    });

    // ========== 联机消息:断开 ==========
    Net.on('disconnected', () => {
        UI.toast('对方已断开连接');
        Net.disconnect();
        Chat.reset();
        UI.showPage('page-welcome');
    });

    // ========== 设置页:配置变更(房主) ==========
    ['cfg-rows', 'cfg-cols', 'cfg-numcount', 'cfg-digits', 'cfg-density'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            if (Net.me.role !== 'host') return;
            const cfg = readConfigFromUI();
            Game.config = Object.assign(Game.config, cfg);
            Net.send('config', cfg);
        });
    });

    // ========== 设置页:房主点开始 ==========
    document.getElementById('btn-start-me-first').addEventListener('click', () => {
        hostStartGame('host');
    });
    document.getElementById('btn-start-peer-first').addEventListener('click', () => {
        hostStartGame('guest');
    });

    // ========== 游戏页:数字堆点击 ==========
    document.getElementById('number-pool').addEventListener('click', (e) => {
        const span = e.target.closest('.pool-num');
        if (!span) return;
        const idx = parseInt(span.dataset.idx, 10);
        const value = parseInt(span.dataset.value, 10);
        handlePoolClick(idx, value);
    });

    // ========== 游戏页:我的格子点击(出题方画叉) ==========
    document.getElementById('my-grid').addEventListener('click', (e) => {
        const cell = e.target.closest('.grid-cell');
        if (!cell || !cell.classList.contains('clickable')) return;
        const row = parseInt(cell.dataset.row, 10);
        const col = parseInt(cell.dataset.col, 10);
        handleMyGridClick(row, col);
    });

    // ========== 游戏页:三个随机化按钮(都会重新跑碰撞检测,把新高度也同步过去) ==========
    document.getElementById('btn-shuffle').addEventListener('click', () => {
        Game.shufflePool();
        UI.renderNumberPool();
        Net.send('shuffle', { pool: Game.state.numberPool, poolHeight: Game.state.poolHeight });
    });
    document.getElementById('btn-resize').addEventListener('click', () => {
        Game.randomizeSize();
        UI.renderNumberPool();
        Net.send('resize', { pool: Game.state.numberPool, poolHeight: Game.state.poolHeight });
    });
    document.getElementById('btn-rotate').addEventListener('click', () => {
        Game.randomizeRotation();
        UI.renderNumberPool();
        Net.send('rotate', { pool: Game.state.numberPool, poolHeight: Game.state.poolHeight });
    });

    // ========== 聊天框 ==========
    document.getElementById('chat-toggle').addEventListener('click', Chat.open);
    document.getElementById('chat-close').addEventListener('click', Chat.close);

    document.getElementById('chat-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;
        Chat.append(text, 'me');
        Net.send('chat', { text });
        input.value = '';
    });

    // 收到对方聊天消息
    Net.on('chat', (data) => {
        if (!data || !data.text) return;
        Chat.receivePeer(data.text);
    });

    // ========== 窗口大小变化时,重新渲染数字堆(手机旋转/调浏览器大小) ==========
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        // 防抖:停止变化后 150ms 再重渲染
        resizeTimer = setTimeout(() => {
            const gamePage = document.getElementById('page-game');
            if (gamePage.classList.contains('active') && Game.state.numberPool.length > 0) {
                UI.renderNumberPool();
            }
        }, 150);
    });

    // ========== 结算页:再来一局 ==========
    document.getElementById('btn-rematch').addEventListener('click', () => {
        Game.state.phase = 'idle';
        Game.state.winner = null;
        Net.send('rematch-request', {});
        enterSetupPage();
    });
    document.getElementById('btn-result-quit').addEventListener('click', quitToWelcome);
});

// ========================================================
// 工具函数区
// ========================================================

// 进入设置页
function enterSetupPage() {
    document.getElementById('setup-my-avatar').textContent = Net.me.avatar;
    document.getElementById('setup-my-nick').textContent = Net.me.nickname;
    document.getElementById('setup-my-role').textContent = Net.me.role === 'host' ? '房主' : '客人';
    document.getElementById('setup-peer-avatar').textContent = Net.peer.avatar;
    document.getElementById('setup-peer-nick').textContent = Net.peer.nickname;
    document.getElementById('setup-peer-role').textContent = Net.me.role === 'host' ? '客人' : '房主';

    const isHost = Net.me.role === 'host';
    ['cfg-rows', 'cfg-cols', 'cfg-numcount', 'cfg-digits'].forEach(id => {
        document.getElementById(id).disabled = !isHost;
    });
    document.getElementById('guest-readonly-tip').style.display = isHost ? 'none' : 'block';
    document.getElementById('host-start-area').style.display = isHost ? 'block' : 'none';

    if (isHost) {
        const cfg = readConfigFromUI();
        Game.config = Object.assign(Game.config, cfg);
        Net.send('config', cfg);
    }
    UI.showPage('page-setup');
}

function readConfigFromUI() {
    return {
        rows: parseInt(document.getElementById('cfg-rows').value, 10) || 3,
        cols: parseInt(document.getElementById('cfg-cols').value, 10) || 3,
        numCount: parseInt(document.getElementById('cfg-numcount').value, 10) || 100,
        digits: parseInt(document.getElementById('cfg-digits').value, 10) || 1,
        density: parseInt(document.getElementById('cfg-density').value, 10) || 3
    };
}

function applyConfigToUI(cfg) {
    document.getElementById('cfg-rows').value = cfg.rows;
    document.getElementById('cfg-cols').value = cfg.cols;
    document.getElementById('cfg-numcount').value = cfg.numCount;
    document.getElementById('cfg-digits').value = cfg.digits;
    if (cfg.density) document.getElementById('cfg-density').value = cfg.density;
}

// 房主开始游戏
function hostStartGame(firstQuestioner) {
    if (Net.me.role !== 'host') return;
    const cfg = readConfigFromUI();
    Game.config = Object.assign(Game.config, cfg);
    // 生成数字堆(碰撞检测保证不重叠)
    const result = Game.generatePool(cfg.numCount, cfg.digits, cfg.density);
    Game.state.numberPool = result.items;
    Game.state.poolHeight = result.height;
    // 广播开始 + 数字堆 + 高度 + 谁先出题
    Net.send('game-start', {
        firstQuestioner: firstQuestioner,
        pool: Game.state.numberPool,
        poolHeight: Game.state.poolHeight,
        rows: cfg.rows,
        cols: cfg.cols,
        density: cfg.density
    });
    const meFirst = firstQuestioner === 'host';
    startGame(meFirst);
}

// 进入游戏:双方都跑这个
function startGame(meFirst) {
    // 初始化格子
    Game.initGrids(Game.config.rows, Game.config.cols);
    Game.state.currentNumber = null;
    Game.state.winner = null;

    // UI 准备
    document.getElementById('game-room-code').textContent = Net.me.roomCode;
    document.getElementById('game-my-avatar').textContent = Net.me.avatar;
    document.getElementById('game-my-nick').textContent = Net.me.nickname;
    document.getElementById('game-peer-avatar').textContent = Net.peer.avatar;
    document.getElementById('game-peer-nick').textContent = Net.peer.nickname;

    UI.showPage('page-game');
    UI.renderNumberPool();
    UI.renderGrid('my');
    UI.renderGrid('peer');
    UI.setQuestion(null);
    UI.setPeerProgress();

    if (meFirst) {
        Game.state.currentQuestioner = 'me';
        Game.state.phase = 'waiting-question';
        UI.setRoleIndicator('你来出题:点数字堆里一个数字', 'questioner');
        UI.setPeerStatus('等你出题...', 'waiting');
        UI.setMyGridClickable(false);
    } else {
        Game.state.currentQuestioner = 'peer';
        Game.state.phase = 'waiting-question';
        UI.setRoleIndicator('等对方出题...', 'waiting');
        UI.setPeerStatus('对方在选题...', 'questioner');
        UI.setMyGridClickable(false);
    }
}

// 处理数字堆点击
function handlePoolClick(idx, value) {
    if (Game.state.phase === 'over') return;

    // 我是出题方,且尚未选题:本次点击=出题
    if (Game.state.currentQuestioner === 'me' && Game.state.phase === 'waiting-question') {
        Game.state.currentNumber = value;
        Game.state.phase = 'questioning';
        UI.setQuestion(value);
        UI.setRoleIndicator('点你的格子画叉!', 'questioner');
        UI.setPeerStatus('对方在找数字...', 'finder');
        UI.setMyGridClickable(true);
        UI.flashPoolNum(idx, true);
        Net.send('question', { value });
        return;
    }

    // 我是找数字方,且正在找:判定对错
    if (Game.state.currentQuestioner === 'peer' && Game.state.phase === 'finding') {
        if (value === Game.state.currentNumber) {
            // 找对了
            UI.flashPoolNum(idx, true);
            Net.send('found', {});
            // 角色对调:我变成出题方
            Game.state.currentQuestioner = 'me';
            Game.state.currentNumber = null;
            Game.state.phase = 'waiting-question';
            UI.setQuestion(null);
            UI.setRoleIndicator('轮到你出题:点数字堆里一个数字', 'questioner');
            UI.setPeerStatus('等你出题...', 'waiting');
            UI.setMyGridClickable(false);
        } else {
            // 找错了,继续找
            UI.flashPoolNum(idx, false);
        }
        return;
    }

    // 其他状态:点了也没事
}

// 处理我的格子点击(只有"我是出题方且已选题"才能画)
function handleMyGridClick(row, col) {
    if (Game.state.currentQuestioner !== 'me') return;
    if (Game.state.phase !== 'questioning') return;
    if (Game.state.myGrid[row][col]) return;

    Game.state.myGrid[row][col] = true;
    UI.markGridCell('my', row, col);
    Net.send('mark', { row, col });

    // 满了就赢
    if (Game.isGridFull(Game.state.myGrid)) {
        endGame('me');
    }
}

// 结束游戏
function endGame(winner) {
    if (Game.state.phase === 'over') return;
    Game.state.phase = 'over';
    Game.state.winner = winner;
    UI.setMyGridClickable(false);

    const emojiEl = document.getElementById('result-emoji');
    const titleEl = document.getElementById('result-title');
    const detailEl = document.getElementById('result-detail');

    if (winner === 'me') {
        emojiEl.textContent = '🎉';
        titleEl.textContent = '恭喜获胜!';
        detailEl.textContent = '你的格子先满了';
    } else {
        emojiEl.textContent = '😅';
        titleEl.textContent = '惜败';
        detailEl.textContent = '对方的格子先满了';
    }
    setTimeout(() => UI.showPage('page-result'), 600);
}
