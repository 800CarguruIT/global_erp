require('module').Module._initPaths();
const sql = require('postgres')('postgres://autoguru:autoguru@localhost:5432/global_erp',{ssl:false});
(async()=>{
  try{
    const rows = await sql`SELECT a.id as accountId, a.code as accountCode, a.name as accountName, SUM(jl.debit - jl.credit) as amount FROM accounting_accounts a LEFT JOIN accounting_journal_lines jl ON jl.account_id = a.id AND jl.created_at::date >= '2025-12-27' AND jl.created_at::date <= '2025-12-27' WHERE a.type IN ('income','expense') GROUP BY a.id, a.code, a.name ORDER BY a.code`;
    console.log(rows);
  }catch(e){console.error(e);}finally{await sql.end();}
})();
