const socket = io();

// --- Elemen DOM ---
const loginContainer = document.getElementById('admin-login-container');
const dashboard = document.getElementById('admin-dashboard');
const loginButton = document.getElementById('admin-login-button');
const passwordInput = document.getElementById('admin-password');

const startButton = document.getElementById('admin-start-button');
const stopButton = document.getElementById('admin-stop-button');
const pauseButton = document.getElementById('admin-pause-button'); // Tombol Pause
const adminStatus = document.getElementById('admin-status');
const calledNumbersLog = document.getElementById('called-numbers-log'); 
const numberGrid = document.getElementById('admin-number-grid'); // Grid Angka
const winConditionSelect = document.getElementById('win-condition');
const maxWinnersInput = document.getElementById('max-winners');
const ticketColorSelect = document.getElementById('ticket-color'); // <-- TAMBAHAN BARU

let currentGameStatus = 'idle'; // Lacak status di klien

// --- Fungsi ---

// Buat grid angka 1-90 untuk admin klik
function createNumberGrid() {
    numberGrid.innerHTML = '';
    for (let i = 1; i <= 90; i++) {
        const button = document.createElement('button');
        button.classList.add('number-button');
        button.dataset.number = i;
        button.textContent = i;
        button.addEventListener('click', handleNumberCallClick);
        numberGrid.appendChild(button);
    }
}

// Handler saat admin klik angka di grid
function handleNumberCallClick(e) {
    const button = e.target;
    const number = parseInt(button.dataset.number);

    // Kirim angka ke server JIKA game sedang running (tidak pause/stop)
    if (currentGameStatus === 'running') {
        socket.emit('ADMIN_CALL_NUMBER', number);
    } else {
        alert('Tidak bisa memanggil angka. Status game: ' + currentGameStatus.toUpperCase());
    }
}

// Update tampilan dashboard berdasarkan state game
function updateDashboard(gameState) {
  currentGameStatus = gameState.status; // Update status klien

  // Update Teks Status & Tombol Kontrol Utama
  let statusText = `Status: ${gameState.status.toUpperCase()}`;
  if (gameState.isPaused) {
      statusText = 'Status: DIJEDA';
      pauseButton.textContent = 'LANJUTKAN';
  } else {
      pauseButton.textContent = 'PAUSE';
  }
  adminStatus.innerText = statusText;

  // --- PERUBAHAN LOGIKA KONTROL ---
  const isRunning = gameState.status === 'running';
  const isPaused = gameState.status === 'paused';
  const isIdle = gameState.status === 'idle' || gameState.status === 'stopped';

  startButton.disabled = isRunning || isPaused;
  stopButton.disabled = isIdle;
  pauseButton.disabled = isIdle;

  // INI ADALAH PERUBAHAN UTAMA YANG ANDA MINTA:
  // Pengaturan hanya di-nonaktifkan (disabled) saat game 'running'.
  // Saat 'paused', 'idle', atau 'stopped', pengaturan akan aktif (enabled).
  winConditionSelect.disabled = isRunning;
  maxWinnersInput.disabled = isRunning;
  ticketColorSelect.disabled = isRunning; // <-- TAMBAHAN BARU
  // --- AKHIR PERUBAHAN LOGIKA KONTROL ---


  // Update Grid Angka (disable yg sudah dipanggil)
  document.querySelectorAll('.number-button').forEach(button => {
      const num = parseInt(button.dataset.number);
      // gameState.calledNumbers sekarang adalah Array
      if (gameState.calledNumbers.includes(num)) { 
          button.classList.add('called');
          button.disabled = true;
      } else {
          // Hanya aktifkan jika game sedang RUNNING
          button.classList.remove('called');
          button.disabled = gameState.status !== 'running'; // Disable saat pause/stop/idle
      }
  });
  
  // (Bagian ini tetap sama, tidak perlu diubah)
  // Update Log Angka Terpanggil
  const numbersArray = [...gameState.calledNumbers];
  numbersArray.reverse(); 
  calledNumbersLog.innerHTML = numbersArray
    .map(num => `<div class="called-number-item">${num}</div>`)
    .join('');
}

// --- Event Listener Tombol Admin ---
loginButton.addEventListener('click', () => {
  socket.emit('ADMIN_LOGIN', passwordInput.value);
});

startButton.addEventListener('click', () => {
  const settings = {
      winCondition: winConditionSelect.value,
      maxWinners: parseInt(maxWinnersInput.value) || 10,
      ticketColor: ticketColorSelect.value // <-- TAMBAHAN BARU
  };
  if (settings.maxWinners < 1) {
      alert('Jumlah maksimal pemenang minimal 1.');
      return;
  }
  if (confirm(`Mulai permainan?\nTarget: ${settings.winCondition.replace('_',' ')}\nMaks Pemenang: ${settings.maxWinners}`)) {
    socket.emit('ADMIN_START_GAME', settings); // Kirim settings ke server
  }
});

stopButton.addEventListener('click', () => {
  if (confirm('Anda yakin ingin MENGHENTIKAN permainan?')) {
    socket.emit('ADMIN_STOP_GAME');
  }
});

pauseButton.addEventListener('click', () => {
    let newSettings = null;
    if (currentGameStatus === 'paused') {
        newSettings = {
            winCondition: winConditionSelect.value,
            maxWinners: parseInt(maxWinnersInput.value) || 10,
            ticketColor: ticketColorSelect.value // <-- TAMBAHAN BARU
        };
        
        if (newSettings.maxWinners < 1) {
            alert('Jumlah maksimal pemenang minimal 1.');
            return;
        }
    }
    
    // Kirim event toggle pause, BERSAMA settings baru (jika ada)
    socket.emit('ADMIN_TOGGLE_PAUSE', newSettings); 
});

// --- Event Listener Server ---
socket.on('ADMIN_AUTHORIZED', () => {
  loginContainer.style.display = 'none';
  dashboard.style.display = 'block';
  createNumberGrid(); // Buat grid angka saat login sukses
  socket.emit('GET_GAME_STATE'); // Minta state awal
});

socket.on('ADMIN_DENIED', () => {
  alert('Password salah!');
});

socket.on('GAME_STATE_UPDATE', (gameState) => {
  updateDashboard(gameState);
  // Update tampilan dropdown warna jika state diterima dari server
  // (misal saat admin refresh halaman di tengah game)
  ticketColorSelect.value = gameState.ticketColor || 'yellow'; // <-- TAMBAHAN BARU
});

// --- Inisialisasi ---
// (Grid dibuat setelah login)