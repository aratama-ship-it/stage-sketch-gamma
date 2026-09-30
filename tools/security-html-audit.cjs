// ACORN_MODULE can point to an existing local parser; no runtime dependency is added.
const fs = require('node:fs');
const acorn = require(process.env.ACORN_MODULE || 'acorn');
const source = fs.readFileSync(process.argv[2] || 'light-design/app.js', 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest', locations: true });
const rows = [];
function visit(node) {
  if (!node || typeof node !== 'object') return;
  let kind, value;
  if (node.type === 'AssignmentExpression' && ['innerHTML','outerHTML','srcdoc'].includes(node.left?.property?.name)) {
    kind = node.left.property.name; value = node.right;
  } else if (node.type === 'CallExpression' && ['el','dialog'].includes(node.callee?.name)) {
    kind = node.callee.name; value = node.arguments[kind === 'el' ? 2 : 0];
  } else if (node.type === 'CallExpression' && ['insertAdjacentHTML','write','writeln','createContextualFragment'].includes(node.callee?.property?.name)) {
    kind = node.callee.property.name; value = node.arguments[kind === 'insertAdjacentHTML' ? 1 : 0];
  }
  if (value) rows.push({ line: node.loc.start.line, kind, expression: source.slice(value.start, value.end) });
  for (const [key, child] of Object.entries(node)) if (key !== 'loc') {
    if (Array.isArray(child)) child.forEach(visit); else if (child && typeof child === 'object') visit(child);
  }
}
visit(ast);
console.log(JSON.stringify(rows, null, 2));
