// 临时测试脚手架：用极简 DOM 影子跑 index.html 里的 IIFE，验证三个修复
const vm = require('vm');
const fs = require('fs');

const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeEnv(store) {
  const ids = {};

  class El {
    constructor(tag) {
      this.tagName = tag;
      this.children = [];
      this.parentNode = null;
      this.className = '';
      this.textContent = '';
      this._style = {};
      this.style = this._style;
      this._id = '';
      this._handlers = {};
      const set = new Set();
      this.classList = {
        add: (...c) => c.forEach(x => set.add(x)),
        remove: (...c) => c.forEach(x => set.delete(x)),
        contains: c => set.has(c),
      };
      this._cls = set;
    }
    get id() { return this._id; }
    set id(v) { this._id = v; ids[v] = this; }
    get clientWidth() { return 384; }
    get offsetWidth() { return 384; }
    set innerHTML(v) {
      this._html = v;
      if (v.includes('ovTitle')) {
        ['ovTitle', 'ovDetail', 'ovBtn'].forEach(n => {
          const e = new El('div');
          e.id = n;
          e.parentNode = this;
          this.children.push(e);
        });
      }
    }
    get innerHTML() { return this._html || ''; }
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      c.parentNode = null;
      return c;
    }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    addEventListener(t, fn) { (this._handlers[t] = this._handlers[t] || []).push(fn); }
    fire(t, ev) { (this._handlers[t] || []).forEach(fn => fn(ev || {})); }
    querySelectorAll(sel) {
      const cls = sel.replace('.', '');
      const out = [];
      const walk = n => n.children.forEach(c => {
        if (c.className && c.className.split(/\s+/).includes(cls)) out.push(c);
        walk(c);
      });
      walk(this);
      return out;
    }
  }

  const board = new El('div');
  board.id = 'board';
  ['score', 'moves', 'best', 'btnRestart'].forEach(n => { const e = new El('div'); e.id = n; });

  const docHandlers = {};
  const document = {
    getElementById: n => ids[n] || null,
    createElement: t => new El(t),
    addEventListener: (t, fn) => (docHandlers[t] = docHandlers[t] || []).push(fn),
  };

  const ctx = {
    document,
    window: { addEventListener() {} },
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    setTimeout, clearTimeout, console, Math, JSON,
  };
  ctx.window.localStorage = ctx.localStorage;
  vm.createContext(ctx);
  vm.runInContext(code, ctx);

  return {
    board, ids, ctx, store,
    key(k) { (docHandlers.keydown || []).forEach(fn => fn({ key: k, preventDefault() {} })); },
    tiles() { return board.children.filter(c => (c.className || '').includes('tile')); },
    values() { return this.tiles().map(t => +t.textContent).sort((a, b) => a - b); },
  };
}

function setBoard(env, matrix) {
  // 直接写 localStorage 再重新加载，比外部拼内部状态稳
  const flat = matrix.flat();
  env.store.set('ssww_state', JSON.stringify({ g: flat, s: 0, m: 0, w: 0 }));
  return makeEnv(env.store);
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  → ' + extra : '')); }
};

// --- 1. 开局两块 ---
console.log('[1] 开局');
let store = new Map();
let env = makeEnv(store);
ok('开局面板有 2 块', env.tiles().length === 2, '实际 ' + env.tiles().length);
ok('新块只可能是 3 或 6', env.values().every(v => v === 3 || v === 6), env.values().join(','));

// --- 2. 合并与得分 ---
console.log('[2] 合并规则 3+6=9');
store = new Map();
env = makeEnv(store);
env = setBoard(env, [
  [3, 6, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
]);
ok('恢复存档成功', env.tiles().length === 2, '实际 ' + env.tiles().length);
env.key('ArrowLeft');
ok('向左滑后合成 9', env.values().includes(9), env.values().join(','));
ok('得分 +9', env.ids.score.textContent === 9, String(env.ids.score.textContent));
ok('步数 1', env.ids.moves.textContent === 1, String(env.ids.moves.textContent));
ok('过渡期 DOM 节点 = 合成块 + 幽灵块 + 新刷块', env.tiles().length === 3, '实际 ' + env.tiles().length);

// --- 3. 被吸收块的 DOM 收尾 ---
console.log('[3] 合体方块延迟移除');
store = new Map();
env = makeEnv(store);
env = setBoard(env, [
  [3, 6, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0],
]);
const before = env.tiles().length;
env.key('ArrowLeft');
const during = env.tiles().length; // 含正在滑走的幽灵块
ok('合并瞬间幽灵块仍在 DOM（有过渡）', during > 1, 'during=' + during + ' before=' + before);
setTimeout(() => {
  const after = env.tiles().length;
  ok('150ms 后幽灵块被移除', after === 2, 'after=' + after);

  // --- 4. 通关锁盘 ---
  console.log('[4] 结算后锁盘');
  store = new Map();
  env = makeEnv(store);
  env = setBoard(env, [
    [1152, 1152, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  env.key('ArrowLeft');
  ok('弹出通关遮罩', env.ids.overlay.classList.contains('show'));
  ok('显示 2304', env.ids.ovTitle.textContent.includes('2304'), env.ids.ovTitle.textContent);
  const snapMoves = env.ids.moves.textContent;
  const snapScore = env.ids.score.textContent;
  const snapTiles = env.tiles().length;
  env.key('ArrowLeft');
  env.key('ArrowUp');
  ok('遮罩期间键盘操作被忽略（步数不变）', env.ids.moves.textContent === snapMoves,
    snapMoves + ' → ' + env.ids.moves.textContent);
  ok('遮罩期间得分不变', env.ids.score.textContent === snapScore);
  ok('遮罩期间块数不变', env.tiles().length === snapTiles);

  // --- 5. 刷新续局 ---
  console.log('[5] 刷新续局');
  const st = store.get('ssww_state');
  const parsed = JSON.parse(st);
  ok('存档记录了棋盘', parsed.g.length === 16);
  ok('存档记录了步数/得分', parsed.m === 1 && parsed.s === 2304, JSON.stringify(parsed).slice(0, 80));
  const env2 = makeEnv(store); // 模拟刷新
  ok('重开页面仍是 2304 的局面', env2.values().includes(2304), env2.values().join(','));
  ok('重开页面步数保留', Number(env2.ids.moves.textContent) === 1, String(env2.ids.moves.textContent));
  ok('重开页面不重复弹窗', !env2.ids.overlay.classList.contains('show'));
  env2.key('ArrowRight');
  ok('通关后的残局还能继续走', Number(env2.ids.moves.textContent) === 2, String(env2.ids.moves.textContent));

  // --- 6. 重新开始清档 ---
  console.log('[6] 重新开始');
  env2.ids.btnRestart.fire('click');
  const st2 = JSON.parse(store.get('ssww_state'));
  ok('重开后步数归零', st2.m === 0 && st2.s === 0, JSON.stringify(st2).slice(0, 60));
  ok('重开后只有 2 块', env2.tiles().length === 2, '实际 ' + env2.tiles().length);
  ok('重开后遮罩关闭且解锁', !env2.ids.overlay.classList.contains('show'));

  // --- 7. 死局判断：满盘是否还能动 ---
  console.log('[7] 满盘仍可合并');
  const env3 = setBoard(makeEnv(new Map()), [
    [3, 6, 3, 6],
    [6, 3, 6, 3],
    [3, 6, 3, 6],
    [6, 3, 6, 3],
  ]);
  const m0 = env3.ids.moves.textContent;
  env3.key('ArrowLeft');
  ok('满盘也能合并（不会死局）', env3.ids.moves.textContent !== m0, m0 + ' → ' + env3.ids.moves.textContent);

  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  process.exit(fail ? 1 : 0);
}, 260);
