/**
 * Check database schema - inspect tables, constraints, and indexes
 * 
 * Usage: tsx scripts/check-db-schema.ts [table-name]
 * Example: tsx scripts/check-db-schema.ts libraries
 */

import { Pool } from 'pg';

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL || process.env.LEARNING_DATABASE_URL_PROXY;
  
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL or LEARNING_DATABASE_URL_PROXY environment variable not set'
    );
  }
  
  return new Pool({ connectionString });
}

async function checkTableStructure(pool: Pool, tableName: string) {
  console.log(`\n📋 Table: ${tableName}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  // Check if table exists
  const tableExists = await pool.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )`,
    [tableName]
  );
  
  if (!tableExists.rows[0].exists) {
    console.log(`❌ Table "${tableName}" does not exist!\n`);
    return;
  }
  
  // Get columns
  console.log(`📊 Columns:`);
  const columns = await pool.query(
    `SELECT 
      column_name, 
      data_type, 
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position`,
    [tableName]
  );
  
  for (const col of columns.rows) {
    const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
    const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
    console.log(`   ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
  }
  
  // Get constraints
  console.log(`\n🔒 Constraints:`);
  const constraints = await pool.query(
    `SELECT
      con.conname AS constraint_name,
      con.contype AS constraint_type,
      CASE con.contype
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 'c' THEN 'CHECK'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'x' THEN 'EXCLUSION'
      END AS constraint_type_desc,
      pg_get_constraintdef(con.oid) AS constraint_definition
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
    AND rel.relname = $1
    ORDER BY con.contype, con.conname`,
    [tableName]
  );
  
  if (constraints.rows.length === 0) {
    console.log(`   (no constraints found)`);
  } else {
    for (const constraint of constraints.rows) {
      console.log(`   [${constraint.constraint_type_desc}] ${constraint.constraint_name}`);
      console.log(`      ${constraint.constraint_definition}`);
    }
  }
  
  // Get indexes
  console.log(`\n📇 Indexes:`);
  const indexes = await pool.query(
    `SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = $1
    ORDER BY indexname`,
    [tableName]
  );
  
  if (indexes.rows.length === 0) {
    console.log(`   (no indexes found)`);
  } else {
    for (const index of indexes.rows) {
      console.log(`   ${index.indexname}`);
      console.log(`      ${index.indexdef}`);
    }
  }
  
  console.log();
}

async function listAllTables(pool: Pool) {
  console.log(`\n📚 All Tables in Database:`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  const tables = await pool.query(
    `SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename`
  );
  
  if (tables.rows.length === 0) {
    console.log(`   (no tables found)`);
  } else {
    for (const table of tables.rows) {
      const rowCount = await pool.query(`SELECT COUNT(*) FROM ${table.tablename}`);
      console.log(`   ${table.tablename} (${rowCount.rows[0].count} rows)`);
    }
  }
  
  console.log();
}

async function main() {
  const tableName = process.argv[2];
  
  if (tableName === '--help' || tableName === '-h') {
    console.log(`
Usage: tsx scripts/check-db-schema.ts [table-name]

Check database schema - inspect tables, constraints, and indexes.

Arguments:
  table-name    (optional) Specific table to inspect (e.g., libraries)
                If omitted, lists all tables

Examples:
  # List all tables
  tsx scripts/check-db-schema.ts
  
  # Inspect specific table
  tsx scripts/check-db-schema.ts libraries
  tsx scripts/check-db-schema.ts concepts
`);
    process.exit(0);
  }
  
  const pool = createPool();
  
  try {
    if (tableName) {
      await checkTableStructure(pool, tableName);
    } else {
      await listAllTables(pool);
      console.log(`💡 Tip: Run 'tsx scripts/check-db-schema.ts <table-name>' for details\n`);
    }
  } catch (error) {
    console.error(`\n❌ Error:`, error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
