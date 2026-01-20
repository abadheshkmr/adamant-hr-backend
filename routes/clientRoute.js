import express from "express";
import { addClient, getClient, listClients, updateClient, removeClient } from "../controllers/clientController.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const clientRouter = express.Router();

// All client routes require admin authentication
clientRouter.post("/add", verifyAdmin, addClient);
clientRouter.get("/get/:id", verifyAdmin, getClient);
clientRouter.get("/list", verifyAdmin, listClients);
clientRouter.put("/update", verifyAdmin, updateClient);
clientRouter.post("/remove", verifyAdmin, removeClient);

export default clientRouter;
