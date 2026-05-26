// game.js —— 游戏核心逻辑

// 数字堆容器宽度(双方约定同一个值,保证两端坐标一致)
const POOL_WIDTH = 480;

// 疏密度档位 -> 数字之间的间隙系数(越大越疏)
// 注:档位1<1.0 时数字几乎贴着,但靠 numRadius 偏大补偿,实际不会真重叠
const DENSITY_GAP = { 1: 0.9, 2: 1.1, 3: 1.4, 4: 1.8, 5: 2.3 };

// 估算单个数字的"半径"(用于碰撞检测)
function numRadius(n) {
    const w = n.size * 0.65 * String(n.value).length;
    const h = n.size;
    // 旋转后包围盒会变大,稍微放宽
    return Math.max(w, h) / 1.6 + 2;
}

// 把一组数字摆到容器里,保证不重叠;返回需要的容器高度
function placeNumbers(items, containerWidth, gap) {
    // 初始高度估算:让总面积比所有数字面积之和大些
    let totalArea = 0;
    items.forEach(n => {
        const r = numRadius(n) * gap;
        totalArea += Math.PI * r * r;
    });
    let containerHeight = Math.max(280, Math.ceil(totalArea / containerWidth * 1.4));
    const MAX_HEIGHT = 3000;

    while (containerHeight <= MAX_HEIGHT) {
        // 重置所有位置
        items.forEach(n => { n.x = -1; n.y = -1; });
        let allPlaced = true;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const r = numRadius(item);
            let success = false;

            for (let a = 0; a < 60; a++) {
                const x = r + Math.random() * Math.max(1, containerWidth - 2 * r);
                const y = r + Math.random() * Math.max(1, containerHeight - 2 * r);

                let collision = false;
                for (let j = 0; j < i; j++) {
                    const p = items[j];
                    const dx = x - p.x;
                    const dy = y - p.y;
                    // 两个数字中心距离需要大于(两半径×间距系数)才算不撞
                    const need = (numRadius(p) + r) * gap;
                    if (dx * dx + dy * dy < need * need) {
                        collision = true;
                        break;
                    }
                }

                if (!collision) {
                    item.x = x;
                    item.y = y;
                    success = true;
                    break;
                }
            }

            if (!success) {
                allPlaced = false;
                break;
            }
        }

        if (allPlaced) return containerHeight;
        containerHeight += 80;
    }
    // 兜底:即使到 3000 还放不完,返回当前高度(允许少数重叠)
    return containerHeight;
}

const Game = {
    config: {
        rows: 3,
        cols: 3,
        numCount: 100,
        digits: 1,
        density: 3
    },

    state: {
        numberPool: [],   // [{ value, size, rotation, x, y }, ...]
        poolHeight: 300,
        myGrid: [],
        peerGrid: [],
        currentQuestioner: '',
        currentNumber: null,
        winner: null,
        phase: 'idle'
    },

    // 生成数字堆:数值/字号/旋转开局就乱,位置碰撞检测保证不重叠
    generatePool(numCount, digits, density) {
        const min = digits === 1 ? 0 : Math.pow(10, digits - 1);
        const max = Math.pow(10, digits) - 1;
        const gap = DENSITY_GAP[density] || 1.8;

        const items = [];
        for (let i = 0; i < numCount; i++) {
            items.push({
                value: Math.floor(Math.random() * (max - min + 1)) + min,
                size: 12 + Math.floor(Math.random() * 17),     // 12-28
                rotation: Math.floor(Math.random() * 61) - 30, // -30~30
                x: -1, y: -1
            });
        }

        const height = placeNumbers(items, POOL_WIDTH, gap);
        return { items, height };
    },

    // 重洗位置:重新做碰撞检测放置,字号/旋转/数值保留
    shufflePool() {
        const gap = DENSITY_GAP[Game.config.density] || 1.8;
        const items = Game.state.numberPool;
        const height = placeNumbers(items, POOL_WIDTH, gap);
        Game.state.poolHeight = height;
    },

    // 随机字号:也要重新摆放(字号变了可能撞)
    randomizeSize() {
        Game.state.numberPool.forEach(n => {
            n.size = 12 + Math.floor(Math.random() * 17);
        });
        const gap = DENSITY_GAP[Game.config.density] || 1.8;
        Game.state.poolHeight = placeNumbers(Game.state.numberPool, POOL_WIDTH, gap);
    },

    // 随机旋转:旋转影响包围盒,也重新摆
    randomizeRotation() {
        Game.state.numberPool.forEach(n => {
            n.rotation = Math.floor(Math.random() * 61) - 30;
        });
        const gap = DENSITY_GAP[Game.config.density] || 1.8;
        Game.state.poolHeight = placeNumbers(Game.state.numberPool, POOL_WIDTH, gap);
    },

    initGrids(rows, cols) {
        Game.state.myGrid = Array.from({ length: rows }, () => Array(cols).fill(false));
        Game.state.peerGrid = Array.from({ length: rows }, () => Array(cols).fill(false));
    },

    isGridFull(grid) {
        for (let r = 0; r < grid.length; r++) {
            for (let c = 0; c < grid[r].length; c++) {
                if (!grid[r][c]) return false;
            }
        }
        return true;
    }
};
