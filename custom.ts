const ALPHABET = {
  CONSTANT: '01',
  DIGIT: '0123456789',
  LETTER: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  OPERATORS: '+•>~',
  UNARY_OPERATORS: '¬',
} as const;

export class BooleanFunction {
  atomics: string[] = [];
  variables: Record<string, number | string>;
  table: Record<string, (string | number)[]> = {};
  sdnf = '';
  sknf = '';
  positive = 0;
  negative = 0;
  total = 0;

  constructor(
    public readonly expression: string,
    initialVariables: Record<string, number> = {},
    private readonly atomicsOnly = false
  ) {
    this.variables = { ...initialVariables };
    const chars = expression.split('').filter((x) => x !== ' ' && x !== '\n');
    this.parse(chars);
    if (chars.length) {
      throw new SyntaxError(`Unexpected '${chars[0]}' after '${Object.keys(this.variables).at(-1)}'`);
    }
    if (!Object.keys(this.variables).length) {
      throw new SyntaxError('The formula is invalid or empty');
    }
  }

  private parseAtomic(input: string[]) {
    let letters = '';
    let postfix = '';
    while (input[0]) {
      if (ALPHABET.LETTER.includes(input[0])) {
        if (postfix) {
          throw new SyntaxError(`Invalid atomic '${letters + postfix + input[0]}'`);
        }
        letters += input.shift();
      } else if (ALPHABET.DIGIT.includes(input[0])) {
        if (!letters && !ALPHABET.CONSTANT.includes(input[0])) {
          throw new SyntaxError(`Invalid atomic '${input[0]}'`);
        }
        postfix += input.shift();
      } else {
        break;
      }
    }
    if (!letters && postfix) {
      return postfix;
    }
    if (!this.atomics.includes(letters + postfix)) {
      this.atomics.push(letters + postfix);
    }
    return letters + postfix;
  }

  parse(input: string[]): string | undefined {
    if (input[0] === '(') {
      input.shift();
      if (ALPHABET.UNARY_OPERATORS.includes(input[0])) {
        const operator = input.shift()!;
        const operand = this.parse(input);
        if (!operand) {
          throw new SyntaxError(`No operand found for operator '${operator}'`);
        }
        if (input.shift() !== ')') {
          throw new SyntaxError(`No closing bracket found after '(${operator}${operand}'`);
        }
        const variable = `(${operator}${operand})`;
        if (!(variable in this.variables) && !this.atomicsOnly)
          this.variables[variable] = this.solveUnaryOperation(operator, operand) ?? variable;
        return variable;
      }
      const first = this.parse(input);
      if (!first) {
        throw new SyntaxError(`No operand found after opening bracket (unexpected '${input[0]}')`);
      }
      const operator = input.shift();
      if (!operator || !ALPHABET.OPERATORS.includes(operator)) {
        throw new SyntaxError(`No operator found after '(${first}' (unexpected '${operator}')`);
      }
      const second = this.parse(input);
      if (!second) {
        throw new SyntaxError(`No operand found after '(${first}${operator}' (unexpected '${input[0]}')`);
      }
      if (input.shift() !== ')') {
        throw new SyntaxError(`No closing bracket found after '(${first}${operator}${second}'`);
      }
      const variable = `(${first}${operator}${second})`;
      if (!(variable in this.variables) && !this.atomicsOnly)
        this.variables[variable] = this.solveOperation(first, operator, second) ?? variable;
      return variable;
    }
    const atomic = this.parseAtomic(input);
    if (atomic) {
      if (!(atomic in this.variables)) this.variables[atomic] = atomic;
      return atomic;
    }
  }

  solveOperation(first: string, operator: string, second: string) {
    if (isNaN(+this.variables[first]) || isNaN(+this.variables[second])) return;
    switch (operator) {
      case '+':
        return +(this.variables[first] || this.variables[second]);
      case '•':
        return +(this.variables[first] && this.variables[second]);
      case '>':
        return +(!this.variables[first] || this.variables[second]);
      case '~':
        return +(this.variables[first] === this.variables[second]);
      default:
        throw new SyntaxError(`Invalid operator '${operator}'`);
    }
  }

  solveUnaryOperation(operator: string, operand: string) {
    if (isNaN(+this.variables[operand])) return;
    switch (operator) {
      case '¬':
        return +!this.variables[operand];
      default:
        throw new SyntaxError(`Invalid unary operator '${operator}'`);
    }
  }

  private *permutations(values: number[] = []): Iterable<Record<string, string | number>> {
    if (values.length < this.atomics.length) {
      yield* this.permutations([...values, 0]);
      yield* this.permutations([...values, 1]);
    } else {
      const definedVariables = {} as Record<string, number>;
      this.atomics.forEach((atomic, index) => (definedVariables[atomic] = values[index]));
      const subinstance = new BooleanFunction(this.expression, definedVariables);
      yield subinstance.variables;
    }
  }

  details(full?: true) {
    this.atomics.sort();
    const result = Array.from(this.permutations());
    const cdnf = [];
    const ccnf = [];
    const final = Object.keys(this.variables).at(-1);

    const source = full ? Object.keys(this.variables) : this.atomics;
    this.table = Object.fromEntries(source.map((atomic) => [atomic, []]));
    this.table.result = [];
    if (final) {
      for (const entry of result) {
        entry[final];
        source.forEach((atomic) => this.table[atomic]?.push(entry[atomic]));
        this.table.result.push(entry[final]);
        const nf = this.atomics.map((atomic) => (entry[atomic] === entry[final] ? atomic : `(¬${atomic})`));
        if (entry[final]) {
          cdnf.push(nf.reduce((a, x) => (a ? `(${a}•${x})` : x), ''));
        } else {
          ccnf.push(nf.reduce((a, x) => (a ? `(${a}+${x})` : x), ''));
        }
      }
    }

    this.table.weight = this.table.result.map((value, exp, { length }) => +value * 2 ** (length - exp - 1));
    this.sdnf = cdnf.reduce((a, x) => (a ? `(${a}+${x})` : x), '');
    this.sknf = ccnf.reduce((a, x) => (a ? `(${a}•${x})` : x), '');
    this.positive = cdnf.length;
    this.negative = ccnf.length;
    this.total = result.length;
  }

  getCanonicalNormalForm(disjunctive: boolean) {
    return this.table.result
      .map(
        (result, index) =>
          disjunctive === !!result &&
          this.atomics.reduce(
            (acc, atomic, i) =>
              acc +
              (i ? ` ${disjunctive ? '•' : '+'} ` : '') +
              (disjunctive === !this.table[atomic][index] ? '¬' : '') +
              atomic,
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
    return this.table.result.reduce<number>(
      (acc, result, exp, { length }) => acc + (+result && 2 ** (length - exp - 1)),
      0
    );
  }
}
