import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { getRates } from './services/exchangeRate.js'
import pricesRouter from './routes/prices.js'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/exchange-rate', async (req, res) => {
  const rates = await getRates()
  res.json(rates)
})

app.use('/api/prices', pricesRouter)

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`)
})
