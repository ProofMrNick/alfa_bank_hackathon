import express from 'express'
import cors from 'cors'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/authRoutes.js'
import applicationsRoutes from './routes/applicationsRoutes.js'
import productsRoutes from './routes/productsRoutes.js'
import recommendationsRoutes from './routes/recommendationsRoutes.js'
import clientRoutes from './routes/clientRoutes.js'
import bankRoutes from './routes/bankRoutes.js'
import healthRoutes from './routes/healthRoutes.js'
import mocksRoutes from './routes/mocksRoutes.js'
import authMiddleware from './middleware/authMiddleware.js'
import fill_db from './fill_db.js'
const app = express()
const PORT = process.env.PORT || 5003

// Get the file path from the URL of the current module
const __filename = fileURLToPath(import.meta.url)
// Get the directory name from the file path
const __dirname = dirname(__filename)

// разрешить запросы с фронта
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));


// Middleware
app.use(express.json())
app.use(express.static(path.join(__dirname, '../public')))


// Routes
app.use('/api/applications',  authMiddleware("CLIENT"), applicationsRoutes) // private route, auth required, return middleware back
app.use('/api/client', authMiddleware("CLIENT"), clientRoutes) // private route, auth required, return middleware back
app.use('/api/recommendations', authMiddleware("CLIENT"), recommendationsRoutes) // private route, auth required, return middleware back
app.use('/api/bank', authMiddleware("EMPLOYEE"), bankRoutes) // private route, auth required, return middleware back

app.use('/api/auth', authRoutes)
app.use('/api/products', productsRoutes) // public route, no auth required

app.use('/api/mocks', mocksRoutes)
app.use('/api/health', healthRoutes)

app.listen(PORT, () => {
    console.log(`Server has started on port: ${PORT}`)


    fill_db()

    setTimeout(async () => {
            const { simulateActivity } = await import('./simulateActivity.js');
            await simulateActivity();
        }, 1500);
})
