require('dotenv').config();
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✅ Presente' : '❌ Ausente');
console.log('OWNER_NUMBER:', process.env.OWNER_NUMBER || 'Não configurado');
