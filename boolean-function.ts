export class BooleanFunction {
  params: string[];
  table: Record<string, number[]>;

  constructor(readonly input: string) {
    if (!/^[a-zA-Z0-9•+¬()\s]+$/.test(this.input)) throw new SyntaxError('Invalid boolean function');

    const operators: Record<string, string> = { '•': '&', '+': '|', '¬': '!' };
    this.input = this.input.replaceAll(/[•+¬\s]/g, (match) => operators[match] ?? '');
    this.params = Array.from(new Set(Array.from(this.input.matchAll(/[01]|[a-zA-Z][0-9]?/g), (match) => match[0])));
    this.params.sort();

    this.table = Object.fromEntries(this.params.map((param) => [param, []]));
    this.table.result = [];
    for (const values of this.permutations()) {
      const expr = this.input.replaceAll(/[01]|[a-zA-Z][0-9]?/g, (match) => `${values[this.params.indexOf(match)]}`);
      this.params.forEach((param, index) => this.table[param].push(values[index]));
      this.table.result.push(Number(eval(expr)));
    }
    this.table.weight = this.table.result.map((value, exp, {length}) => value * 2 ** (length - exp - 1));
  }

  private *permutations(values: number[] = []): Iterable<number[]> {
    if (values.length < this.params.length) {
      yield* this.permutations([...values, 0]);
      yield* this.permutations([...values, 1]);
    } else {
      yield values;
    }
  }

  getCanonicalNormalForm(disjunctive: boolean) {
    return this.table.result
      .map(
        (result, index) =>
          disjunctive === !!result &&
          this.params.reduce(
            (acc, param, i) =>
              acc +
              (i ? ` ${disjunctive ? '•' : '+'} ` : '') +
              (disjunctive === !this.table[param][index] ? '¬' : '') +
              param,
            ''
          )
      )
      .filter(Boolean)
      .join(`  ${disjunctive ? '+' : '•'}  `);
  }

  getCanonicalNormalFormBinary(disjunctive: boolean) {
    return this.table.result
      .map((result, index) => disjunctive === !!result && index)
      .filter((number) => number !== false)
      .join(',');
  }


  get cdnf() {
    return this.getCanonicalNormalForm(true);
  }

  get ccnf() {
    return this.getCanonicalNormalForm(false);
  }

  get cdnfBinary() {
    return `V(${this.getCanonicalNormalFormBinary(true)})`;
  }

  get ccnfBinary() {
    return `Λ(${this.getCanonicalNormalFormBinary(false)})`;
  }

  get binaryIndex() {
    return this.table.result.reduce((acc, result, exp, { length }) => acc + (result && 2 ** (length - exp - 1)), 0);
  }
}
