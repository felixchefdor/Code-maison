'use strict';

const $ = (id) => document.getElementById(id);
const sensorGrid = $('sensorGrid');
const emitterGrid = $('emitterGrid');
const permissionList = $('permissionList');
const cameraPreview = $('cameraPreview');
const colorEmitter = $('colorEmitter');
const closeColorEmitterBtn = $('closeColorEmitterBtn');

let deferredInstallPrompt = null;
let wakeLock = null;
let mediaStream = null;
let motionActive = false;
let orientationActive = false;
let geoWatchId = null;
let gamepadLoop = 0;
let audioContext = null;
let soundOscillator = null;
let soundGain = null;
const genericSensors = new Map();

const fmt = (value, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : '-';
const yesNo = (value) => value ? 'oui' : 'non';

function setText(id, value) {
  const node = $(id);
  if (node) node.textContent = value;
}

function createCard(parent, config) {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-head">
      <div>
        <h3>${config.title}</h3>
        <span class="label">${config.description}</span>
      </div>
      <span class="badge ${config.badgeClass || ''}" id="${config.id}Badge">${config.badge || 'pret'}</span>
    </div>
    <div class="readout" id="${config.id}Readout">${config.initial || 'En attente.'}</div>
    <div class="actions" id="${config.id}Actions"></div>
  `;
  parent.appendChild(card);
  const actions = card.querySelector(`#${config.id}Actions`);
  (config.actions || []).forEach((action) => {
    if (action.type === 'range') {
      const row = document.createElement('div');
      row.className = `control-row ${action.wide ? 'wide' : ''}`;
      row.innerHTML = `<label for="${action.id}">${action.label}</label><input id="${action.id}" type="range" min="${action.min}" max="${action.max}" step="${action.step || 1}" value="${action.value}">`;
      actions.appendChild(row);
      if (action.onInput) row.querySelector('input').addEventListener('input', action.onInput);
      return;
    }
    if (action.type === 'color') {
      const row = document.createElement('div');
      row.className = `control-row ${action.wide ? 'wide' : ''}`;
      row.innerHTML = `<label for="${action.id}">${action.label}</label><input id="${action.id}" type="color" value="${action.value}">`;
      actions.appendChild(row);
      row.querySelector('input').addEventListener('input', action.onInput);
      return;
    }
    if (action.type === 'swatches') {
      const row = document.createElement('div');
      row.className = 'swatches wide';
      action.colors.forEach((color) => {
        const button = document.createElement('button');
        button.className = 'swatch';
        button.style.background = color;
        button.title = color;
        button.addEventListener('click', () => action.onPick(color));
        row.appendChild(button);
      });
      actions.appendChild(row);
      return;
    }
    const button = document.createElement('button');
    button.textContent = action.label;
    button.className = action.className || '';
    if (action.wide) button.classList.add('wide');
    button.addEventListener('click', action.onClick);
    actions.appendChild(button);
  });
}

function badge(id, text, state = '') {
  const node = $(`${id}Badge`);
  if (!node) return;
  node.textContent = text;
  node.className = `badge ${state}`;
}

function readout(id, lines) {
  const node = $(`${id}Readout`);
  if (!node) return;
  node.textContent = Array.isArray(lines) ? lines.join('\n') : lines;
}

function support(value) {
  return value ? ['disponible', 'ok'] : ['indisponible', 'bad'];
}

function updateEnvironment() {
  setText('secureStatus', window.isSecureContext ? 'HTTPS actif' : 'HTTPS requis');
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  setText('networkStatus', `${navigator.onLine ? 'en ligne' : 'hors ligne'}${connection ? `, ${connection.effectiveType || connection.type || 'reseau'}` : ''}`);
  setText('deviceStatus', `${navigator.platform || 'appareil'} / ${navigator.hardwareConcurrency || '?'} coeurs`);
}

async function updateBattery() {
  if (!navigator.getBattery) {
    setText('batteryStatus', 'non exposee');
    return;
  }
  const battery = await navigator.getBattery();
  const render = () => setText('batteryStatus', `${Math.round(battery.level * 100)}%${battery.charging ? ', charge' : ''}`);
  render();
  battery.addEventListener('levelchange', render);
  battery.addEventListener('chargingchange', render);
}

async function requestMotionPermission() {
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    const result = await DeviceMotionEvent.requestPermission();
    if (result !== 'granted') throw new Error('Permission mouvement refusee');
  }
}

async function requestOrientationPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    const result = await DeviceOrientationEvent.requestPermission();
    if (result !== 'granted') throw new Error('Permission orientation refusee');
  }
}

function startMotion() {
  requestMotionPermission().then(() => {
    motionActive = true;
    badge('motion', 'actif', 'ok');
  }).catch((error) => {
    badge('motion', 'bloque', 'bad');
    readout('motion', error.message);
  });
}

function stopMotion() {
  motionActive = false;
  badge('motion', 'pause', '');
}

window.addEventListener('devicemotion', (event) => {
  if (!motionActive) return;
  const acc = event.acceleration || {};
  const gravity = event.accelerationIncludingGravity || {};
  const rot = event.rotationRate || {};
  readout('motion', [
    `Acceleration x/y/z: ${fmt(acc.x)} / ${fmt(acc.y)} / ${fmt(acc.z)} m/s2`,
    `Avec gravite x/y/z: ${fmt(gravity.x)} / ${fmt(gravity.y)} / ${fmt(gravity.z)} m/s2`,
    `Rotation alpha/beta/gamma: ${fmt(rot.alpha)} / ${fmt(rot.beta)} / ${fmt(rot.gamma)} deg/s`,
    `Intervalle: ${fmt(event.interval, 0)} ms`
  ]);
});

function startOrientation() {
  requestOrientationPermission().then(() => {
    orientationActive = true;
    badge('orientation', 'actif', 'ok');
  }).catch((error) => {
    badge('orientation', 'bloque', 'bad');
    readout('orientation', error.message);
  });
}

function stopOrientation() {
  orientationActive = false;
  badge('orientation', 'pause', '');
}

window.addEventListener('deviceorientation', (event) => {
  if (!orientationActive) return;
  readout('orientation', [
    `Alpha: ${fmt(event.alpha)} deg`,
    `Beta: ${fmt(event.beta)} deg`,
    `Gamma: ${fmt(event.gamma)} deg`,
    `Absolu: ${yesNo(event.absolute)}`
  ]);
});

function startGenericSensor(kind, SensorClass) {
  try {
    const sensor = new SensorClass({ frequency: 8 });
    sensor.addEventListener('reading', () => {
      const entries = ['x', 'y', 'z', 'illuminance'].filter((key) => key in sensor);
      readout(kind, entries.map((key) => `${key}: ${fmt(sensor[key])}`));
    });
    sensor.addEventListener('error', (event) => {
      badge(kind, 'erreur', 'bad');
      readout(kind, event.error?.message || 'Capteur refuse par le navigateur.');
    });
    sensor.start();
    genericSensors.set(kind, sensor);
    badge(kind, 'actif', 'ok');
  } catch (error) {
    badge(kind, 'bloque', 'bad');
    readout(kind, error.message);
  }
}

function stopGenericSensor(kind) {
  genericSensors.get(kind)?.stop();
  genericSensors.delete(kind);
  badge(kind, 'pause', '');
}

function startGeolocation() {
  if (!navigator.geolocation) {
    badge('geo', 'indisponible', 'bad');
    return;
  }
  geoWatchId = navigator.geolocation.watchPosition((position) => {
    const c = position.coords;
    badge('geo', 'actif', 'ok');
    readout('geo', [
      `Lat/Lon: ${fmt(c.latitude, 6)} / ${fmt(c.longitude, 6)}`,
      `Precision: ${fmt(c.accuracy, 0)} m`,
      `Altitude: ${fmt(c.altitude, 1)} m`,
      `Vitesse: ${fmt(c.speed, 1)} m/s`,
      `Cap: ${fmt(c.heading, 0)} deg`
    ]);
  }, (error) => {
    badge('geo', 'bloque', 'bad');
    readout('geo', error.message);
  }, { enableHighAccuracy: true, maximumAge: 1000 });
}

function stopGeolocation() {
  if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
  geoWatchId = null;
  badge('geo', 'pause', '');
}

async function startCameraAudio() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
    cameraPreview.srcObject = mediaStream;
    cameraPreview.style.display = 'block';
    await cameraPreview.play();
    const videoTrack = mediaStream.getVideoTracks()[0];
    const audioTrack = mediaStream.getAudioTracks()[0];
    const capabilities = videoTrack?.getCapabilities?.() || {};
    badge('media', 'actif', 'ok');
    readout('media', [
      `Camera: ${videoTrack?.label || 'active'}`,
      `Micro: ${audioTrack?.label || 'actif'}`,
      `Torche: ${yesNo(Boolean(capabilities.torch))}`,
      `Resolution: ${cameraPreview.videoWidth || '-'} x ${cameraPreview.videoHeight || '-'}`
    ]);
  } catch (error) {
    badge('media', 'bloque', 'bad');
    readout('media', error.message);
  }
}

function stopMedia() {
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  cameraPreview.pause();
  cameraPreview.srcObject = null;
  cameraPreview.style.display = 'none';
  badge('media', 'pause', '');
}

async function setTorch(enabled) {
  const track = mediaStream?.getVideoTracks()[0];
  if (!track && !enabled) {
    badge('torch', 'eteinte', '');
    readout('torch', 'Aucun flux camera actif.');
    return;
  }
  if (!track && enabled) {
    await startCameraAudio();
  }
  const nextTrack = mediaStream?.getVideoTracks()[0];
  const hasTorch = Boolean(nextTrack?.getCapabilities?.().torch);
  if (!hasTorch) {
    readout('torch', 'Torche non exposee par ce navigateur/appareil.');
    badge('torch', 'indisponible', 'bad');
    return;
  }
  await nextTrack.applyConstraints({ advanced: [{ torch: enabled }] });
  badge('torch', enabled ? 'allumee' : 'eteinte', enabled ? 'ok' : '');
  readout('torch', enabled ? 'LED camera active.' : 'LED camera eteinte.');
}

async function requestBluetooth() {
  try {
    const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['battery_service'] });
    badge('bluetooth', 'connecte', 'ok');
    readout('bluetooth', `Selection: ${device.name || device.id}`);
  } catch (error) {
    badge('bluetooth', 'bloque', 'bad');
    readout('bluetooth', error.message);
  }
}

async function requestUsbLike(kind, api, method, args) {
  try {
    const result = await navigator[api][method](args);
    badge(kind, 'selection', 'ok');
    readout(kind, result.productName || result.productId || result.collections?.length || 'Peripherique selectionne.');
  } catch (error) {
    badge(kind, 'bloque', 'bad');
    readout(kind, error.message);
  }
}

async function startNfc() {
  try {
    const reader = new NDEFReader();
    await reader.scan();
    badge('nfc', 'scan', 'ok');
    readout('nfc', 'Approche un tag NFC.');
    reader.addEventListener('reading', (event) => {
      readout('nfc', `Tag lu: ${event.serialNumber || 'sans numero'}\nEnregistrements: ${event.message.records.length}`);
    });
  } catch (error) {
    badge('nfc', 'bloque', 'bad');
    readout('nfc', error.message);
  }
}

function startGamepads() {
  cancelAnimationFrame(gamepadLoop);
  const tick = () => {
    const pads = [...navigator.getGamepads()].filter(Boolean);
    badge('gamepad', pads.length ? 'actif' : 'attente', pads.length ? 'ok' : 'warn');
    readout('gamepad', pads.length ? pads.map((pad) => `${pad.index}: ${pad.id}\nAxes: ${pad.axes.map((axis) => fmt(axis, 2)).join(', ')}\nBoutons: ${pad.buttons.map((button) => button.pressed ? '1' : '0').join('')}`).join('\n\n') : 'Branche ou touche une manette.');
    gamepadLoop = requestAnimationFrame(tick);
  };
  tick();
}

function stopGamepads() {
  cancelAnimationFrame(gamepadLoop);
  gamepadLoop = 0;
  badge('gamepad', 'pause', '');
}

function emitVibration(pattern) {
  const ok = navigator.vibrate?.(pattern);
  badge('vibration', ok ? 'envoye' : 'indisponible', ok ? 'ok' : 'bad');
  readout('vibration', ok ? `Pattern: ${JSON.stringify(pattern)}` : 'Vibration non exposee par ce navigateur.');
}

function emitScreenColor(color) {
  colorEmitter.style.background = color;
  colorEmitter.classList.add('active');
  badge('screen', 'couleur', 'ok');
  readout('screen', `Couleur envoyee a l'ecran: ${color}`);
}

function clearScreenColor() {
  colorEmitter.classList.remove('active');
  colorEmitter.style.background = 'transparent';
  badge('screen', 'pause', '');
}

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    await document.documentElement.requestFullscreen();
  }
}

async function toggleWakeLock() {
  try {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
      badge('screen', 'veille libre', '');
      return;
    }
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
      badge('screen', 'veille libre', '');
    });
    badge('screen', 'veille bloquee', 'ok');
  } catch (error) {
    readout('screen', error.message);
  }
}

function stopSound() {
  if (soundOscillator) {
    try {
      soundOscillator.stop();
    } catch {
      // Already stopped.
    }
    soundOscillator.disconnect();
    soundOscillator = null;
  }
  soundGain?.disconnect();
  soundGain = null;
  badge('sound', 'pause', '');
  readout('sound', 'Son arrete.');
}

function emitSound() {
  const frequency = Number($('frequencyRange')?.value || 440);
  const volume = Number($('volumeRange')?.value || 20) / 100;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) {
    badge('sound', 'absent', 'bad');
    readout('sound', 'Web Audio non expose par ce navigateur.');
    return;
  }
  audioContext = audioContext || new AudioCtor();
  stopSound();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  soundOscillator = oscillator;
  soundGain = gain;
  badge('sound', 'continu', 'ok');
  readout('sound', `${frequency} Hz / volume ${Math.round(volume * 100)}%\nActif jusqu'au bouton Stop.`);
}

function updateLiveSound() {
  if (!soundOscillator || !soundGain) return;
  const frequency = Number($('frequencyRange')?.value || 440);
  const volume = Number($('volumeRange')?.value || 20) / 100;
  soundOscillator.frequency.setTargetAtTime(frequency, audioContext.currentTime, 0.015);
  soundGain.gain.setTargetAtTime(volume, audioContext.currentTime, 0.015);
  readout('sound', `${frequency} Hz / volume ${Math.round(volume * 100)}%\nActif jusqu'au bouton Stop.`);
}

function speak() {
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance('Test des haut parleurs et de la synthese vocale.');
  utterance.lang = 'fr-FR';
  window.speechSynthesis.speak(utterance);
  badge('speech', 'parle', 'ok');
  readout('speech', utterance.text);
}

async function notify() {
  if (!('Notification' in window)) {
    badge('notify', 'indisponible', 'bad');
    return;
  }
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') {
    badge('notify', 'refuse', 'bad');
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  registration.showNotification('Capteurs et emetteurs', {
    body: 'Notification envoyee depuis la PWA.',
    icon: 'icon.svg',
    badge: 'icon.svg'
  });
  badge('notify', 'envoye', 'ok');
}

async function refreshPermissions() {
  const names = ['geolocation', 'camera', 'microphone', 'notifications', 'accelerometer', 'gyroscope', 'magnetometer', 'ambient-light-sensor', 'clipboard-read'];
  permissionList.innerHTML = '';
  if (!navigator.permissions?.query) {
    permissionList.textContent = 'API Permissions non exposee par ce navigateur.';
    return;
  }
  for (const name of names) {
    const article = document.createElement('article');
    try {
      const status = await navigator.permissions.query({ name });
      article.innerHTML = `<span>${name}</span><strong>${status.state}</strong>`;
    } catch {
      article.innerHTML = `<span>${name}</span><strong>non expose</strong>`;
    }
    permissionList.appendChild(article);
  }
}

function stopAll() {
  stopMotion();
  stopOrientation();
  stopGeolocation();
  stopGamepads();
  setTorch(false).catch(() => {});
  stopMedia();
  [...genericSensors.keys()].forEach(stopGenericSensor);
  navigator.vibrate?.(0);
  clearScreenColor();
  window.speechSynthesis?.cancel();
  stopSound();
}

function buildSensors() {
  createCard(sensorGrid, {
    id: 'motion',
    title: 'Mouvement',
    description: 'Accelerometre, gravite et rotation via DeviceMotion',
    badge: typeof DeviceMotionEvent === 'undefined' ? 'absent' : 'pret',
    badgeClass: typeof DeviceMotionEvent === 'undefined' ? 'bad' : '',
    actions: [
      { label: 'Activer', onClick: startMotion },
      { label: 'Pause', className: 'ghost', onClick: stopMotion }
    ]
  });
  createCard(sensorGrid, {
    id: 'orientation',
    title: 'Orientation',
    description: 'Boussole et inclinaison via DeviceOrientation',
    badge: typeof DeviceOrientationEvent === 'undefined' ? 'absent' : 'pret',
    badgeClass: typeof DeviceOrientationEvent === 'undefined' ? 'bad' : '',
    actions: [
      { label: 'Activer', onClick: startOrientation },
      { label: 'Pause', className: 'ghost', onClick: stopOrientation }
    ]
  });

  [
    ['accelerometer', 'Accelerometer', 'Accelerometre', 'Generic Sensor API'],
    ['gyroscope', 'Gyroscope', 'Gyroscope', 'Generic Sensor API'],
    ['magnetometer', 'Magnetometer', 'Magnetometre', 'Champ magnetique'],
    ['light', 'AmbientLightSensor', 'Lumiere ambiante', 'Lux ambiants si exposes']
  ].forEach(([id, className, title, description]) => {
    const SensorClass = window[className];
    const [text, state] = support(Boolean(SensorClass));
    createCard(sensorGrid, {
      id,
      title,
      description,
      badge: text,
      badgeClass: state,
      actions: [
        { label: 'Activer', onClick: () => SensorClass ? startGenericSensor(id, SensorClass) : readout(id, 'Non expose par ce navigateur.') },
        { label: 'Pause', className: 'ghost', onClick: () => stopGenericSensor(id) }
      ]
    });
  });

  createCard(sensorGrid, {
    id: 'geo',
    title: 'Position GPS',
    description: 'Localisation, altitude, vitesse et cap',
    badge: navigator.geolocation ? 'pret' : 'absent',
    badgeClass: navigator.geolocation ? '' : 'bad',
    actions: [
      { label: 'Activer', onClick: startGeolocation },
      { label: 'Pause', className: 'ghost', onClick: stopGeolocation }
    ]
  });
  createCard(sensorGrid, {
    id: 'media',
    title: 'Camera et micro',
    description: 'Flux media, piste audio et capacites camera',
    badge: navigator.mediaDevices?.getUserMedia ? 'pret' : 'absent',
    badgeClass: navigator.mediaDevices?.getUserMedia ? '' : 'bad',
    actions: [
      { label: 'Activer', onClick: startCameraAudio },
      { label: 'Stop', className: 'ghost', onClick: stopMedia }
    ]
  });
  createCard(sensorGrid, {
    id: 'bluetooth',
    title: 'Bluetooth',
    description: 'Selection d objets Bluetooth proches',
    badge: navigator.bluetooth ? 'pret' : 'absent',
    badgeClass: navigator.bluetooth ? '' : 'bad',
    actions: [{ label: 'Scanner', wide: true, onClick: requestBluetooth }]
  });
  createCard(sensorGrid, {
    id: 'usb',
    title: 'USB',
    description: 'Selection de peripheriques WebUSB',
    badge: navigator.usb ? 'pret' : 'absent',
    badgeClass: navigator.usb ? '' : 'bad',
    actions: [{ label: 'Choisir', wide: true, onClick: () => navigator.usb ? requestUsbLike('usb', 'usb', 'requestDevice', { filters: [] }) : readout('usb', 'WebUSB indisponible.') }]
  });
  createCard(sensorGrid, {
    id: 'serial',
    title: 'Serie',
    description: 'Ports serie Web Serial',
    badge: navigator.serial ? 'pret' : 'absent',
    badgeClass: navigator.serial ? '' : 'bad',
    actions: [{ label: 'Choisir', wide: true, onClick: () => navigator.serial ? requestUsbLike('serial', 'serial', 'requestPort', {}) : readout('serial', 'Web Serial indisponible.') }]
  });
  createCard(sensorGrid, {
    id: 'hid',
    title: 'HID',
    description: 'Claviers, commandes et appareils WebHID compatibles',
    badge: navigator.hid ? 'pret' : 'absent',
    badgeClass: navigator.hid ? '' : 'bad',
    actions: [{ label: 'Choisir', wide: true, onClick: () => navigator.hid ? requestUsbLike('hid', 'hid', 'requestDevice', { filters: [] }) : readout('hid', 'WebHID indisponible.') }]
  });
  createCard(sensorGrid, {
    id: 'nfc',
    title: 'NFC',
    description: 'Lecture de tags NDEF',
    badge: 'NDEFReader' in window ? 'pret' : 'absent',
    badgeClass: 'NDEFReader' in window ? '' : 'bad',
    actions: [{ label: 'Scanner', wide: true, onClick: startNfc }]
  });
  createCard(sensorGrid, {
    id: 'gamepad',
    title: 'Manettes',
    description: 'Axes et boutons Gamepad API',
    badge: navigator.getGamepads ? 'pret' : 'absent',
    badgeClass: navigator.getGamepads ? '' : 'bad',
    actions: [
      { label: 'Ecouter', onClick: startGamepads },
      { label: 'Pause', className: 'ghost', onClick: stopGamepads }
    ]
  });
}

function buildEmitters() {
  createCard(emitterGrid, {
    id: 'vibration',
    title: 'Vibration',
    description: 'Moteur haptique si le navigateur l autorise',
    badge: navigator.vibrate ? 'pret' : 'absent',
    badgeClass: navigator.vibrate ? '' : 'bad',
    actions: [
      { label: 'Court', onClick: () => emitVibration(120) },
      { label: 'Double', onClick: () => emitVibration([80, 70, 140]) },
      { label: 'SOS', onClick: () => emitVibration([90, 60, 90, 60, 90, 180, 240, 80, 240, 80, 240]) },
      { label: 'Stop', className: 'ghost', onClick: () => emitVibration(0) }
    ]
  });
  createCard(emitterGrid, {
    id: 'torch',
    title: 'Lumiere LED',
    description: 'Torche camera arriere quand WebRTC expose torch',
    actions: [
      { label: 'Allumer', onClick: () => setTorch(true) },
      { label: 'Eteindre', className: 'ghost', onClick: () => setTorch(false) }
    ]
  });
  createCard(emitterGrid, {
    id: 'screen',
    title: 'Ecran couleur',
    description: 'Plein ecran, couleur, anti-veille',
    actions: [
      { type: 'color', id: 'screenColorInput', label: 'Couleur', value: '#30d0a2', wide: true, onInput: (event) => emitScreenColor(event.target.value) },
      { type: 'swatches', colors: ['#ffffff', '#ff2d55', '#ffd166', '#30d0a2', '#2274a5', '#000000'], onPick: emitScreenColor },
      { label: 'Plein ecran', onClick: toggleFullscreen },
      { label: 'Anti-veille', onClick: toggleWakeLock },
      { label: 'Effacer', className: 'ghost wide', onClick: clearScreenColor }
    ]
  });
  createCard(emitterGrid, {
    id: 'sound',
    title: 'Haut-parleur',
    description: 'Oscillateur Web Audio',
    actions: [
      { type: 'range', id: 'frequencyRange', label: 'Frequence', min: 80, max: 2200, value: 440, wide: true, onInput: updateLiveSound },
      { type: 'range', id: 'volumeRange', label: 'Volume', min: 0, max: 100, value: 22, wide: true, onInput: updateLiveSound },
      { label: 'Jouer', onClick: emitSound },
      { label: 'Stop', className: 'ghost', onClick: stopSound }
    ]
  });
  createCard(emitterGrid, {
    id: 'speech',
    title: 'Synthese vocale',
    description: 'Sortie audio par speechSynthesis',
    badge: 'speechSynthesis' in window ? 'pret' : 'absent',
    badgeClass: 'speechSynthesis' in window ? '' : 'bad',
    actions: [
      { label: 'Parler', onClick: speak },
      { label: 'Stop', className: 'ghost', onClick: () => window.speechSynthesis?.cancel() }
    ]
  });
  createCard(emitterGrid, {
    id: 'notify',
    title: 'Notification',
    description: 'Notification systeme via service worker',
    badge: 'Notification' in window ? 'pret' : 'absent',
    badgeClass: 'Notification' in window ? '' : 'bad',
    actions: [{ label: 'Envoyer', wide: true, onClick: notify }]
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  $('installBtn').hidden = false;
});

$('installBtn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $('installBtn').hidden = true;
});

closeColorEmitterBtn.addEventListener('click', clearScreenColor);
$('refreshPermissionsBtn').addEventListener('click', refreshPermissions);
$('stopAllBtn').addEventListener('click', stopAll);
window.addEventListener('online', updateEnvironment);
window.addEventListener('offline', updateEnvironment);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && colorEmitter.classList.contains('active')) {
    clearScreenColor();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}

buildSensors();
buildEmitters();
updateEnvironment();
updateBattery().catch(() => setText('batteryStatus', 'non exposee'));
refreshPermissions();
