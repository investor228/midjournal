require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Подключаем библиотеку Google

const app = express();
const PORT = 3000;

const prisma = new PrismaClient();
// Инициализируем Gemini с твоим ключом из .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use(cors());
app.use(express.json());

// Окно 1: Получение истории
app.get('/entries', async (req, res) => {
  try {
    const entries = await prisma.journalEntry.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(entries);
  } catch (error) {
    console.error('Ошибка при получении записей:', error);
    res.status(500).json({ error: 'Не удалось получить записи' });
  }
});

// Окно 2: Создание записи и общение с ИИ
app.post('/entries', async (req, res) => {
  try {
    const { mood } = req.body;

    if (!mood) {
      return res.status(400).json({ error: 'Текст записи не может быть пустым' });
    }

   // 1. Берем классическую, безотказную модель gemini-pro
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 2. Вшиваем инструкцию прямо в текст запроса
    const prompt = `Действуй как поддерживающий ассистент для ведения дневника. 
    Ответь коротко, по-доброму и ободряюще (не более 3 предложений) на эту мысль человека: "${mood}"`;

    // 3. Отправляем текст и ждем ответ
    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    // 3. Сохраняем в базу данных
    const newEntry = await prisma.journalEntry.create({
      data: {
        mood: mood,
        aiResponse: aiResponse
      }
    });

    // 4. Возвращаем результат
    res.status(201).json(newEntry);

  } catch (error) {
    console.error('Ошибка при создании записи:', error);
    res.status(500).json({ error: 'Не удалось сохранить запись' });
  }
});

app.delete('/entries/:id', async (req, res) => {
  try {
    const entryId = parseInt(req.params.id); // Достаем ID из ссылки и превращаем в число

    // Просим базу данных (Prisma) удалить запись с таким ID
    await prisma.journalEntry.delete({
      where: { id: entryId }
    });

    // Отвечаем фронтенду, что всё прошло успешно
    res.status(200).json({ message: 'Запись успешно удалена' });
  } catch (error) {
    console.error('Ошибка при удалении записи:', error);
    res.status(500).json({ error: 'Не удалось удалить запись' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер с Gemini запущен на http://localhost:${PORT}`);
});