require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const bcrypt = require('bcrypt');       // Библиотека для шифрования паролей
const jwt = require('jsonwebtoken');    // Библиотека для пропусков-токенов

const app = express();
const PORT = 3000;
const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

// ==========================================
// 🛡️ ОХРАННИК (Middleware)
// ==========================================
// Эта функция будет стоять перед дневником и проверять токен
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Достаем токен из заголовка

  if (!token) return res.status(401).json({ error: 'Нет доступа. Пожалуйста, войдите в систему.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Пропуск недействителен или просрочен.' });
    req.user = user; // Если токен верный, запоминаем, кто этот юзер
    next(); // Пропускаем дальше к записям!
  });
};

// ==========================================
// 🚪 ВРАТА: РЕГИСТРАЦИЯ И ВХОД
// ==========================================

// 1. Регистрация нового юзера
app.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Проверяем, нет ли уже такого email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'Этот Email уже занят' });

    // Шифруем пароль (10 - это уровень сложности шифрования)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаем пользователя в базе
    const newUser = await prisma.user.create({
      data: { email, password: hashedPassword, name }
    });

    res.status(201).json({ message: 'Пользователь успешно зарегистрирован!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка при регистрации' });
  }
});

// 2. Вход в систему (Логин)
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Ищем юзера
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // Сравниваем пароль с тем, что в базе
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Неверный пароль' });

    // Выдаем крипто-пропуск (токен), который будет действовать 7 дней
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка при входе' });
  }
});

// ==========================================
// 📖 ДНЕВНИК (Теперь под защитой Охранника!)
// ==========================================

// Окно 1: Получение истории (ТОЛЬКО СВОЕЙ)
// Обрати внимание: мы добавили authenticateToken перед async
app.get('/entries', authenticateToken, async (req, res) => {
  try {
    const entries = await prisma.journalEntry.findMany({
      where: { userId: req.user.id }, // ИЩЕМ ТОЛЬКО ЗАПИСИ ЭТОГО ЮЗЕРА!
      orderBy: { createdAt: 'desc' }
    });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: 'Не удалось получить записи' });
  }
});

// Окно 2: Создание записи
app.post('/entries', authenticateToken, async (req, res) => {
  try {
    const { mood } = req.body;
    if (!mood) return res.status(400).json({ error: 'Текст не может быть пустым' });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `Действуй как поддерживающий ассистент для ведения дневника. 
    Ответь коротко, по-доброму и ободряюще (не более 3 предложений) на эту мысль человека: "${mood}"`;

    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    // Сохраняем в базу с привязкой к ID создателя!
    const newEntry = await prisma.journalEntry.create({
      data: {
        mood: mood,
        aiResponse: aiResponse,
        userId: req.user.id // ПРИВЯЗЫВАЕМ К АВТОРУ
      }
    });

    res.status(201).json(newEntry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Не удалось сохранить запись' });
  }
});

// Окно 3: Удаление (ТОЛЬКО СВОЕЙ ЗАПИСИ)
app.delete('/entries/:id', authenticateToken, async (req, res) => {
  try {
    const entryId = parseInt(req.params.id);

    // deleteMany позволяет удалить запись только если совпадает и ID записи, и ID юзера
    const deleted = await prisma.journalEntry.deleteMany({
      where: { 
        id: entryId,
        userId: req.user.id 
      }
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Запись не найдена или у вас нет прав на ее удаление' });
    }

    res.status(200).json({ message: 'Запись удалена' });
  } catch (error) {
    res.status(500).json({ error: 'Не удалось удалить запись' });
  }
});

app.listen(PORT, () => {
  console.log(`Сервер с Аутентификацией запущен на http://localhost:${PORT}`);
});