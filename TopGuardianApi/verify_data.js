const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'TopGuardian_Api.db');
const db = new sqlite3.Database(dbPath);

console.log('Verifying inserted data...\n');

// Check trainings
db.get('SELECT COUNT(*) as count FROM trainings', (err, row) => {
  if (err) console.error('Error:', err);
  else console.log(`Trainings: ${row.count}`);

  // Check employees
  db.get('SELECT COUNT(*) as count FROM employees', (err, row) => {
    if (err) console.error('Error:', err);
    else console.log(`Employees: ${row.count}`);

    // Check checklist items
    db.get('SELECT COUNT(*) as count FROM checklist_items', (err, row) => {
      if (err) console.error('Error:', err);
      else console.log(`Checklist Items: ${row.count}`);

      // Check planos
      db.get('SELECT COUNT(*) as count FROM planos', (err, row) => {
        if (err) console.error('Error:', err);
        else console.log(`Planos: ${row.count}`);

        // Check company trainings
        db.get('SELECT COUNT(*) as count FROM company_trainings', (err, row) => {
          if (err) console.error('Error:', err);
          else console.log(`Company Trainings: ${row.count}`);

          // Check employee trainings
          db.get('SELECT COUNT(*) as count FROM employee_trainings', (err, row) => {
            if (err) console.error('Error:', err);
            else console.log(`Employee Trainings: ${row.count}`);

            // Check checklist visits
            db.get('SELECT COUNT(*) as count FROM checklist_visits', (err, row) => {
              if (err) console.error('Error:', err);
              else console.log(`Checklist Visits: ${row.count}`);

              // Check risk matrices
              db.get('SELECT COUNT(*) as count FROM risk_matrices', (err, row) => {
                if (err) console.error('Error:', err);
                else console.log(`Risk Matrices: ${row.count}`);

                // Check risk matrix cells
                db.get('SELECT COUNT(*) as count FROM risk_matrix_cells', (err, row) => {
                  if (err) console.error('Error:', err);
                  else console.log(`Risk Matrix Cells: ${row.count}`);

                  console.log('\nData verification complete!');
                  db.close();
                });
              });
            });
          });
        });
      });
    });
  });
});