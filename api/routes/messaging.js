const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { ATTACHMENT_DIR } = require('../config');

const router = Router();
router.use(requireAuth);

const EMPLOYEE_SAFE_COLS = 'e.id, e.first_name, e.last_name, e.username, e.role, e.status, e.photo_url';
const SENDER_COLS = 'e.id AS sender_employee_id, e.first_name AS sender_first_name, e.last_name AS sender_last_name, e.username AS sender_username, e.role AS sender_role, e.status AS sender_status, e.photo_url AS sender_photo_url';

// Multer for attachments
const attachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ATTACHMENT_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const attachmentUpload = multer({
  storage: attachmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ========== CHANNEL ENDPOINTS ==========

// POST /channels - create channel
router.post('/channels', async (req, res) => {
  const { name, description, emoji, icon, type = 'channel', parentId, memberIds = [] } = req.body;
  const userId = req.user.id;

  if (type === 'channel' && !name) {
    return res.status(400).json({ error: 'Channel name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO channels (name, description, emoji, icon, type, parent_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name || null, description || null, emoji || null, icon || null, type, parentId || null, userId]
    );
    const channel = result.rows[0];

    // Add creator as owner
    await pool.query(
      `INSERT INTO channel_members (channel_id, employee_id, role) VALUES ($1, $2, 'owner')`,
      [channel.id, userId]
    );

    // Add other members
    const uniqueMembers = [...new Set(memberIds.filter(id => id !== userId))];
    for (const empId of uniqueMembers) {
      await pool.query(
        `INSERT INTO channel_members (channel_id, employee_id, role) VALUES ($1, $2, 'member')
         ON CONFLICT (channel_id, employee_id) DO NOTHING`,
        [channel.id, empId]
      );
    }

    res.status(201).json(channel);
  } catch (err) {
    console.error('Create channel error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /channels - list user's channels
router.get('/channels', async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT c.*,
        cm.last_read_at,
        (SELECT COUNT(*) FROM messages m
         WHERE m.channel_id = c.id AND m.created_at > cm.last_read_at AND m.sender_id != $1 AND m.is_deleted = false
        ) AS unread_count,
        (SELECT row_to_json(lm) FROM (
          SELECT m.id, m.content, m.created_at, m.sender_id,
                 e.first_name AS sender_first_name, e.last_name AS sender_last_name
          FROM messages m
          JOIN employees e ON e.id = m.sender_id
          WHERE m.channel_id = c.id AND m.is_deleted = false
          ORDER BY m.created_at DESC LIMIT 1
        ) lm) AS latest_message,
        (SELECT row_to_json(dp) FROM (
          SELECT e.id, e.first_name, e.last_name, e.photo_url
          FROM channel_members om
          JOIN employees e ON e.id = om.employee_id
          WHERE om.channel_id = c.id AND om.employee_id != $1
          LIMIT 1
        ) dp) AS dm_partner
       FROM channels c
       JOIN channel_members cm ON cm.channel_id = c.id AND cm.employee_id = $1
       WHERE c.parent_id IS NULL
       ORDER BY c.type = 'dm' DESC, c.name ASC`,
      [userId]
    );

    // Fetch sub-channels
    const channelIds = result.rows.map(r => r.id);
    let subChannels = [];
    if (channelIds.length > 0) {
      const subResult = await pool.query(
        `SELECT c.*,
          cm.last_read_at,
          (SELECT COUNT(*) FROM messages m
           WHERE m.channel_id = c.id AND m.created_at > cm.last_read_at AND m.sender_id != $1 AND m.is_deleted = false
          ) AS unread_count,
          (SELECT row_to_json(lm) FROM (
            SELECT m.id, m.content, m.created_at, m.sender_id,
                   e.first_name AS sender_first_name, e.last_name AS sender_last_name
            FROM messages m
            JOIN employees e ON e.id = m.sender_id
            WHERE m.channel_id = c.id AND m.is_deleted = false
            ORDER BY m.created_at DESC LIMIT 1
          ) lm) AS latest_message,
          (SELECT row_to_json(dp) FROM (
            SELECT e.id, e.first_name, e.last_name, e.photo_url
            FROM channel_members om
            JOIN employees e ON e.id = om.employee_id
            WHERE om.channel_id = c.id AND om.employee_id != $1
            LIMIT 1
          ) dp) AS dm_partner
         FROM channels c
         JOIN channel_members cm ON cm.channel_id = c.id AND cm.employee_id = $1
         WHERE c.parent_id = ANY($2)
         ORDER BY c.name ASC`,
        [userId, channelIds]
      );
      subChannels = subResult.rows;
    }

    // Nest sub-channels
    const channels = result.rows.map(ch => ({
      ...ch,
      unread_count: parseInt(ch.unread_count, 10),
      children: subChannels
        .filter(sc => sc.parent_id === ch.id)
        .map(sc => ({ ...sc, unread_count: parseInt(sc.unread_count, 10) })),
    }));

    res.json(channels);
  } catch (err) {
    console.error('List channels error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /channels/:id - single channel
router.get('/channels/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) AS member_count,
        row_to_json((SELECT cb FROM (SELECT e.id, e.first_name, e.last_name, e.username FROM employees e WHERE e.id = c.created_by) cb)) AS created_by_info
       FROM channels c
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    const channel = result.rows[0];
    channel.member_count = parseInt(channel.member_count, 10);
    res.json(channel);
  } catch (err) {
    console.error('Get channel error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /channels/:id - update channel (owner/admin)
router.patch('/channels/:id', async (req, res) => {
  const userId = req.user.id;
  const { name, emoji, icon, description } = req.body;

  try {
    // Check ownership or admin
    const memberCheck = await pool.query(
      `SELECT role FROM channel_members WHERE channel_id = $1 AND employee_id = $2`,
      [req.params.id, userId]
    );
    const isOwner = memberCheck.rows.length > 0 && memberCheck.rows[0].role === 'owner';
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only channel owner or admin can update' });
    }

    const result = await pool.query(
      `UPDATE channels SET
        name = COALESCE($1, name),
        emoji = COALESCE($2, emoji),
        icon = COALESCE($3, icon),
        description = COALESCE($4, description),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [name, emoji, icon, description, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update channel error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /channels/:id/archive
router.post('/channels/:id/archive', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE channels SET is_archived = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Archive channel error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /channels/:id/members - add members
router.post('/channels/:id/members', async (req, res) => {
  const { employeeIds = [] } = req.body;

  try {
    const added = [];
    for (const empId of employeeIds) {
      const result = await pool.query(
        `INSERT INTO channel_members (channel_id, employee_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (channel_id, employee_id) DO NOTHING
         RETURNING *`,
        [req.params.id, empId]
      );
      if (result.rows.length > 0) added.push(result.rows[0]);
    }
    res.json({ added });
  } catch (err) {
    console.error('Add members error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /channels/:id/members/:employeeId
router.delete('/channels/:id/members/:employeeId', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM channel_members WHERE channel_id = $1 AND employee_id = $2`,
      [req.params.id, req.params.employeeId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /channels/:id/members
router.get('/channels/:id/members', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cm.id AS membership_id, cm.role AS channel_role, cm.joined_at, cm.last_read_at,
              ${EMPLOYEE_SAFE_COLS}
       FROM channel_members cm
       JOIN employees e ON e.id = cm.employee_id
       WHERE cm.channel_id = $1
       ORDER BY cm.role = 'owner' DESC, e.first_name ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List members error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== MESSAGE ENDPOINTS ==========

// GET /channels/:id/messages
router.get('/channels/:id/messages', async (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const before = req.query.before ? parseInt(req.query.before, 10) : null;
  const after = req.query.after ? parseInt(req.query.after, 10) : null;

  try {
    let query;
    let params;

    if (before) {
      query = `
        SELECT m.id, m.channel_id, m.sender_id, m.parent_message_id, m.status,
               m.is_pinned, m.is_deleted, m.created_at, m.updated_at,
               CASE WHEN m.is_deleted THEN '[This message was deleted]' ELSE m.content END AS content,
               ${SENDER_COLS},
               COALESCE(
                 (SELECT json_agg(row_to_json(a)) FROM message_attachments a WHERE a.message_id = m.id),
                 '[]'::json
               ) AS attachments
        FROM messages m
        JOIN employees e ON e.id = m.sender_id
        WHERE m.channel_id = $1 AND m.id < $2
        ORDER BY m.id DESC
        LIMIT $3`;
      params = [req.params.id, before, limit];
    } else if (after) {
      query = `
        SELECT m.id, m.channel_id, m.sender_id, m.parent_message_id, m.status,
               m.is_pinned, m.is_deleted, m.created_at, m.updated_at,
               CASE WHEN m.is_deleted THEN '[This message was deleted]' ELSE m.content END AS content,
               ${SENDER_COLS},
               COALESCE(
                 (SELECT json_agg(row_to_json(a)) FROM message_attachments a WHERE a.message_id = m.id),
                 '[]'::json
               ) AS attachments
        FROM messages m
        JOIN employees e ON e.id = m.sender_id
        WHERE m.channel_id = $1 AND m.id > $2
        ORDER BY m.id ASC
        LIMIT $3`;
      params = [req.params.id, after, limit];
    } else {
      query = `
        SELECT m.id, m.channel_id, m.sender_id, m.parent_message_id, m.status,
               m.is_pinned, m.is_deleted, m.created_at, m.updated_at,
               CASE WHEN m.is_deleted THEN '[This message was deleted]' ELSE m.content END AS content,
               ${SENDER_COLS},
               COALESCE(
                 (SELECT json_agg(row_to_json(a)) FROM message_attachments a WHERE a.message_id = m.id),
                 '[]'::json
               ) AS attachments
        FROM messages m
        JOIN employees e ON e.id = m.sender_id
        WHERE m.channel_id = $1
        ORDER BY m.id DESC
        LIMIT $2`;
      params = [req.params.id, limit];
    }

    const result = await pool.query(query, params);

    // Update last_read_at
    await pool.query(
      `UPDATE channel_members SET last_read_at = CURRENT_TIMESTAMP
       WHERE channel_id = $1 AND employee_id = $2`,
      [req.params.id, userId]
    );

    // Return oldest-first for display
    const messages = before || !after ? result.rows.reverse() : result.rows;
    res.json(messages);
  } catch (err) {
    console.error('List messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /channels/:id/messages
router.post('/channels/:id/messages', async (req, res) => {
  const userId = req.user.id;
  const { content, mentions = [], parentMessageId } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO messages (channel_id, sender_id, content, parent_message_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.id, userId, content.trim(), parentMessageId || null]
    );
    const message = result.rows[0];

    // Parse @mentions from content
    const mentionRegex = /@(\w+)/g;
    let match;
    const parsedMentions = new Set(mentions.map(Number));
    while ((match = mentionRegex.exec(content)) !== null) {
      const usernameMatch = await pool.query(
        `SELECT id FROM employees WHERE username = $1`, [match[1]]
      );
      if (usernameMatch.rows.length > 0) {
        parsedMentions.add(usernameMatch.rows[0].id);
      }
    }

    // Create mention records and notifications
    for (const empId of parsedMentions) {
      if (empId === userId) continue;
      await pool.query(
        `INSERT INTO message_mentions (message_id, employee_id)
         VALUES ($1, $2) ON CONFLICT (message_id, employee_id) DO NOTHING`,
        [message.id, empId]
      );
      await pool.query(
        `INSERT INTO notifications (employee_id, type, reference_type, reference_id, content)
         VALUES ($1, 'mention', 'message', $2, $3)`,
        [empId, message.id, `${req.user.firstName} ${req.user.lastName} mentioned you in a message`]
      );
    }

    // Fetch with sender info
    const full = await pool.query(
      `SELECT m.*, ${SENDER_COLS}
       FROM messages m
       JOIN employees e ON e.id = m.sender_id
       WHERE m.id = $1`,
      [message.id]
    );

    res.status(201).json(full.rows[0]);
  } catch (err) {
    console.error('Create message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /messages/:id - edit message (sender only)
router.patch('/messages/:id', async (req, res) => {
  const userId = req.user.id;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  try {
    const check = await pool.query(`SELECT sender_id FROM messages WHERE id = $1`, [req.params.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    if (check.rows[0].sender_id !== userId) {
      return res.status(403).json({ error: 'Only the sender can edit this message' });
    }

    const result = await pool.query(
      `UPDATE messages SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [content.trim(), req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Edit message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /messages/:id - soft delete
router.delete('/messages/:id', async (req, res) => {
  const userId = req.user.id;

  try {
    const check = await pool.query(
      `SELECT m.sender_id, m.channel_id FROM messages m WHERE m.id = $1`,
      [req.params.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const msg = check.rows[0];
    // Check if sender or channel owner
    const isOwner = await pool.query(
      `SELECT 1 FROM channel_members WHERE channel_id = $1 AND employee_id = $2 AND role = 'owner'`,
      [msg.channel_id, userId]
    );

    if (msg.sender_id !== userId && isOwner.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this message' });
    }

    await pool.query(
      `UPDATE messages SET is_deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /messages/:id/star - toggle star
router.post('/messages/:id/star', async (req, res) => {
  const userId = req.user.id;

  try {
    const existing = await pool.query(
      `SELECT id FROM message_stars WHERE message_id = $1 AND employee_id = $2`,
      [req.params.id, userId]
    );

    if (existing.rows.length > 0) {
      await pool.query(`DELETE FROM message_stars WHERE id = $1`, [existing.rows[0].id]);
      res.json({ starred: false });
    } else {
      await pool.query(
        `INSERT INTO message_stars (message_id, employee_id) VALUES ($1, $2)`,
        [req.params.id, userId]
      );
      res.json({ starred: true });
    }
  } catch (err) {
    console.error('Star message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /messages/:id/pin - toggle pin (owner/admin)
router.post('/messages/:id/pin', async (req, res) => {
  const userId = req.user.id;

  try {
    const msgResult = await pool.query(`SELECT channel_id, is_pinned FROM messages WHERE id = $1`, [req.params.id]);
    if (msgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    const msg = msgResult.rows[0];

    const ownerCheck = await pool.query(
      `SELECT 1 FROM channel_members WHERE channel_id = $1 AND employee_id = $2 AND role = 'owner'`,
      [msg.channel_id, userId]
    );
    if (ownerCheck.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only channel owner or admin can pin messages' });
    }

    const result = await pool.query(
      `UPDATE messages SET is_pinned = NOT is_pinned, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Pin message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== ATTACHMENT ENDPOINT ==========

router.post('/messages/:id/attachments', attachmentUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO message_attachments (message_id, filename, original_name, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.params.id, req.file.filename, req.file.originalname, req.file.size, req.file.mimetype]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Upload attachment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== FOLDER ENDPOINTS ==========

router.get('/folders/:folder', async (req, res) => {
  const userId = req.user.id;
  const folder = req.params.folder;

  try {
    switch (folder) {
      case 'inbox': {
        const result = await pool.query(
          `SELECT DISTINCT ON (m.channel_id) m.id, m.channel_id, m.content, m.sender_id, m.created_at,
                  c.name AS channel_name, c.emoji AS channel_emoji, c.type AS channel_type,
                  e.first_name AS sender_first_name, e.last_name AS sender_last_name
           FROM messages m
           JOIN channels c ON c.id = m.channel_id
           JOIN channel_members cm ON cm.channel_id = c.id AND cm.employee_id = $1
           JOIN employees e ON e.id = m.sender_id
           WHERE m.is_deleted = false
           ORDER BY m.channel_id, m.created_at DESC`,
          [userId]
        );
        // Sort by recency
        result.rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return res.json(result.rows);
      }
      case 'starred': {
        const result = await pool.query(
          `SELECT m.id, m.content, m.channel_id, m.sender_id, m.created_at,
                  c.name AS channel_name, c.emoji AS channel_emoji,
                  e.first_name AS sender_first_name, e.last_name AS sender_last_name,
                  ms.created_at AS starred_at
           FROM message_stars ms
           JOIN messages m ON m.id = ms.message_id
           JOIN channels c ON c.id = m.channel_id
           JOIN employees e ON e.id = m.sender_id
           WHERE ms.employee_id = $1
           ORDER BY ms.created_at DESC`,
          [userId]
        );
        return res.json(result.rows);
      }
      case 'sent': {
        const result = await pool.query(
          `SELECT m.id, m.content, m.channel_id, m.sender_id, m.created_at,
                  c.name AS channel_name, c.emoji AS channel_emoji
           FROM messages m
           JOIN channels c ON c.id = m.channel_id
           WHERE m.sender_id = $1 AND m.is_deleted = false
           ORDER BY m.created_at DESC
           LIMIT 100`,
          [userId]
        );
        return res.json(result.rows);
      }
      case 'drafts': {
        const result = await pool.query(
          `SELECT m.id, m.content, m.channel_id, m.sender_id, m.created_at,
                  c.name AS channel_name, c.emoji AS channel_emoji
           FROM messages m
           JOIN channels c ON c.id = m.channel_id
           WHERE m.sender_id = $1 AND m.status = 'draft'
           ORDER BY m.created_at DESC`,
          [userId]
        );
        return res.json(result.rows);
      }
      case 'archive': {
        const result = await pool.query(
          `SELECT c.*
           FROM channels c
           JOIN channel_members cm ON cm.channel_id = c.id AND cm.employee_id = $1
           WHERE c.is_archived = true
           ORDER BY c.updated_at DESC`,
          [userId]
        );
        return res.json(result.rows);
      }
      default:
        return res.status(400).json({ error: 'Invalid folder' });
    }
  } catch (err) {
    console.error('Folder query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== NOTIFICATION ENDPOINTS ==========

// GET /notifications
router.get('/notifications', async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT n.*,
        CASE
          WHEN n.reference_type = 'message' THEN (
            SELECT row_to_json(ref) FROM (
              SELECT m.id, m.content, m.channel_id, c.name AS channel_name
              FROM messages m
              LEFT JOIN channels c ON c.id = m.channel_id
              WHERE m.id = n.reference_id
            ) ref
          )
          ELSE NULL
        END AS reference
       FROM notifications n
       WHERE n.employee_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /notifications/read
router.post('/notifications/read', async (req, res) => {
  const userId = req.user.id;
  const { notificationIds, all } = req.body;

  try {
    if (all) {
      await pool.query(
        `UPDATE notifications SET is_read = true WHERE employee_id = $1`,
        [userId]
      );
    } else if (notificationIds && notificationIds.length > 0) {
      await pool.query(
        `UPDATE notifications SET is_read = true WHERE id = ANY($1) AND employee_id = $2`,
        [notificationIds, userId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Mark notifications read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /notifications/count
router.get('/notifications/count', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) AS unread FROM notifications WHERE employee_id = $1 AND is_read = false`,
      [req.user.id]
    );
    res.json({ unread: parseInt(result.rows[0].unread, 10) });
  } catch (err) {
    console.error('Notification count error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== CUSTOM FOLDER ENDPOINTS ==========

// GET /custom-folders - list current user's folders with item counts
router.get('/custom-folders', async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT mf.*,
        (SELECT COUNT(*) FROM message_folder_items mfi WHERE mfi.folder_id = mf.id) AS item_count
       FROM message_folders mf
       WHERE mf.employee_id = $1
       ORDER BY mf.sort_order ASC, mf.created_at ASC`,
      [userId]
    );
    res.json(result.rows.map(r => ({ ...r, item_count: parseInt(r.item_count, 10) })));
  } catch (err) {
    console.error('List custom folders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /custom-folders - create folder
router.post('/custom-folders', async (req, res) => {
  const userId = req.user.id;
  const { name, emoji, icon } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO message_folders (name, emoji, icon, employee_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), emoji || null, icon || null, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create custom folder error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /custom-folders/:id - update folder
router.patch('/custom-folders/:id', async (req, res) => {
  const userId = req.user.id;
  const { name, emoji, icon } = req.body;

  try {
    const check = await pool.query(
      `SELECT id FROM message_folders WHERE id = $1 AND employee_id = $2`,
      [req.params.id, userId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const result = await pool.query(
      `UPDATE message_folders SET
        name = COALESCE($1, name),
        emoji = COALESCE($2, emoji),
        icon = COALESCE($3, icon)
       WHERE id = $4 AND employee_id = $5
       RETURNING *`,
      [name, emoji, icon, req.params.id, userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update custom folder error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /custom-folders/:id - delete folder and its items
router.delete('/custom-folders/:id', async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `DELETE FROM message_folders WHERE id = $1 AND employee_id = $2 RETURNING id`,
      [req.params.id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete custom folder error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /custom-folders/:id/items - add item to folder
router.post('/custom-folders/:id/items', async (req, res) => {
  const userId = req.user.id;
  const { channelId, messageId } = req.body;

  if (!channelId && !messageId) {
    return res.status(400).json({ error: 'channelId or messageId is required' });
  }

  try {
    const folderCheck = await pool.query(
      `SELECT id FROM message_folders WHERE id = $1 AND employee_id = $2`,
      [req.params.id, userId]
    );
    if (folderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const result = await pool.query(
      `INSERT INTO message_folder_items (folder_id, channel_id, message_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.params.id, channelId || null, messageId || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Add folder item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /custom-folders/:id/items/:itemId - remove item from folder
router.delete('/custom-folders/:id/items/:itemId', async (req, res) => {
  const userId = req.user.id;

  try {
    const folderCheck = await pool.query(
      `SELECT id FROM message_folders WHERE id = $1 AND employee_id = $2`,
      [req.params.id, userId]
    );
    if (folderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const result = await pool.query(
      `DELETE FROM message_folder_items WHERE id = $1 AND folder_id = $2 RETURNING id`,
      [req.params.itemId, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Remove folder item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /custom-folders/:id/items - list items in a folder with details
router.get('/custom-folders/:id/items', async (req, res) => {
  const userId = req.user.id;

  try {
    const folderCheck = await pool.query(
      `SELECT id FROM message_folders WHERE id = $1 AND employee_id = $2`,
      [req.params.id, userId]
    );
    if (folderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const result = await pool.query(
      `SELECT mfi.id AS item_id, mfi.folder_id, mfi.added_at,
        mfi.channel_id, mfi.message_id,
        CASE WHEN mfi.channel_id IS NOT NULL THEN (
          SELECT row_to_json(ch) FROM (
            SELECT c.id, c.name, c.description, c.type, c.emoji, c.icon, c.is_archived,
              (SELECT row_to_json(lm) FROM (
                SELECT m.id, m.content, m.created_at, m.sender_id,
                       e.first_name AS sender_first_name, e.last_name AS sender_last_name
                FROM messages m
                JOIN employees e ON e.id = m.sender_id
                WHERE m.channel_id = c.id AND m.is_deleted = false
                ORDER BY m.created_at DESC LIMIT 1
              ) lm) AS latest_message
            FROM channels c WHERE c.id = mfi.channel_id
          ) ch
        ) ELSE NULL END AS channel,
        CASE WHEN mfi.message_id IS NOT NULL THEN (
          SELECT row_to_json(mg) FROM (
            SELECT m.id, m.content, m.channel_id, m.sender_id, m.created_at,
                   e.first_name AS sender_first_name, e.last_name AS sender_last_name,
                   c.name AS channel_name
            FROM messages m
            JOIN employees e ON e.id = m.sender_id
            JOIN channels c ON c.id = m.channel_id
            WHERE m.id = mfi.message_id
          ) mg
        ) ELSE NULL END AS message
       FROM message_folder_items mfi
       WHERE mfi.folder_id = $1
       ORDER BY mfi.added_at DESC`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('List folder items error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== OTHER ENDPOINTS ==========

// GET /unread-counts
router.get('/unread-counts', async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT cm.channel_id,
        (SELECT COUNT(*) FROM messages m
         WHERE m.channel_id = cm.channel_id AND m.created_at > cm.last_read_at
           AND m.sender_id != $1 AND m.is_deleted = false
        ) AS count
       FROM channel_members cm
       WHERE cm.employee_id = $1`,
      [userId]
    );
    res.json(result.rows.map(r => ({ channelId: r.channel_id, count: parseInt(r.count, 10) })));
  } catch (err) {
    console.error('Unread counts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /search
router.get('/search', async (req, res) => {
  const q = req.query.q;
  if (!q || !q.trim()) {
    return res.json({ channels: [], messages: [], employees: [] });
  }

  const pattern = `%${q.trim()}%`;

  try {
    const [channels, messages, employees] = await Promise.all([
      pool.query(
        `SELECT c.* FROM channels c
         JOIN channel_members cm ON cm.channel_id = c.id AND cm.employee_id = $1
         WHERE c.name ILIKE $2
         ORDER BY c.name LIMIT 20`,
        [req.user.id, pattern]
      ),
      pool.query(
        `SELECT m.id, m.content, m.channel_id, m.sender_id, m.created_at,
                c.name AS channel_name,
                e.first_name AS sender_first_name, e.last_name AS sender_last_name
         FROM messages m
         JOIN channels c ON c.id = m.channel_id
         JOIN channel_members cm ON cm.channel_id = c.id AND cm.employee_id = $1
         JOIN employees e ON e.id = m.sender_id
         WHERE m.content ILIKE $2 AND m.is_deleted = false
         ORDER BY m.created_at DESC LIMIT 20`,
        [req.user.id, pattern]
      ),
      pool.query(
        `SELECT id, first_name, last_name, username, role, status, photo_url
         FROM employees
         WHERE (first_name ILIKE $1 OR last_name ILIKE $1 OR username ILIKE $1)
         ORDER BY first_name LIMIT 20`,
        [pattern]
      ),
    ]);

    res.json({
      channels: channels.rows,
      messages: messages.rows,
      employees: employees.rows,
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /dm/:employeeId - find or create DM
router.get('/dm/:employeeId', async (req, res) => {
  const userId = req.user.id;
  const targetId = parseInt(req.params.employeeId, 10);

  if (userId === targetId) {
    return res.status(400).json({ error: 'Cannot create DM with yourself' });
  }

  try {
    // Find existing DM
    const existing = await pool.query(
      `SELECT c.* FROM channels c
       WHERE c.type = 'dm'
         AND EXISTS (SELECT 1 FROM channel_members WHERE channel_id = c.id AND employee_id = $1)
         AND EXISTS (SELECT 1 FROM channel_members WHERE channel_id = c.id AND employee_id = $2)
         AND (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) = 2
       LIMIT 1`,
      [userId, targetId]
    );

    if (existing.rows.length > 0) {
      return res.json(existing.rows[0]);
    }

    // Create new DM
    const newDm = await pool.query(
      `INSERT INTO channels (type, created_by) VALUES ('dm', $1) RETURNING *`,
      [userId]
    );
    const dmId = newDm.rows[0].id;

    await pool.query(
      `INSERT INTO channel_members (channel_id, employee_id, role) VALUES ($1, $2, 'member'), ($1, $3, 'member')`,
      [dmId, userId, targetId]
    );

    res.json(newDm.rows[0]);
  } catch (err) {
    console.error('DM lookup/create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
