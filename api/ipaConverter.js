// src/utils/ipaConverter.js

// Importa o dicionário completo CMU
import { CMU_DICTIONARY_IPA } from './cmuDictionaryIPA.js';

/**
 * Converte texto em inglês para IPA
 * @param {string} text - Texto para converter
 * @returns {string} - Texto em IPA
 */
export const convertTextToIPA = (text) => {
  if (!text) return '';

  const words = text.toLowerCase()
    .replace(/[.,!?;:—\-''""]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0);

  const ipaWords = words.map(word => {
    // Busca no dicionário CMU completo
    if (CMU_DICTIONARY_IPA[word]) {
      return CMU_DICTIONARY_IPA[word];
    }

    // Fallback: retorna a palavra original entre colchetes
    return `[${word}]`;
  });

  return ipaWords.join(' ');
};

/**
 * Verifica se uma palavra tem tradução IPA disponível
 * @param {string} word - Palavra para verificar
 * @returns {boolean}
 */
export const hasIPATranslation = (word) => {
  if (!word) return false;
  return !!CMU_DICTIONARY_IPA[word.toLowerCase()];
};

/**
 * Calcula a porcentagem de palavras que têm tradução IPA
 * @param {string} text - Texto para analisar
 * @returns {number} - Porcentagem (0-100)
 */
export const getIPACoverage = (text) => {
  if (!text) return 0;

  const words = text.toLowerCase()
    .replace(/[.,!?;:—\-''""]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0);

  if (words.length === 0) return 0;

  const wordsWithIPA = words.filter(word => hasIPATranslation(word)).length;

  return Math.round((wordsWithIPA / words.length) * 100);
};

/**
 * Converte uma única palavra para IPA
 * @param {string} word - Palavra para converter
 * @returns {string} - Palavra em IPA
 */
export const convertWordToIPA = (word) => {
  if (!word) return '';

  const lowerWord = word.toLowerCase();

  if (CMU_DICTIONARY_IPA[lowerWord]) {
    return CMU_DICTIONARY_IPA[lowerWord];
  }

  return word;
};

/**
 * Retorna estatísticas sobre o dicionário
 * @returns {object}
 */
export const getDictionaryStats = () => {
  return {
    totalWords: Object.keys(CMU_DICTIONARY_IPA).length,
    version: 'CMU Pronouncing Dictionary',
  };
};