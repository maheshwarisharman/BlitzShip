import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const caPath = path.join(__dirname, 'certs', 'ca.pem')

const connectionString = process.env.DATABASE_URL!

const adapter = new PrismaPg({
    connectionString,
    ssl: {
        ca: fs.readFileSync(caPath, 'utf8'),
        rejectUnauthorized: true,
    },
})

const prisma = new PrismaClient({ adapter })

export { prisma }