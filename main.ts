import { BooleanFunction } from './boolean-function.ts';

const expr = `¬((¬x2 + ¬x3) • ¬(x1 • ¬x3))`;

const data = new BooleanFunction(expr);

console.table(data.table);
console.log('%cCDNF:', 'color: green', data.cdnf);
console.log('%cCCNF:', 'color: green', data.ccnf);
console.log('%cCDNF bin:', 'color: green', data.cdnfBinary);
console.log('%cCCNF bin:', 'color: green', data.ccnfBinary);
console.log('%cBinary index:', 'color: green', data.binaryIndex);
