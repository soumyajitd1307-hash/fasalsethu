// Mandi CSV import runner (B1 Task 4).
// Usage:  DATABASE_URL="postgresql://..." node scripts/import-mandi-csv.js <file.csv> [source]
// Input: Agmarknet-style CSV (State,District,Market,Commodity,Variety,Grade,
// Arrival_Date,Min_Price,Max_Price,Modal_Price). Prints import statistics.
const fs = require('fs');
const path = require('path');
const { parseCsvText, importRecords } = require('../src/services/marketPriceIngestService');
const { disconnect } = require('../src/config/database');

async function main() {
  const file = process.argv[2];
  const source = process.argv[3] || 'agmarknet';
  if (!file) {
    console.error('Usage: node scripts/import-mandi-csv.js <file.csv> [source]');
    process.exit(1);
  }
  const text = fs.readFileSync(path.resolve(file), 'utf8');
  const rows = parseCsvText(text);
  console.log(`Parsed ${rows.length} rows from ${file}`);
  const stats = await importRecords(rows, { source });
  console.log(JSON.stringify(stats, null, 2));
  await disconnect();
}

main().catch(async (err) => {
  console.error('Import failed:', err.message);
  await disconnect();
  process.exit(1);
});
