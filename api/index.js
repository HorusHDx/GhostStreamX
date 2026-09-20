// Punto de entrada de la Serverless Function en Vercel.
// Vercel (sistema por defecto, sin "builds") solo convierte en funciones a los
// archivos que viven dentro de /api. Todo el backend real está en server/ y se
// importa desde acá; api/index.js es el ÚNICO archivo en /api, así que se crea
// una sola función (configurada en vercel.json con maxDuration).
import app from '../server/index.js'

export default app