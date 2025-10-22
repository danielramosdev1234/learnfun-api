// src/utils/phonemeAnalyzer.js

import { convertWordToIPA } from './ipaConverter';

/**
 * Matriz de similaridade fonética
 * Sons similares têm distância menor (0-1)
 * 0 = idêntico, 1 = completamente diferente
 */
const PHONETIC_SIMILARITY = {
  // Plosivas surdas/sonoras (muito similares)
  'p-b': 0.2, 'b-p': 0.2,
  't-d': 0.2, 'd-t': 0.2,
  'k-g': 0.2, 'g-k': 0.2,

  // Fricativas surdas/sonoras
  'f-v': 0.2, 'v-f': 0.2,
  's-z': 0.2, 'z-s': 0.2,
  'θ-ð': 0.2, 'ð-θ': 0.2, // th sounds
  'ʃ-ʒ': 0.2, 'ʒ-ʃ': 0.2, // sh/zh sounds

  // Africadas relacionadas
  'tʃ-dʒ': 0.3, 'dʒ-tʃ': 0.3, // ch/j sounds

  // Nasais (similares entre si)
  'm-n': 0.3, 'n-m': 0.3,
  'n-ŋ': 0.3, 'ŋ-n': 0.3,

  // Líquidas e aproximantes
  'l-r': 0.3, 'r-l': 0.3,
  'ɹ-l': 0.3, 'l-ɹ': 0.3,
  'w-v': 0.4, 'v-w': 0.4,

  // Vogais similares
  'i-ɪ': 0.2, 'ɪ-i': 0.2, // beat/bit
  'u-ʊ': 0.2, 'ʊ-u': 0.2, // boot/book
  'e-ɛ': 0.2, 'ɛ-e': 0.2, // bait/bet
  'o-ɔ': 0.2, 'ɔ-o': 0.2, // boat/bought
  'ə-ʌ': 0.2, 'ʌ-ə': 0.2, // schwa variations

  // Erros comuns de não-nativos
  'θ-t': 0.4, 't-θ': 0.4, // th -> t (comum em espanhol/português)
  'ð-d': 0.4, 'd-ð': 0.4, // th -> d
  'θ-s': 0.5, 's-θ': 0.5, // th -> s
  'ð-z': 0.5, 'z-ð': 0.5, // th -> z
  'v-b': 0.4, 'b-v': 0.4, // v -> b (comum em espanhol)
  'w-v': 0.4, // w -> v (alemão/russo)
  'r-ʁ': 0.5, 'ʁ-r': 0.5, // r gutural vs americano
};

/**
 * Obtém distância entre dois fonemas baseado em similaridade
 */
const getPhoneticDistance = (phone1, phone2) => {
  if (phone1 === phone2) return 0;

  const key = `${phone1}-${phone2}`;
  return PHONETIC_SIMILARITY[key] || 1.0; // Default: completamente diferente
};

/**
 * Normaliza texto removendo pontuação e convertendo para minúsculas
 */
const normalizeText = (text) => {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Distância de Levenshtein PONDERADA para strings IPA
 * Considera similaridade fonética entre sons
 */
const phoneticLevenshtein = (ipa1, ipa2) => {
  // Converte IPA strings em arrays de fonemas
  const phones1 = Array.from(ipa1);
  const phones2 = Array.from(ipa2);

  const len1 = phones1.length;
  const len2 = phones2.length;

  // Matriz de programação dinâmica
  const matrix = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(0));

  // Inicializa primeira linha e coluna
  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  // Preenche matriz com custos ponderados
  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const phone1 = phones1[i - 1];
      const phone2 = phones2[j - 1];

      // Custo de substituição baseado em similaridade fonética
      const substitutionCost = getPhoneticDistance(phone1, phone2);

      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,                    // Inserção
        matrix[j - 1][i] + 1,                    // Deleção
        matrix[j - 1][i - 1] + substitutionCost  // Substituição ponderada
      );
    }
  }

  return matrix[len2][len1];
};

/**
 * Calcula similaridade fonética (0-1) entre duas palavras
 * Usa IPA quando disponível, fallback para texto normal
 */
const calculatePhoneticSimilarity = (word1, word2) => {
  const clean1 = word1.trim().toLowerCase();
  const clean2 = word2.trim().toLowerCase();

  // Se são iguais, retorna 1.0 imediatamente
  if (clean1 === clean2) {
    console.log(`      💯 "${clean1}" === "${clean2}" → 100%`);
    return 1.0;
  }

  // Separa em palavras se houver espaço
  const words1 = clean1.split(/\s+/);
  const words2 = clean2.split(/\s+/);

  // Se ambas são palavra única, tenta IPA
  if (words1.length === 1 && words2.length === 1) {
    const ipa1 = convertWordToIPA(clean1);
    const ipa2 = convertWordToIPA(clean2);

    console.log(`      🔬 IPA: "${clean1}" → ${ipa1}`);
    console.log(`      🔬 IPA: "${clean2}" → ${ipa2}`);

    const useIPA = !ipa1.includes('[') && !ipa2.includes('[');

    if (useIPA) {
      const cleanIPA1 = ipa1.replace(/[\/\[\]]/g, '');
      const cleanIPA2 = ipa2.replace(/[\/\[\]]/g, '');

      const maxLen = Math.max(cleanIPA1.length, cleanIPA2.length);
      if (maxLen === 0) return 1.0;

      const distance = phoneticLevenshtein(cleanIPA1, cleanIPA2);
      const similarity = Math.max(0, (maxLen - distance) / maxLen);

      console.log(`      ✨ IPA similarity: ${Math.round(similarity * 100)}%`);
      return similarity;
    } else {
      console.log(`      ⚠️ IPA não disponível, usando fallback`);
    }
  }

  // ✅ Fallback para múltiplas palavras - converte cada palavra individualmente
  console.log(`      🔄 Fallback multi-word: "${clean1}" vs "${clean2}"`);

  const ipa1Parts = words1.map(w => {
    const wordIPA = convertWordToIPA(w);
    return wordIPA.includes('[') ? w : wordIPA.replace(/[\/\[\]]/g, '');
  });
  const ipa2Parts = words2.map(w => {
    const wordIPA = convertWordToIPA(w);
    return wordIPA.includes('[') ? w : wordIPA.replace(/[\/\[\]]/g, '');
  });

  const cleanIPA1 = ipa1Parts.join('');
  const cleanIPA2 = ipa2Parts.join('');

  console.log(`      🔬 IPA parts: "${words1.join(' ')}" → ${cleanIPA1}`);
  console.log(`      🔬 IPA parts: "${words2.join(' ')}" → ${cleanIPA2}`);

  const maxLen = Math.max(cleanIPA1.length, cleanIPA2.length);
  if (maxLen === 0) return 1.0;

  const distance = phoneticLevenshtein(cleanIPA1, cleanIPA2);
  const similarity = Math.max(0, (maxLen - distance) / maxLen);

  console.log(`      ✨ Multi-word IPA similarity: ${Math.round(similarity * 100)}%`);
  return similarity;
};

/**
 * Levenshtein simples (fallback)
 */
const simpleLevenshtein = (str1, str2) => {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[len2][len1];
};

/**
 * 🆕 Alinha palavras esperadas com palavras faladas
 * Permite que múltiplas palavras faladas correspondam a uma palavra esperada
 */
const alignWords = (expectedWords, spokenWords) => {
  console.log('🎯 STARTING DYNAMIC ALIGNMENT');
  console.log('Expected:', expectedWords);
  console.log('Spoken:', spokenWords);

  const m = expectedWords.length;
  const n = spokenWords.length;

  // Matriz de custos (menor custo = melhor alinhamento)
  const cost = Array(m + 1).fill(null).map(() => Array(n + 1).fill(Infinity));
  const path = Array(m + 1).fill(null).map(() => Array(n + 1).fill(null));

  // Caso base
  cost[0][0] = 0;

  // Inicializa bordas (palavras omitidas/extras)
  for (let i = 1; i <= m; i++) {
    cost[i][0] = cost[i - 1][0] + 1; // Palavra esperada omitida
    path[i][0] = { type: 'skip', i: i - 1, j: -1 };
  }

  for (let j = 1; j <= n; j++) {
    cost[0][j] = cost[0][j - 1] + 1; // Palavra falada extra
    path[0][j] = { type: 'extra', i: -1, j: j - 1 };
  }

  // Preenche matriz com alinhamentos possíveis
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const expectedWord = expectedWords[i - 1];
      const spokenWord = spokenWords[j - 1];

      // Opção 1: Match 1:1
      const sim1to1 = calculatePhoneticSimilarity(expectedWord, spokenWord);
      const cost1to1 = cost[i - 1][j - 1] + (1 - sim1to1); // Menor similaridade = maior custo

      // Opção 2: Match 1:2 (se possível)
      let cost1to2 = Infinity;
      if (j >= 2) {
        const spokenPair = `${spokenWords[j - 2]} ${spokenWords[j - 1]}`;
        const sim1to2 = calculatePhoneticSimilarity(expectedWord, spokenPair);
        cost1to2 = cost[i - 1][j - 2] + (1 - sim1to2);
      }

      // Opção 3: Palavra esperada omitida
      const costSkip = cost[i - 1][j] + 1;

      // Opção 4: Palavra falada extra
      const costExtra = cost[i][j - 1] + 1;

      // Escolhe o menor custo
      const minCost = Math.min(cost1to1, cost1to2, costSkip, costExtra);

      cost[i][j] = minCost;

      if (minCost === cost1to2) {
        path[i][j] = { type: '1:2', i: i - 1, j: j - 2, similarity: 1 - (cost1to2 - cost[i - 1][j - 2]) };
      } else if (minCost === cost1to1) {
        path[i][j] = { type: '1:1', i: i - 1, j: j - 1, similarity: sim1to1 };
      } else if (minCost === costSkip) {
        path[i][j] = { type: 'skip', i: i - 1, j };
      } else {
        path[i][j] = { type: 'extra', i, j: j - 1 };
      }
    }
  }

  // Reconstrói alinhamento seguindo o caminho
  const alignments = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    const step = path[i][j];

    if (step.type === '1:1') {
      alignments.unshift({
        expected: expectedWords[step.i],
        spoken: spokenWords[step.j],
        similarity: step.similarity,
        matchType: '1:1'
      });
      i = step.i;
      j = step.j;
    } else if (step.type === '1:2') {
      alignments.unshift({
        expected: expectedWords[step.i],
        spoken: `${spokenWords[step.j]} ${spokenWords[step.j + 1]}`,
        similarity: step.similarity,
        matchType: '1:2'
      });
      i = step.i;
      j = step.j;
    } else if (step.type === 'skip') {
      alignments.unshift({
        expected: expectedWords[step.i],
        spoken: '',
        similarity: 0,
        matchType: 'missing'
      });
      i = step.i;
    } else if (step.type === 'extra') {
      // Palavra extra não corresponde a nenhuma esperada
      // Pode ser ignorada ou marcada
      j = step.j;
    }
  }

  console.log('🏁 DYNAMIC ALIGNMENT COMPLETE');
  console.log('Resultado:', alignments);

  return alignments;
};
export const analyzeWords = (expectedText, spokenText) => {
  const expectedWords = normalizeText(expectedText).split(/\s+/);
  const spokenWords = normalizeText(spokenText).split(/\s+/);

  // 🔄 USA ALINHAMENTO
  const alignments = alignWords(expectedWords, spokenWords);

  const analysis = alignments.map((alignment, index) => {
    const { expected, spoken, similarity: alignedSimilarity } = alignment;

    // ✅ CRUCIAL: Usa a similaridade JÁ CALCULADA no alinhamento
    const finalSimilarity = alignedSimilarity !== undefined
      ? alignedSimilarity
      : calculatePhoneticSimilarity(expected, spoken);

    const isExactMatch = expected.toLowerCase() === spoken.toLowerCase();
    const confidence = Math.round(finalSimilarity * 100);
    const isCorrect = isExactMatch || finalSimilarity >= 0.75;

    const expectedIPA = convertWordToIPA(expected);
    const spokenIPA = spoken ? convertWordToIPA(spoken) : '';

    return {
      expected,
      spoken,
      expectedIPA,
      spokenIPA,
      isCorrect,
      isExactMatch,
      similarity: finalSimilarity,
      confidence,
      position: index
    };
  });

  return analysis;
};
/**
 * Calcula métricas gerais da pronúncia
 * @param {string} expectedText - Texto esperado
 * @param {string} spokenText - Texto falado
 * @returns {Object} - Métricas gerais
 */
export const analyzePronunciation = (expectedText, spokenText) => {
  const wordAnalysis = analyzeWords(expectedText, spokenText);

  const totalWords = wordAnalysis.length;
  const correctWords = wordAnalysis.filter(w => w.isCorrect).length;
  const exactMatches = wordAnalysis.filter(w => w.isExactMatch).length;

  // Confidence médio ponderado
  const averageConfidence = wordAnalysis.reduce((sum, w) => sum + w.confidence, 0) / totalWords;

  // Identifica palavras por nível de confiança
  const problematicWords = wordAnalysis
    .filter(w => w.confidence < 60)
    .map(w => ({
      word: w.expected,
      spoken: w.spoken,
      confidence: w.confidence,
      expectedIPA: w.expectedIPA,
      spokenIPA: w.spokenIPA
    }));

  const goodWords = wordAnalysis
    .filter(w => w.confidence >= 60 && w.confidence < 85)
    .map(w => ({
      word: w.expected,
      confidence: w.confidence
    }));

  const excellentWords = wordAnalysis
    .filter(w => w.confidence >= 85)
    .map(w => ({
      word: w.expected,
      confidence: w.confidence
    }));

  return {
    totalWords,
    correctWords,
    exactMatches,
    accuracy: Math.round((correctWords / totalWords) * 100),
    averageConfidence: Math.round(averageConfidence),
    wordAnalysis,
    problematicWords,
    goodWords,
    excellentWords
  };
};

/**
 * Fonemas problemáticos expandidos com IPA
 */
const PHONEME_CHALLENGES = {
  'θ': { // voiceless th (think)
    graphemes: ['th'],
    name: 'voiceless th',
    commonErrors: ['t', 's', 'f'],
    tip: 'Place tongue between teeth, blow air gently (no voice) (Coloque a língua entre os dentes, sopre o ar suavemente sem voz)',
    examples: ['think', 'three', 'math', 'teeth']
  },
  'ð': { // voiced th (this)
    graphemes: ['th'],
    name: 'voiced th',
    commonErrors: ['d', 'z', 'v'],
    tip: 'Place tongue between teeth, add voice (Coloque a língua entre os dentes, adicione voz)',
    examples: ['this', 'that', 'mother', 'breathe']
  },
  'ɹ': { // r sound
    graphemes: ['r'],
    name: 'American r',
    commonErrors: ['l', 'ʁ'],
    tip: 'Curl tongue back, don\'t touch roof of mouth (Curve a língua para trás, não toque o céu da boca)',
    examples: ['red', 'car', 'three', 'brown']
  },
  'l': {
    graphemes: ['l'],
    name: 'l sound',
    commonErrors: ['r', 'w'],
    tip: 'Touch tip of tongue to ridge behind upper teeth (Toque a ponta da língua na crista atrás dos dentes superiores)',
    examples: ['light', 'ball', 'please', 'cold']
  },
  'v': {
    graphemes: ['v'],
    name: 'v sound',
    commonErrors: ['b', 'f', 'w'],
    tip: 'Upper teeth touch lower lip, add voice (Dentes superiores tocam o lábio inferior, adicione voz)',
    examples: ['very', 'have', 'voice', 'five']
  },
  'w': {
    graphemes: ['w'],
    name: 'w sound',
    commonErrors: ['v', 'u'],
    tip: 'Round lips like whistling, then voice (Arredonde os lábios como para assobiar, depois adicione voz)',
    examples: ['water', 'away', 'sweet', 'wonder']
  },
  'ʃ': { // sh
    graphemes: ['sh', 'ti', 'ci'],
    name: 'sh sound',
    commonErrors: ['s', 'tʃ'],
    tip: 'Lips rounded, tongue behind teeth, push air (Lábios arredondados, língua atrás dos dentes, empurre o ar)',
    examples: ['she', 'fish', 'nation', 'special']
  },
  'ʒ': { // zh
    graphemes: ['s', 'si', 'ge'],
    name: 'zh sound',
    commonErrors: ['z', 'dʒ', 'ʃ'],
    tip: 'Like "sh" but with voice (Como "sh" mas com voz)',
    examples: ['measure', 'vision', 'beige', 'usual']
  },
  'tʃ': { // ch
    graphemes: ['ch', 'tch'],
    name: 'ch sound',
    commonErrors: ['ʃ', 't'],
    tip: 'Start with "t", end with "sh" (Comece com "t", termine com "sh")',
    examples: ['church', 'watch', 'nature', 'future']
  },
  'dʒ': { // j
    graphemes: ['j', 'g', 'dge'],
    name: 'j sound',
    commonErrors: ['tʃ', 'ʒ'],
    tip: 'Start with "d", end with "zh" (Comece com "d", termine com "zh")',
    examples: ['judge', 'magic', 'edge', 'joy']
  }
};

/**
 * Detecta fonemas problemáticos baseado em análise IPA
 * @param {Array} problematicWords - Palavras com baixa confidence
 * @returns {Array} - Dicas específicas
 */
export const getPronunciationTips = (problematicWords) => {
  const tips = [];
  const tipsGiven = new Set();

  problematicWords.forEach(wordData => {
    const { word, expectedIPA, spokenIPA } = wordData;

    // Analisa diferenças no IPA
    if (expectedIPA && !expectedIPA.includes('[')) {
      const cleanExpectedIPA = expectedIPA.replace(/[\/\[\]]/g, '');
      const cleanSpokenIPA = spokenIPA ? spokenIPA.replace(/[\/\[\]]/g, '') : '';

      // Detecta quais fonemas estão faltando ou errados
      const expectedPhonemes = Array.from(cleanExpectedIPA);
      const spokenPhonemes = Array.from(cleanSpokenIPA);

      expectedPhonemes.forEach((phoneme, idx) => {
        const spokenPhoneme = spokenPhonemes[idx];

        // Se o fonema é diferente E está na lista de desafios
        if (phoneme !== spokenPhoneme && PHONEME_CHALLENGES[phoneme]) {
          const key = `${phoneme}-${word}`;

          if (!tipsGiven.has(phoneme)) {
            const challenge = PHONEME_CHALLENGES[phoneme];

            tips.push({
              phoneme,
              name: challenge.name,
              tip: challenge.tip,
              example: word,
              expectedSound: phoneme,
              detectedSound: spokenPhoneme || '(missing)',
              examples: challenge.examples
            });

            tipsGiven.add(phoneme);
          }
        }
      });
    }

    // Fallback: busca por padrões de texto se IPA não disponível
    Object.keys(PHONEME_CHALLENGES).forEach(phoneme => {
      const challenge = PHONEME_CHALLENGES[phoneme];

      challenge.graphemes.forEach(grapheme => {
        if (word.includes(grapheme) && !tipsGiven.has(phoneme)) {
          tips.push({
            phoneme,
            name: challenge.name,
            tip: challenge.tip,
            example: word,
            examples: challenge.examples
          });
          tipsGiven.add(phoneme);
        }
      });
    });
  });

  return tips;
};

/**
 * Gera feedback textual baseado na performance
 * @param {number} accuracy - Porcentagem de acurácia (0-100)
 * @returns {Object} - Feedback com mensagem e emoji
 */
export const generateFeedback = (accuracy) => {
  if (accuracy >= 90) {
    return {
      level: 'excellent',
      message: 'Outstanding! Your pronunciation is excellent!',
      emoji: '🌟',
      color: 'green'
    };
  } else if (accuracy >= 80) {
    return {
      level: 'great',
      message: 'Great job! Keep up the good work!',
      emoji: '🎉',
      color: 'green'
    };
  } else if (accuracy >= 70) {
    return {
      level: 'good',
      message: 'Good effort! A bit more practice will help!',
      emoji: '👍',
      color: 'blue'
    };
  } else if (accuracy >= 60) {
    return {
      level: 'fair',
      message: 'Fair attempt! Focus on the highlighted words.',
      emoji: '💪',
      color: 'yellow'
    };
  } else {
    return {
      level: 'needs-practice',
      message: 'Keep practicing! Focus on listening carefully.',
      emoji: '🎯',
      color: 'orange'
    };
  }
};