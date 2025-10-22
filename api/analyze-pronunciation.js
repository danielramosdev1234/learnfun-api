// api/analyze-pronunciation.js
// Vercel Serverless Function

import fetch from 'node-fetch';
import FormData from 'form-data';

/**
 * ========================================
 * SERVIÇO DE TRANSCRIÇÃO - WIT.AI
 * ========================================
 */
class WitAIService {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.apiUrl = 'https://api.wit.ai/speech';
  }

  async transcribe(audioBuffer) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'audio/ogg', // WhatsApp usa OGG
          'Transfer-Encoding': 'chunked'
        },
        body: audioBuffer
      });

      if (!response.ok) {
        throw new Error(`Wit.ai error: ${response.status}`);
      }

      const data = await response.json();

      return {
        text: data.text || '',
        confidence: data.traits ? 1.0 : 0.8, // Wit.ai não retorna confidence direto
        isSuccess: data.text && data.text.length > 0
      };

    } catch (error) {
      console.error('Wit.ai transcription error:', error);
      throw error;
    }
  }
}

/**
 * ========================================
 * LÓGICA DE ANÁLISE DE PRONÚNCIA
 * (Extraída do seu código React)
 * ========================================
 */
class PronunciationAnalyzer {

  /**
   * Analisa a pronúncia comparando texto esperado vs transcrito
   */
  analyze(expectedText, userTranscript) {
    const expected = this.normalize(expectedText);
    const user = this.normalize(userTranscript);

    const expectedWords = expected.split(/\s+/);
    const userWords = user.split(/\s+/);

    const wordAnalysis = [];
    let correctCount = 0;

    // Análise palavra por palavra
    for (let i = 0; i < expectedWords.length; i++) {
      const expectedWord = expectedWords[i];
      const userWord = userWords[i] || null;

      const result = this.compareWords(expectedWord, userWord);
      wordAnalysis.push(result);

      if (result.status === 'correct') {
        correctCount++;
      }
    }

    // Calcula acurácia geral
    const accuracy = Math.round((correctCount / expectedWords.length) * 100);

    return {
      overall: {
        expected: expectedText,
        userSaid: userTranscript,
        accuracy: accuracy,
        status: this.getStatus(accuracy)
      },
      wordByWord: wordAnalysis
    };
  }

  /**
   * Compara duas palavras
   */
  compareWords(expected, user) {
    if (!user) {
      return {
        expected: expected,
        userSaid: '(not detected)',
        status: 'missing',
        confidence: 0
      };
    }

    if (expected === user) {
      return {
        expected: expected,
        userSaid: user,
        status: 'correct',
        confidence: 100
      };
    }

    // Calcula similaridade
    const similarity = this.calculateSimilarity(expected, user);

    if (similarity > 0.8) {
      return {
        expected: expected,
        userSaid: user,
        status: 'similar',
        confidence: Math.round(similarity * 100)
      };
    }

    return {
      expected: expected,
      userSaid: user,
      status: 'wrong',
      confidence: Math.round(similarity * 100)
    };
  }

  /**
   * Normaliza texto (remove acentos, lowercase, trim)
   */
  normalize(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  /**
   * Calcula similaridade entre strings (Levenshtein)
   */
  calculateSimilarity(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Distância de Levenshtein
   */
  levenshteinDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  /**
   * Retorna status baseado na acurácia
   */
  getStatus(accuracy) {
    if (accuracy >= 80) return 'excellent';
    if (accuracy >= 60) return 'good';
    if (accuracy >= 40) return 'needsPractice';
    return 'poor';
  }

  /**
   * Gera dicas de pronúncia baseadas nos erros
   */
  generateTips(wordAnalysis) {
    const tips = [];

    wordAnalysis.forEach(word => {
      if (word.status === 'wrong' || word.status === 'similar') {
        tips.push({
          word: word.expected,
          issue: `You said "${word.userSaid}" but it should be "${word.expected}"`,
          tip: this.getPhoneticTip(word.expected)
        });
      } else if (word.status === 'missing') {
        tips.push({
          word: word.expected,
          issue: `The word "${word.expected}" was not detected`,
          tip: 'Try to speak more clearly and at a moderate pace'
        });
      }
    });

    return tips.slice(0, 3); // Máximo 3 dicas
  }

  /**
   * Gera dica fonética (simplificada)
   */
  getPhoneticTip(word) {
    // Aqui você pode integrar com seu IPA converter se quiser
    const tips = {
      'hello': 'Pronounce: /həˈloʊ/ - Start with soft "h", end with "low"',
      'how': 'Pronounce: /haʊ/ - Like "h" + "ow" in "cow"',
      'are': 'Pronounce: /ɑr/ - Open mouth, "ar" sound',
      'you': 'Pronounce: /ju/ - Quick "y" sound + "oo"',
    };

    return tips[word.toLowerCase()] || `Focus on pronouncing "${word}" clearly`;
  }
}

/**
 * ========================================
 * REPOSITÓRIO DE FRASES
 * (Reutilizado do seu projeto React)
 * ========================================
 */
const PHRASES = [
  {
    id: 1,
    text: "Hello, how are you?",
    difficulty: 'easy',
    ipa: '/həˈloʊ haʊ ɑr ju/',
    translation: 'Olá, como você está?'
  },
  {
    id: 2,
    text: "I'm learning English",
    difficulty: 'easy',
    ipa: '/aɪm ˈlɜrnɪŋ ˈɪŋɡlɪʃ/',
    translation: 'Estou aprendendo inglês'
  },
  {
    id: 3,
    text: "The weather is beautiful today",
    difficulty: 'medium',
    ipa: '/ðə ˈwɛðər ɪz ˈbjutəfəl təˈdeɪ/',
    translation: 'O tempo está lindo hoje'
  },
  {
    id: 4,
    text: "I would like to order a coffee",
    difficulty: 'medium',
    ipa: '/aɪ wʊd laɪk tu ˈɔrdər ə ˈkɔfi/',
    translation: 'Eu gostaria de pedir um café'
  },
  {
    id: 5,
    text: "Could you please repeat that?",
    difficulty: 'medium',
    ipa: '/kʊd ju pliz rɪˈpit ðæt/',
    translation: 'Você poderia repetir isso, por favor?'
  },
  {
    id: 6,
    text: "Pronunciation practice is important",
    difficulty: 'hard',
    ipa: '/prəˌnʌnsiˈeɪʃən ˈpræktɪs ɪz ɪmˈpɔrtənt/',
    translation: 'Prática de pronúncia é importante'
  },
];

function getRandomPhrase(difficulty = null) {
  const filtered = difficulty
    ? PHRASES.filter(p => p.difficulty === difficulty)
    : PHRASES;

  return filtered[Math.floor(Math.random() * filtered.length)];
}

function getPhraseById(id) {
  return PHRASES.find(p => p.id === id);
}

/**
 * ========================================
 * HANDLER DA API VERCEL
 * ========================================
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
      const { difficulty, phraseId } = req.query;

      if (phraseId) {
        const phrase = getPhraseById(parseInt(phraseId));
        return res.status(200).json({ success: true, phrase });
      }

      const phrase = getRandomPhrase(difficulty);
      return res.status(200).json({ success: true, phrase });
    }

  if (req.method !== 'POST' || req.method !== 'GET' ) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audio, expectedText, phraseId } = req.body;

    // Validação
    if (!audio) {
      return res.status(400).json({ error: 'Audio is required' });
    }

    // Se phraseId foi fornecido, busca a frase
    let expected = expectedText;
    let phraseData = null;

    if (phraseId) {
      phraseData = getPhraseById(phraseId);
      if (phraseData) {
        expected = phraseData.text;
      }
    }

    if (!expected) {
      return res.status(400).json({ error: 'Expected text or phraseId is required' });
    }

    // Converte base64 para Buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // 1. Transcreve com Wit.ai
    const witService = new WitAIService(process.env.WIT_AI_TOKEN);
    const transcription = await witService.transcribe(audioBuffer);

    if (!transcription.isSuccess) {
      return res.status(200).json({
        success: false,
        error: 'Could not transcribe audio. Please try again.'
      });
    }

    // 2. Analisa pronúncia
    const analyzer = new PronunciationAnalyzer();
    const analysis = analyzer.analyze(expected, transcription.text);
    const tips = analyzer.generateTips(analysis.wordByWord);

    // 3. Retorna resultado
    return res.status(200).json({
      success: true,
      transcription: transcription.text,
      analysis: analysis,
      tips: tips,
      phrase: phraseData
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}

/**
 * ========================================
 * ENDPOINT AUXILIAR: GET RANDOM PHRASE
 * ========================================
 */
export async function getPhrase(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { difficulty } = req.query;
  const phrase = getRandomPhrase(difficulty);

  return res.status(200).json({
    success: true,
    phrase
  });
}