const STORE_KEY = 'moral-pwa-state-v1';

const lines = {
  dur: [
    "La seule mission : passer les dix prochaines minutes.",
    "On reduit tout. Une respiration, puis une chose simple.",
    "Pas besoin d'etre fort maintenant. Juste accompagne."
  ],
  flou: [
    "Quand c'est flou, on cherche un point fixe.",
    "Tu peux faire petit. Petit compte vraiment.",
    "On revient au corps, puis au prochain geste."
  ],
  fatigue: [
    "Ralentir est une action valable.",
    "Le minimum propre suffit pour ce soir.",
    "On enleve une pression, puis on respire."
  ],
  mieux: [
    "Garde la trace de ce qui aide.",
    "Un peu mieux, c'est deja une information.",
    "On consolide doucement, sans forcer."
  ]
};

const actions = [
  "Bois quelques gorgees d'eau, lentement.",
  "Pose les deux pieds au sol et decris cinq objets autour de toi.",
  "Ouvre une fenetre ou change d'air pendant deux minutes.",
  "Envoie juste un point ou un 'tu es la ?' a quelqu'un.",
  "Range seulement une surface de la taille d'une assiette.",
  "Mets une musique calme et baisse un peu la lumiere.",
  "Prends une douche courte ou lave-toi le visage.",
  "Mange un truc simple si tu n'as pas mange depuis longtemps.",
  "Ecris la phrase exacte qui tourne en boucle, puis ajoute 'ce n'est pas toute la realite'."
];

const grounding = [
  "Nomme trois couleurs visibles.",
  "Nomme trois sons, meme petits.",
  "Relache la machoire et baisse les epaules."
];

const state = loadState();
let timerId = null;
let remaining = 60;
let deferredInstall = null;
let lastAction = "";

const els = {
  installBtn: document.querySelector('#installBtn'),
  todayLine: document.querySelector('#todayLine'),
  moodBtns: [...document.querySelectorAll('.mood-btn')],
  breatheBtn: document.querySelector('#breatheBtn'),
  resetBtn: document.querySelector('#resetBtn'),
  comfortBtn: document.querySelector('#comfortBtn'),
  focusTitle: document.querySelector('#focusTitle'),
  focusText: document.querySelector('#focusText'),
  timerValue: document.querySelector('#timerValue'),
  timerCue: document.querySelector('#timerCue'),
  doneBtn: document.querySelector('#doneBtn'),
  againBtn: document.querySelector('#againBtn'),
  noteInput: document.querySelector('#noteInput'),
  saveNoteBtn: document.querySelector('#saveNoteBtn'),
  savedNote: document.querySelector('#savedNote'),
  clearWinsBtn: document.querySelector('#clearWinsBtn'),
  winsList: document.querySelector('#winsList'),
  tabs: [...document.querySelectorAll('.bottom-tabs button')]
};

init();

function init() {
  renderMood();
  renderNote();
  renderWins();
  setDailyLine();
  bindEvents();
  registerServiceWorker();
}

function bindEvents() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstall = event;
    els.installBtn.hidden = false;
  });

  els.installBtn.addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    els.installBtn.hidden = true;
  });

  els.moodBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.mood = btn.dataset.mood;
      saveState();
      renderMood();
      setDailyLine();
    });
  });

  els.breatheBtn.addEventListener('click', startBreathing);
  els.resetBtn.addEventListener('click', showRandomAction);
  els.comfortBtn.addEventListener('click', showGrounding);
  els.againBtn.addEventListener('click', showRandomAction);
  els.doneBtn.addEventListener('click', recordWin);
  els.saveNoteBtn.addEventListener('click', saveNote);
  els.clearWinsBtn.addEventListener('click', clearWins);

  els.tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.querySelector(`#${btn.dataset.jump}`);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (target.matches('textarea')) target.focus();
    });
  });
}

function setDailyLine() {
  const mood = state.mood || 'flou';
  const pool = lines[mood];
  const index = new Date().getDate() % pool.length;
  els.todayLine.textContent = pool[index];
}

function renderMood() {
  els.moodBtns.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mood === state.mood);
  });
}

function startBreathing() {
  stopTimer();
  remaining = 60;
  els.focusTitle.textContent = "Respiration 4 - 6";
  els.focusText.textContent = "Inspire doucement 4 secondes, expire 6 secondes. L'expiration fait le gros du travail.";
  els.timerCue.textContent = "inspire";
  updateTimer();
  timerId = window.setInterval(() => {
    remaining -= 1;
    els.timerCue.textContent = remaining % 10 > 5 ? "inspire" : "expire";
    updateTimer();
    if (remaining <= 0) {
      stopTimer();
      els.timerCue.textContent = "termine";
      lastAction = "Respiration 60 s";
    }
  }, 1000);
}

function showRandomAction() {
  stopTimer();
  const choice = choose(actions, lastAction);
  lastAction = choice;
  els.focusTitle.textContent = "Un seul geste";
  els.focusText.textContent = choice;
  els.timerCue.textContent = "sans chrono";
  els.timerValue.textContent = "01";
  focusPanel();
}

function showGrounding() {
  stopTimer();
  lastAction = "Ancrage 3 choses";
  els.focusTitle.textContent = "Revenir ici";
  els.focusText.textContent = grounding.join(" ");
  els.timerCue.textContent = "maintenant";
  els.timerValue.textContent = "03";
  focusPanel();
}

function recordWin() {
  const text = lastAction || els.focusText.textContent;
  const date = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());
  state.wins = [{ text, date }, ...state.wins].slice(0, 6);
  saveState();
  renderWins();
}

function saveNote() {
  state.note = els.noteInput.value.trim();
  saveState();
  renderNote();
}

function renderNote() {
  els.noteInput.value = state.note || "";
  els.savedNote.textContent = state.note ? "Gardee sur cet appareil." : "";
}

function renderWins() {
  els.winsList.innerHTML = "";
  state.wins.forEach((win) => {
    const item = document.createElement('li');
    item.textContent = `${win.date} - ${win.text}`;
    els.winsList.append(item);
  });
}

function clearWins() {
  state.wins = [];
  saveState();
  renderWins();
}

function updateTimer() {
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');
  els.timerValue.textContent = `${minutes}:${seconds}`;
}

function stopTimer() {
  if (timerId) window.clearInterval(timerId);
  timerId = null;
}

function focusPanel() {
  document.querySelector('#focusPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function choose(items, avoid) {
  const pool = items.filter((item) => item !== avoid);
  return pool[Math.floor(Math.random() * pool.length)] || items[0];
}

function loadState() {
  try {
    return {
      mood: 'flou',
      note: '',
      wins: [],
      ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
    };
  } catch {
    return { mood: 'flou', note: '', wins: [] };
  }
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./service-worker.js');
}
