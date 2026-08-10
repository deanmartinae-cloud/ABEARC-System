const getTableColumns = async (tableName) => {
  const safeName = String(tableName || '').replace(/[^A-Za-z0-9_]/g, '');
  if (!safeName) throw new Error('Invalid table name for migration.');
  const rows = await dbAll(`PRAGMA table_info(${safeName})`);
  return rows || [];
};

const addColumnIfMissing = async (tableName, columnName, columnDefinition) => {
  const columns = await getTableColumns(tableName);
  const exists = columns.some(col => col.name === columnName);
  if (!exists) {
    await dbRun(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
};

const ensureCalendarEventTypeDetailMigration = async () => {
  await addColumnIfMissing('CalendarEvents', 'event_type_detail', 'TEXT');
};

const ensureUserDriveUploadIdempotencyMigration = async () => {
  await addColumnIfMissing('UserDriveFiles', 'upload_idempotency_key', 'TEXT');
  await dbRun(`CREATE UNIQUE INDEX IF NOT EXISTS idx_user_drive_upload_idempotency
               ON UserDriveFiles(owner_user_id, upload_idempotency_key)
               WHERE upload_idempotency_key IS NOT NULL`);
};

const removeNonSystemFeedbackNotifications = async () => {
  await dbRun(`
    DELETE FROM Notifications
    WHERE type = 'user_feedback_submitted'
      AND recipient_user_id NOT IN (
        SELECT id
        FROM Users
        WHERE role = 'system'
           OR COALESCE(is_system_account, 0) = 1
      )
  `);
};

const ensureUsersSystemRoleMigration = async () => {
  const table = await dbGet(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'Users'`);
  if (!table) return;

  let columns = await getTableColumns('Users');
  let columnNames = new Set(columns.map(col => col.name));
  const schemaSql = String(table.sql || '');
  const supportsSystemRole = /role\s+IN\s*\([^)]*['"]system['"]/i.test(schemaSql);

  if (supportsSystemRole) {
    await addColumnIfMissing('Users', 'is_system_account', 'INTEGER DEFAULT 0');
    await addColumnIfMissing('Users', 'hidden_from_workflows', 'INTEGER DEFAULT 0');
    await dbRun(`UPDATE Users
                 SET is_system_account = CASE WHEN role = 'system' THEN 1 ELSE COALESCE(is_system_account, 0) END,
                     hidden_from_workflows = CASE WHEN role = 'system' THEN 1 ELSE COALESCE(hidden_from_workflows, 0) END`);
    return;
  }

  const expr = (name, fallback) => columnNames.has(name) ? name : fallback;
  const roleExpr = `CASE WHEN role IN ('superadmin', 'admin', 'user', 'system') THEN role ELSE 'user' END`;
  const themeExpr = columnNames.has('theme_preference')
    ? `CASE WHEN theme_preference IN ('light', 'dark', 'system') THEN theme_preference ELSE 'light' END`
    : `'light'`;
  const avatarExpr = expr('avatar_path', 'NULL');
  const directSuperiorExpr = expr('direct_superior_user_id', 'NULL');
  const createdAtExpr = expr('created_at', 'CURRENT_TIMESTAMP');
  const isSystemExpr = columnNames.has('is_system_account') ? 'COALESCE(is_system_account, 0)' : '0';
  const hiddenExpr = columnNames.has('hidden_from_workflows') ? 'COALESCE(hidden_from_workflows, 0)' : '0';

  console.log('Migrating Users table to support the System / Maintenance role...');

  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('PRAGMA foreign_keys = OFF;', (fkOffErr) => {
        if (fkOffErr) return reject(fkOffErr);
        db.run('BEGIN IMMEDIATE;', (beginErr) => {
          if (beginErr) return reject(beginErr);
          const rollback = (err) => {
            db.run('ROLLBACK;', () => {
              db.run('PRAGMA foreign_keys = ON;', () => reject(err));
            });
          };
          db.exec(`
            DROP TABLE IF EXISTS Users_system_role_migration;
            CREATE TABLE Users_system_role_migration (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL CHECK(role IN ('superadmin', 'admin', 'user', 'system')),
              theme_preference TEXT DEFAULT 'light' CHECK(theme_preference IN ('light', 'dark', 'system')),
              avatar_path TEXT,
              direct_superior_user_id INTEGER,
              is_system_account INTEGER DEFAULT 0,
              hidden_from_workflows INTEGER DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO Users_system_role_migration (
              id, username, password_hash, role, theme_preference, avatar_path,
              direct_superior_user_id, is_system_account, hidden_from_workflows, created_at
            )
            SELECT
              id,
              username,
              password_hash,
              ${roleExpr},
              ${themeExpr},
              ${avatarExpr},
              ${directSuperiorExpr},
              CASE WHEN role = 'system' THEN 1 ELSE ${isSystemExpr} END,
              CASE WHEN role = 'system' THEN 1 ELSE ${hiddenExpr} END,
              ${createdAtExpr}
            FROM Users;
            DROP TABLE Users;
            ALTER TABLE Users_system_role_migration RENAME TO Users;
            CREATE INDEX IF NOT EXISTS idx_users_username ON Users(username);
          `, (execErr) => {
            if (execErr) return rollback(execErr);
            db.run('COMMIT;', (commitErr) => {
              if (commitErr) return rollback(commitErr);
              db.run('PRAGMA foreign_keys = ON;', (fkOnErr) => fkOnErr ? reject(fkOnErr) : resolve());
            });
          });
        });
      });
    });
  });

  await dbRun(`UPDATE Users
               SET is_system_account = CASE WHEN role = 'system' THEN 1 ELSE COALESCE(is_system_account, 0) END,
                   hidden_from_workflows = CASE WHEN role = 'system' THEN 1 ELSE COALESCE(hidden_from_workflows, 0) END`);
};

