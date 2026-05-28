const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../database');

/**
 * @swagger
 * /menu:
 *   get:
 *     summary: Get menu for user role
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Menu items
 */
router.get('/', authenticateToken, async (req, res) => {
  const { userId } = req.query;

  try {
    // Migración automática para asegurar el orden exacto (Drag and Drop)
    try { await db.runAsync('ALTER TABLE menus ADD COLUMN order_index INTEGER DEFAULT 0'); } catch(e) {}

    // Get user role
    const user = await db.getAsync('SELECT role FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userRole = user.role.toLowerCase();

    // Get menus for role
    const menus = await db.allAsync('SELECT id, key, name, icon, path, parent_key FROM menus WHERE roles LIKE ? ORDER BY order_index ASC, id ASC', [`%${userRole}%`]);

    // Build hierarchy
    const menuMap = {};
    const rootMenus = [];

    // Create all menu items
    menus.forEach(menu => {
      menuMap[menu.key] = {
        id: menu.key,
        icon: menu.icon,
        label: menu.name,
        path: menu.path,
        children: []
      };
    });

    // Assign children to parents
    menus.forEach(menu => {
      if (menu.parent_key) {
        if (menuMap[menu.parent_key]) {
          menuMap[menu.parent_key].children.push(menuMap[menu.key]);
        }
      } else {
        rootMenus.push(menuMap[menu.key]);
      }
    });

    res.json(rootMenus);
  } catch (err) {
    console.error('Error fetching menu:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /menu/all:
 *   get:
 *     summary: Get all menu items for administration
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All menu items
 */
router.get('/all', authenticateToken, async (req, res) => {
  try {
    // Migración automática para asegurar el orden exacto (Drag and Drop)
    try { await db.runAsync('ALTER TABLE menus ADD COLUMN order_index INTEGER DEFAULT 0'); } catch(e) {}

    const menus = await db.allAsync('SELECT id, key, name, icon, path, parent_key, roles FROM menus ORDER BY order_index ASC, id ASC');

    // Build hierarchy
    const menuMap = {};
    const rootMenus = [];

    // Create all menu items
    menus.forEach(menu => {
      const roles = menu.roles ? menu.roles.split(',').map(r => r.trim()) : [];
      menuMap[menu.key] = {
        id: menu.key,
        icon: menu.icon,
        label: menu.name,
        path: menu.path,
        requiredRoles: roles,
        children: []
      };
    });

    // Assign children to parents
    menus.forEach(menu => {
      if (menu.parent_key) {
        if (menuMap[menu.parent_key]) {
          menuMap[menu.parent_key].children.push(menuMap[menu.key]);
        }
      } else {
        rootMenus.push(menuMap[menu.key]);
      }
    });

    res.json(rootMenus);
  } catch (err) {
    console.error('Error fetching all menu items:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /menu:
 *   post:
 *     summary: Create a new menu item
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - label
 *               - icon
 *               - roles
 *             properties:
 *               label:
 *                 type: string
 *               icon:
 *                 type: string
 *               path:
 *                 type: string
 *               parentId:
 *                 type: string
 *               requiredRoles:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Menu item created
 */
router.post('/', authenticateToken, async (req, res) => {
  const { label, icon, path, parentId, requiredRoles } = req.body;

  if (!label || !icon || !requiredRoles) {
    return res.status(400).json({ error: 'Label, icon and roles are required' });
  }

  try {
    // Generate unique key
    const key = `menu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const rolesStr = Array.isArray(requiredRoles) ? requiredRoles.join(',') : requiredRoles;

    const result = await db.runAsync(
      'INSERT INTO menus (key, name, icon, path, parent_key, roles) VALUES (?, ?, ?, ?, ?, ?)',
      [key, label, icon, path || null, parentId || null, rolesStr]
    );

    const newMenu = await db.getAsync('SELECT id, key, name, icon, path, parent_key, roles FROM menus WHERE id = ?', [result.lastID]);

    const roles = newMenu.roles ? newMenu.roles.split(',').map(r => r.trim()) : [];
    const response = {
      id: newMenu.key,
      icon: newMenu.icon,
      label: newMenu.name,
      path: newMenu.path,
      requiredRoles: roles,
      children: []
    };

    res.status(201).json(response);
  } catch (err) {
    console.error('Error creating menu item:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /menu/structure:
 *   put:
 *     summary: Update menu structure (Drag and Drop ordering)
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *     responses:
 *       200:
 *         description: Structure updated
 */
router.put('/structure', authenticateToken, async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Items array is required' });
    try { await db.runAsync('ALTER TABLE menus ADD COLUMN order_index INTEGER DEFAULT 0'); } catch(e) {}

    const updates = [];
    const flatten = (nodes, parentId = null) => {
      nodes.forEach((node, index) => {
        updates.push({ id: node.id, parentId, orderIndex: index });
        if (node.children && node.children.length > 0) flatten(node.children, node.id);
      });
    };
    flatten(items);

    for (const update of updates) {
      await db.runAsync(
        'UPDATE menus SET parent_key = ?, order_index = ? WHERE key = ?',
        [update.parentId, update.orderIndex, update.id]
      );
    }
    res.json({ success: true, message: 'Structure updated' });
  } catch (err) {
    console.error('Error updating menu structure:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /menu/{id}:
 *   put:
 *     summary: Update a menu item
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *               icon:
 *                 type: string
 *               path:
 *                 type: string
 *               requiredRoles:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Menu item updated
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { label, icon, path, requiredRoles } = req.body;

  try {
    // Find menu by key
    const existingMenu = await db.getAsync('SELECT id FROM menus WHERE key = ?', [id]);
    if (!existingMenu) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const rolesStr = Array.isArray(requiredRoles) ? requiredRoles.join(',') : requiredRoles;

    await db.runAsync(
      'UPDATE menus SET name = ?, icon = ?, path = ?, roles = ? WHERE key = ?',
      [label, icon, path || null, rolesStr, id]
    );

    const updatedMenu = await db.getAsync('SELECT id, key, name, icon, path, parent_key, roles FROM menus WHERE key = ?', [id]);

    const roles = updatedMenu.roles ? updatedMenu.roles.split(',').map(r => r.trim()) : [];
    const response = {
      id: updatedMenu.key,
      icon: updatedMenu.icon,
      label: updatedMenu.name,
      path: updatedMenu.path,
      requiredRoles: roles,
      children: []
    };

    res.json(response);
  } catch (err) {
    console.error('Error updating menu item:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /menu/{id}:
 *   delete:
 *     summary: Delete a menu item
 *     tags: [Menu]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Menu item deleted
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Find menu by key
    const existingMenu = await db.getAsync('SELECT id FROM menus WHERE key = ?', [id]);
    if (!existingMenu) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // Delete the menu item (children will be handled by cascade if needed)
    await db.runAsync('DELETE FROM menus WHERE key = ?', [id]);

    res.json({ message: 'Menu item deleted successfully' });
  } catch (err) {
    console.error('Error deleting menu item:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;