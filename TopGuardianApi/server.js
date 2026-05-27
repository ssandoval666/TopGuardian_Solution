const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Nota: En producción cambia esto por la URL de tu frontend (ej: 'http://localhost:3000')
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 9000;

// Exponer socket.io a las rutas
app.set('io', io);

// Middleware
app.use(cors());

// Custom JSON parser with error handling
app.use(express.json({
  limit: '50mb', // Aumentado para permitir la subida de archivos como array de bytes
  verify: (req, res, buf, encoding) => {
    // This captures the raw body before parsing
    req.rawBody = buf.toString(encoding);
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database setup
const dbPath = path.join(__dirname, 'TopGuardian_Api.db');
const db = new sqlite3.Database(dbPath);

// Initialize database
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    // Create tables
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        phone TEXT,
        password_hash TEXT NOT NULL,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        ruc TEXT UNIQUE NOT NULL,
        address TEXT,
        phone TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS company_users (
        company_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        PRIMARY KEY (company_id, user_id),
        FOREIGN KEY (company_id) REFERENCES companies (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`,
      `CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        document_number TEXT UNIQUE NOT NULL,
        position TEXT NOT NULL,
        department TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies (id)
      )`,
      `CREATE TABLE IF NOT EXISTS trainings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        instructor TEXT NOT NULL,
        date TEXT NOT NULL,
        duration TEXT NOT NULL,
        recurrence TEXT DEFAULT 'none',
        pdf_file_name TEXT,
        pdf_data BLOB,
        thumbnail_file_name TEXT,
        thumbnail_data BLOB,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS company_trainings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        training_id INTEGER NOT NULL,
        assigned_date TEXT NOT NULL,
        completed_date TEXT,
        due_date TEXT,
        recurrence TEXT DEFAULT 'none',
        FOREIGN KEY (company_id) REFERENCES companies (id),
        FOREIGN KEY (training_id) REFERENCES trainings (id)
      )`,
      `CREATE TABLE IF NOT EXISTS employee_trainings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        training_id INTEGER NOT NULL,
        assigned_date TEXT NOT NULL,
        completed_date TEXT,
        due_date TEXT,
        recurrence TEXT DEFAULT 'none',
        FOREIGN KEY (employee_id) REFERENCES employees (id),
        FOREIGN KEY (training_id) REFERENCES trainings (id)
      )`,
      `CREATE TABLE IF NOT EXISTS employee_training_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        training_id INTEGER NOT NULL,
        completion_date TEXT NOT NULL,
        score INTEGER NOT NULL,
        signature_data BLOB,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees (id),
        FOREIGN KEY (training_id) REFERENCES trainings (id)
      )`,
      `CREATE TABLE IF NOT EXISTS training_questionnaires (
        training_id INTEGER PRIMARY KEY,
        min_passing_score INTEGER DEFAULT 0,
        questions_json TEXT NOT NULL,
        FOREIGN KEY (training_id) REFERENCES trainings (id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS planos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        company_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_data BLOB NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies (id)
      )`,
      `CREATE TABLE IF NOT EXISTS checklist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS checklist_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        visit_date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies (id)
      )`,
      `CREATE TABLE IF NOT EXISTS checklist_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visit_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        compliant BOOLEAN,
        observations TEXT,
        FOREIGN KEY (visit_id) REFERENCES checklist_visits (id),
        FOREIGN KEY (item_id) REFERENCES checklist_items (id)
      )`,
      `CREATE TABLE IF NOT EXISTS risk_matrices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies (id)
      )`,
      `CREATE TABLE IF NOT EXISTS risk_matrix_sectors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matrix_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        FOREIGN KEY (matrix_id) REFERENCES risk_matrices (id)
      )`,
      `CREATE TABLE IF NOT EXISTS risk_matrix_hazards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matrix_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        FOREIGN KEY (matrix_id) REFERENCES risk_matrices (id)
      )`,
      `CREATE TABLE IF NOT EXISTS risk_matrix_cells (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matrix_id INTEGER NOT NULL,
        hazard_id INTEGER NOT NULL,
        sector_id INTEGER NOT NULL,
        probability INTEGER NOT NULL,
        severity INTEGER NOT NULL,
        risk_score INTEGER NOT NULL,
        risk_level TEXT NOT NULL,
        control_measure TEXT,
        FOREIGN KEY (matrix_id) REFERENCES risk_matrices (id),
        FOREIGN KEY (hazard_id) REFERENCES risk_matrix_hazards (id),
        FOREIGN KEY (sector_id) REFERENCES risk_matrix_sectors (id)
      )`,
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER NOT NULL,
        message_text TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        read_status BOOLEAN DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users (id),
        FOREIGN KEY (to_user_id) REFERENCES users (id)
      )`,
      `CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        notes TEXT,
        completed BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`,
      `CREATE TABLE IF NOT EXISTS menus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT,
        path TEXT,
        parent_key TEXT,
        roles TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS user_presence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        is_online BOOLEAN DEFAULT 0,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        UNIQUE(user_id)
      )`,
      // Índices para mejorar drásticamente el rendimiento de lectura del chat
      `CREATE INDEX IF NOT EXISTS idx_chat_messages_users ON chat_messages(from_user_id, to_user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON chat_messages(to_user_id, read_status)`,
      `CREATE INDEX IF NOT EXISTS idx_user_presence_online ON user_presence(is_online)`,
      `CREATE INDEX IF NOT EXISTS idx_users_active ON users(active)`
    ];

    let completed = 0;
    const total = tables.length;

    tables.forEach(sql => {
      db.run(sql, (err) => {
        if (err) {
          console.error('Error creating table:', err);
          reject(err);
          return;
        }
        completed++;
        if (completed === total) {
          // Solo insertamos los datos falsos y borramos las tablas si estamos en modo desarrollo
          if (process.env.NODE_ENV === 'development') {
            console.log('Entorno de desarrollo detectado. Insertando datos de prueba...');
            insertMockData().then(resolve).catch(reject);
          } else {
            console.log('Entorno de producción. Se omiten los datos de prueba y se conservan los datos reales.');
            resolve();
          }
        }
      });
    });
  });
};

const insertMockData = async () => {
  try {
    // Clear existing data to avoid duplicates
    const clearTables = async () => {
      const tablesToClear = ['users', 'companies', 'company_users', 'employees', 'trainings', 'training_questionnaires', 'company_trainings', 'employee_trainings', 'employee_training_records', 'planos', 'checklist_items', 'checklist_visits', 'checklist_entries', 'risk_matrices', 'risk_matrix_sectors', 'risk_matrix_hazards', 'risk_matrix_cells', 'chat_messages', 'menus', 'roles'];
      for (const table of tablesToClear) {
        await new Promise((resolve, reject) => {
          db.run(`DELETE FROM ${table}`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      await new Promise((resolve, reject) => {
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'", (err, row) => {
          if (err) reject(err);
          else if (row) {
            db.run('DELETE FROM sqlite_sequence', (innerErr) => {
              if (innerErr) reject(innerErr);
              else resolve();
            });
          } else {
            resolve();
          }
        });
      });
    };

    await clearTables();

    // Insert initial user
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('123', 10);

    await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO users (name, username, email, role, phone, password_hash)
        VALUES (?, ?, ?, ?, ?, ?)
      `, ['Sebastian Sandoval', 'ssandoval', 'ssandoval@test.com', 'Administrador', '1158803733', hashedPassword], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log('Initial user created');

    // Insert mock data
    // Companies
    const companies = [
      ['Acme Corp', '20100001234', 'Av. Principal 123', '01-2345678', 'info@acme.com']
    ];

    for (const company of companies) {
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO companies (name, ruc, address, phone, email) VALUES (?, ?, ?, ?, ?)', company, function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Users
    const users = [
      ['Carlos García', 'cgarcia', 'carlos@acme.com', 'Administrador', '01-1111111'],
      ['María López', 'mlopez', 'maria@acme.com', 'Editor', '01-2222222'],
      ['Juan Pérez', 'jperez', 'juan@acme.com', 'Visualizador', '01-3333333']
    ];

    for (const user of users) {
      const hashed = bcrypt.hashSync('123', 10);
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO users (name, username, email, role, phone, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
          [...user, hashed], function(err) {
            if (err) reject(err);
            else resolve();
          });
      });
    }

    // Employees
    const employees = [
      [1, 'Juan', 'Pérez', '12345678', 'Gerente', 'Administración', 'juan@acme.com', '999111222'],
      [1, 'María', 'López', '23456789', 'Analista', 'Finanzas', 'maria@acme.com', '999333444'],
      [2, 'Ana', 'Martínez', '45678901', 'Directora', 'Operaciones', 'ana@globex.com', '999777888']
    ];

    for (const emp of employees) {
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO employees (company_id, first_name, last_name, document_number, position, department, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', emp, function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Trainings
    const trainings = [
      ['Seguridad e Higiene', 'Capacitación obligatoria de seguridad laboral', 'María López', '2025-03-15', '4 horas', 'yearly'],
      ['Primeros Auxilios', 'Curso básico de primeros auxilios', 'Dr. Juan Pérez', '2025-04-10', '8 horas', 'yearly'],
      ['Manejo de Extintores', 'Uso correcto de extintores', 'Carlos Ruiz', '2025-05-20', '2 horas', 'monthly']
    ];

    for (const training of trainings) {
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO trainings (title, description, instructor, date, duration, recurrence) VALUES (?, ?, ?, ?, ?, ?)', training, function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Checklist items
    const checklistItems = [
      ['Extintores en buen estado', 'Seguridad'],
      ['Señalización de emergencia visible', 'Seguridad'],
      ['Salidas de emergencia despejadas', 'Seguridad'],
      ['EPP disponible y en condiciones', 'EPP']
    ];

    for (const item of checklistItems) {
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO checklist_items (name, category) VALUES (?, ?)', item, function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Menus
    const menuData = [
      { key: 'dash', name: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard', parent_key: null, roles: 'Administrador,Editor,Visualizador' },
      { key: 'risk-matrix', name: 'Matriz de Riesgo', icon: 'Shield', path: '/dashboard/risk-matrix', parent_key: null, roles: 'Administrador,Editor,Visualizador' },
      { key: 'planos', name: 'Planos', icon: 'Map', path: '/dashboard/planos', parent_key: null, roles: 'Administrador,Editor,Visualizador' },
      { key: 'checklist-visits', name: 'Check Lista Visitas', icon: 'ClipboardCheck', path: '/dashboard/checklist-visits', parent_key: null, roles: 'Administrador,Editor,Visualizador' },
      { key: 'settings', name: 'Configuración', icon: 'Settings', path: '', parent_key: null, roles: 'Administrador,Editor,Visualizador' },
      { key: 'companies', name: 'Empresas', icon: 'Building2', path: '/dashboard/companies', parent_key: 'settings', roles: 'Administrador,Editor,Visualizador' },
      { key: 'users', name: 'Usuarios', icon: 'Users', path: '/dashboard/users', parent_key: 'settings', roles: 'Administrador' },
      { key: 'menu', name: 'menu', icon: 'ClipboardList', path: '/dashboard/menu', parent_key: 'settings', roles: 'Administrador,Editor,Visualizador' },
      { key: 'trainings', name: 'Capacitaciones', icon: 'GraduationCap', path: '/dashboard/trainings', parent_key: 'settings', roles: 'Administrador,Editor,Visualizador' },
      { key: 'checklist-items', name: 'Items Check List', icon: 'ClipboardList', path: '/dashboard/checklist-items', parent_key: 'settings', roles: 'Administrador,Editor,Visualizador' },
      { key: 'registro-capacitaciones', name: 'Registro de Capacitaciones', icon: 'FileText', path: '/dashboard/registro-capacitaciones', parent_key: null, roles: 'Administrador,Editor,Visualizador' },
      { key: 'sesiones-activas', name: 'Sesiones Activas', icon: 'ShieldAlert', path: '/dashboard/sesiones-activas', parent_key: null, roles: 'Administrador' }
    ];

    for (const menu of menuData) {
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO menus (key, name, icon, path, parent_key, roles) VALUES (?, ?, ?, ?, ?, ?)', 
          [menu.key, menu.name, menu.icon, menu.path, menu.parent_key, menu.roles], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Roles
    const roleNames = ['Administrador', 'Visualizador', 'Editor'];
    for (const nombre of roleNames) {
      await new Promise((resolve, reject) => {
        db.run('INSERT INTO roles (nombre) VALUES (?)', [nombre], function(err) {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    console.log('Mock data inserted successfully');
  } catch (err) {
    console.error('Error inserting mock data:', err);
  }
};

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TopGuardian API',
      version: '1.0.0',
      description: 'API for safety management system',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './server.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/companies');
const userRoutes = require('./routes/users');
const employeeRoutes = require('./routes/employees');
const trainingRoutes = require('./routes/trainings');
const planoRoutes = require('./routes/planos');
const checklistRoutes = require('./routes/checklists');
const riskMatrixRoutes = require('./routes/riskMatrices');
const menuRoutes = require('./routes/menu');
const chatRoutes = require('./routes/chat');
const rolesRoutes = require('./routes/roles');
const calendarRoutes = require('./routes/calendar');

// Override para asegurar que el chat muestre TODOS los usuarios reales de la DB sin hardcode
app.get('/chat/users', (req, res) => {
  const sql = `
    SELECT u.id, u.name, u.username, IFNULL(p.is_online, 0) as online
    FROM users u
    LEFT JOIN user_presence p ON u.id = p.user_id
    WHERE u.active = 1
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, online: Boolean(r.online) })));
  });
});

app.use('/auth', authRoutes);
app.use('/companies', companyRoutes);
app.use('/users', userRoutes);
app.use('/employees', employeeRoutes);
app.use('/trainings', trainingRoutes);
app.use('/planos', planoRoutes);
app.use('/checklists', checklistRoutes);
app.use('/risk-matrices', riskMatrixRoutes);
app.use('/menu', menuRoutes);
app.use('/chat', chatRoutes);
app.use('/roles', rolesRoutes);
app.use('/calendar', calendarRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  // Handle JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400) {
    console.error('JSON Parsing Error:');
    console.error('  Method:', req.method);
    console.error('  URL:', req.url);
    console.error('  Content-Type:', req.get('content-type'));
    console.error('  Raw Body:', req.rawBody);
    console.error('  Error:', err.message);
    return res.status(400).json({ 
      error: 'Invalid JSON in request body',
      details: err.message,
      receivedBody: req.rawBody
    });
  }
  
  console.error('Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// =========================================
// Configuración de WebSockets (Socket.io)
// =========================================
const activeUserSockets = new Map(); // Mapa para rastrear la conexión principal de cada usuario

io.on('connection', (socket) => {
  let currentUserId = null;

  console.log(`[WebSocket] Nuevo usuario conectado: ${socket.id}`);

  // El usuario se une a una sala personal utilizando su ID para recibir mensajes privados
  socket.on('join_chat', (userId) => {
    // Forzar el cierre de sesión en otras ubicaciones/pestañas del mismo usuario
    socket.to(userId.toString()).emit('force_logout');

    currentUserId = userId;
        activeUserSockets.set(userId, socket.id); // Actualizamos cuál es el socket activo actual
    socket.join(userId.toString());
    console.log(`[WebSocket] Usuario ${socket.id} asociado a userId: ${userId}`);

    // Registrar al usuario como conectado
    const sql = `INSERT INTO user_presence (user_id, is_online, last_seen) VALUES (?, 1, CURRENT_TIMESTAMP)
                 ON CONFLICT(user_id) DO UPDATE SET is_online = 1, last_seen = CURRENT_TIMESTAMP`;
    db.run(sql, [userId], () => {
      io.emit('user_status_change', { userId, online: true });
      
      // Emitir el conteo total de usuarios online
      db.get('SELECT COUNT(*) as count FROM user_presence WHERE is_online = 1', (err, row) => {
        if (!err && row) io.emit('online_count_update', row.count);
      });

      // Emitir también el conteo de operarios en capacitación al administrador que se acaba de conectar
      const trainingCount = io.sockets.adapter.rooms.get('training_app_users')?.size || 0;
      socket.emit('training_online_count_update', trainingCount);

      // Enviar mensajes offline pendientes al usuario automáticamente al conectarse
      const unreadSql = 'SELECT * FROM chat_messages WHERE to_user_id = ? AND read_status = 0';
      db.all(unreadSql, [userId], (err, rows) => {
        if (err) return;
        rows.forEach(msg => {
          socket.emit('receive_message', {
            ...msg,
            read_status: Boolean(msg.read_status)
          });
        });
      });
    });
  });

  // Escuchar cuando se envía un nuevo mensaje
  socket.on('send_message', (data) => {
    const { from_user_id, to_user_id, message_text } = data;
    
    // 1. Guardar el mensaje en la tabla chat_messages de tu SQLite
    const sql = 'INSERT INTO chat_messages (from_user_id, to_user_id, message_text) VALUES (?, ?, ?)';
    db.run(sql, [from_user_id, to_user_id, message_text], function(err) {
      if (err) {
        console.error('[WebSocket] Error guardando mensaje en la BD:', err);
        return;
      }
      
      // 2. Emitir en tiempo real al destinatario y al remitente
      const newMessage = { id: this.lastID, from_user_id, to_user_id, message_text, timestamp: new Date().toISOString(), read_status: false };
      io.to(to_user_id.toString()).emit('receive_message', newMessage);
      socket.emit('receive_message', newMessage); // Confirma al front que se guardó
    });
  });

  // Escuchar a los operarios de la app de Training
  socket.on('join_training', () => {
    socket.join('training_app_users');
    const count = io.sockets.adapter.rooms.get('training_app_users')?.size || 0;
    io.emit('training_online_count_update', count);
  });

  // Escuchar cuando un usuario avisa que ha leído los mensajes
  socket.on('messages_read', (data) => {
    const { from_user_id, to_user_id } = data;
    io.to(from_user_id.toString()).emit('messages_read_by_user', { read_by: to_user_id });
  });

  // Detectar antes de que se desconecte para saber si saldrá de la app de Training
  socket.on('disconnecting', () => {
    if (socket.rooms.has('training_app_users')) {
      const count = Math.max(0, (io.sockets.adapter.rooms.get('training_app_users')?.size || 1) - 1);
      io.emit('training_online_count_update', count);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Usuario desconectado: ${socket.id}`);
    // Solo apagamos el estado 'Online' si el socket que se desconecta es el último válido
    if (currentUserId && activeUserSockets.get(currentUserId) === socket.id) {
      activeUserSockets.delete(currentUserId);
      // Marcar usuario como desconectado
      const sql = `UPDATE user_presence SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE user_id = ?`;
      db.run(sql, [currentUserId], () => {
        io.emit('user_status_change', { userId: currentUserId, online: false });
        
        // Emitir el conteo total de usuarios online
        db.get('SELECT COUNT(*) as count FROM user_presence WHERE is_online = 1', (err, row) => {
          if (!err && row) io.emit('online_count_update', row.count);
        });
      });
    }
  });
});

// Start server
initDatabase().then(() => {
  // Limpiar estados colgados: poner a todos los usuarios como offline al arrancar el servidor
  db.run("UPDATE user_presence SET is_online = 0", (err) => {
    if (err) console.error("Error reseteando presencia:", err);
  });

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (with WebSockets)`);
    console.log(`API docs available at http://localhost:${PORT}/api-docs`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = app;