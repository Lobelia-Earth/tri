import { tri } from '../index';

describe('Process', () => {
  // ====================================
  // Basic
  // ====================================
  it('null', () => {
    expect(tri(null)).toBeNull();
  });

  it('undefined', () => {
    expect(tri(undefined)).toBeUndefined();
  });

  it('tree with no definitions', () => {
    const tree = {
      a: {
        b: { c: 3, d: 'foo', e: null, f: true, g: undefined },
        h: [3, 4, 'a'],
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('removes $definitions', () => {
    const tree = { a: 3, $definitions: { foo: 4 } };
    expect(tri(tree)).toMatchSnapshot();
  });

  // ====================================
  // Interpolation
  // ====================================
  it('simple interpolation', () => {
    const tree = {
      a: { b: 'Length: <<$.len>> <<$.units>>' },
      $definitions: { len: 7, units: 'm' },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('simple interpolation without escapes', () => {
    const tree = {
      a: { b: 'Comparisons <<$.lt>> <<$.gt>>' },
      $definitions: { lt: '<', gt: '>' },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('nested interpolation', () => {
    const tree = {
      a: 'Hello <<$.foo>>',
      $definitions: {
        foo: '<<$.bar>>!',
        bar: 'world',
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  // ====================================
  // Call shortcut
  // ====================================
  it('call shortcut', () => {
    const tree = {
      a: '$foo',
      $definitions: { foo: 'Some fixed text' },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('call shortcut, optional', () => {
    const tree = {
      a: '$foo?',
      $definitions: { foo: 'Some fixed text' },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('call shortcut with invalid name throws', () => {
    const tree = {
      a: '$fuzz',
      $definitions: { foo: 'Some fixed text' },
    };
    expect(() => tri(tree)).toThrowError();
  });

  it('call shortcut, optional, with invalid name does not throw', () => {
    const tree = { a: '$fuzz?' };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('nested call shortcuts', () => {
    const tree = {
      a: '$foo',
      $definitions: { foo: '$bar', bar: 'Final text' },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('exploded short call', () => {
    const tree = {
      a: ['$*foo', '$*bar'],
      $definitions: {
        foo: ['$*qux', 3],
        bar: [4, '$theEnd'],
        qux: [1, 2],
        theEnd: 'finished!',
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('exploded short call returning non-array throws', () => {
    const tree = {
      a: ['$*foo'],
      $definitions: { foo: 'Some fixed text' },
    };
    expect(() => tri(tree)).toThrowError();
  });

  // ====================================
  // Call shortcut + interpolation
  // ====================================
  it('nested shortcut and interpolation', () => {
    const tree = {
      a: '$foo',
      $definitions: { foo: '$bar', bar: 'Hello <<$.bass>>', bass: 'world!' },
      // NOTE: it doesn't work the other way around (shortcut inside interpolation)
      // Workaround: just use interpolation inside interpolation in this case
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('nested interpolation and shortcut', () => {
    const tree = {
      a: '$foo',
      $definitions: {
        foo: '<<$.prefix>> <<$.bar>>',
        prefix: 'Hello',
        bar: '$bass',
        bass: 'world!',
      },
    };
    expect(tri(tree).a).toEqual('Hello world!');
  });

  // ====================================
  // Calls
  // ====================================
  it('call', () => {
    const tree = {
      a: { $call: 'foo' },
      $definitions: { foo: 3 },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('call, optional', () => {
    const tree = {
      a: { $call: 'foo', $optional: true },
      $definitions: { foo: 3 },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('call with invalid name throws', () => {
    const tree = { a: { $call: 'foo' } };
    expect(() => tri(tree)).toThrowError();
  });

  it('call, optional, with invalid name does not throw', () => {
    const tree = {
      a: { $call: 'fuzz', $optional: true },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('call with params', () => {
    const tree = {
      a: { $call: 'fn', $params: { param1: 7, param2: { foo: true } } },
      $definitions: {
        fn: {
          result1: '$param1',
          result2: '$param2',
          result3: 'My age is <<$.param1>>',
        },
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('nested calls with params', () => {
    const tree = {
      a: { $call: 'fn1', $params: { param1: 7 } },
      $definitions: {
        fn1: { $call: 'fn2', $params: { param2: 10 } },
        fn2: { result1: '$param1', result2: '$param2' },
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('exploded call', () => {
    const tree = {
      a: [
        { $call: 'foo', $explode: true },
        { $call: 'bar', $explode: true },
      ],
      $definitions: {
        foo: ['$*qux', 3],
        bar: [4, '$theEnd'],
        qux: [1, 2],
        theEnd: 'finished!',
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('exploded call returning non-array throws', () => {
    const tree = {
      a: [{ $call: 'foo', $explode: true }],
      $definitions: { foo: 'Some fixed text' },
    };
    expect(() => tri(tree)).toThrowError();
  });

  it('call with $forEach', () => {
    const tree = {
      a: {
        $call: 'foo',
        $forEach: [
          { name: 'Pau' },
          { name: 'Théo' },
          { name: 'Sascha' },
          { name: 'Jordi' },
          { name: 'Aleix' },
          { name: 'Guille' },
        ],
      },
      $definitions: {
        salutation: 'Hello',
        foo: '<<$.salutation>>, <<$.name>>!',
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('call with $forEach and $params', () => {
    const tree = {
      a: {
        $call: 'foo',
        $forEach: [{ name: 'Pau' }, { name: 'Théo' }],
        $params: { salutation: 'Hi' },
      },
      $definitions: {
        foo: '<<$.salutation>>, <<$.name>>!',
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('call with $forEach but no array throws', () => {
    const tree = {
      a: {
        $call: 'foo',
        $forEach: { name: 'Pau' }, // should be an array!
      },
      $definitions: { foo: 'Hi, <<$.name>>!' },
    };
    expect(() => tri(tree)).toThrowError();
  });

  it('call with $forEach and $explode: true', () => {
    const tree = {
      a: [
        {
          $call: 'foo',
          $explode: true,
          $forEach: [{ item: 'A' }, { item: 'B' }, { item: 'C' }],
        },
      ],
      $definitions: { foo: ['<<$.item>>1', '<<$.item>>2'] },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('call with $forEach and $explode: true, but call returns an object', () => {
    const tree = {
      a: [
        {
          $call: 'foo',
          $explode: true,
          $forEach: [{ item: 'A' }, { item: 'B' }, { item: 'C' }],
        },
      ],
      $definitions: { foo: '<<$.item>>1' },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  // ====================================
  // Merge
  // ====================================
  it('$merge without calls', () => {
    const tree = { a: { $merge: [{ b: 3 }, { c: 4 }] } };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('$merge with calls', () => {
    const tree = {
      a: {
        $merge: [
          '$fn1',
          { $call: 'fn2', $params: { param: 'foo' } },
          { $call: 'fn3', $params: { param: 3.14 } },
        ],
      },
      $definitions: {
        fn1: { a: 3 },
        fn2: { b: 'Hi <<$.param>>!' },
        fn3: { c: '$param' },
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('$merge throws without array', () => {
    const tree = { a: { $merge: { b: 3 } } };
    expect(() => tri(tree)).toThrow();
  });

  // ====================================
  // Concatenate
  // ====================================
  it('$concatenate without calls', () => {
    const tree = { a: { $concatenate: [1, 2, [3, 4], 5, [[6, 7]]] } };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('$concatenate with calls', () => {
    const tree = {
      a: {
        $concatenate: [
          '$salute',
          { $call: 'say', $params: { param: 'Nice to see you' } },
          { $call: 'ask', $params: { param: 'What time is it' } },
        ],
      },
      $definitions: {
        salute: ['Hi', '----'],
        say: ['<<$.param>>!', '----'],
        ask: ['<<$.param>>?', '----'],
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('$concatenate throws without array', () => {
    const tree = { a: { $concatenate: { b: 3 } } };
    expect(() => tri(tree)).toThrow();
  });

  // ====================================
  // CSV
  // ====================================
  it('$csv', () => {
    const tree = {
      a: {
        $csv: `a,b,c
1,a,true
,b,false`,
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('$csv with relative path', () => {
    const tree = {
      a: {
        $csv: './src/__tests__/data.csv',
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('$csv with absolute path', () => {
    const tree = {
      a: {
        $csv: `file://${process.cwd()}/src/__tests__/data.csv`,
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('$csv with missing columns throws', () => {
    const tree = {
      a: {
        $csv: `a,b,c
1,a,2
c,b`,
      },
    };
    expect(() => tri(tree)).toThrow();
  });

  it('$csv with extra columns throws', () => {
    const tree = {
      a: {
        $csv: `a,b,c
1,a,3
2,b,2,f`,
      },
    };
    expect(() => tri(tree)).toThrow();
  });

  it('$csv without content throws', () => {
    const tree = { a: { $csv: null } };
    expect(() => tri(tree)).toThrow();
  });

  it('$csv with $json parsing', () => {
    const tree = {
      a: {
        $csv: `foo,jsonField
a,"{""foo"":true}"
b,`,
        $json: ['jsonField'],
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('$csv with interpolated content', () => {
    const tree = {
      a: {
        $csv: `a,b,c
1,a,<<$.myVar>>`,
      },
      $definitions: { myVar: 'true' },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('$csv with $forEach', () => {
    const tree = {
      a: {
        $call: 'myFunction',
        $forEach: { $csv: 'name,age\n"John",30\n"Jane",28' },
      },
      $definitions: { myFunction: { a: '$name', b: '$age' } },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  // ====================================
  // YAML
  // ====================================
  it('$yaml with relative path', () => {
    const tree = {
      a: {
        $yaml: './src/__tests__/data.yaml',
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('$yaml with absolute path', () => {
    const tree = {
      a: {
        $yaml: `file://${process.cwd()}/src/__tests__/data.yaml`,
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('$yaml without content throws', () => {
    const tree = { a: { $yaml: null } };
    expect(() => tri(tree)).toThrow();
  });

  it('$yaml calling parent definitions', () => {
    const tree = {
      a: {
        $yaml: `foo: $foo`,
      },
      $definitions: { foo: 'bar' },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  it('$yaml with array', () => {
    const tree = {
      a: {
        $yaml: '- foo\n- bar\n- baz',
      },
    };
    expect(tri(tree)).toMatchSnapshot();
  });

  // ====================================
  // Deep copies
  // ====================================
  it('deep copies may exist by default', () => {
    const tree = {
      a: '$foo',
      b: '$foo',
      $definitions: { foo: { bar: 3 } },
    };
    const res = tri(tree);
    expect(res.a === res.b).toBeTruthy();
  });

  it('deep copies can be disabled', () => {
    const tree = {
      a: '$foo',
      b: '$foo',
      $definitions: { foo: { bar: 3 } },
    };
    const res = tri(tree, { noDeepCopies: true });
    expect(res.a === res.b).toBeFalsy();
  });
});
