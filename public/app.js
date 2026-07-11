const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const slots = [...document.querySelectorAll('.player')];
const channelOneSelect = document.querySelector('#channelOne');
const channelTwoSelect = document.querySelector('#channelTwo');
const applyChosenButton = document.querySelector('#applyChosen');
const refreshRandomButton = document.querySelector('#refreshRandom');
const randomStatus = document.querySelector('#randomStatus');
const template = document.querySelector('#playerTemplate');

let channelList = [];
let refreshTimer = null;
let countdownTimer = null;
let nextRefreshAt = Date.now() + REFRESH_INTERVAL_MS;

applyChosenButton.addEventListener('click', () => {
  keepChosenChannelsDistinct();
  saveChosenChannels();
  renderChosenPlayers();
  loadRandomPlayers(true);
});

channelOneSelect.addEventListener('change', keepChosenChannelsDistinct);
channelTwoSelect.addEventListener('change', keepChosenChannelsDistinct);

refreshRandomButton.addEventListener('click', () => {
  loadRandomPlayers(true);
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
    renderChosenPlayers();
    loadRandomPlayers(true);
  } catch (error) {
    randomStatus.textContent = `Impossible de charger la liste: ${error.message}`;
    [0, 1, 2, 3, 4].forEach((slotIndex) => {
      renderEmptySlot(slotIndex, `Lecteur ${slotIndex + 1}`, 'Verifie data/channels.json.');
    });
  }
}

function populateChannelSelects() {
  const savedChannels = JSON.parse(localStorage.getItem('chosenChannels') || '[]');
  const firstDefault = savedChannels[0] || channelList[0] || '';
  const secondDefault = savedChannels[1] || channelList.find((channel) => channel !== firstDefault) || '';

  [channelOneSelect, channelTwoSelect].forEach((select) => {
    select.replaceChildren(
      ...channelList.map((channel) => {
        const option = document.createElement('option');
        option.value = channel;
        option.textContent = channel;
        return option;
      })
    );
  });

  channelOneSelect.value = channelList.includes(firstDefault) ? firstDefault : channelList[0] || '';
  channelTwoSelect.value = channelList.includes(secondDefault) ? secondDefault : channelList[1] || channelList[0] || '';
  keepChosenChannelsDistinct();
}

function keepChosenChannelsDistinct() {
  if (channelList.length < 2 || channelOneSelect.value !== channelTwoSelect.value) {
    return;
  }

  const replacement = channelList.find((channel) => channel !== channelOneSelect.value);
  if (replacement) {
    channelTwoSelect.value = replacement;
  }
}

function saveChosenChannels() {
  localStorage.setItem(
    'chosenChannels',
    JSON.stringify([normalizeChannel(channelOneSelect.value), normalizeChannel(channelTwoSelect.value)])
  );
}

function renderChosenPlayers() {
  const channels = [normalizeChannel(channelOneSelect.value), normalizeChannel(channelTwoSelect.value)];
  channels.forEach((channel, index) => {
    if (!channel) {
      renderEmptySlot(index, `Lecteur ${index + 1}`, 'Choisis un streamer puis clique sur Afficher.');
      return;
    }

    renderPlayer(index, {
      channel,
      displayName: channel,
      status: 'chosen'
    });
  });
}

function loadRandomPlayers(force = false) {
  saveChosenChannels();
  const excludedChannels = [normalizeChannel(channelOneSelect.value), normalizeChannel(channelTwoSelect.value)];
  const availableChannels = channelList.filter((channel) => !excludedChannels.includes(channel));

  randomStatus.textContent = 'Tirage en cours...';

  try {
    const randomStreams = shuffle(availableChannels).slice(0, 3).map((channel) => ({
      channel,
      displayName: channel,
      status: 'random'
    }));

    [2, 3, 4].forEach((slotIndex, randomIndex) => {
      const stream = randomStreams[randomIndex];
      if (!stream) {
        renderEmptySlot(slotIndex, `Aleatoire ${randomIndex + 1}`, 'Ajoute plus de chaines dans data/channels.json.');
        return;
      }

      renderPlayer(slotIndex, stream);
    });

    nextRefreshAt = force ? Date.now() + REFRESH_INTERVAL_MS : nextTenMinuteBoundary();
    scheduleNextRefresh();
    startCountdown();
  } catch (error) {
    randomStatus.textContent = `Erreur tirage: ${error.message}`;
    scheduleNextRefresh();
  }
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
  label.textContent = slotIndex < 2 ? `Lecteur ${slotIndex + 1}` : `Aleatoire ${slotIndex - 1}`;
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
