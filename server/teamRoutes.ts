import { Router } from "express";
import { storage } from "./storage";
import { insertTeamSchema } from "@shared/schema";

const router = Router();

// Get all teams
router.get("/", async (_req, res) => {
  try {
    const teams = await storage.getTeams();
    res.json(teams);
  } catch (error) {
    console.error("Failed to fetch teams:", error);
    res.status(500).json({ message: "Failed to fetch teams" });
  }
});

// Get specific team
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid team ID" });
  }

  try {
    const team = await storage.getTeam(id);
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }
    res.json(team);
  } catch (error) {
    console.error("Failed to fetch team:", error);
    res.status(500).json({ message: "Failed to fetch team" });
  }
});

// Create team
router.post("/", async (req, res) => {
  const result = insertTeamSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: result.error.message });
  }

  try {
    const team = await storage.createTeam(result.data);
    res.status(201).json(team);
  } catch (error) {
    console.error("Failed to create team:", error);
    res.status(500).json({ message: "Failed to create team" });
  }
});

// Update team
router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid team ID" });
  }

  const result = insertTeamSchema.partial().safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: result.error.message });
  }

  try {
    const team = await storage.updateTeam(id, result.data);
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }
    res.json(team);
  } catch (error) {
    console.error("Failed to update team:", error);
    res.status(500).json({ message: "Failed to update team" });
  }
});

// Delete team
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid team ID" });
  }

  try {
    await storage.deleteTeam(id);
    res.status(204).send();
  } catch (error) {
    console.error("Failed to delete team:", error);
    res.status(500).json({ message: "Failed to delete team" });
  }
});

// Get team members
router.get("/:teamId/members", async (req, res) => {
  const teamId = parseInt(req.params.teamId);
  if (isNaN(teamId)) {
    return res.status(400).json({ message: "Invalid team ID" });
  }

  try {
    console.log(`Fetching members for team ${teamId}`);
    const teamMembers = await storage.getTeamMembers(teamId);

    // Get full user details for each team member
    const members = await Promise.all(
      teamMembers.map(async (tm) => {
        const user = await storage.getUser(tm.userId);
        const { passwordHash, ...userWithoutPassword } = user;
        return userWithoutPassword;
      })
    );

    console.log(`Found ${members.length} members for team ${teamId}`);
    res.json(members);
  } catch (error) {
    console.error(`Error fetching team members for team ${teamId}:`, error);
    res.status(500).json({ message: "Failed to fetch team members" });
  }
});

// Get team objectives
router.get("/:teamId/objectives", async (req, res) => {
  const teamId = parseInt(req.params.teamId);
  if (isNaN(teamId)) {
    return res.status(400).json({ message: "Invalid team ID" });
  }

  try {
    console.log(`Fetching objectives for team ${teamId}`);
    const objectives = await storage.getObjectivesByTeam(teamId);
    console.log(`Found ${objectives.length} objectives`);
    res.json(objectives);
  } catch (error) {
    console.error("Failed to fetch team objectives:", error);
    res.status(500).json({ message: "Failed to fetch team objectives" });
  }
});

// Get team boards
router.get("/:teamId/boards", async (req, res) => {
  const teamId = parseInt(req.params.teamId);
  if (isNaN(teamId)) {
    return res.status(400).json({ message: "Invalid team ID" });
  }

  try {
    console.log(`Fetching boards for team ${teamId}`);
    const boards = await storage.getBoardsByTeam(teamId);
    console.log(`Found ${boards.length} boards`);
    res.json(boards);
  } catch (error) {
    console.error("Failed to fetch team boards:", error);
    res.status(500).json({ message: "Failed to fetch team boards" });
  }
});

export default router;