// api/analyze-pronunciation.js
// Vercel Serverless Function - Modular Pronunciation Analysis

import fetch from 'node-fetch';
import FormData from 'form-data';

// Importa as funções dos outros módulos
import { convertTextToIPA, convertWordToIPA, getIPACoverage } from './ipaConverter.js';
import {
  analyzeWords,
  analyzePronunciation,
  getPronunciationTips,
  generateFeedback
} from './phonemeAnalyzer.js';

// Importa Firebase config para buscar frases
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, query, where, getDocs } from 'firebase/firestore';

/**
 * ========================================
 * FIREBASE CONFIGURATION
 * ========================================
 */
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAt2pGCDu7UgdRBGvOFb98jwdUNE_vydiI",
  authDomain: "learnfun-2e26f.firebaseapp.com",
  projectId: "learnfun-2e26f",
  storageBucket: "learnfun-2e26f.firebasestorage.app",
  messagingSenderId: "620241304009",
  appId: "1:620241304009:web:0ba10caafa660e99a89018"
};

let db = null;

const initFirebase = () => {
  if (!db) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
  return db;
};

/**
 * ========================================
 * PHRASE REPOSITORY
 * ========================================
 */
class PhraseRepository {
  static async getPhraseById(phraseId) {
    try {
      const db = initFirebase();
      const phraseRef = doc(db, 'phrases', phraseId);
      const phraseSnap = await getDoc(phraseRef);

      if (phraseSnap.exists()) {
        return {
          id: phraseSnap.id,
          ...phraseSnap.data()
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching phrase:', error);
      return null;
    }
  }

  static async getRandomPhrase(difficulty = null, environment = 'production') {
    try {
      const db = initFirebase();
      let q = collection(db, 'phrases');

      // Filtra por dificuldade se fornecida
      if (difficulty) {
        q = query(q, where('difficulty', '==', difficulty));
      }

      // Filtra por ambiente (production apenas em produção)
      if (environment === 'production') {
        q = query(q, where('environment', '!=', 'development'));
      }

      const querySnapshot = await getDocs(q);
      const phrases = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (phrases.length === 0) {
        return null;
      }

      // Retorna frase aleatória
      const randomIndex = Math.floor(Math.random() * phrases.length);
      return phrases[randomIndex];

    } catch (error) {
      console.error('Error fetching random phrase:', error);
      return null;
    }
  }
}

/**
 * ========================================
 * TRANSCRIPTION SERVICE - WIT.AI
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
          'Content-Type': 'audio/ogg',
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
        confidence: data.traits ? 1.0 : 0.8,
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
 * MAIN HANDLER
 * ========================================
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ========================================
  // GET - Buscar Frase
  // ========================================
  if (req.method === 'GET') {
    try {
      const { phraseId, difficulty, random } = req.query;

      // Busca frase específica por ID
      if (phraseId) {
        const phrase = await PhraseRepository.getPhraseById(phraseId);

        if (!phrase) {
          return res.status(404).json({
            success: false,
            error: 'Phrase not found'
          });
        }

        // Adiciona IPA se a frase não tiver
        if (!phrase.ipa && phrase.text) {
          phrase.ipa = convertTextToIPA(phrase.text);
          phrase.ipaCoverage = getIPACoverage(phrase.text);
        }

        return res.status(200).json({
          success: true,
          phrase
        });
      }

      // Busca frase aleatória
      if (random === 'true') {
        const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
        const phrase = await PhraseRepository.getRandomPhrase(difficulty, environment);

        if (!phrase) {
          return res.status(404).json({
            success: false,
            error: 'No phrases found'
          });
        }

        // Adiciona IPA
        if (!phrase.ipa && phrase.text) {
          phrase.ipa = convertTextToIPA(phrase.text);
          phrase.ipaCoverage = getIPACoverage(phrase.text);
        }

        return res.status(200).json({
          success: true,
          phrase
        });
      }

      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: phraseId or random=true'
      });

    } catch (error) {
      console.error('GET Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch phrase',
        details: error.message
      });
    }
  }

  // ========================================
  // POST - Analisar Pronúncia
  // ========================================
  if (req.method === 'POST') {
    try {
      const { audio, expectedText, phraseId } = req.body;

      // Validação
      if (!audio) {
        return res.status(400).json({
          success: false,
          error: 'Audio is required'
        });
      }

      // Determina o texto esperado
      let expected = expectedText;
      let phraseData = null;

      if (phraseId) {
        phraseData = await PhraseRepository.getPhraseById(phraseId);
        if (phraseData) {
          expected = phraseData.text;
        }
      }

      if (!expected) {
        return res.status(400).json({
          success: false,
          error: 'Expected text or valid phraseId is required'
        });
      }

      // Converte base64 para Buffer
      const audioBuffer = Buffer.from(audio, 'base64');

      // 1. Transcreve com Wit.ai
      const witToken = process.env.WIT_AI_TOKEN;
      if (!witToken) {
        return res.status(500).json({
          success: false,
          error: 'WIT_AI_TOKEN not configured'
        });
      }

      const witService = new WitAIService(witToken);
      const transcription = await witService.transcribe(audioBuffer);

      if (!transcription.isSuccess) {
        return res.status(200).json({
          success: false,
          error: 'Could not transcribe audio. Please speak clearly and try again.',
          transcription: transcription.text
        });
      }

      // 2. Analisa pronúncia usando phonemeAnalyzer
      const analysis = analyzePronunciation(expected, transcription.text);

      // 3. Gera feedback
      const feedback = generateFeedback(analysis.accuracy);

      // 4. Obtém dicas de pronúncia
      const tips = getPronunciationTips(analysis.problematicWords);

      // 5. Adiciona IPA para referência
      const expectedIPA = convertTextToIPA(expected);
      const spokenIPA = convertTextToIPA(transcription.text);
      const ipaCoverage = getIPACoverage(expected);

      // 6. Retorna resultado completo
      return res.status(200).json({
        success: true,
        transcription: transcription.text,
        transcriptionConfidence: transcription.confidence,

        analysis: {
          ...analysis,
          feedback,
          tips,
        },

        ipa: {
          expected: expectedIPA,
          spoken: spokenIPA,
          coverage: ipaCoverage
        },

        phrase: phraseData
      });

    } catch (error) {
      console.error('POST Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Analysis failed',
        details: error.message
      });
    }
  }

  // Método não permitido
  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
}

/**
 * ========================================
 * HELPER: GET PHRASE (Endpoint separado opcional)
 * ========================================
 */
export async function getPhrase(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phraseId, difficulty } = req.query;

    if (phraseId) {
      const phrase = await PhraseRepository.getPhraseById(phraseId);
      return res.status(200).json({ success: true, phrase });
    }

    const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    const phrase = await PhraseRepository.getRandomPhrase(difficulty, environment);

    return res.status(200).json({ success: true, phrase });

  } catch (error) {
    console.error('getPhrase Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch phrase',
      details: error.message
    });
  }
}