import { Router } from "express";
import { prisma } from "@repo/db"
import { getAuth } from "@clerk/express"

const router: Router = Router()
    
router.get('/all', async (req, res) => {
    const auth = getAuth(req);
    const clerkUserId = auth.userId;


    console.log("Clerk Id", clerkUserId)

    if (!clerkUserId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }
                                                                                        
    try {
        const projects = await prisma.project.findMany({
            where: {
                user_id: clerkUserId
            }
        })                                  
        res.status(200).json({
            message: "Projects fetched successfully",
            data: projects
        })
    } catch (e) {
        console.log(e)
        res.status(500).json({
            message: "Some error occured",
            error: e
        })
    }
})

router.post('/single', async (req, res) => {
    const auth = getAuth(req);
    const clerkUserId = auth.userId;

    if (!clerkUserId) {
        return res.status(401).json({
            message: "Unauthorized",
        });
    }

    if(!req.body.project_id) {
        return res.status(401).json({
            message: "project_id is required"
        })
    }

    try {
        const project = await prisma.project.findUnique({
            where: {
                project_id: req.body.project_id
            }
        })
        if(project?.user_id !== clerkUserId) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        res.status(200).json({
            message: "Project fetched successfully",
            data: project
        })
    } catch (e) {
        console.log(e)
        res.status(500).json({
            message: "Some error occured",
            error: e
        })
    }
})


router.delete('/delete', async (req, res) => {

    try {
        const project = await prisma.project.delete({
            where: {
                project_id: req.body.project_id
            }
        })
        res.status(200).json({
            message: "Project deleted successfully",
            data: project
        })
    } catch (e) {
        console.log(e)
        res.status(500).json({
            message: "Some error occured",
            error: e
        })
    }
})

export default router