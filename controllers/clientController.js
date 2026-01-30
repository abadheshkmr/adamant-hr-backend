import ClientModel from "../models/clientModel.js";
import vacancyModel from "../models/vacancyModel.js";

/**
 * Add Client
 * 
 * Creates a new client/company record
 */
const addClient = async (req, res) => {
  try {
    const client = new ClientModel({
      name: req.body.name,
      description: req.body.description,
      contactPerson: req.body.contactPerson,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      website: req.body.website,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      companyId: req.body.companyId || null
    });

    await client.save();
    res.json({ success: true, message: "Client added successfully", data: client });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Add Client Error:`, error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: "Client with this name already exists" 
      });
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message).join(', ');
      return res.status(400).json({ 
        success: false, 
        message: `Validation error: ${errors}` 
      });
    }
    
    res.status(500).json({ success: false, message: "Error adding client", error: error.message });
  }
};

/**
 * Get Client by ID
 * 
 * Returns client details with vacancy count
 */
const getClient = async (req, res) => {
  try {
    const client = await ClientModel.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }
    
    // Get vacancy count for this client
    const vacancyCount = await vacancyModel.countDocuments({ client: client._id });
    
    res.json({ 
      success: true, 
      data: {
        ...client.toObject(),
        vacancyCount
      }
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Get Client Error:`, error);
    res.status(500).json({ success: false, message: "Error fetching client" });
  }
};

/**
 * List all Clients
 * 
 * Returns all clients with optional filtering
 */
const listClients = async (req, res) => {
  try {
    const filter = {};
    
    // Filter by active status
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }
    
    // Search by name
    if (req.query.search) {
      filter.name = new RegExp(req.query.search, 'i');
    }
    
    const clients = await ClientModel.find(filter)
      .sort({ name: 1 })
      .lean();
    
    // Get vacancy count for each client
    const clientsWithCounts = await Promise.all(
      clients.map(async (client) => {
        const vacancyCount = await vacancyModel.countDocuments({ client: client._id });
        return {
          ...client,
          vacancyCount
        };
      })
    );
    
    res.json({ success: true, data: clientsWithCounts });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] List Clients Error:`, error);
    res.status(500).json({ success: false, message: "Error fetching clients" });
  }
};

/**
 * Update Client
 * 
 * Updates client information
 */
const updateClient = async (req, res) => {
  try {
    const { id, ...updateData } = req.body;
    
    if (!id) {
      return res.status(400).json({ success: false, message: "Client ID is required" });
    }
    
    const client = await ClientModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }
    
    res.json({ success: true, message: "Client updated successfully", data: client });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Update Client Error:`, error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: "Client with this name already exists" 
      });
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message).join(', ');
      return res.status(400).json({ 
        success: false, 
        message: `Validation error: ${errors}` 
      });
    }
    
    res.status(500).json({ success: false, message: "Error updating client", error: error.message });
  }
};

/**
 * Remove Client
 * 
 * Deletes client (only if no vacancies are associated)
 */
const removeClient = async (req, res) => {
  try {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ success: false, message: "Client ID is required" });
    }
    
    // Check if client has associated vacancies
    const vacancyCount = await vacancyModel.countDocuments({ client: id });
    
    if (vacancyCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete client. ${vacancyCount} vacancy/vacancies are associated with this client. Please remove or reassign vacancies first.` 
      });
    }
    
    const client = await ClientModel.findByIdAndDelete(id);
    
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }
    
    res.json({ success: true, message: "Client removed successfully" });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Remove Client Error:`, error);
    res.status(500).json({ success: false, message: "Error removing client", error: error.message });
  }
};

export { addClient, getClient, listClients, updateClient, removeClient };
