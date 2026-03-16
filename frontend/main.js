const API_URL = 'http://localhost:3000';
const themeToggleBtn = document.getElementById('themeToggleBtn');
// Элементы Авторизации
const authSection = document.getElementById('authSection');
const journalSection = document.getElementById('journalSection');
const authTitle = document.getElementById('authTitle');
const nameInput = document.getElementById('nameInput');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const authBtn = document.getElementById('authBtn');
const toggleAuthMode = document.getElementById('toggleAuthMode');
const logoutBtn = document.getElementById('logoutBtn');

// Элементы Дневника
const moodInput = document.getElementById('moodInput');
const submitBtn = document.getElementById('submitBtn');
const aiResponseArea = document.getElementById('aiResponseArea');
const aiText = document.getElementById('aiText');
const entriesList = document.getElementById('entriesList');
const searchInput = document.getElementById('searchInput');

let allEntries = [];
let isLoginMode = true; // Флаг: мы сейчас входим или регистрируемся?

// ==========================================
// 🛡️ СИСТЕМА АВТОРИЗАЦИИ
// ==========================================

// Проверяем, есть ли у нас сохраненный пропуск
function checkAuth() {
  const token = localStorage.getItem('token');
  if (token) {
    authSection.style.display = 'none';
    journalSection.style.display = 'block';
    loadEntries(); // Если пропуск есть, пускаем и грузим историю
  } else {
    authSection.style.display = 'block';
    journalSection.style.display = 'none';
  }
}

// Переключатель между Входом и Регистрацией
toggleAuthMode.addEventListener('click', () => {
  isLoginMode = !isLoginMode;
  if (isLoginMode) {
    authTitle.textContent = 'Вход в дневник 🔒';
    nameInput.style.display = 'none';
    authBtn.textContent = 'Войти';
    toggleAuthMode.textContent = 'Нет аккаунта? Зарегистрироваться';
  } else {
    authTitle.textContent = 'Создать аккаунт ✨';
    nameInput.style.display = 'block';
    authBtn.textContent = 'Зарегистрироваться';
    toggleAuthMode.textContent = 'Уже есть аккаунт? Войти';
  }
});

// Кнопка Входа/Регистрации
authBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const name = nameInput.value.trim();

  if (!email || !password) return alert('Введи Email и пароль!');

  const endpoint = isLoginMode ? '/login' : '/register';
  const bodyData = isLoginMode ? { email, password } : { email, password, name };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });

    const data = await response.json();

    if (!response.ok) {
      return alert(data.error || 'Произошла ошибка');
    }

    if (isLoginMode) {
      // ЕСЛИ ВОШЛИ УСПЕШНО: Сохраняем токен в память браузера!
      localStorage.setItem('token', data.token);
      checkAuth(); // Переключаем экраны
    } else {
      alert('Регистрация успешна! Теперь выполни вход.');
      toggleAuthMode.click(); // Перекидываем на экран логина
    }
  } catch (error) {
    console.error(error);
    alert('Ошибка соединения с сервером.');
  }
});

// Кнопка Выхода (просто удаляем пропуск и перезагружаем)
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('token');
  checkAuth();
});

// ==========================================
// 📖 ФУНКЦИИ ДНЕВНИКА (С ПРОПУСКАМИ!)
// ==========================================

// Функция: Достать токен для заголовков
const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}` // ВОТ ОН, НАШ ПРОПУСК!
});

async function loadEntries() {
  try {
    const response = await fetch(`${API_URL}/entries`, { headers: getAuthHeaders() });
    
    // Если токен просрочен, сервер вернет 401 или 403
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('token');
      return checkAuth();
    }

    allEntries = await response.json();
    renderEntries(allEntries);
  } catch (error) {
    console.error(error);
  }
}

function renderEntries(entriesToDraw) {
  entriesList.innerHTML = ''; 
  if (entriesToDraw.length === 0) {
    entriesList.innerHTML = '<p style="color: gray; text-align: center;">Записей пока нет. Напиши что-нибудь!</p>';
    return;
  }
  
  entriesToDraw.forEach(entry => {
    const div = document.createElement('div');
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <p style="margin: 0 0 10px 0; width: 90%;"><strong>Твои мысли:</strong> ${entry.mood}</p>
        <button onclick="deleteEntry(${entry.id})" class="delete-btn" title="Удалить">✖</button>
      </div>
      <p style="margin: 0 0 10px 0; color: #1565c0;"><strong>ИИ:</strong> ${entry.aiResponse}</p>
      <small style="color: gray;">${new Date(entry.createdAt).toLocaleString()}</small>
    `;
    entriesList.appendChild(div);
  });
}

// Отправка записи
submitBtn.addEventListener('click', async () => {
  const text = moodInput.value.trim();
  if (!text) return alert('Напиши что-нибудь!');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Нейросеть думает...';

  try {
    const response = await fetch(`${API_URL}/entries`, {
      method: 'POST',
      headers: getAuthHeaders(), // Добавляем пропуск!
      body: JSON.stringify({ mood: text })
    });

    const newEntry = await response.json();
    aiResponseArea.style.display = 'block';
    aiText.textContent = newEntry.aiResponse;
    moodInput.value = '';
    
    loadEntries();
  } catch (error) {
    alert('Не удалось отправить запись.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Отправить';
  }
});

// Удаление записи
window.deleteEntry = async (id) => {
  if (!confirm('Удалить навсегда?')) return;
  try {
    const response = await fetch(`${API_URL}/entries/${id}`, { 
      method: 'DELETE',
      headers: getAuthHeaders() // Добавляем пропуск!
    });
    if (response.ok) loadEntries();
  } catch (error) {
    console.error(error);
  }
};

// Поиск
searchInput.addEventListener('input', (e) => {
  const searchText = e.target.value.toLowerCase();
  const filtered = allEntries.filter(entry => 
    entry.mood.toLowerCase().includes(searchText) || 
    entry.aiResponse.toLowerCase().includes(searchText)
  );
  renderEntries(filtered);
});

// Отправка по Enter
moodInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); 
    submitBtn.click();      
  }
});

// ==========================================
// 🌙 ТЕМНАЯ ТЕМА
// ==========================================

// Проверяем, сохранял ли юзер темную тему ранее
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark-theme');
}

// Слушаем клик по кнопке с луной
themeToggleBtn.addEventListener('click', () => {
  // Переключаем класс dark-theme на body
  document.body.classList.toggle('dark-theme');
  
  // Сохраняем выбор в память браузера
  if (document.body.classList.contains('dark-theme')) {
    localStorage.setItem('theme', 'dark');
  } else {
    localStorage.setItem('theme', 'light');
  }
});

// ==========================================
// ⚙️ ЛОГИКА НАСТРОЕК ПРОФИЛЯ
// ==========================================

// Находим новые элементы
const profileSection = document.getElementById('profileSection');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const backToJournalBtn = document.getElementById('backToJournalBtn');

const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const saveProfileBtn = document.getElementById('saveProfileBtn');

const oldPassword = document.getElementById('oldPassword');
const newPassword = document.getElementById('newPassword');
const changePasswordBtn = document.getElementById('changePasswordBtn');

// Открыть настройки
openSettingsBtn.addEventListener('click', async () => {
  journalSection.style.display = 'none';
  profileSection.style.display = 'block';

  // Запрашиваем актуальные данные с сервера
  try {
    const response = await fetch(`${API_URL}/profile`, { headers: getAuthHeaders() });
    if (response.ok) {
      const data = await response.json();
      profileName.value = data.name || '';
      profileEmail.value = data.email || '';
    }
  } catch (error) {
    console.error('Ошибка загрузки профиля', error);
  }
});

// Вернуться в дневник
backToJournalBtn.addEventListener('click', () => {
  profileSection.style.display = 'none';
  journalSection.style.display = 'block';
});

// Сохранить Имя и Email
saveProfileBtn.addEventListener('click', async () => {
  const name = profileName.value.trim();
  const email = profileEmail.value.trim();

  if (!email) return alert('Email не может быть пустым!');

  try {
    const response = await fetch(`${API_URL}/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, email })
    });

    const data = await response.json();
    if (response.ok) {
      alert(data.message);
    } else {
      alert(data.error);
    }
  } catch (error) {
    alert('Ошибка при сохранении профиля');
  }
});

// Сменить пароль
changePasswordBtn.addEventListener('click', async () => {
  const oldPass = oldPassword.value.trim();
  const newPass = newPassword.value.trim();

  if (!oldPass || !newPass) return alert('Заполни оба поля с паролями!');
  if (oldPass === newPass) return alert('Новый пароль должен отличаться от старого!');

  try {
    const response = await fetch(`${API_URL}/profile/password`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass })
    });

    const data = await response.json();
    if (response.ok) {
      alert(data.message);
      oldPassword.value = '';
      newPassword.value = '';
    } else {
      alert(data.error); // Например "Неверный старый пароль"
    }
  } catch (error) {
    alert('Ошибка при смене пароля');
  }
});
// Запускаем проверку при открытии сайта
checkAuth();