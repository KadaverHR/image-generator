(function (global) {
  const map = {
    А: 'A', а: 'a', Б: 'B', б: 'b', В: 'V', в: 'v',
    Г: 'G', г: 'g', Д: 'D', д: 'd', Е: 'E', е: 'e',
    Ё: 'E', ё: 'e', Ж: 'Zh', ж: 'zh', З: 'Z', з: 'z',
    И: 'I', и: 'i', Й: 'Y', й: 'y', К: 'K', к: 'k',
    Л: 'L', л: 'l', М: 'M', м: 'm', Н: 'N', н: 'n',
    О: 'O', о: 'o', П: 'P', п: 'p', Р: 'R', р: 'r',
    С: 'S', с: 's', Т: 'T', т: 't', У: 'U', у: 'u',
    Ф: 'F', ф: 'f', Х: 'Kh', х: 'kh', Ц: 'Ts', ц: 'ts',
    Ч: 'Ch', ч: 'ch', Ш: 'Sh', ш: 'sh', Щ: 'Shch', щ: 'shch',
    Ъ: '', ъ: '', Ы: 'Y', ы: 'y', Ь: '', ь: '',
    Э: 'E', э: 'e', Ю: 'Yu', ю: 'yu', Я: 'Ya', я: 'ya'
  };

  function transliterate(text) {
    if (typeof text !== 'string') return '';
    return text
      .split('')
      .map(char => map[char] || char)
      .join('');
  }

  global.transliteration = {
    transliterate
  };
})(window);
