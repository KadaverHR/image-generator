document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generateBtn');
  const progressBar = document.getElementById('progress');
  const statusEl = document.getElementById('status');
  const logEl = document.getElementById('log');

  const API_BASE_URL = 'http://localhost:3000';
  const BATCH_SIZE = 200;
  let isGenerating = false;
  let brandsData = [];

  function log(message, isError = false) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.textContent = `[${timestamp}] ${message}`;
    entry.style.color = isError ? '#ff4444' : '#333333';
    entry.style.padding = '4px';
    entry.style.margin = '2px 0';
    entry.style.borderLeft = isError ? '3px solid #ff4444' : '3px solid #4CAF50';
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
    
    if (isError) console.error(message);
    else console.log(message);
  }

  async function fetchBrands() {
    try {
      log('Загрузка списка брендов с сервера...');
      const response = await fetch(`${API_BASE_URL}/api/brands`);
      
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !Array.isArray(data.brands)) {
        throw new Error('Неверный формат данных о брендах');
      }

      brandsData = data.brands;
      log(`Получено ${brandsData.length} брендов для обработки`);
      return true;
    } catch (error) {
      log(`Ошибка загрузки брендов: ${error.message}`, true);
      return false;
    }
  }

  async function generateBrandCanvas(brand) {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.width = '900px';
    container.style.height = '1200px';
    document.body.appendChild(container);

    try {
      const template = document.getElementById('template');
      const clone = template.cloneNode(true);
      clone.style.display = 'block';
      
      clone.querySelector('.canvas__title').textContent = brand.brand;
      clone.querySelector('.canvas__desc').textContent = brand.description;

      container.appendChild(clone);
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(clone, {
        scale: 1,
        width: 900,
        height: 1200,
        logging: true
      });

      if (!canvas || canvas.width === 0) {
        throw new Error('Не удалось создать canvas');
      }

      return canvas;
    } finally {
      container.remove();
    }
  }

  async function uploadImageBatch(batch) {
    const formData = new FormData();
    
    // Сначала преобразуем все Canvas в Blob
    const blobs = await Promise.all(
      batch.map(async ({canvas, brand}) => {
        return new Promise((resolve) => {
          canvas.toBlob(blob => {
            resolve({blob, brand});
          }, 'image/png', 0.9);
        });
      })
    );

    // Затем добавляем все Blob в FormData
    blobs.forEach(({blob, brand}) => {
      formData.append('images', blob, `${brand.brand}.png`);
    });

    try {
      log(`Отправка пачки из ${batch.length} изображений...`);
      const response = await fetch(`${API_BASE_URL}/api/upload-batch`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error('Сервер вернул ошибку');
      }

      log(`Успешно загружено ${result.count} изображений`);
      return result.count;
    } catch (error) {
      log(`Ошибка загрузки пачки: ${error.message}`, true);
      throw error;
    }
  }

  async function generateAllImages() {
    if (isGenerating) return;
    isGenerating = true;
    generateBtn.disabled = true;
    
    let successCount = 0;
    const startTime = performance.now();
    logEl.innerHTML = '';
    log('Начало процесса генерации изображений');

    try {
      if (!await fetchBrands() || brandsData.length === 0) {
        throw new Error('Нет данных о брендах для обработки');
      }

      for (let i = 0; i < brandsData.length; i += BATCH_SIZE) {
        const batchBrands = brandsData.slice(i, i + BATCH_SIZE);
        log(`Обработка пачки ${Math.floor(i/BATCH_SIZE) + 1} (бренды ${i+1}-${Math.min(i+BATCH_SIZE, brandsData.length)})`);

        const batch = await Promise.all(
          batchBrands.map(async brand => ({
            brand,
            canvas: await generateBrandCanvas(brand)
          }))
        );

        try {
          const uploadedCount = await uploadImageBatch(batch);
          successCount += uploadedCount;
        } catch (error) {
          batch.forEach(({brand}) => {
            log(`❌ Ошибка при обработке ${brand.brand}`, true);
          });
        }

        const progress = Math.min(i + BATCH_SIZE, brandsData.length) / brandsData.length * 100;
        progressBar.style.width = `${progress}%`;
        statusEl.textContent = `Обработано ${Math.min(i + BATCH_SIZE, brandsData.length)} из ${brandsData.length}`;
      }
    } catch (error) {
      log(`🔥 Критическая ошибка: ${error.message}`, true);
    } finally {
      const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
      log(`Генерация завершена! Успешно: ${successCount}/${brandsData.length}`);
      log(`Общее время: ${totalTime} сек`);
      statusEl.textContent = `Готово! Успешно: ${successCount}/${brandsData.length}`;
      generateBtn.disabled = false;
      isGenerating = false;
    }
  }

  generateBtn.addEventListener('click', generateAllImages);
  log('Система готова. Нажмите "Сгенерировать изображения"');
});