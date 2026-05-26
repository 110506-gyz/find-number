// ui.js —— 负责页面切换和UI层的公共操作

const UI = {
    // 当前显示的页面id
    currentPage: 'page-welcome',

    // 切换到指定页面
    showPage(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(pageId);
        if (target) {
            target.classList.add('active');
            UI.currentPage = pageId;
        }
    },

    // 简单提示(后续可以改成更好看的Toast)
    toast(msg) {
        alert(msg);
    },

    // 随机分配一个emoji头像
    randomAvatar() {
        const pool = ['🦊', '🐼', '🐯', '🦁', '🐵', '🐸', '🐧', '🐨', '🐰', '🐱', '🐶', '🐻'];
        return pool[Math.floor(Math.random() * pool.length)];
    },

    // 生成6位房间号
    randomRoomCode() {
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += Math.floor(Math.random() * 10);
        }
        return code;
    },

    // ========== 渲染数字堆(像素坐标,小屏自动缩放) ==========
    // 坐标系是 480px 基准。手机窄屏时按容器实际宽度等比缩小,
    // 双方仍用同一份 pool 数据,只是渲染时缩放,不影响逻辑。
    renderNumberPool() {
        const pool = Game.state.numberPool;
        const container = document.getElementById('number-pool');
        const POOL_BASE_WIDTH = 480;
        const actualWidth = container.clientWidth || POOL_BASE_WIDTH;
        const scale = Math.min(1, actualWidth / POOL_BASE_WIDTH);

        container.innerHTML = '';
        container.style.height = (Game.state.poolHeight * scale) + 'px';

        pool.forEach((n, idx) => {
            const span = document.createElement('span');
            span.className = 'pool-num';
            span.textContent = n.value;
            span.style.fontSize = (n.size * scale) + 'px';
            span.style.left = (n.x * scale) + 'px';
            span.style.top = (n.y * scale) + 'px';
            span.style.transform = 'translate(-50%, -50%) rotate(' + n.rotation + 'deg)';
            span.dataset.idx = idx;
            span.dataset.value = n.value;
            container.appendChild(span);
        });
    },

    // ========== 渲染格子图(myOrPeer: 'my' / 'peer') ==========
    renderGrid(side) {
        const grid = side === 'my' ? Game.state.myGrid : Game.state.peerGrid;
        const container = document.getElementById(side + '-grid');
        const rows = Game.config.rows;
        const cols = Game.config.cols;

        container.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
        container.innerHTML = '';

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                if (grid[r] && grid[r][c]) {
                    cell.classList.add('marked');
                    cell.textContent = '✕';
                }
                container.appendChild(cell);
            }
        }
    },

    // ========== 更新单个格子(画叉时调用,带动画) ==========
    markGridCell(side, row, col) {
        const container = document.getElementById(side + '-grid');
        const cell = container.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (cell && !cell.classList.contains('marked')) {
            cell.classList.add('marked', 'just-marked');
            cell.textContent = '✕';
            setTimeout(() => cell.classList.remove('just-marked'), 300);
        }
    },

    // ========== 设置 myGrid 的格子是否可点击 ==========
    setMyGridClickable(canClick) {
        const cells = document.querySelectorAll('#my-grid .grid-cell');
        cells.forEach(c => {
            if (canClick && !c.classList.contains('marked')) {
                c.classList.add('clickable');
            } else {
                c.classList.remove('clickable');
            }
        });
    },

    // ========== 显示题目数字 ==========
    setQuestion(num) {
        document.getElementById('current-question').textContent = num === null ? '-' : num;
    },

    // ========== 角色提示 ==========
    setRoleIndicator(text, kind) {
        const el = document.getElementById('role-indicator');
        el.textContent = text;
        el.className = 'role-indicator ' + (kind || '');
    },

    // ========== 数字堆中匹配的数字闪烁(正确/错误) ==========
    flashPoolNum(idx, correct) {
        const span = document.querySelector(`.pool-num[data-idx="${idx}"]`);
        if (!span) return;
        span.classList.add(correct ? 'flash-correct' : 'flash-wrong');
        setTimeout(() => {
            span.classList.remove('flash-correct', 'flash-wrong');
        }, 500);
    }
};
