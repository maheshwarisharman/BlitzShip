import express, { Express, Request, Response, Router } from "express";
import cors from 'cors'
import {prisma} from '@repo/db'

//v1 Routes
import githubRoutes from './routes/githubRoutes.js'
import deployProjectRoutes from './routes/deployProject.js'
import domainRoutes from './routes/domainRoutes.js'

const app: Express = express()
app.use(cors())
app.use(express.json())


app.get("/health", async (req: Request, res: Response) => {
    res.json({
        status: "ok",
        message: "Server is healthy"
    })
});

app.post('/add-user', async (req, res) => {
    try {

        const user = await prisma.user.create({
            data: {
                email: req.body.email,
                name: req.body.name,
                github_username: null,
                github_user_id: null,
                github_installation_id: null
            }
        })
        res.status(200).json({
            message: "User added successfully",
            data: user
        })
    } catch (e) {
        res.status(500).json({
            message: "Some Error Occuered",
            error: e
        })
    }
})

app.use('/github', githubRoutes)
app.use('/deploy', deployProjectRoutes)
app.use('/domain', domainRoutes)

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});