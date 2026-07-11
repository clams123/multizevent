const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const slots = [...document.querySelectorAll('.player')];
const channelOneSelect = document.querySelector('#channelOne');
const channelTwoSelect = document.querySelector('#channelTwo');
const manualRandomMode = document.querySelector('#manualRandomMode');
const manualRandomControls = document.querySelector('#manualRandomControls');
const manualRandomSelects = [...document.querySelectorAll('[data-manual-slot]')];
const refreshRandomButton = document.querySelector('#refreshRandom');
const randomStatus = document.querySelector('#randomStatus');
const template = document.querySelector('#playerTemplate');

let channelList = [];
let currentRandomChannels = [];
let isManualRandomMode = false;
let refreshTimer = null;
let countdownTimer = null;
let nextRefreshAt = Date.now() + REFRESH_INTERVAL_MS;

channelOneSelect.addEventListener('change', () => handleChosenChannelChange(0));
channelTwoSelect.addEventListener('change', () => handleChosenChannelChange(1));

manualRandomMode.addEventListener('change', () => {
  setManualRandomMode(manualRandomMode.checked);
});

manualRandomSelects.forEach((select) => {
  select.addEventListener('change', () => {
    const slotIndex = Number(select.dataset.manualSlot);
    saveManualRandomChannels();
    renderPlayer(slotIndex, {
      channel: normalizeChannel(select.value),
      displayName: normalizeChannel(select.value),
      status: 'manual'
    });
  });
});

refreshRandomButton.addEventListener('click', () => {
  if (!isManualRandomMode) {
    loadRandomPlayers(true);
  }
});

await boot();

async function boot() {
  try {
    const response = await fetch('./channels.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    channelList = (await response.json()).map(normalizeChannel).filter(Boolean);
    populateChannelSelects();
    restoreSavedState();
    renderChosenPlayer(0);
    renderChosenPlayer(1);

    if (isManualRandomMode) {
      setManualRandomMode(true, { initial: true });
    } else {
      loadRandomPlayers(true);
    }
  } catch (error) {
    randomStatus.textContent = `Impossible de charger la liste: ${error.message}`;
    [0, 1, 2, 3, 4].forEach((slotIndex) => {
      renderEmptySlot(slotIndex, `Lecteur ${slotIndex + 1}`, 'Verifie channels.json.');
    });
  }
}

function populateChannelSelects() {
  [channelOneSelect, channelTwoSelect, ...manualRandomSelects].forEach((select) => {
    select.replaceChildren(
      ...channelList.map((channel) => {
        const option = document.createElement('option');
        option.value = channel;
        option.textContent = channel;
        return option;
      })
    );
  });
}

function restoreSavedState() {
  const savedChosenChannels = JSON.parse(localStorage.getItem('chosenChannels') || '[]');
  const savedManualChannels = JSON.parse(localStorage.getItem('manualRandomChannels') || '[]');

  channelOneSelect.value = pickSavedOrDefault(savedChosenChannels[0], 0);
  channelTwoSelect.value = pickSavedOrDefault(savedChosenChannels[1], 1);

  manualRandomSelects.forEach((select, index) => {
    select.value = pickSavedOrDefault(savedManualChannels[index], index + 2);
  });

  isManualRandomMode = false;
  manualRandomMode.checked = isManualRandomMode;
}

function pickSavedOrDefault(savedChannel, fallbackIndex) {
  const normalized = normalizeChannel(savedChannel);
  if (channelList.includes(normalized)) {
    return normalized;
  }

  return channelList[fallbackIndex] || channelList[0] || '';
}

function handleChosenChannelChange(slotIndex) {
  saveChosenChannels();
  renderChosenPlayer(slotIndex);

  if (!isManualRandomMode) {
    reconcileRandomPlayersWithChosenChannels();
  }
}

function saveChosenChannels() {
  localStorage.setItem(
    'chosenChannels',
    JSON.stringify([normalizeChannel(channelOneSelect.value), normalizeChannel(channelTwoSelect.value)])
  );
}

function saveManualRandomChannels() {
  localStorage.setItem(
    'manualRandomChannels',
    JSON.stringify(manualRandomSelects.map((select) => normalizeChannel(select.value)))
  );
}

function renderChosenPlayer(slotIndex) {
  const select = slotIndex === 0 ? channelOneSelect : channelTwoSelect;
  const channel = normalizeChannel(select.value);

  if (!channel) {
    renderEmptySlot(slotIndex, `Lecteur ${slotIndex + 1}`, 'Choisis un streamer.');
    return;
  }

  renderPlayer(slotIndex, {
    channel,
    displayName: channel,
    status: 'chosen'
  });
}

function setManualRandomMode(enabled, options = {}) {
  isManualRandomMode = enabled;
  manualRandomMode.checked = enabled;
  manualRandomControls.hidden = !enabled;
  refreshRandomButton.disabled = enabled;

  if (enabled) {
    window.clearTimeout(refreshTimer);
    window.clearInterval(countdownTimer);
    randomStatus.textContent = 'Mode manuel actif';
    saveManualRandomChannels();
    renderManualRandomPlayers();
    return;
  }

  if (!options.initial) {
    loadRandomPlayers(true);
  }
}

function renderManualRandomPlayers() {
  manualRandomSelects.forEach((select) => {
    const slotIndex = Number(select.dataset.manualSlot);
    renderPlayer(slotIndex, {
      channel: normalizeChannel(select.value),
      displayName: normalizeChannel(select.value),
      status: 'manual'
    });
  });
}

function loadRandomPlayers(force = false) {
  saveChosenChannels();
  const chosenSet = getChosenChannelSet();
  const availableChannels = channelList.filter((channel) => !chosenSet.has(channel));

  randomStatus.textContent = 'Tirage en cours...';

  try {
    currentRandomChannels = shuffle(availableChannels).slice(0, 3);
    renderRandomPlayers();

    nextRefreshAt = force ? Date.now() + REFRESH_INTERVAL_MS : nextTenMinuteBoundary();
    scheduleNextRefresh();
    startCountdown();
  } catch (error) {
    randomStatus.textContent = `Erreur tirage: ${error.message}`;
    scheduleNextRefresh();
  }
}

function reconcileRandomPlayersWithChosenChannels() {
  const chosenSet = getChosenChannelSet();

  currentRandomChannels.forEach((channel, randomIndex) => {
    if (!chosenSet.has(channel)) {
      return;
    }

    const replacement = findReplacementRandomChannel(chosenSet);
    currentRandomChannels[randomIndex] = replacement;

    if (replacement) {
      renderPlayer(randomIndex + 2, {
        channel: replacement,
        displayName: replacement,
        status: 'random'
      });
    } else {
      renderEmptySlot(randomIndex + 2, `Aleatoire ${randomIndex + 1}`, 'Ajoute plus de chaines dans channels.json.');
    }
  });
}

function findReplacementRandomChannel(chosenSet) {
  const currentSet = new Set(currentRandomChannels);
  return shuffle(channelList).find((channel) => !chosenSet.has(channel) && !currentSet.has(channel));
}

function getChosenChannelSet() {
  return new Set([normalizeChannel(channelOneSelect.value), normalizeChannel(channelTwoSelect.value)].filter(Boolean));
}

function renderRandomPlayers() {
  [2, 3, 4].forEach((slotIndex, randomIndex) => {
    const channel = currentRandomChannels[randomIndex];
    if (!channel) {
      renderEmptySlot(slotIndex, `Aleatoire ${randomIndex + 1}`, 'Ajoute plus de chaines dans channels.json.');
      return;
    }

    renderPlayer(slotIndex, {
      channel,
      displayName: channel,
      status: 'random'
    });
  });
}

function renderPlayer(slotIndex, stream) {
  const slot = slots[slotIndex];
  const content = template.content.cloneNode(true);
  const label = content.querySelector('.slot-label');
  const link = content.querySelector('.channel-link');
  const videoFrame = content.querySelector('.video-frame');
  const chatFrame = content.querySelector('.chat-frame');
  const meta = content.querySelector('.player-meta');
  const channel = normalizeChannel(stream.channel);
  const shouldShowChat = slotIndex < 2;

  slot.classList.toggle('has-chat', shouldShowChat);
  label.textContent = slotIndex < 2 ? `Lecteur ${slotIndex + 1}` : `Lecteur ${slotIndex + 1}`;
  link.textContent = stream.displayName || channel;
  link.href = `https://twitch.tv/${channel}`;
  videoFrame.title = `Lecteur Twitch ${channel}`;
  videoFrame.src = twitchPlayerUrl(channel);

  if (shouldShowChat) {
    chatFrame.title = `Chat Twitch ${channel}`;
    chatFrame.src = twitchChatUrl(channel);
  } else {
    chatFrame.remove();
  }

  meta.textContent = buildMetaText(stream);
  slot.replaceChildren(content);
}

function renderEmptySlot(slotIndex, labelText, message) {
  const slot = slots[slotIndex];
  const empty = document.createElement('div');
  empty.className = 'empty-slot';
  empty.innerHTML = `<strong>${labelText}</strong><span>${message}</span>`;
  slot.classList.remove('has-chat');
  slot.replaceChildren(empty);
}

function twitchPlayerUrl(channel) {
  const parent = window.location.hostname || 'localhost';
  const params = new URLSearchParams({
    channel,
    parent,
    muted: 'false'
  });
  return `https://player.twitch.tv/?${params}`;
}

function twitchChatUrl(channel) {
  const parent = window.location.hostname || 'localhost';
  const params = new URLSearchParams({
    parent,
    darkpopout: ''
  });
  return `https://www.twitch.tv/embed/${channel}/chat?${params}`;
}

function buildMetaText(stream) {
  if (stream.status === 'random') {
    return 'Tire depuis la liste locale';
  }

  if (stream.status === 'manual') {
    return 'Choisi manuellement';
  }

  return 'Choisi manuellement';
}

function normalizeChannel(channel) {
  return String(channel || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
    .toLowerCase();
}

function scheduleNextRefresh() {
  window.clearTimeout(refreshTimer);
  const delay = Math.max(5_000, nextRefreshAt - Date.now());
  refreshTimer = window.setTimeout(() => loadRandomPlayers(false), delay);
}

function startCountdown() {
  window.clearInterval(countdownTimer);
  updateCountdown();
  countdownTimer = window.setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  const secondsLeft = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  randomStatus.textContent = `Prochain tirage dans ${minutes}:${seconds}`;
}

function nextTenMinuteBoundary() {
  const next = new Date();
  next.setSeconds(0, 0);
  next.setMinutes(Math.floor(next.getMinutes() / 10) * 10 + 10);
  return next.getTime();
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
