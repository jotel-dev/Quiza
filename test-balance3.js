import { getWalletBalances } from './src/lib/quizaContract.js';
getWalletBalances(null, '0x31846b45a0b77A4bc1b54aA6f31613A884707Bb7'.toLowerCase(), 'alfajores')
  .then(console.log)
  .catch(console.error);
