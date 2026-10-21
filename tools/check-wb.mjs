// Checks World Bank indicators: node tools/check-wb.mjs CODE [CODE…] → rows, newest year, sample
for (const c of process.argv.slice(2)) {
  try {
    const j = await (await fetch(`https://api.worldbank.org/v2/country/all/indicator/${c}?format=json&per_page=20000&mrnev=1`)).json();
    const rows = (j[1] || []).filter(r => r.value != null && /^[A-Z]{3}$/.test(r.countryiso3code));
    const esp = rows.find(r => r.countryiso3code === 'ESP'), ind = rows.find(r => r.countryiso3code === 'IND');
    console.log(`${c}: ${rows.length} countries, newest ${Math.max(...rows.map(r => +r.date))} · ESP ${esp?.value} (${esp?.date}) · IND ${ind?.value} (${ind?.date})${j[0]?.message ? ' · ' + JSON.stringify(j[0].message) : ''}`);
  } catch (e) { console.log(`${c}: ERROR ${e.message}`); }
}
