import { Router } from "express";
import {prisma} from "@repo/db"

const router: Router = Router()

export default router

router.get('/search/:domain_url', async (req, res) => {
    const domain_url: string = req.params.domain_url as string
    console.log(domain_url);
    

    try {
        const result = await prisma.domain.findUnique({
            where: {
                domain_url
            }
        })

        if(result) {
            return res.status(404).json({
                message: "Domain Url Already Taken"
            })
        }

        res.status(200).json({
            message: "Domain is Available"
        })
    } catch (e) {
        console.log(e)
        res.status(500).json({
            message: "Some error occured in DB",
            error: e
        })
    }


})