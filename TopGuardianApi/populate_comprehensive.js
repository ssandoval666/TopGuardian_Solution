const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'TopGuardian_Api.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting to insert comprehensive mock data...');

// Insert additional employees
const additionalEmployees = [
  [1, 'Pedro', 'García', '34567890', 'Asistente', 'RRHH', 'pedro@acme.com', '999555666', 0],
  [2, 'Carlos', 'Ruiz', '56789012', 'Supervisor', 'Logística', 'carlos@globex.com', '999000111', 1]
];

let employeeCount = 0;
additionalEmployees.forEach(emp => {
  db.run('INSERT OR IGNORE INTO employees (company_id, first_name, last_name, document_number, position, department, email, phone, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', emp, function(err) {
    if (err) console.error('Error inserting employee:', err);
    else employeeCount++;
    if (employeeCount === additionalEmployees.length) {
      console.log('Employees inserted');
      insertChecklistItems();
    }
  });
});

function insertChecklistItems() {
  // Insert additional checklist items
  const additionalChecklistItems = [
    ['Botiquín de primeros auxilios completo', 'Salud'],
    ['Orden y limpieza general', 'Higiene'],
    ['Instalaciones eléctricas protegidas', 'Eléctrico'],
    ['Capacitación al día', 'Capacitación']
  ];

  let itemCount = 0;
  additionalChecklistItems.forEach(item => {
    db.run('INSERT OR IGNORE INTO checklist_items (name, category) VALUES (?, ?)', item, function(err) {
      if (err) console.error('Error inserting checklist item:', err);
      else itemCount++;
      if (itemCount === additionalChecklistItems.length) {
        console.log('Checklist items inserted');
        insertPlanos();
      }
    });
  });
}

function insertPlanos() {
  // Insert planos
  const planos = [
    { name: 'Plano Planta Baja', companyId: 1, fileName: 'planta_baja.pdf', fileData: Buffer.from('mock_pdf_data_planta_baja') },
    { name: 'Plano Segundo Piso', companyId: 1, fileName: 'segundo_piso.pdf', fileData: Buffer.from('mock_pdf_data_segundo_piso') },
    { name: 'Plano Evacuación', companyId: 1, fileName: 'evacuacion.pdf', fileData: Buffer.from('mock_pdf_data_evacuacion') },
    { name: 'Plano Oficinas', companyId: 2, fileName: 'oficinas.pdf', fileData: Buffer.from('mock_pdf_data_oficinas') }
  ];

  let planoCount = 0;
  planos.forEach(plano => {
    db.run('INSERT OR IGNORE INTO planos (name, company_id, file_name, file_data) VALUES (?, ?, ?, ?)',
      [plano.name, plano.companyId, plano.fileName, plano.fileData], function(err) {
        if (err) console.error('Error inserting plano:', err);
        else planoCount++;
        if (planoCount === planos.length) {
          console.log('Planos inserted');
          insertCompanyTrainings();
        }
      });
  });
}

function insertCompanyTrainings() {
  // Insert company trainings
  const companyTrainings = [
    { companyId: 1, trainingTitle: 'Seguridad e Higiene', assignedDate: '2025-01-10', completedDate: '2025-01-15', dueDate: '2026-01-15', recurrence: 'yearly' },
    { companyId: 1, trainingTitle: 'Primeros Auxilios', assignedDate: '2025-02-01', completedDate: null, dueDate: '2026-02-18', recurrence: 'yearly' },
    { companyId: 2, trainingTitle: 'Manejo de Extintores', assignedDate: '2025-03-01', completedDate: '2025-03-10', dueDate: '2025-04-10', recurrence: 'monthly' },
    { companyId: 1, trainingTitle: 'Trabajo en Altura', assignedDate: '2025-04-01', completedDate: null, dueDate: null, recurrence: 'none' },
    { companyId: 2, trainingTitle: 'Seguridad e Higiene', assignedDate: '2025-01-20', completedDate: '2025-02-01', dueDate: '2026-02-01', recurrence: 'yearly' }
  ];

  let ctCount = 0;
  companyTrainings.forEach(ct => {
    // Get training ID first
    db.get('SELECT id FROM trainings WHERE title = ?', [ct.trainingTitle], function(err, row) {
      if (err) {
        console.error('Error getting training ID:', err);
        ctCount++;
        if (ctCount === companyTrainings.length) finish();
        return;
      }

      if (row) {
        db.run('INSERT OR IGNORE INTO company_trainings (company_id, training_id, assigned_date, completed_date, due_date, recurrence) VALUES (?, ?, ?, ?, ?, ?)',
          [ct.companyId, row.id, ct.assignedDate, ct.completedDate, ct.dueDate, ct.recurrence], function(err) {
            if (err) console.error('Error inserting company training:', err);
            ctCount++;
            if (ctCount === companyTrainings.length) {
              console.log('Company trainings inserted');
              insertEmployeeTrainings();
            }
          });
      } else {
        ctCount++;
        if (ctCount === companyTrainings.length) {
          console.log('Company trainings inserted');
          insertEmployeeTrainings();
        }
      }
    });
  });
}

function insertEmployeeTrainings() {
  // Insert employee trainings
  const employeeTrainings = [
    { employeeDoc: '12345678', trainingTitle: 'Seguridad e Higiene', assignedDate: '2025-01-10', completedDate: '2025-01-15', dueDate: '2026-01-15', recurrence: 'yearly' },
    { employeeDoc: '12345678', trainingTitle: 'Primeros Auxilios', assignedDate: '2025-02-01', completedDate: null, dueDate: '2026-02-18', recurrence: 'yearly' },
    { employeeDoc: '23456789', trainingTitle: 'Manejo de Extintores', assignedDate: '2025-03-01', completedDate: '2025-03-10', dueDate: '2025-04-10', recurrence: 'monthly' }
  ];

  let etCount = 0;
  employeeTrainings.forEach(et => {
    // Get employee and training IDs
    db.get('SELECT id FROM employees WHERE document_number = ?', [et.employeeDoc], function(err, empRow) {
      if (err) {
        console.error('Error getting employee ID:', err);
        etCount++;
        if (etCount === employeeTrainings.length) finish();
        return;
      }

      db.get('SELECT id FROM trainings WHERE title = ?', [et.trainingTitle], function(err, trainRow) {
        if (err) {
          console.error('Error getting training ID:', err);
          etCount++;
          if (etCount === employeeTrainings.length) finish();
          return;
        }

        if (empRow && trainRow) {
          db.run('INSERT OR IGNORE INTO employee_trainings (employee_id, training_id, assigned_date, completed_date, due_date, recurrence) VALUES (?, ?, ?, ?, ?, ?)',
            [empRow.id, trainRow.id, et.assignedDate, et.completedDate, et.dueDate, et.recurrence], function(err) {
              if (err) console.error('Error inserting employee training:', err);
              etCount++;
              if (etCount === employeeTrainings.length) {
                console.log('Employee trainings inserted');
                insertChecklistVisits();
              }
            });
        } else {
          etCount++;
          if (etCount === employeeTrainings.length) {
            console.log('Employee trainings inserted');
            insertChecklistVisits();
          }
        }
      });
    });
  });
}

function insertChecklistVisits() {
  // Insert checklist visits and entries
  const checklistVisits = [
    { companyId: 1, visitDate: '2026-03-15', entries: [
      { itemName: 'Extintores en buen estado', compliant: 1, observations: '' },
      { itemName: 'Señalización de emergencia visible', compliant: 1, observations: '' },
      { itemName: 'Salidas de emergencia despejadas', compliant: 0, observations: 'Salida bloqueada en sector B' },
      { itemName: 'EPP disponible y en condiciones', compliant: 1, observations: '' },
      { itemName: 'Botiquín de primeros auxilios completo', compliant: 1, observations: '' },
      { itemName: 'Orden y limpieza general', compliant: 0, observations: 'Área de almacén desordenada' }
    ]},
    { companyId: 1, visitDate: '2026-02-10', entries: [
      { itemName: 'Extintores en buen estado', compliant: 1, observations: '' },
      { itemName: 'Señalización de emergencia visible', compliant: 0, observations: 'Falta señalización en piso 2' },
      { itemName: 'Salidas de emergencia despejadas', compliant: 1, observations: '' },
      { itemName: 'Instalaciones eléctricas protegidas', compliant: 1, observations: '' }
    ]},
    { companyId: 2, visitDate: '2026-03-20', entries: [
      { itemName: 'Extintores en buen estado', compliant: 1, observations: '' },
      { itemName: 'EPP disponible y en condiciones', compliant: 1, observations: '' },
      { itemName: 'Botiquín de primeros auxilios completo', compliant: 0, observations: 'Faltan insumos básicos' },
      { itemName: 'Orden y limpieza general', compliant: 1, observations: '' },
      { itemName: 'Capacitación al día', compliant: 1, observations: '' }
    ]}
  ];

  let visitCount = 0;
  checklistVisits.forEach(visit => {
    db.run('INSERT OR IGNORE INTO checklist_visits (company_id, visit_date) VALUES (?, ?)',
      [visit.companyId, visit.visitDate], function(err) {
        if (err) {
          console.error('Error inserting visit:', err);
          visitCount++;
          if (visitCount === checklistVisits.length) finish();
          return;
        }

        const visitId = this.lastID;
        let entryCount = 0;

        visit.entries.forEach(entry => {
          db.get('SELECT id FROM checklist_items WHERE name = ?', [entry.itemName], function(err, row) {
            if (err) {
              console.error('Error getting item ID:', err);
              entryCount++;
              if (entryCount === visit.entries.length) {
                visitCount++;
                if (visitCount === checklistVisits.length) finish();
              }
              return;
            }

            if (row) {
              db.run('INSERT OR IGNORE INTO checklist_entries (visit_id, item_id, compliant, observations) VALUES (?, ?, ?, ?)',
                [visitId, row.id, entry.compliant, entry.observations], function(err) {
                  if (err) console.error('Error inserting entry:', err);
                  entryCount++;
                  if (entryCount === visit.entries.length) {
                    visitCount++;
                    if (visitCount === checklistVisits.length) {
                      console.log('Checklist visits and entries inserted');
                      insertRiskMatrix();
                    }
                  }
                });
            } else {
              entryCount++;
              if (entryCount === visit.entries.length) {
                visitCount++;
                if (visitCount === checklistVisits.length) {
                  console.log('Checklist visits and entries inserted');
                  insertRiskMatrix();
                }
              }
            }
          });
        });
      });
  });
}

function insertRiskMatrix() {
  // Insert risk matrix
  db.run('INSERT OR IGNORE INTO risk_matrices (company_id, name, date) VALUES (?, ?, ?)',
    [1, 'Matriz IPERC - Planta Principal', '2026-01-15'], function(err) {
      if (err) {
        console.error('Error inserting risk matrix:', err);
        finish();
        return;
      }

      const matrixId = this.lastID;
      console.log('Risk matrix inserted');

      // Insert sectors
      const sectors = [
        { name: 'Servicio de Alimentación' },
        { name: 'Servicio de Nutrición' },
        { name: 'Mantenimiento' }
      ];

      let sectorCount = 0;
      const sectorIds = [];

      sectors.forEach(sector => {
        db.run('INSERT OR IGNORE INTO risk_matrix_sectors (matrix_id, name) VALUES (?, ?)',
          [matrixId, sector.name], function(err) {
            if (err) console.error('Error inserting sector:', err);
            else sectorIds.push(this.lastID);
            sectorCount++;
            if (sectorCount === sectors.length) {
              console.log('Sectors inserted');
              insertHazards(matrixId, sectorIds);
            }
          });
      });
    });
}

function insertHazards(matrixId, sectorIds) {
  // Insert hazards
  const hazards = [
    { name: 'Ruido', category: 'Físico' },
    { name: 'Iluminación', category: 'Físico' },
    { name: 'Sustancias tóxicas', category: 'Químico' },
    { name: 'Posturas forzadas', category: 'Ergonómico' },
    { name: 'Estrés laboral', category: 'Psicosocial' },
    { name: 'Caída de objetos', category: 'Mecánico' }
  ];

  let hazardCount = 0;
  const hazardIds = [];

  hazards.forEach(hazard => {
    db.run('INSERT OR IGNORE INTO risk_matrix_hazards (matrix_id, name, category) VALUES (?, ?, ?)',
      [matrixId, hazard.name, hazard.category], function(err) {
        if (err) console.error('Error inserting hazard:', err);
        else hazardIds.push(this.lastID);
        hazardCount++;
        if (hazardCount === hazards.length) {
          console.log('Hazards inserted');
          insertCells(matrixId, hazardIds, sectorIds);
        }
      });
  });
}

function insertCells(matrixId, hazardIds, sectorIds) {
  // Insert cells
  const cells = [
    { hazardIndex: 0, sectorIndex: 0, probability: 3, severity: 2, controlMeasure: 'Uso de protectores auditivos' },
    { hazardIndex: 1, sectorIndex: 0, probability: 2, severity: 1, controlMeasure: 'Iluminación adecuada' },
    { hazardIndex: 2, sectorIndex: 0, probability: 4, severity: 4, controlMeasure: 'EPP y ventilación' },
    { hazardIndex: 3, sectorIndex: 0, probability: 3, severity: 3, controlMeasure: 'Rotación de tareas' },
    { hazardIndex: 4, sectorIndex: 0, probability: 2, severity: 2, controlMeasure: 'Pausas activas' },
    { hazardIndex: 5, sectorIndex: 0, probability: 4, severity: 5, controlMeasure: 'Señalización y cascos' },
    { hazardIndex: 0, sectorIndex: 1, probability: 2, severity: 2, controlMeasure: 'Ambiente controlado' },
    { hazardIndex: 1, sectorIndex: 1, probability: 1, severity: 1, controlMeasure: 'OK' },
    { hazardIndex: 2, sectorIndex: 1, probability: 1, severity: 3, controlMeasure: 'Mínima exposición' },
    { hazardIndex: 3, sectorIndex: 1, probability: 4, severity: 3, controlMeasure: 'Sillas ergonómicas' },
    { hazardIndex: 4, sectorIndex: 1, probability: 3, severity: 3, controlMeasure: 'Programa de bienestar' },
    { hazardIndex: 5, sectorIndex: 1, probability: 1, severity: 2, controlMeasure: 'N/A' },
    { hazardIndex: 0, sectorIndex: 2, probability: 5, severity: 3, controlMeasure: 'Doble protección auditiva' },
    { hazardIndex: 1, sectorIndex: 2, probability: 3, severity: 2, controlMeasure: 'Lámparas portátiles' },
    { hazardIndex: 2, sectorIndex: 2, probability: 4, severity: 5, controlMeasure: 'Procedimiento especial' },
    { hazardIndex: 3, sectorIndex: 2, probability: 3, severity: 2, controlMeasure: 'Capacitación postural' },
    { hazardIndex: 4, sectorIndex: 2, probability: 2, severity: 2, controlMeasure: 'Supervisión' },
    { hazardIndex: 5, sectorIndex: 2, probability: 5, severity: 5, controlMeasure: 'Detener actividad' }
  ];

  let cellCount = 0;
  cells.forEach(cell => {
    const riskScore = cell.probability * cell.severity;
    let riskLevel;
    if (riskScore <= 4) riskLevel = 'trivial';
    else if (riskScore <= 8) riskLevel = 'tolerable';
    else if (riskScore <= 12) riskLevel = 'moderado';
    else if (riskScore <= 16) riskLevel = 'importante';
    else riskLevel = 'intolerable';

    db.run('INSERT OR IGNORE INTO risk_matrix_cells (matrix_id, hazard_id, sector_id, probability, severity, risk_score, risk_level, control_measure) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [matrixId, hazardIds[cell.hazardIndex], sectorIds[cell.sectorIndex], cell.probability, cell.severity, riskScore, riskLevel, cell.controlMeasure], function(err) {
        if (err) console.error('Error inserting cell:', err);
        cellCount++;
        if (cellCount === cells.length) {
          console.log('Risk matrix cells inserted');
          insertMenu();
        }
      });
  });
}

function insertMenu() {
  // Insert menu items
  const menuItems = [
    // Root level items
    { key: 'dash', name: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard', parent_key: null, roles: 'admin,manager,supervisor,employee,viewer' },
    { key: 'risk-matrix', name: 'Matriz de Riesgo', icon: 'Shield', path: '/dashboard/risk-matrix', parent_key: null, roles: 'admin,manager,supervisor,employee,viewer' },
    { key: 'planos', name: 'Planos', icon: 'Map', path: '/dashboard/planos', parent_key: null, roles: 'admin,manager,supervisor,employee,viewer' },
    { key: 'checklist-visits', name: 'Check Lista Visitas', icon: 'ClipboardCheck', path: '/dashboard/checklist-visits', parent_key: null, roles: 'admin,manager,supervisor,employee,viewer' },
    { key: 'settings', name: 'Configuración', icon: 'Settings', path: '', parent_key: null, roles: 'admin,manager' },

    // Settings children
    { key: 'companies', name: 'Empresas', icon: 'Building2', path: '/dashboard/companies', parent_key: 'settings', roles: 'admin' },
    { key: 'users', name: 'Usuarios', icon: 'Users', path: '/dashboard/users', parent_key: 'settings', roles: 'admin,manager' },
    { key: 'trainings', name: 'Capacitaciones', icon: 'GraduationCap', path: '/dashboard/trainings', parent_key: 'settings', roles: 'admin,manager' },
    { key: 'checklist-items', name: 'Items Check List', icon: 'ClipboardList', path: '/dashboard/checklist-items', parent_key: 'settings', roles: 'admin,manager' },
    { key: 'calendar', name: 'Calendario', icon: 'CalendarDays', path: '/dashboard/calendario', parent_key: 'settings', roles: 'admin,manager,supervisor,employee,viewer' }
  ];

  let menuCount = 0;
  menuItems.forEach(menu => {
    db.run('INSERT OR IGNORE INTO menus (key, name, icon, path, parent_key, roles) VALUES (?, ?, ?, ?, ?, ?)',
      [menu.key, menu.name, menu.icon, menu.path, menu.parent_key, menu.roles], function(err) {
        if (err) console.error('Error inserting menu item:', err);
        else menuCount++;
        if (menuCount === menuItems.length) {
          console.log('Menu items inserted');
          insertRoles();
        }
      });
  });
}

function insertRoles() {
  // Insert roles
  const roles = [
    { nombre: 'administrador' },
    { nombre: 'editor' },
    { nombre: 'visualizador' }
  ];

  let roleCount = 0;
  roles.forEach(role => {
    db.run('INSERT OR IGNORE INTO roles (nombre) VALUES (?)',
      [role.nombre], function(err) {
        if (err) console.error('Error inserting role:', err);
        else roleCount++;
        if (roleCount === roles.length) {
          console.log('Roles inserted');
          finish();
        }
      });
  });
}

function finish() {
  console.log('All additional mock data inserted successfully!');
  db.close();
}