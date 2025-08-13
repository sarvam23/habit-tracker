/* 8‑Bit Habits — app.js */

/**
 * Data Model
 * - Item: Habit or Task
 *   {
 *     id: string,
 *     type: 'habit' | 'task',
 *     name: string,
 *     target: number,                    // habit: daily target; task: step goal
 *     progress: Record<string, number>,  // habit: date->count; task: {"__task": count}
 *     archived: boolean,
 *     createdAt: string
 *   }
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'pixelHabitsData.v1';
  const THEME_KEY = 'pixelHabitsTheme';

  /** @type {Array<any>} */
  let items = [];

  // DOM elements
  const habitsListEl = document.getElementById('habitsList');
  const tasksListEl = document.getElementById('tasksList');
  const completedListEl = document.getElementById('completedList');
  const addFormEl = document.getElementById('addForm');
  const itemTypeEl = document.getElementById('itemType');
  const habitTargetEl = document.getElementById('habitTarget');
  const taskStepsEl = document.getElementById('taskSteps');
  const themeToggleEl = document.getElementById('themeToggle');
  const exportBtnEl = document.getElementById('exportData');
  const importInputEl = document.getElementById('importData');
  const overallPercentEl = document.getElementById('overallPercent');

  // Canvas
  const canvas = document.getElementById('progressCanvas');
  const ctx = canvas.getContext('2d');

  /* Utilities */
  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function generateId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (e) {
      console.error('Failed to read storage', e);
      return [];
    }
  }

  function writeStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to write storage', e);
    }
  }

  function setTheme(theme) {
    const isLight = theme === 'light';
    document.body.classList.toggle('theme-light', isLight);
    document.body.classList.toggle('theme-dark', !isLight);
    themeToggleEl.textContent = isLight ? '☀' : '☾';
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
    drawArena();
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
    } else {
      const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      setTheme(prefersLight ? 'light' : 'dark');
    }
  }

  function ensureDemoData() {
    if (items.length > 0) return;
    const now = new Date().toISOString();
    const tKey = todayKey();
    items = [
      {
        id: generateId(),
        type: 'habit',
        name: 'Drink Water',
        target: 8,
        progress: { [tKey]: 3 },
        archived: false,
        createdAt: now,
      },
      {
        id: generateId(),
        type: 'habit',
        name: 'Read',
        target: 1,
        progress: { [tKey]: 0 },
        archived: false,
        createdAt: now,
      },
      {
        id: generateId(),
        type: 'task',
        name: 'Ship Habit App',
        target: 5,
        progress: { '__task': 2 },
        archived: false,
        createdAt: now,
      }
    ];
    writeStorage();
  }

  /* Calculations */
  function getHabitTodayCount(item) {
    const key = todayKey();
    return Number(item.progress?.[key] || 0);
  }

  function setHabitTodayCount(item, value) {
    const key = todayKey();
    if (!item.progress) item.progress = {};
    item.progress[key] = value;
  }

  function getTaskProgress(item) {
    const value = Number(item.progress?.['__task'] || 0);
    return value;
  }

  function setTaskProgress(item, value) {
    if (!item.progress) item.progress = {};
    item.progress['__task'] = value;
  }

  function habitPercent(item) {
    const count = getHabitTodayCount(item);
    return clamp((count / Math.max(1, item.target)) * 100, 0, 100);
  }

  function taskPercent(item) {
    const count = getTaskProgress(item);
    return clamp((count / Math.max(1, item.target)) * 100, 0, 100);
  }

  function overallTodayPercent() {
    const active = items.filter(i => !i.archived);
    if (active.length === 0) return 0;
    let sum = 0;
    active.forEach(i => {
      sum += i.type === 'habit' ? habitPercent(i) : taskPercent(i);
    });
    return Math.round(sum / active.length);
  }

  /* Rendering */
  function render() {
    // Clear lists
    habitsListEl.innerHTML = '';
    tasksListEl.innerHTML = '';
    completedListEl.innerHTML = '';

    // Active items
    const active = items.filter(i => !i.archived);
    const habits = active.filter(i => i.type === 'habit');
    const tasks = active.filter(i => i.type === 'task');

    habits.forEach(habit => habitsListEl.appendChild(renderHabit(habit)));
    tasks.forEach(task => tasksListEl.appendChild(renderTask(task)));

    // Completed items
    const completed = items.filter(i => i.archived);
    completed.forEach(it => completedListEl.appendChild(renderCompleted(it)));

    // Arena
    const percent = overallTodayPercent();
    overallPercentEl.textContent = `${percent}%`;
    drawArena();
  }

  function renderHabit(item) {
    const li = document.createElement('li');
    li.className = 'item';

    const left = document.createElement('div');
    const right = document.createElement('div');
    right.className = 'actions';

    // Name + meta
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = item.name;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `Habit • target ${item.target}/day`;

    // Progress bar
    const progress = document.createElement('div');
    progress.className = 'progress';
    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.width = `${habitPercent(item)}%`;
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = `${getHabitTodayCount(item)} / ${item.target}`;
    progress.appendChild(fill);
    progress.appendChild(label);

    // Pills (last 7 days)
    const pills = document.createElement('div');
    pills.className = 'pills';
    const days = lastNDays(7);
    days.forEach(d => {
      const pill = document.createElement('div');
      pill.className = 'pill';
      const v = Number(item.progress?.[d] || 0);
      if (v >= Math.max(1, item.target)) pill.classList.add('filled');
      pill.title = `${d}: ${v}/${item.target}`;
      pills.appendChild(pill);
    });

    left.appendChild(name);
    left.appendChild(meta);
    left.appendChild(progress);
    left.appendChild(pills);

    // Actions
    const minus = document.createElement('button');
    minus.className = 'pixel-button';
    minus.textContent = '−';
    minus.addEventListener('click', () => {
      const cur = getHabitTodayCount(item);
      setHabitTodayCount(item, clamp(cur - 1, 0, 9999));
      writeStorage();
      render();
      sparkle();
    });

    const plus = document.createElement('button');
    plus.className = 'pixel-button primary';
    plus.textContent = '+';
    plus.addEventListener('click', () => {
      const cur = getHabitTodayCount(item);
      setHabitTodayCount(item, clamp(cur + 1, 0, 9999));
      writeStorage();
      render();
      sparkle();
    });

    const edit = document.createElement('button');
    edit.className = 'pixel-button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => editItemPrompt(item));

    const del = document.createElement('button');
    del.className = 'pixel-button';
    del.textContent = 'Archive';
    del.addEventListener('click', () => {
      if (!confirm(`Archive habit “${item.name}”?`)) return;
      item.archived = true;
      writeStorage();
      render();
    });

    right.appendChild(minus);
    right.appendChild(plus);
    right.appendChild(edit);
    right.appendChild(del);

    li.appendChild(left);
    li.appendChild(right);
    return li;
  }

  function renderTask(item) {
    const li = document.createElement('li');
    li.className = 'item';

    const left = document.createElement('div');
    const right = document.createElement('div');
    right.className = 'actions';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = item.name;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `Task • ${getTaskProgress(item)} / ${item.target} steps`;

    // Progress bar
    const progress = document.createElement('div');
    progress.className = 'progress';
    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.width = `${taskPercent(item)}%`;
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = `${Math.round(taskPercent(item))}%`;
    progress.appendChild(fill);
    progress.appendChild(label);

    // Pills for steps
    const pills = document.createElement('div');
    pills.className = 'pills';
    const prog = getTaskProgress(item);
    for (let i = 0; i < Math.min(24, item.target); i++) {
      const pill = document.createElement('div');
      pill.className = 'pill';
      if (i < prog) pill.classList.add('filled');
      pills.appendChild(pill);
    }

    left.appendChild(name);
    left.appendChild(meta);
    left.appendChild(progress);
    left.appendChild(pills);

    // Actions
    const minus = document.createElement('button');
    minus.className = 'pixel-button';
    minus.textContent = '−';
    minus.addEventListener('click', () => {
      const cur = getTaskProgress(item);
      setTaskProgress(item, clamp(cur - 1, 0, item.target));
      writeStorage();
      render();
      sparkle();
    });

    const plus = document.createElement('button');
    plus.className = 'pixel-button primary';
    plus.textContent = '+';
    plus.addEventListener('click', () => {
      let cur = getTaskProgress(item);
      cur = clamp(cur + 1, 0, item.target);
      setTaskProgress(item, cur);
      if (cur >= item.target) {
        if (confirm(`Mark task “${item.name}” as completed?`)) {
          item.archived = true;
        }
      }
      writeStorage();
      render();
      sparkle();
    });

    const edit = document.createElement('button');
    edit.className = 'pixel-button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => editItemPrompt(item));

    const del = document.createElement('button');
    del.className = 'pixel-button';
    del.textContent = 'Archive';
    del.addEventListener('click', () => {
      if (!confirm(`Archive task “${item.name}”?`)) return;
      item.archived = true;
      writeStorage();
      render();
    });

    right.appendChild(minus);
    right.appendChild(plus);
    right.appendChild(edit);
    right.appendChild(del);

    li.appendChild(left);
    li.appendChild(right);
    return li;
  }

  function renderCompleted(item) {
    const li = document.createElement('li');
    li.className = 'item';

    const left = document.createElement('div');
    const right = document.createElement('div');
    right.className = 'actions';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = item.name;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = item.type === 'task' ? 'Task • done' : 'Habit • archived';

    left.appendChild(name);
    left.appendChild(meta);

    const restore = document.createElement('button');
    restore.className = 'pixel-button';
    restore.textContent = 'Restore';
    restore.addEventListener('click', () => {
      item.archived = false;
      writeStorage();
      render();
    });

    const remove = document.createElement('button');
    remove.className = 'pixel-button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      if (!confirm(`Delete “${item.name}” permanently?`)) return;
      items = items.filter(i => i.id !== item.id);
      writeStorage();
      render();
    });

    right.appendChild(restore);
    right.appendChild(remove);

    li.appendChild(left);
    li.appendChild(right);
    return li;
  }

  /* Arena rendering: pixel hero moves toward a flag; hearts show overall percent */
  function drawArena() {
    const isLight = document.body.classList.contains('theme-light');
    const bg = isLight ? '#fff' : '#000';
    const fg = isLight ? '#000' : '#fff';

    const w = canvas.width;
    const h = canvas.height;

    ctx.imageSmoothingEnabled = false;

    // Clear
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Ground
    const groundY = Math.floor(h * 0.72);
    ctx.fillStyle = fg;
    for (let x = 0; x < w; x += 8) {
      ctx.fillRect(x, groundY, 6, 6);
    }

    // Hearts (10 squares)
    const percent = overallTodayPercent();
    const hearts = 10;
    const filled = Math.round((percent / 100) * hearts);
    const heartSize = 8;
    const startX = 8;
    const startY = 8;
    for (let i = 0; i < hearts; i++) {
      const x = startX + i * (heartSize + 4);
      ctx.strokeStyle = fg;
      ctx.strokeRect(x, startY, heartSize, heartSize);
      if (i < filled) {
        ctx.fillStyle = fg;
        ctx.fillRect(x + 1, startY + 1, heartSize - 2, heartSize - 2);
      }
    }

    // Flag at end
    const flagX = w - 24;
    ctx.fillStyle = fg;
    ctx.fillRect(flagX, groundY - 24, 2, 24);
    ctx.fillRect(flagX, groundY - 24, 12, 8);

    // Hero (8x8) position by percent
    const heroSize = 12;
    const pathStart = 8;
    const pathEnd = flagX - heroSize - 4;
    const x = Math.round(pathStart + ((pathEnd - pathStart) * percent) / 100);
    const y = groundY - heroSize;

    // Body
    ctx.fillStyle = fg;
    ctx.fillRect(x, y, heroSize, heroSize);
    // Eye (invert)
    ctx.fillStyle = bg;
    ctx.fillRect(x + 3, y + 3, 2, 2);
  }

  function sparkle() {
    // Tiny pixel sparkle animation overlay on canvas
    const isLight = document.body.classList.contains('theme-light');
    const bg = isLight ? '#fff' : '#000';
    const fg = isLight ? '#000' : '#fff';

    const max = 10;
    const points = [];
    for (let i = 0; i < max; i++) {
      points.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, life: 8 });
    }

    let frame = 0;
    const id = setInterval(() => {
      frame++;
      ctx.globalCompositeOperation = 'source-over';
      // draw points as small squares
      points.forEach(p => {
        if (p.life <= 0) return;
        ctx.fillStyle = fg;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 2);
        p.y -= 1;
        p.life -= 1;
      });
      if (frame > 8) {
        clearInterval(id);
        drawArena();
      }
    }, 30);
  }

  function lastNDays(n) {
    const arr = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      arr.push(`${y}-${m}-${day}`);
    }
    return arr;
  }

  function editItemPrompt(item) {
    const name = prompt('Name', item.name);
    if (!name) return;
    const targetStr = prompt('Target (number)', String(item.target));
    const target = Math.max(1, parseInt(targetStr || '1', 10));
    item.name = name.trim();
    item.target = target;
    writeStorage();
    render();
  }

  /* Form */
  function syncConditionalInputs() {
    const type = itemTypeEl.value;
    document.querySelectorAll('.conditional').forEach(el => {
      const forType = el.getAttribute('data-for');
      const show = forType === type;
      el.hidden = !show;
    });
  }

  function handleAddSubmit(e) {
    e.preventDefault();
    const formData = new FormData(addFormEl);
    const name = String(formData.get('itemName') || '').trim();
    const type = String(formData.get('itemType')) === 'task' ? 'task' : 'habit';
    if (!name) return;

    const now = new Date().toISOString();

    if (type === 'habit') {
      const target = Math.max(1, parseInt(String(formData.get('habitTarget') || '1'), 10));
      const newItem = {
        id: generateId(),
        type: 'habit',
        name,
        target,
        progress: {},
        archived: false,
        createdAt: now,
      };
      items.push(newItem);
    } else {
      const target = Math.max(1, parseInt(String(formData.get('taskSteps') || '1'), 10));
      const newItem = {
        id: generateId(),
        type: 'task',
        name,
        target,
        progress: { '__task': 0 },
        archived: false,
        createdAt: now,
      };
      items.push(newItem);
    }

    writeStorage();
    addFormEl.reset();
    itemTypeEl.value = type; // keep selected type
    syncConditionalInputs();
    render();
  }

  /* Backup */
  function handleExport() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `8-bit-habits-${todayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '[]'));
        if (!Array.isArray(data)) throw new Error('Invalid file');
        items = data;
        writeStorage();
        render();
      } catch (err) {
        alert('Failed to import file');
      }
    };
    reader.readAsText(file);
  }

  /* Init */
  function init() {
    items = readStorage();
    ensureDemoData();

    initTheme();

    addFormEl.addEventListener('submit', handleAddSubmit);
    itemTypeEl.addEventListener('change', syncConditionalInputs);
    syncConditionalInputs();

    themeToggleEl.addEventListener('click', () => {
      const isLight = document.body.classList.contains('theme-light');
      setTheme(isLight ? 'dark' : 'light');
    });

    exportBtnEl.addEventListener('click', handleExport);
    importInputEl.addEventListener('change', handleImport);

    render();
  }

  window.addEventListener('DOMContentLoaded', init);
})();