const { transliterate } = window.transliteration || {};

// Функция для создания безопасных имен файлов
function safeFilename(brand) {
  if (!brand?.id || !brand?.brand) return `brand_${Math.random().toString(36).substr(2, 8)}`;

  try {
    const translit = transliterate(brand.brand);
    const cleanBrand = translit
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50);
    return `${brand.id}-${cleanBrand}`;
  } catch (error) {
    console.error('Transliteration error:', transliterate(brand));
    return `${brand.id}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateBtn');
  const progressBar = document.getElementById('progress');
  const statusEl = document.getElementById('status');
  const logEl = document.getElementById('log');

  const API_BASE_URL = 'http://localhost:3000';
  const BATCH_SIZE = 50; // Уменьшили размер пачки для стабильности
  let isGenerating = false;
  let brandsData = [];
  let processedCount = 0;

  // Улучшенное логирование
  function log(message, isError = false) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = isError ? 'log-entry error' : 'log-entry';
    entry.innerHTML = `[${timestamp}] ${message}`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;

    if (isError) console.error(message);
    else console.log(message);
  }

  // Загрузка брендов с сервера
  async function fetchBrands() {
    try {
      log('⌛ Загрузка списка брендов...');
      const response = await fetch(`${API_BASE_URL}/api/brands`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (!data?.success || !Array.isArray(data.brands)) {
        throw new Error('Неверный формат данных о брендах');
      }

      brandsData = data.brands.filter(b => b?.brand); // Фильтруем пустые
      log(`✅ Загружено ${brandsData.length} брендов`);
      return true;
    } catch (error) {
      log(`❌ Ошибка загрузки брендов: ${error.message}`, true);
      return false;
    }
  }

  // Генерация изображения бренда
  async function generateBrandCanvas(brand) {
    const container = document.createElement('div');
    container.className = 'hidden-canvas-container';
    document.body.appendChild(container);

    try {
      const template = document.getElementById('template');
      if (!template) throw new Error('Шаблон не найден');

      const clone = template.cloneNode(true);
      clone.style.display = 'block';

      // Заполняем данные
      clone.querySelector('.canvas__title').textContent = brand.brand || 'Без названия';
      clone.querySelector('.canvas__desc').textContent = brand.description || 'Описание отсутствует';
      clone.querySelector('.canvas__country').textContent = brand.country;

      container.appendChild(clone);

      // Даем время на рендеринг
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(clone, {
        scale: 1,
        width: 900,
        height: 1200,
        logging: false,
        useCORS: true
      });

      if (!canvas || canvas.width === 0) {
        throw new Error('Не удалось создать canvas');
      }

      return canvas;
    } finally {
      container.remove();
    }
  }

  // Загрузка пачки изображений
  async function uploadImageBatch(batch) {
    const formData = new FormData();
    let successInBatch = 0;

    // Создаем blob'ы параллельно
    const blobs = await Promise.all(
      batch.map(async ({ canvas, brand }) => {
        try {
          if (!canvas) throw new Error('Canvas не существует');

          const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(
              blob => blob ? resolve(blob) : reject(new Error('Blob creation failed')),
              'image/png',
              0.9
            );
          });

          return { blob, brand };
        } catch (error) {
          log(`⚠️ Ошибка обработки ${brand?.brand || 'unknown'}: ${error.message}`, true);
          return null;
        }
      })
    );

    // Добавляем только валидные файлы
    blobs.forEach((item, index) => {
      if (item?.blob) {
        const filename = `${safeFilename(batch[index].brand)}.png`;
        formData.append('images', item.blob, filename);
        successInBatch++;
      }
    });

    if (successInBatch === 0) {
      throw new Error('Нет валидных изображений в пачке');
    }

    try {
      log(`⬆️ Отправка пачки (${successInBatch}/${batch.length} файлов)...`);
      const response = await fetch(`${API_BASE_URL}/api/upload-batch`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      log(`✅ Успешно загружено ${result.count || successInBatch} файлов`);
      return result.count || successInBatch;
    } catch (error) {
      log(`❌ Ошибка загрузки пачки: ${error.message}`, true);
      throw error;
    }
  }

  // Основная функция генерации
  async function generateAllImages() {
    if (isGenerating) return;
    isGenerating = true;
    generateBtn.disabled = true;
    processedCount = 0;

    const startTime = performance.now();
    logEl.innerHTML = '';
    log('🚀 Начало генерации изображений');

    try {
      // 1. Загрузка данных
      if (!await fetchBrands() || brandsData.length === 0) {
        throw new Error('Нет данных для обработки');
      }

      // 2. Обработка пачками
      for (let i = 0; i < brandsData.length; i += BATCH_SIZE) {
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
        const batchBrands = brandsData.slice(i, i + BATCH_SIZE);

        log(`\n--- Пачка ${batchIndex} (${i + 1}-${Math.min(i + BATCH_SIZE, brandsData.length)}) ---`);

        try {
          // 2.1. Генерация изображений
          const batch = await Promise.all(
            batchBrands.map(async brand => {
              try {
                const canvas = await generateBrandCanvas(brand);
                return { brand, canvas };
              } catch (error) {
                log(`⚠️ Ошибка генерации ${brand.brand}: ${error.message}`, true);
                return null;
              }
            })
          );

          // 2.2. Фильтрация и загрузка
          const validItems = batch.filter(item => item?.canvas);
          if (validItems.length > 0) {
            const uploaded = await uploadImageBatch(validItems);
            processedCount += uploaded;
          } else {
            log('ℹ️ Нет валидных изображений в пачке');
          }
        } catch (error) {
          log(`⛔ Пропуск пачки из-за ошибки: ${error.message}`, true);
        }

        // 2.3. Обновление прогресса
        const progress = Math.min(i + BATCH_SIZE, brandsData.length) / brandsData.length * 100;
        progressBar.style.width = `${progress}%`;
        statusEl.textContent = `Обработано: ${Math.min(i + BATCH_SIZE, brandsData.length)}/${brandsData.length} | Успешно: ${processedCount}`;
      }
    } catch (error) {
      log(`💥 Критическая ошибка: ${error.message}`, true);
    } finally {
      const totalTime = ((performance.now() - startTime) / 1000).toFixed(1);
      log(`\n🏁 Генерация завершена за ${totalTime} сек`);
      log(`Итого: ${processedCount}/${brandsData.length} изображений успешно обработано`);

      statusEl.textContent = `Готово! Успешно: ${processedCount}/${brandsData.length}`;
      generateBtn.disabled = false;
      isGenerating = false;
    }
  }

  // Инициализация
  generateBtn.addEventListener('click', generateAllImages);
  log('Система инициализирована. Нажмите "Сгенерировать изображения"');
});