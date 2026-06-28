const DEFAULT_IMAGE_SRC = 'assets/antler.png';

const state = {
  totalSeconds: 10 * 60,
  remainingSeconds: 10 * 60,
  running: false,
  deadline: null,
  raf: null,
  audioContext: null,
  alarmOscillator: null,
};

const timeText = document.getElementById('timeText');
const startButton = document.getElementById('startButton');
const cancelButton = document.getElementById('cancelButton');
const colorInput = document.getElementById('colorInput');
const volumeInput = document.getElementById('volumeInput');
const vibrateInput = document.getElementById('vibrateInput');
const imageInput = document.getElementById('imageInput');
const imagePickerButton = document.getElementById('imagePickerButton');
const userImage = document.getElementById('userImage');
const imagePlaceholder = document.getElementById('imagePlaceholder');
const sampleColorButton = document.getElementById('sampleColorButton');
const colorModal = document.getElementById('colorModal');
const colorCanvas = document.getElementById('colorCanvas');
const closeColorModal = document.getElementById('closeColorModal');
const pickedColorPreview = document.getElementById('pickedColorPreview');
const quickButtons = [...document.querySelectorAll('.quick-times button')];

loadSettings();
render();
registerServiceWorker();

startButton.addEventListener('click', async () => {
  await unlockAudio();
  state.running ? pauseTimer() : startTimer();
});

cancelButton.addEventListener('click', () => {
  stopAlarm();
  pauseTimer();
  state.remainingSeconds = state.totalSeconds;
  render();
});

quickButtons.forEach(button => {
  button.addEventListener('click', () => {
    const minutes = Number(button.dataset.min);
    state.totalSeconds = minutes * 60;
    state.remainingSeconds = state.totalSeconds;
    stopAlarm();
    pauseTimer();
    quickButtons.forEach(b => b.classList.toggle('selected', b === button));
    saveSettings();
    render();
  });
});

colorInput.addEventListener('input', () => {
  setBackgroundColor(colorInput.value);
  saveSettings();
});
volumeInput.addEventListener('input', saveSettings);
vibrateInput.addEventListener('change', saveSettings);
sampleColorButton.addEventListener('click', openImageColorPicker);
closeColorModal.addEventListener('click', closeImageColorPicker);
colorModal.addEventListener('click', event => {
  if (event.target === colorModal) closeImageColorPicker();
});
colorCanvas.addEventListener('click', pickColorFromCanvas);

imagePickerButton.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    localStorage.setItem('chairTimer.userImage', reader.result);
    showUserImage(reader.result);
  };
  reader.readAsDataURL(file);
});

function startTimer() {
  stopAlarm();
  state.running = true;
  state.deadline = Date.now() + state.remainingSeconds * 1000;
  tick();
  render();
}

function pauseTimer() {
  if (state.running && state.deadline) {
    state.remainingSeconds = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
  }
  state.running = false;
  state.deadline = null;
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = null;
  render();
}

function tick() {
  if (!state.running) return;
  state.remainingSeconds = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
  render();
  if (state.remainingSeconds <= 0) {
    state.running = false;
    state.deadline = null;
    playAlarm();
    if (vibrateInput.checked && 'vibrate' in navigator) navigator.vibrate([300, 120, 300, 120, 600]);
    return;
  }
  state.raf = requestAnimationFrame(tick);
}

function render() {
  const min = Math.floor(state.remainingSeconds / 60);
  const sec = state.remainingSeconds % 60;
  timeText.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  startButton.textContent = state.running ? '一時停止' : 'スタート';
}

async function unlockAudio() {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (state.audioContext.state === 'suspended') await state.audioContext.resume();
}

function playAlarm() {
  const ctx = state.audioContext;
  if (!ctx) return;
  stopAlarm();

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, ctx.currentTime);
  gain.gain.setValueAtTime(Number(volumeInput.value), ctx.currentTime);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();

  const interval = setInterval(() => {
    if (!state.alarmOscillator) return clearInterval(interval);
    const now = ctx.currentTime;
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.setValueAtTime(660, now + 0.18);
  }, 420);

  state.alarmOscillator = { oscillator, interval };
}

function stopAlarm() {
  if (!state.alarmOscillator) return;
  clearInterval(state.alarmOscillator.interval);
  try { state.alarmOscillator.oscillator.stop(); } catch {}
  state.alarmOscillator = null;
}

function saveSettings() {
  localStorage.setItem('chairTimer.settings', JSON.stringify({
    totalSeconds: state.totalSeconds,
    color: colorInput.value,
    volume: volumeInput.value,
    vibrate: vibrateInput.checked,
  }));
}

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('chairTimer.settings') || '{}');
  if (settings.totalSeconds) {
    state.totalSeconds = settings.totalSeconds;
    state.remainingSeconds = settings.totalSeconds;
  }
  if (settings.color) colorInput.value = settings.color;
  if (settings.volume) volumeInput.value = settings.volume;
  if (typeof settings.vibrate === 'boolean') vibrateInput.checked = settings.vibrate;
  setBackgroundColor(colorInput.value);

  const storedImage = localStorage.getItem('chairTimer.userImage');
  showUserImage(storedImage || DEFAULT_IMAGE_SRC);

  quickButtons.forEach(b => b.classList.toggle('selected', Number(b.dataset.min) * 60 === state.totalSeconds));
}

function showUserImage(src) {
  userImage.src = src;
  userImage.hidden = false;
  userImage.removeAttribute('hidden');
  imagePickerButton.classList.add('has-image');
  imagePickerButton.setAttribute('aria-label', '上部画像を変更する');

  imagePlaceholder.hidden = true;
  imagePlaceholder.setAttribute('hidden', '');
  imagePlaceholder.setAttribute('aria-hidden', 'true');
  imagePlaceholder.style.display = 'none';
  imagePlaceholder.style.visibility = 'hidden';
  imagePlaceholder.style.opacity = '0';
  imagePlaceholder.textContent = '';
}

function openImageColorPicker() {
  if (!userImage.src) {
    alert('画像が読み込まれていません。');
    return;
  }

  const pickerImage = new Image();
  pickerImage.onload = () => {
    drawImageForColorPicking(pickerImage);
    colorModal.classList.add('is-open');
    colorModal.setAttribute('aria-hidden', 'false');
  };
  pickerImage.onerror = () => alert('画像を読み込めませんでした。');
  pickerImage.src = userImage.src;
}

function closeImageColorPicker() {
  colorModal.classList.remove('is-open');
  colorModal.setAttribute('aria-hidden', 'true');
}

function drawImageForColorPicking(img) {
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  colorCanvas.width = width;
  colorCanvas.height = height;

  const ctx = colorCanvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  pickedColorPreview.style.background = colorInput.value;
}

function pickColorFromCanvas(event) {
  const rect = colorCanvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) * (colorCanvas.width / rect.width));
  const y = Math.floor((event.clientY - rect.top) * (colorCanvas.height / rect.height));

  const ctx = colorCanvas.getContext('2d', { willReadFrequently: true });
  const pixel = ctx.getImageData(
    Math.min(Math.max(x, 0), colorCanvas.width - 1),
    Math.min(Math.max(y, 0), colorCanvas.height - 1),
    1,
    1
  ).data;

  const color = rgbToHex(pixel[0], pixel[1], pixel[2]);
  pickedColorPreview.style.background = color;
  setBackgroundColor(color);
  saveSettings();
  setTimeout(closeImageColorPicker, 180);
}

function setBackgroundColor(color) {
  if (!color) return;
  colorInput.value = color;
  document.documentElement.style.setProperty('--bg', color);
  saveSettings();
}

function getAverageColorFromImageElement(img) {
  return new Promise(resolve => {
    const draw = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 48;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 128) continue;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        if (!count) return resolve(null);
        resolve(rgbToHex(Math.round(r / count), Math.round(g / count), Math.round(b / count)));
      } catch {
        resolve(null);
      }
    };

    if (img.complete && img.naturalWidth > 0) draw();
    else img.addEventListener('load', draw, { once: true });
  });
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
  }
}
