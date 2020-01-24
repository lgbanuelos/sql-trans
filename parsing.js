const fs = require('fs');
const parser = require('pg-query-parser');
const ejs = require('ejs');

var contents = fs.readFileSync('input.sql', 'utf8');

var q = parser.parse(contents).query;

var x = q.reduce((acc, stmt) => {
  if (stmt.SelectStmt) {
    result  = ejs.render(`
<% var hasFunctionCalls = false; -%>
INSERT INTO <%= n.intoClause.IntoClause.rel.RangeVar.relname %>
SELECT <%= n.targetList.map( tgt =>
  tgt.ResTarget.val.ColumnRef.fields.map( s => s.String.str ).join('.') +
  ' AS ' + tgt.ResTarget.name ).join(', ') %>
FROM <%= n.fromClause.map( elem => {
  if (elem.RangeVar) {
    return elem.RangeVar.relname + ' AS ' + elem.RangeVar.alias.Alias.aliasname;
  } else if (elem.RangeFunction) {
    hasFunctionCalls = true;
    return elem.RangeFunction.functions[0][0].FuncCall.funcname[0].String.str + ' AS ' + elem.RangeFunction.alias.Alias.aliasname;
 }}).join(', ') -%>
<% if (n.whereClause) {

} else if (hasFunctionCalls) { %>
WHERE <%= n.fromClause
           .filter( elem => elem.RangeFunction )
           .map( elem => {
              arg = elem.RangeFunction.functions[0][0].FuncCall.args[0];
              return elem.RangeFunction.alias.Alias.aliasname +
                     '.param1 = ' + arg.ColumnRef.fields.map( s => s.String.str ).join('.');
            })
      -%>
<% } %>;`, 
      {n: stmt.SelectStmt});
    return [...acc, result];
  } else if (stmt.CreateFunctionStmt) {
    var param1 = stmt.CreateFunctionStmt.parameters.name;
    var inner = parser.parse(stmt.CreateFunctionStmt.options[0].DefElem.arg[0].String.str);

    var column = inner.query[0].SelectStmt.whereClause.BoolExpr.args
    .find( elem => elem.A_Expr.rexpr.ColumnRef.fields.map(s => s.String.str).join('.') == 'pname')
    .A_Expr.lexpr.ColumnRef.fields.map(s => s.String.str).join('.');

    result = "\nINSERT INTO " + stmt.CreateFunctionStmt.funcname[0].String.str;
    result += ejs.render(`
<%
let expand = (expr) => {
  if (expr.ColumnRef) {
    return expr.ColumnRef.fields.map(s => s.String.str).join('.');
  } else if (expr.A_Expr) {
    return expand(expr.A_Expr.lexpr) + ' ' +
      expr.A_Expr.name[0].String.str + ' ' +
      expand(expr.A_Expr.rexpr); 
  } else if (expr.FuncCall) {
    return expr.FuncCall.funcname[0].String.str + '(' +
      expr.FuncCall.args.map( a => expand(a) ).join(', ') + ')';
  } else if (expr.A_Const) {
    return expr.A_Const.val.Float.str;
  }
}
-%>
SELECT <%= n.targetList.map( tgt =>
  tgt.ResTarget.val.FuncCall.funcname.map( s => s.String.str ).join('.') + '(' +
  tgt.ResTarget.val.FuncCall.args.map( a => a.ColumnRef.fields.map( s => s.String.str ).join('.') ).join('.') + ')' +
  ' AS ' + tgt.ResTarget.name ).join(', ') %>,
  <%= column %> AS param1
FROM <%= n.fromClause.map( elem => elem.RangeVar.relname).join(', ')%>
WHERE <%-
n.whereClause.BoolExpr.args
.filter( elem => elem.A_Expr.rexpr.ColumnRef.fields.map(s => s.String.str).join('.') != param1)
.map( elem => { 
  return expand(elem.A_Expr.lexpr) + ' ' +
    elem.A_Expr.name[0].String.str + ' ' +
    expand(elem.A_Expr.rexpr); 
}).join('\\n AND ')
%>;
GROUP BY <%= column %>;`, 
      {n: inner.query[0].SelectStmt, param1: param1, column: column});
    return [...acc, result];
  } else {
    // console.log(stmt);
  }
}, []);

 console.log(x.join('\n'));
