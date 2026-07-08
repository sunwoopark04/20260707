const SUPABASE_URL = window.SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY ?? "";
const SUPABASE_TABLE = window.SUPABASE_TABLE ?? "lotto_draws";
const isPlaceholder = (value) => !value || value.includes("YOUR_");

const drawButton = document.getElementById("drawButton");
const resetButton = document.getElementById("resetButton");
const mainBalls = document.getElementById("mainBalls");
const bonusBall = document.getElementById("bonusBall");
const statusText = document.getElementById("statusText");
const machine = document.querySelector(".machine");
const historyList = document.getElementById("historyList");
const officialList = document.getElementById("officialList");
const officialStatus = document.getElementById("officialStatus");

let drawTimer = null;
let flickerTimer = null;
const recentDraws = [];
const createClient = window.supabase?.createClient;
const supabase = !isPlaceholder(SUPABASE_URL)
  && !isPlaceholder(SUPABASE_ANON_KEY)
  && typeof createClient === "function"
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
const officialDraws = [
  { round: 1231, date: "2026-07-04", main: [4, 13, 14, 18, 31, 38], bonus: 15 },
  { round: 1230, date: "2026-06-27", main: [3, 8, 9, 22, 28, 42], bonus: 45 },
  { round: 1229, date: "2026-06-20", main: [12, 13, 29, 34, 37, 42], bonus: 16 },
  { round: 1228, date: "2026-06-13", main: [24, 29, 30, 31, 35, 44], bonus: 1 },
  { round: 1227, date: "2026-06-06", main: [1, 14, 16, 34, 41, 44], bonus: 13 },
];

function normalizeDraw(record) {
  return {
    main: record.main_numbers ?? record.main ?? [],
    bonus: record.bonus_number ?? record.bonus,
    createdAt: record.created_at ?? record.createdAt ?? "",
  };
}

async function saveDraw(draw) {
  if (!supabase) {
    return Promise.resolve(null);
  }

  const payload = {
    main_numbers: draw.main,
    bonus_number: draw.bonus,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .insert(payload)
    .select("main_numbers, bonus_number, created_at")
    .single();

  if (error) {
    throw error;
  }

  return normalizeDraw(data);
}

async function loadRecentDraws(limit = 5) {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select("main_numbers, bonus_number, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(normalizeDraw);
}

function formatDrawDate(createdAt) {
  if (!createdAt) {
    return "";
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pickNumbers() {
  const numbers = Array.from({ length: 45 }, (_, index) => index + 1);
  for (let i = numbers.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }

  const main = numbers.slice(0, 6).sort((a, b) => a - b);
  const bonus = numbers[6];
  return { main, bonus };
}

function renderPlaceholder() {
  mainBalls.innerHTML = "";
  for (let i = 0; i < 6; i += 1) {
    const placeholder = document.createElement("div");
    placeholder.className = "ball";
    placeholder.textContent = "?";
    mainBalls.appendChild(placeholder);
  }
  bonusBall.textContent = "?";
}

function renderResult(main, bonus) {
  mainBalls.innerHTML = "";
  main.forEach((number, index) => {
    const ball = document.createElement("div");
    ball.className = "ball";
    if (index < 3) {
      ball.classList.add("is-active");
    }
    ball.textContent = number;
    mainBalls.appendChild(ball);
  });
  bonusBall.textContent = bonus;
}

function renderHistory() {
  historyList.innerHTML = "";

  if (recentDraws.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-item";
    empty.textContent = "No draws yet.";
    historyList.appendChild(empty);
    return;
  }

  recentDraws.forEach((draw, index) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const meta = document.createElement("div");
    meta.className = "history-meta";

    const order = document.createElement("span");
    order.className = "history-index";
    order.textContent = `#${index + 1}`;

    const date = document.createElement("span");
    date.className = "history-date";
    date.textContent = formatDrawDate(draw.createdAt);

    meta.append(order, date);

    const balls = document.createElement("div");
    balls.className = "history-balls";

    draw.main.forEach((number) => {
      const badge = document.createElement("span");
      badge.className = "history-badge";
      badge.textContent = number;
      balls.appendChild(badge);
    });

    const bonus = document.createElement("span");
    bonus.className = "history-badge bonus";
    bonus.textContent = `+ ${draw.bonus}`;
    balls.appendChild(bonus);

    item.append(meta, balls);
    historyList.appendChild(item);
  });
}

function renderOfficialHistory() {
  officialList.innerHTML = "";

  if (officialDraws.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-item";
    empty.textContent = "Could not load official round data.";
    officialList.appendChild(empty);
    return;
  }

  officialDraws.forEach((draw) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const meta = document.createElement("div");
    meta.className = "history-meta";

    const order = document.createElement("span");
    order.className = "history-index";
    order.textContent = `${draw.round}`;

    const date = document.createElement("span");
    date.className = "history-date";
    date.textContent = draw.date;

    meta.append(order, date);

    const balls = document.createElement("div");
    balls.className = "history-balls";

    draw.main.forEach((number) => {
      const badge = document.createElement("span");
      badge.className = "history-badge";
      badge.textContent = number;
      balls.appendChild(badge);
    });

    const bonus = document.createElement("span");
    bonus.className = "history-badge bonus";
    bonus.textContent = `+ ${draw.bonus}`;
    balls.appendChild(bonus);

    item.append(meta, balls);
    officialList.appendChild(item);
  });
}

function setRollingState(isRolling) {
  drawButton.disabled = isRolling;
  resetButton.disabled = isRolling;
  machine.classList.toggle("is-rolling", isRolling);
  statusText.textContent = isRolling ? "Drawing..." : "Idle";
}

function startDraw() {
  if (flickerTimer) {
    clearInterval(flickerTimer);
    flickerTimer = null;
  }

  if (drawTimer) {
    clearTimeout(drawTimer);
    drawTimer = null;
  }

  setRollingState(true);
  statusText.textContent = "Mixing balls...";
  mainBalls.innerHTML = "";
  bonusBall.textContent = "!";

  const flickerCount = 10;
  let count = 0;

  flickerTimer = setInterval(() => {
    const preview = pickNumbers();
    renderResult(preview.main, preview.bonus);
    count += 1;

    if (count >= flickerCount) {
      clearInterval(flickerTimer);
      flickerTimer = null;
      const result = pickNumbers();
      drawTimer = setTimeout(() => {
        renderResult(result.main, result.bonus);
        const optimisticDraw = {
          main: result.main,
          bonus: result.bonus,
          createdAt: new Date().toISOString(),
        };

        recentDraws.unshift(optimisticDraw);
        recentDraws.splice(5);
        renderHistory();

        saveDraw(result)
          .then((savedDraw) => {
            if (savedDraw) {
              recentDraws[0] = savedDraw;
              renderHistory();
            }
          })
          .catch((error) => {
            console.error("Failed to save lotto draw to Supabase:", error);
            statusText.textContent = "Draw complete, save failed";
          })
          .finally(() => {
            if (statusText.textContent !== "Draw complete, save failed") {
              statusText.textContent = "Draw complete";
            }
            setRollingState(false);
            drawTimer = null;
          });
      }, 400);
    }
  }, 90);
}

function resetMachine() {
  if (flickerTimer) {
    clearInterval(flickerTimer);
    flickerTimer = null;
  }

  if (drawTimer) {
    clearTimeout(drawTimer);
    drawTimer = null;
  }
  setRollingState(false);
  statusText.textContent = "Idle";
  renderPlaceholder();
}

drawButton.addEventListener("click", startDraw);
resetButton.addEventListener("click", resetMachine);

async function init() {
  renderPlaceholder();
  renderOfficialHistory();

  try {
    const savedDraws = await loadRecentDraws(5);
    recentDraws.splice(0, recentDraws.length, ...savedDraws);
  } catch (error) {
    console.error("Failed to load lotto draws from Supabase:", error);
    recentDraws.length = 0;
  }

  renderHistory();

  if (!supabase) {
    statusText.textContent = "Supabase not configured";
  }
}

init();
