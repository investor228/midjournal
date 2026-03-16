const API_URL = 'http://localhost:3000/entries';

const moodInput = document.getElementById('moodInput');
const submitBtn = document.getElementById('submitBtn');
const aiResponseArea = document.getElementById('aiResponseArea');
const aiText = document.getElementById('aiText');
const entriesList = document.getElementById('entriesList');
const searchInput = document.getElementById('searchInput'); // Находим поле поиска
// Слушаем нажатия клавиш в поле ввода текста
moodInput.addEventListener('keydown', (event) => {
  // Если нажат Enter И при этом НЕ зажат Shift
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault(); // Запрещаем браузеру делать перенос строки
    submitBtn.click();      // Программно "нажимаем" на кнопку отправки
  }
});

// НОВАЯ ПЕРЕМЕННАЯ: Здесь мы будем хранить ВСЕ записи в памяти браузера
let allEntries = []; 

// 1. Функция: Скачать историю (только скачивает)
async function loadEntries() {
  try {
    const response = await fetch(API_URL);
    allEntries = await response.json(); // Сохраняем скачанное в нашу переменную
    
    renderEntries(allEntries); // Просим нарисовать всё, что скачали
  } catch (error) {
    console.error('Ошибка загрузки истории:', error);
  }
}

// 2. НОВАЯ ФУНКЦИЯ: Только рисует то, что ей передали
function renderEntries(entriesToDraw) {
  entriesList.innerHTML = ''; // Очищаем экран
  
  // Если после поиска ничего не найдено
  if (entriesToDraw.length === 0) {
    entriesList.innerHTML = '<p style="color: gray; text-align: center;">Ничего не найдено 🤷‍♂️</p>';
    return;
  }
  
  // Перебираем записи и рисуем карточки
  entriesToDraw.forEach(entry => {
    const div = document.createElement('div');
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <p style="margin: 0 0 10px 0; width: 90%;"><strong>Твои мысли:</strong> ${entry.mood}</p>
        <button onclick="deleteEntry(${entry.id})" class="delete-btn" title="Удалить запись">✖</button>
      </div>
      <p style="margin: 0 0 10px 0; color: #1565c0;"><strong>ИИ:</strong> ${entry.aiResponse}</p>
      <small style="color: gray;">${new Date(entry.createdAt).toLocaleString()}</small>
    `;
    entriesList.appendChild(div);
  });
}

// 3. НОВАЯ МАГИЯ: Слушаем поле поиска
// Событие 'input' срабатывает при каждом нажатии любой клавиши в поле
searchInput.addEventListener('input', (event) => {
  // Берем текст из поиска и переводим в нижний регистр (чтобы "Сон" и "сон" искались одинаково)
  const searchText = event.target.value.toLowerCase();

  // Фильтруем наш массив всех записей
  const filteredEntries = allEntries.filter(entry => {
    // Проверяем, есть ли искомое слово в мыслях ИЛИ в ответе ИИ
    const moodMatch = entry.mood.toLowerCase().includes(searchText);
    const aiMatch = entry.aiResponse.toLowerCase().includes(searchText);
    
    return moodMatch || aiMatch; // Оставляем запись, если есть хотя бы одно совпадение
  });

  // Рисуем только отфильтрованные записи!
  renderEntries(filteredEntries);
});

// Удаление записи
window.deleteEntry = async (id) => {
  const isConfirmed = confirm('Точно хочешь удалить эту мысль навсегда?');
  if (!isConfirmed) return;

  try {
    const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    if (response.ok) {
      loadEntries(); // Скачиваем обновленный список с сервера
      searchInput.value = ''; // Очищаем поиск после удаления
    } else {
      alert('Ошибка при удалении на сервере.');
    }
  } catch (error) {
    console.error('Ошибка:', error);
  }
};

// Отправка новой записи
submitBtn.addEventListener('click', async () => {
  const text = moodInput.value.trim();
  if (!text) return alert('Сначала напиши что-нибудь!');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Нейросеть думает...';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood: text })
    });

    const newEntry = await response.json();
    aiResponseArea.style.display = 'block';
    aiText.textContent = newEntry.aiResponse;
    moodInput.value = '';
    
    loadEntries(); // Скачиваем обновленный список
    searchInput.value = ''; // Очищаем поиск
  } catch (error) {
    console.error('Ошибка отправки:', error);
    alert('Не удалось отправить запись.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Отправить';
  }
});

// Запускаем при открытии
loadEntries();