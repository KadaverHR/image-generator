const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { transliterate } = require('transliteration');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Загрузка брендов из JSON-файла
function loadBrands() {
  try {
    const brandsPath = path.join(__dirname, 'data', 'brands.json');
    if (!fs.existsSync(brandsPath)) {
      console.error('Файл brands.json не найден');
      return [];
    }
    
    const brandsData = JSON.parse(fs.readFileSync(brandsPath, 'utf-8'));
    if (!Array.isArray(brandsData)) {
      console.error('Неверный формат данных в brands.json');
      return [];
    }
    
    return brandsData;
  } catch (error) {
    console.error('Ошибка загрузки брендов:', error);
    return [];
  }
}

// Маршрут для получения брендов
app.get('/api/brands', (req, res) => {
  const brands = loadBrands();
  res.json({
    success: true,
    count: brands.length,
    brands: brands
  });
});

// Настройка Multer для пакетной загрузки
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Получаем имя, переданное клиентом
    let originalName = file.originalname;

    // Транслитерируем и очищаем
    let cleanedName = transliterate(originalName)
      .replace(/[<>:"\/\\|?*]/g, '') // Удаляем запрещенные символы
      .replace(/\s+/g, '_') // Пробелы → _
      .replace(/,+/g, ''); // Удаляем запятые

    // Гарантируем наличие расширения
    const ext = path.extname(cleanedName) || '.png';
    const base = path.basename(cleanedName, ext);
    const finalName = `${base}${ext}`; // Без добавления уникальных суффиксов

    cb(null, finalName); // Просто вернём имя — multer перезапишет если уже есть
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB на файл
}).array('images', 200); // До 10 файлов за раз

// Маршрут для пакетной загрузки
app.post('/api/upload-batch', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      console.error('Ошибка загрузки:', err);
      return res.status(500).json({ 
        success: false,
        error: err.message 
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files were uploaded'
      });
    }

    console.log(`Успешно загружено ${req.files.length} файлов:`);
    req.files.forEach(file => {
      console.log(`- ${file.originalname} → ${file.filename}`);
    });

    res.json({
      success: true,
      count: req.files.length,
      files: req.files.map(file => ({
        originalName: file.originalname,
        savedName: file.filename,
        size: file.size
      }))
    });
  });
});

// Проверка и создание папок при запуске
function ensureDirectoriesExist() {
  const dirs = ['uploads', 'data'];
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
      console.log(`Создана папка: ${dirPath}`);
    }
  });
}

// Запуск сервера
app.listen(PORT, () => {
  ensureDirectoriesExist();
  const brandsCount = loadBrands().length;
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  console.log(`Загружено брендов: ${brandsCount}`);
  console.log(`Папка для загрузок: ${path.join(__dirname, 'uploads')}`);
});