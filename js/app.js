/* =========================================================================
 *  단어 복습 게임 - 게임 로직
 * ========================================================================= */

const QUESTIONS_PER_ROUND = 30; // 한 판에 나오는 문제 수

// ---- 상태 ----
const state = {
  student: null,      // "ben" | "lily"
  words: [],          // 현재 학생의 단어 목록
  mode: null,         // "mixed" | "meaning" | "spelling" | "sentence" | "wrong"
  queue: [],          // 이번 판 문제 목록
  index: 0,           // 현재 문제 번호
  score: 0,           // 이번 판 점수
  combo: 0,           // 연속 정답
  correctCount: 0,    // 맞힌 개수
  answered: false,    // 현재 문제에 답했는지
};

// ---- 화면 전환 ----
const screens = {
  select: document.getElementById("screen-select"),
  menu:   document.getElementById("screen-menu"),
  quiz:   document.getElementById("screen-quiz"),
  result: document.getElementById("screen-result"),
  manage: document.getElementById("screen-manage"),
};
function show(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// ---- 저장(localStorage) ----
function storeKey(student) { return `wordgame_${student}`; }
function loadProgress(student) {
  try { return JSON.parse(localStorage.getItem(storeKey(student))) || {}; }
  catch { return {}; }
}
function saveProgress(student, data) {
  localStorage.setItem(storeKey(student), JSON.stringify(data));
}
function getBestScore(student) { return loadProgress(student).bestScore || 0; }
function getWrongWords(student) { return loadProgress(student).wrongWords || []; }

// ---- 학생 프로필 (이름·캐릭터·카드색, localStorage에 저장) ----
const CARD_GRADIENTS = [
  ["#ff9a3c", "#ff6348"],
  ["#a78bfa", "#7c3aed"],
  ["#38ef7d", "#11998e"],
  ["#4facfe", "#00c6fb"],
  ["#f953c6", "#b91d73"],
  ["#ffd200", "#f7971e"],
];
const EMOJI_CHOICES = ["🦊","🐰","🐻","🐱","🐶","🦁","🐯","🐼","🐨","🐵","🦄","🐸","🐧","🐥","🦉","🐢"];
const DEFAULT_PROFILES = [
  { id: "ben",  name: "Ben",  emoji: "🦊", grad: 0 },
  { id: "lily", name: "Lily", emoji: "🐰", grad: 1 },
];

function loadProfiles() {
  try {
    const p = JSON.parse(localStorage.getItem("wordgame_profiles"));
    if (Array.isArray(p) && p.length) return p;
  } catch {}
  return DEFAULT_PROFILES.map(p => ({ ...p }));
}
function saveProfiles(profiles) {
  localStorage.setItem("wordgame_profiles", JSON.stringify(profiles));
}
function getProfile(id) {
  return loadProfiles().find(p => p.id === id) || { id, name: id, emoji: "🙂", grad: 0 };
}

// GPT/제미나이 답변에 섞여 들어오는 마크다운 기호(**bold**, *italic*, `code`)를 제거
function stripMarkdown(str) {
  return String(str)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .trim();
}

// ---- 단어 데이터 (localStorage 우선, 없으면 words.js 초기값) ----
function loadWords(student) {
  const data = loadProgress(student);
  if (Array.isArray(data.words)) {
    // 예전에 마크다운 기호가 섞인 채로 저장된 데이터를 불러올 때마다 정리
    return data.words.map(w => ({
      word: stripMarkdown(w.word),
      meaning_ko: stripMarkdown(w.meaning_ko),
      meaning_en: stripMarkdown(w.meaning_en),
      example: stripMarkdown(w.example),
    }));
  }
  // 처음 접속 시 words.js 데이터를 localStorage에 복사
  const seed = (WORD_DATA[student] || []).map(w => ({ ...w }));
  data.words = seed;
  saveProgress(student, data);
  return seed;
}
function saveWords(student, words) {
  const data = loadProgress(student);
  data.words = words;
  saveProgress(student, data);
}

function addWrongWord(student, word) {
  const data = loadProgress(student);
  data.wrongWords = data.wrongWords || [];
  if (!data.wrongWords.includes(word)) data.wrongWords.push(word);
  saveProgress(student, data);
}
function removeWrongWord(student, word) {
  const data = loadProgress(student);
  data.wrongWords = (data.wrongWords || []).filter((w) => w !== word);
  saveProgress(student, data);
}

// ---- 유틸 ----
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sample(arr, n) { return shuffle(arr).slice(0, n); }
function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// 예문에서 단어가 실제로 어떤 형태로 쓰였는지 추출 (crouched, captivated 등)
function findInflectedForm(example, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let m = example.match(new RegExp(`\\b(${escaped})\\b`, "i"));
  if (m) return m[1];
  m = example.match(new RegExp(`\\b(${escaped}\\w*)`, "i"));
  if (m) return m[1];
  return word;
}

// 예문에서 단어를 빈칸으로 치환
// 1) 정확히 일치 → 2) 어간 일치(crouched, captivated 등 어형 변화 처리)
function blankOut(example, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // 정확한 단어 매칭
  const reExact = new RegExp(`\\b${escaped}\\b`, "i");
  if (reExact.test(example)) {
    return example.replace(reExact, '<span class="blank"> ? </span>');
  }
  // 어간 매칭: 단어로 시작하는 파생형 (captivate → captivated, crouch → crouched 등)
  const reStem = new RegExp(`\\b${escaped}\\w*`, "i");
  if (reStem.test(example)) {
    return example.replace(reStem, '<span class="blank"> ? </span>');
  }
  // 그래도 없으면 문장 끝에 빈칸 추가
  return example + ' — <span class="blank"> ? </span>';
}

/* =========================================================================
 *  문제 생성기
 *  각 유형은 { type, word, render, check } 를 반환
 * ========================================================================= */

// 객관식 보기 4개 만들기 (정답 + 오답 3개)
function buildChoices(correctWord, field) {
  const pool = state.words.filter((w) => w.word !== correctWord.word);
  const distractors = sample(pool, Math.min(3, pool.length)).map((w) => w[field]);
  return shuffle([correctWord[field], ...distractors]);
}

// 1) 한글 뜻 고르기
function makeMeaningKo(word) {
  return {
    type: "meaning",
    word: word.word,
    label: "다음 단어의 뜻은?",
    prompt: word.word,
    choices: buildChoices(word, "meaning_ko"),
    answer: word.meaning_ko,
    kind: "choice",
  };
}
// 2) 영영 풀이 보고 단어 고르기
function makeMeaningEn(word) {
  return {
    type: "meaning",
    word: word.word,
    label: "설명에 맞는 단어는?",
    prompt: `"${word.meaning_en}"`,
    choices: buildChoices(word, "word"),
    answer: word.word,
    kind: "choice",
  };
}
// 3) 스펠링 - 직접 타이핑 (한글 뜻이 힌트)
function makeSpellType(word) {
  return {
    type: "spelling",
    word: word.word,
    label: "뜻을 보고 단어의 철자를 쓰세요",
    prompt: word.meaning_ko,
    hint: `${word.word.length}글자 · 첫 글자: ${word.word[0]}`,
    answer: word.word,
    kind: "input",
  };
}
// 4) 스펠링 - 글자 순서 맞추기
function makeSpellTiles(word) {
  return {
    type: "spelling",
    word: word.word,
    label: "글자를 눌러 단어를 완성하세요",
    prompt: word.meaning_ko,
    letters: shuffle(word.word.split("")),
    answer: word.word,
    kind: "tiles",
  };
}
// 5) 문장 빈칸 채우기 (객관식)
function makeSentence(word) {
  // 예문에 실제 쓰인 형태 추출 (captivate → captivated, crouch → crouched 등)
  const actualForm = findInflectedForm(word.example, word.word);
  const distractors = sample(
    state.words.filter((w) => w.word !== word.word),
    Math.min(3, state.words.length - 1)
  ).map((w) => w.word);
  return {
    type: "sentence",
    word: word.word,
    label: "빈칸에 알맞은 단어는?",
    prompt: blankOut(word.example, word.word),
    choices: shuffle([actualForm, ...distractors]),
    answer: actualForm,
    kind: "choice",
    isHtml: true,
  };
}

// 모드별 문제 만들기
function generateQuestion(word, mode) {
  if (mode === "meaning") return pickOne([makeMeaningKo, makeMeaningEn])(word);
  if (mode === "spelling") return pickOne([makeSpellType, makeSpellTiles])(word);
  if (mode === "sentence") return makeSentence(word);
  // mixed / wrong : 모든 유형 중 랜덤
  const makers = [makeMeaningKo, makeMeaningEn, makeSpellType, makeSpellTiles, makeSentence];
  return pickOne(makers)(word);
}

/* =========================================================================
 *  게임 진행
 * ========================================================================= */

function startRound(mode) {
  state.mode = mode;
  state.score = 0;
  state.combo = 0;
  state.correctCount = 0;
  state.index = 0;

  let sourceWords;
  if (mode === "wrong") {
    const wrongList = getWrongWords(state.student);
    sourceWords = state.words.filter((w) => wrongList.includes(w.word));
    if (sourceWords.length === 0) {
      alert("오답 노트가 비어 있어요! 먼저 다른 모드로 복습해 보세요.");
      return;
    }
  } else {
    sourceWords = state.words;
  }

  // 단어를 섞어 한 판 분량만큼 문제 생성 (단어가 적으면 반복 사용)
  const count = Math.min(QUESTIONS_PER_ROUND, Math.max(sourceWords.length, 1) * 2);
  const order = [];
  while (order.length < count) order.push(...shuffle(sourceWords));
  state.queue = order.slice(0, count).map((w) => generateQuestion(w, mode));

  document.getElementById("q-total").textContent = state.queue.length;
  show("quiz");
  renderQuestion();
}

function updateHud() {
  document.getElementById("quiz-score").textContent = state.score;
  document.getElementById("quiz-combo").textContent = state.combo;
  const pct = (state.index / state.queue.length) * 100;
  document.getElementById("progress-fill").style.width = pct + "%";
  document.getElementById("q-current").textContent = Math.min(state.index + 1, state.queue.length);
}

function renderQuestion() {
  state.answered = false;
  const q = state.queue[state.index];
  updateHud();

  document.getElementById("feedback").classList.add("hidden");
  document.getElementById("btn-next").classList.add("hidden");
  document.getElementById("submit-area").innerHTML = "";

  const area = document.getElementById("question-area");
  let html = `<div class="q-label">${q.label}</div>`;
  html += `<div class="q-prompt">${q.isHtml ? q.prompt : escapeHtml(q.prompt)}</div>`;

  if (q.kind === "choice") {
    const labels = ["A", "B", "C", "D"];
    html += `<div class="options">`;
    q.choices.forEach((c, i) => {
      html += `<button class="option" data-val="${escapeAttr(c)}" data-index="${labels[i]}">${escapeHtml(c)}</button>`;
    });
    html += `</div>`;
    area.innerHTML = html;
    area.querySelectorAll(".option").forEach((btn) => {
      btn.addEventListener("click", () => handleChoice(btn, q));
    });
  } else if (q.kind === "input") {
    html += `<div class="hint-row"><span class="hint-text">💡 ${q.hint}</span></div>`;
    html += `<input class="spell-input" id="spell-input" autocomplete="off" autocapitalize="off" placeholder="여기에 입력" />`;
    area.innerHTML = html;
    const input = document.getElementById("spell-input");
    input.focus();
    const submit = () => handleInput(input.value, q);
    // 확인 버튼을 하단 고정 영역에 배치
    const submitBtn = document.createElement("button");
    submitBtn.className = "btn-primary";
    submitBtn.textContent = "확인";
    submitBtn.addEventListener("click", submit);
    document.getElementById("submit-area").appendChild(submitBtn);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  } else if (q.kind === "tiles") {
    html += `<div class="answer-slot" id="answer-slot"></div>`;
    html += `<div class="tiles" id="tiles"></div>`;
    area.innerHTML = html;
    // 다시/확인 버튼을 하단 고정 영역에 배치
    const tileControls = document.createElement("div");
    tileControls.className = "tile-controls";
    tileControls.innerHTML = `
      <button class="btn-ghost" id="btn-tile-reset">↺ 다시</button>
      <button class="btn-primary" id="btn-submit-tiles">확인</button>`;
    document.getElementById("submit-area").appendChild(tileControls);
    setupTiles(q);
  }
}

function setupTiles(q) {
  const slot = document.getElementById("answer-slot");
  const tilesBox = document.getElementById("tiles");
  let chosen = [];

  function redraw() {
    // 답 슬롯: 글자마다 클릭 가능한 버튼으로 렌더링
    slot.innerHTML = "";
    if (chosen.length === 0) {
      slot.innerHTML = '<span class="slot-placeholder">글자를 눌러 단어를 완성하세요</span>';
    } else {
      chosen.forEach((c, idx) => {
        const btn = document.createElement("button");
        btn.className = "slot-letter";
        btn.textContent = c.letter;
        btn.title = "클릭하면 제거";
        btn.addEventListener("click", () => {
          chosen.splice(idx, 1);
          redraw();
        });
        slot.appendChild(btn);
      });
    }
    // 원래 타일 used 상태 업데이트
    tilesBox.querySelectorAll(".tile").forEach((t, i) => {
      t.classList.toggle("used", chosen.some((c) => c.id === i));
    });
  }

  q.letters.forEach((letter, i) => {
    const t = document.createElement("button");
    t.className = "tile";
    t.textContent = letter;
    t.addEventListener("click", () => {
      if (chosen.some((c) => c.id === i)) return;
      chosen.push({ id: i, letter });
      redraw();
    });
    tilesBox.appendChild(t);
  });

  redraw(); // 초기 placeholder 표시
  document.getElementById("btn-tile-reset").addEventListener("click", () => { chosen = []; redraw(); });
  document.getElementById("btn-submit-tiles").addEventListener("click", () => {
    handleInput(chosen.map((c) => c.letter).join(""), q);
  });
}

// ---- 정답 처리 ----
function handleChoice(btn, q) {
  if (state.answered) return;
  const val = btn.dataset.val;
  const correct = val === q.answer;
  const buttons = document.querySelectorAll(".option");
  buttons.forEach((b) => {
    b.disabled = true;
    if (b.dataset.val === q.answer) b.classList.add("correct");
    else if (b === btn) b.classList.add("wrong");
  });
  finishQuestion(correct, q);
}

function handleInput(value, q) {
  if (state.answered) return;
  const correct = value.trim().toLowerCase() === q.answer.toLowerCase();
  finishQuestion(correct, q);
}

function finishQuestion(correct, q) {
  state.answered = true;
  const fb = document.getElementById("feedback");
  fb.classList.remove("hidden", "ok", "no");

  if (correct) {
    state.combo += 1;
    const points = 10 + Math.min(state.combo - 1, 5) * 2; // 콤보 보너스
    state.score += points;
    state.correctCount += 1;
    fb.classList.add("ok");
    fb.innerHTML = `✅ 정답! <b>+${points}점</b>` + (state.combo >= 3 ? ` 🔥 ${state.combo}연속!` : "");
    const comboBox = document.getElementById("combo-box");
    comboBox.classList.add("pop");
    setTimeout(() => comboBox.classList.remove("pop"), 200);
    removeWrongWord(state.student, q.word);
  } else {
    state.combo = 0;
    fb.classList.add("no");
    fb.innerHTML = `❌ 아쉬워요. 정답: <span class="correct-answer">${escapeHtml(q.answer)}</span>`;
    document.getElementById("question-area").classList.add("shake");
    setTimeout(() => document.getElementById("question-area").classList.remove("shake"), 300);
    addWrongWord(state.student, q.word);
  }

  updateHud();
  document.getElementById("btn-next").classList.remove("hidden");
  document.getElementById("btn-next").textContent =
    state.index + 1 >= state.queue.length ? "결과 보기 →" : "다음 →";
}

function nextQuestion() {
  state.index += 1;
  if (state.index >= state.queue.length) {
    finishRound();
  } else {
    renderQuestion();
  }
}

function finishRound() {
  updateHud();
  document.getElementById("progress-fill").style.width = "100%";

  // 최고 점수 저장
  const best = getBestScore(state.student);
  const newBest = state.score > best;
  if (newBest) {
    const data = loadProgress(state.student);
    data.bestScore = state.score;
    saveProgress(state.student, data);
  }

  const total = state.queue.length;
  const ratio = state.correctCount / total;
  document.getElementById("result-correct").textContent = state.correctCount;
  document.getElementById("result-total").textContent = total;
  document.getElementById("result-points").textContent = state.score;
  document.getElementById("result-newbest").classList.toggle("hidden", !newBest);

  let emoji = "🎉", title = "참 잘했어요!";
  if (ratio === 1) { emoji = "🏆"; title = "완벽해요! 만점!"; }
  else if (ratio >= 0.7) { emoji = "🎉"; title = "잘했어요!"; }
  else if (ratio >= 0.4) { emoji = "💪"; title = "조금만 더 힘내요!"; }
  else { emoji = "📚"; title = "다시 복습해 봐요!"; }
  document.getElementById("result-emoji").textContent = emoji;
  document.getElementById("result-title").textContent = title;

  show("result");
}

/* =========================================================================
 *  메뉴 / 학생 선택
 * ========================================================================= */

function enterStudent(student) {
  state.student = student;
  state.words = loadWords(student);
  const p = getProfile(student);
  document.getElementById("menu-student-name").textContent = `${p.name} ${p.emoji}`;
  document.getElementById("menu-greeting").textContent = `${p.name}, 반가워요!`;
  document.getElementById("menu-best-score").textContent = getBestScore(student);

  const empty = state.words.length === 0;
  document.getElementById("empty-warning").classList.toggle("hidden", !empty);
  document.querySelectorAll(".mode-btn").forEach((b) => { b.disabled = empty; b.style.opacity = empty ? 0.4 : 1; });

  const wrongCount = getWrongWords(student).filter((w) => state.words.some((x) => x.word === w)).length;
  document.getElementById("wrong-count-text").textContent =
    wrongCount > 0 ? `틀린 단어 ${wrongCount}개 다시 풀기` : "틀린 단어 다시 풀기";

  show("menu");
}

/* =========================================================================
 *  단어 관리 화면
 * ========================================================================= */

let editingIndex = null; // null = 추가 모드, 숫자 = 수정 모드

function enterManage() {
  const p = getProfile(state.student);
  document.getElementById("manage-student-badge").textContent = `${p.emoji} ${p.name}`;
  renderWordList();
  show("manage");
}

/* =========================================================================
 *  학생 카드 렌더링 & 프로필 편집
 * ========================================================================= */

function renderStudentCards() {
  const wrap = document.getElementById("student-cards");
  wrap.innerHTML = "";
  const profiles = loadProfiles();

  profiles.forEach((p) => {
    const g = CARD_GRADIENTS[p.grad % CARD_GRADIENTS.length];
    const btn = document.createElement("button");
    btn.className = "student-card";
    btn.style.background = `linear-gradient(145deg, ${g[0]}, ${g[1]})`;
    btn.innerHTML = `
      <span class="student-glow"></span>
      <span class="student-emoji">${p.emoji}</span>
      <span class="student-name">${escapeHtml(p.name)}</span>
      <span class="student-tag">시작하기 →</span>
      <span class="student-edit" title="이름·캐릭터 바꾸기">✏️</span>`;
    btn.addEventListener("click", () => enterStudent(p.id));
    btn.querySelector(".student-edit").addEventListener("click", (e) => {
      e.stopPropagation();
      openStudentModal(p.id);
    });
    wrap.appendChild(btn);
  });

  if (profiles.length < 6) {
    const add = document.createElement("button");
    add.className = "student-card student-card-add";
    add.innerHTML = `<span class="student-add-plus">＋</span><span class="student-tag">새 학생 추가</span>`;
    add.addEventListener("click", () => openStudentModal(null));
    wrap.appendChild(add);
  }
}

let editingStudentId = null; // null = 추가 모드
let _selEmoji = EMOJI_CHOICES[0];
let _selGrad = 0;

function renderEmojiGrid() {
  const grid = document.getElementById("emoji-grid");
  grid.innerHTML = "";
  EMOJI_CHOICES.forEach((em) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "emoji-choice" + (em === _selEmoji ? " selected" : "");
    b.textContent = em;
    b.addEventListener("click", () => { _selEmoji = em; renderEmojiGrid(); });
    grid.appendChild(b);
  });
}

function renderGradRow() {
  const row = document.getElementById("grad-row");
  row.innerHTML = "";
  CARD_GRADIENTS.forEach((g, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "grad-swatch" + (i === _selGrad ? " selected" : "");
    b.style.background = `linear-gradient(145deg, ${g[0]}, ${g[1]})`;
    b.addEventListener("click", () => { _selGrad = i; renderGradRow(); });
    row.appendChild(b);
  });
}

function openStudentModal(id) {
  editingStudentId = id;
  const profiles = loadProfiles();
  const p = id ? getProfile(id) : null;
  document.getElementById("student-modal-title").textContent = id ? "학생 정보 수정" : "새 학생 추가";
  document.getElementById("s-name").value = p ? p.name : "";
  _selEmoji = p ? p.emoji : EMOJI_CHOICES[profiles.length % EMOJI_CHOICES.length];
  _selGrad  = p ? (p.grad % CARD_GRADIENTS.length) : (profiles.length % CARD_GRADIENTS.length);
  renderEmojiGrid();
  renderGradRow();
  document.getElementById("btn-student-delete").classList.toggle("hidden", !id || profiles.length <= 1);
  document.getElementById("student-error").classList.add("hidden");
  document.getElementById("student-overlay").classList.remove("hidden");
  setTimeout(() => document.getElementById("s-name").focus(), 100);
}

function closeStudentModal() {
  document.getElementById("student-overlay").classList.add("hidden");
}

function saveStudentForm() {
  const name = document.getElementById("s-name").value.trim();
  if (!name) {
    document.getElementById("student-error").classList.remove("hidden");
    document.getElementById("s-name").focus();
    return;
  }
  const profiles = loadProfiles();
  if (editingStudentId) {
    const p = profiles.find((x) => x.id === editingStudentId);
    if (p) { p.name = name; p.emoji = _selEmoji; p.grad = _selGrad; }
  } else {
    profiles.push({ id: "s" + Date.now().toString(36), name, emoji: _selEmoji, grad: _selGrad });
  }
  saveProfiles(profiles);
  closeStudentModal();
  renderStudentCards();
}

function deleteStudent() {
  const p = getProfile(editingStudentId);
  if (!confirm(`${p.name} 학생을 삭제할까요?\n단어 목록과 점수 기록도 함께 사라져요.`)) return;
  saveProfiles(loadProfiles().filter((x) => x.id !== editingStudentId));
  localStorage.removeItem(storeKey(editingStudentId));
  closeStudentModal();
  renderStudentCards();
}

function renderWordList() {
  const words = loadWords(state.student);
  document.getElementById("word-count-label").textContent = `총 ${words.length}개`;
  const list = document.getElementById("word-list");
  list.innerHTML = "";

  if (words.length === 0) {
    list.innerHTML = `<p style="text-align:center;color:rgba(255,255,255,0.35);padding:32px 0;font-weight:700;">
      단어가 없어요. 위 버튼으로 추가해보세요!
    </p>`;
    return;
  }

  words.forEach((w, i) => {
    const card = document.createElement("div");
    card.className = "word-card";
    card.innerHTML = `
      <div class="word-card-info">
        <div class="word-card-en">${escapeHtml(w.word)}</div>
        <div class="word-card-ko">${escapeHtml(w.meaning_ko)}</div>
      </div>
      <div class="word-card-actions">
        <button class="btn-icon btn-edit" data-i="${i}" title="수정">✏️</button>
        <button class="btn-icon btn-delete" data-i="${i}" title="삭제">🗑️</button>
      </div>`;
    list.appendChild(card);
  });

  list.querySelectorAll(".btn-edit").forEach(btn =>
    btn.addEventListener("click", () => openModal(Number(btn.dataset.i))));
  list.querySelectorAll(".btn-delete").forEach(btn =>
    btn.addEventListener("click", () => deleteWord(Number(btn.dataset.i))));
}

function openModal(index = null) {
  editingIndex = index;
  const isEdit = index !== null;
  document.getElementById("modal-title").textContent = isEdit ? "단어 수정" : "새 단어 추가";
  document.getElementById("form-error").classList.add("hidden");

  if (isEdit) {
    const w = loadWords(state.student)[index];
    document.getElementById("f-word").value    = w.word;
    document.getElementById("f-ko").value      = w.meaning_ko;
    document.getElementById("f-en").value      = w.meaning_en || "";
    document.getElementById("f-example").value = w.example   || "";
  } else {
    document.getElementById("f-word").value    = "";
    document.getElementById("f-ko").value      = "";
    document.getElementById("f-en").value      = "";
    document.getElementById("f-example").value = "";
  }

  document.getElementById("modal-overlay").classList.remove("hidden");
  document.getElementById("f-word").focus();
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

function saveWordForm() {
  const word    = document.getElementById("f-word").value.trim();
  const ko      = document.getElementById("f-ko").value.trim();
  const en      = document.getElementById("f-en").value.trim();
  const example = document.getElementById("f-example").value.trim();

  if (!word || !ko) {
    document.getElementById("form-error").classList.remove("hidden");
    return;
  }
  document.getElementById("form-error").classList.add("hidden");

  const words = loadWords(state.student);
  const entry = { word, meaning_ko: ko, meaning_en: en, example };

  if (editingIndex !== null) {
    words[editingIndex] = entry;
  } else {
    words.push(entry);
  }

  saveWords(state.student, words);
  state.words = words; // 즉시 반영
  closeModal();
  renderWordList();
}

function deleteWord(index) {
  const words = loadWords(state.student);
  const target = words[index];
  if (!confirm(`"${target.word}" 을(를) 삭제할까요?`)) return;
  words.splice(index, 1);
  saveWords(state.student, words);
  state.words = words;
  renderWordList();
}

/* =========================================================================
 *  붙여넣기 가져오기
 * ========================================================================= */

let _parsedImport = []; // 파싱된 결과를 임시 저장

function openImport() {
  _parsedImport = [];
  document.getElementById("import-textarea").value = "";
  document.getElementById("prompt-word-input").value = "";
  document.getElementById("import-preview").classList.add("hidden");
  document.getElementById("import-error").classList.add("hidden");
  document.getElementById("btn-import-add").classList.add("hidden");
  document.getElementById("btn-import-replace").classList.add("hidden");
  document.getElementById("btn-import-parse").classList.remove("hidden");
  document.getElementById("import-overlay").classList.remove("hidden");
  setTimeout(() => document.getElementById("prompt-word-input").focus(), 100);
}

// 입력한 단어 목록으로 AI(GPT/제미나이)용 요청 프롬프트를 만들어 클립보드에 복사
// 단어를 입력하지 않으면 PDF/사진 첨부용 프롬프트가 만들어진다.
function buildAiPrompt(wordListText) {
  const source = wordListText
    ? `단어 목록: ${wordListText}`
    : `첨부한 파일(사진/PDF)에 나오는 영어 단어들을 모두 찾아서 정리해줘.`;
  return `다음 영어 단어들을 초등 고학년~중학생 수준 단어 학습용으로 표로 정리해줘.
컬럼은 Word / Definition (KR) / Definition / Example Sentence 순서로 만들어줘.
- Definition (KR): 한글 뜻
- Definition: 영어로 된 뜻 풀이
- Example Sentence: 반드시 해당 단어(또는 그 단어의 변형)를 포함한 예문
마크다운 표 형식으로 출력해줘.

${source}`;
}

async function copyAiPrompt() {
  const input = document.getElementById("prompt-word-input");
  const errEl = document.getElementById("import-error");
  errEl.classList.add("hidden");

  const words = input.value.trim();
  const prompt = buildAiPrompt(words);
  const btn = document.getElementById("btn-copy-prompt");

  try {
    await navigator.clipboard.writeText(prompt);
  } catch (e) {
    errEl.textContent = "클립보드 복사에 실패했어요. 직접 선택해서 복사해 주세요.";
    errEl.classList.remove("hidden");
    return;
  }

  const original = "📋 AI 프롬프트 복사";
  btn.textContent = words ? "✅ 복사 완료!" : "✅ 파일 첨부용 프롬프트 복사됨!";
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove("copied");
  }, 2200);
}

function closeImport() {
  document.getElementById("import-overlay").classList.add("hidden");
}

// 마크다운 표(| a | b |) 형식이면 파이프 구분 텍스트로 변환
function normalizeMarkdownTable(raw) {
  const rawLines = raw.split("\n").map(l => l.trim()).filter(l => l);
  const isMarkdownTable = rawLines.length > 0 &&
    rawLines.filter(l => l.startsWith("|") && l.endsWith("|")).length >= rawLines.length * 0.5;
  if (!isMarkdownTable) return raw;

  // 구분선 줄( |---|---| )은 제거하고, 각 줄 양끝 파이프를 벗겨낸 뒤 다시 조립
  return rawLines
    .filter(l => l.startsWith("|") && l.endsWith("|"))
    .filter(l => !/^\|[\s:|-]+\|$/.test(l)) // |---|---|---| 같은 구분선 제거
    .map(l => l.slice(1, -1).split("|").map(c => c.trim()).join("\t"))
    .join("\n");
}

// 붙여넣은 텍스트를 단어 배열로 파싱
function parseImportText(rawInput) {
  const raw = normalizeMarkdownTable(rawInput);
  const lines = raw.split("\n").map(l => l.trimEnd()).filter(l => l.trim());
  if (!lines.length) return [];

  // 탭 구분 여부 확인
  const sep = lines[0].includes("\t") ? "\t" : ",";

  // 첫 줄이 헤더인지 확인 (영어/숫자 단어가 아닌 경우)
  const firstCols = lines[0].split(sep);
  const looksLikeHeader = firstCols[0].toLowerCase().match(/^(word|단어|english|vocab)/);
  const dataLines = looksLikeHeader ? lines.slice(1) : lines;

  // 헤더로 컬럼 위치 자동 감지
  let colWord = 0, colKo = -1, colEn = -1, colEx = -1;
  if (looksLikeHeader) {
    firstCols.forEach((h, i) => {
      const t = h.trim().toLowerCase();
      if (t === "word" || t === "단어" || t === "vocab")          colWord = i;
      else if (t.includes("korean") || t.includes("한글") || t.includes("뜻") || t.includes("meaning_ko") || t.includes("(kr)") || (t.includes("definition") && t.includes("kr"))) colKo = i;
      else if (t === "definition" || t.includes("meaning") || t.includes("meaning_en")) colEn = i;
      else if (t.includes("example") || t.includes("sentence") || t.includes("예문"))  colEx = i;
    });
  } else {
    // 헤더 없이 열 개수로 추론
    const n = firstCols.length;
    if (n === 2) { colKo = 1; }
    else if (n === 3) { colKo = 1; colEn = 2; }
    else if (n >= 4) { colKo = 1; colEn = 2; colEx = 3; }
  }

  // 6열짜리 구글시트 형식 특별 처리 (Word, PoS, Definition, Synonym, Antonym, Example)
  if (looksLikeHeader && colEn === -1) {
    firstCols.forEach((h, i) => {
      const t = h.trim().toLowerCase();
      if (t.includes("part") || t.includes("speech") || t.includes("synonym") || t.includes("antonym")) return;
    });
  }
  // 구글시트 6열: Word(0) PoS(1) Definition(2) Synonym(3) Antonym(4) ExampleSentence(5)
  if (looksLikeHeader && firstCols.length >= 5 && colKo === -1 && colEn === -1) {
    // Definition이 colEn, Example이 마지막 열
    firstCols.forEach((h, i) => {
      const t = h.trim().toLowerCase();
      if (t === "definition" || t === "meaning") colEn = i;
      if (t.includes("example")) colEx = i;
    });
  }

  return dataLines.map(line => {
    const cols = line.split(sep).map(c => stripMarkdown(c.trim().replace(/^"|"$/g, "")));
    const word = cols[colWord] || "";
    if (!word || word.length > 60) return null; // 빈 줄·이상한 줄 제거
    return {
      word,
      meaning_ko: colKo  >= 0 ? (cols[colKo]  || "") : "",
      meaning_en: colEn  >= 0 ? (cols[colEn]  || "") : "",
      example:    colEx  >= 0 ? (cols[colEx]  || "") : "",
    };
  }).filter(Boolean);
}

function runImportPreview() {
  const raw = document.getElementById("import-textarea").value;
  const errEl = document.getElementById("import-error");
  errEl.classList.add("hidden");

  if (!raw.trim()) {
    errEl.textContent = "내용을 붙여넣어 주세요.";
    errEl.classList.remove("hidden");
    return;
  }

  _parsedImport = parseImportText(raw);

  if (!_parsedImport.length) {
    errEl.textContent = "단어를 인식하지 못했어요. 형식을 확인해 주세요.";
    errEl.classList.remove("hidden");
    return;
  }

  // 미리보기 렌더링
  document.getElementById("preview-title").textContent =
    `✅ ${_parsedImport.length}개 단어를 인식했어요`;

  const list = document.getElementById("preview-list");
  list.innerHTML = "";
  _parsedImport.slice(0, 8).forEach(w => {
    const div = document.createElement("div");
    div.className = "preview-item";
    div.innerHTML = `<span class="preview-item-word">${escapeHtml(w.word)}</span>
                     <span class="preview-item-ko">${escapeHtml(w.meaning_ko || "(한글 뜻 없음)")}</span>
                     <span class="preview-item-ko">${escapeHtml(w.meaning_en ? "· " + w.meaning_en.slice(0, 30) + (w.meaning_en.length > 30 ? "…" : "") : "")}</span>`;
    list.appendChild(div);
  });
  if (_parsedImport.length > 8) {
    const more = document.createElement("div");
    more.className = "preview-item";
    more.style.color = "rgba(255,255,255,0.35)";
    more.textContent = `… 외 ${_parsedImport.length - 8}개`;
    list.appendChild(more);
  }

  document.getElementById("import-preview").classList.remove("hidden");
  document.getElementById("btn-import-parse").classList.add("hidden");
  document.getElementById("btn-import-add").classList.remove("hidden");
  document.getElementById("btn-import-replace").classList.remove("hidden");
}

function doImport(replace) {
  if (!_parsedImport.length) return;
  const current = replace ? [] : loadWords(state.student);
  // 중복 단어는 덮어쓰기
  const merged = [...current];
  _parsedImport.forEach(w => {
    const idx = merged.findIndex(x => x.word.toLowerCase() === w.word.toLowerCase());
    if (idx >= 0) merged[idx] = w;
    else merged.push(w);
  });
  saveWords(state.student, merged);
  state.words = merged;
  closeImport();
  renderWordList();

  // 메뉴 단어 수도 갱신
  const empty = merged.length === 0;
  document.getElementById("empty-warning").classList.toggle("hidden", !empty);
  document.querySelectorAll(".mode-btn").forEach(b => { b.disabled = empty; b.style.opacity = empty ? 0.4 : 1; });
}

/* =========================================================================
 *  HTML escape (안전)
 * ========================================================================= */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(str) { return escapeHtml(str); }

/* =========================================================================
 *  이벤트 연결
 * ========================================================================= */
document.getElementById("btn-back-select").addEventListener("click", () => show("select"));

// 학생 프로필 모달
document.getElementById("btn-student-cancel").addEventListener("click", closeStudentModal);
document.getElementById("btn-student-save").addEventListener("click", saveStudentForm);
document.getElementById("btn-student-delete").addEventListener("click", deleteStudent);
document.getElementById("student-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("student-overlay")) closeStudentModal();
});
document.getElementById("s-name").addEventListener("keydown", (e) => { if (e.key === "Enter") saveStudentForm(); });
document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => startRound(btn.dataset.mode));
});
document.getElementById("btn-quit").addEventListener("click", () => enterStudent(state.student));
document.getElementById("btn-next").addEventListener("click", nextQuestion);
document.getElementById("btn-again").addEventListener("click", () => startRound(state.mode));
document.getElementById("btn-to-menu").addEventListener("click", () => enterStudent(state.student));

// 단어 관리 화면
document.getElementById("btn-go-manage").addEventListener("click",    () => enterManage());
document.getElementById("btn-open-import").addEventListener("click",  () => openImport());
document.getElementById("btn-copy-prompt").addEventListener("click",  () => copyAiPrompt());
document.getElementById("btn-import-cancel").addEventListener("click",() => closeImport());
document.getElementById("btn-import-parse").addEventListener("click", () => runImportPreview());
document.getElementById("btn-import-add").addEventListener("click",   () => doImport(false));
document.getElementById("btn-import-replace").addEventListener("click",() => {
  if (!confirm(`기존 단어를 모두 지우고 붙여넣은 ${_parsedImport.length}개로 교체할까요?`)) return;
  doImport(true);
});
document.getElementById("import-overlay").addEventListener("click", e => {
  if (e.target === document.getElementById("import-overlay")) closeImport();
});
document.getElementById("btn-back-menu").addEventListener("click", () => enterStudent(state.student));
document.getElementById("btn-open-add").addEventListener("click", () => openModal(null));
document.getElementById("btn-reset-words").addEventListener("click", () => {
  if (!confirm("원래 단어 목록으로 초기화할까요?\n직접 추가/수정한 단어는 모두 사라져요.")) return;
  const data = loadProgress(state.student);
  delete data.words;
  saveProgress(state.student, data);
  state.words = loadWords(state.student);
  renderWordList();
});

// 모달
document.getElementById("btn-modal-cancel").addEventListener("click", closeModal);
document.getElementById("btn-modal-save").addEventListener("click", saveWordForm);
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
});
document.getElementById("f-word").addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("f-ko").focus(); });
document.getElementById("f-ko").addEventListener("keydown",   (e) => { if (e.key === "Enter") document.getElementById("f-en").focus(); });
document.getElementById("f-en").addEventListener("keydown",   (e) => { if (e.key === "Enter") document.getElementById("f-example").focus(); });

// ---- 초기 렌더링 ----
renderStudentCards();
