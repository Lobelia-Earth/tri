# tri 🌳

_tri_ is a tiny library (~200 LOCs, 100% test coverage) that processes a tree applying several useful transformations, including function calls (or variables) and string interpolation.

In this short example you can see some of these features in action:

```js
tri({
  a: '$foo', // equivalent to { $call: 'foo' }
  b: { $call: 'sayHi', $params: { name: 'Guille' } },
  $definitions: {
    foo: 'Hello world!',
    sayHi: 'Hi, <<$.name>>!',
  },
});
// Result:
// { a: 'Hello world!', b: 'Hi, Guille!' }
```

## Function calls

You can either use the shorthand syntax `'$myFunction'`, if you don't need to pass any arguments, or the full syntax `{ $call: 'myFunction', $params: { foo: 'bar' } }`. The return value of a function does not need to be a string:

```js
tri({
  a: '$foo',
  $definitions: {
    foo: { something: { moreComplex: true } },
  },
});
// Result:
// { a: { something: { moreComplex: true } } }
```

Calling a function that doesn't exist usually throws. You can avoid it by making a call optional. For instance, neither of the following calls throw, even though they're not defined:

```js
tri({
  a: '$fuzz?',
  b: { $call: 'fuzz', $optional: true },
});
// Result:
// { a: undefined, b: undefined }
```

Nested calls are possible, and they inherit all parameters from the outer call:

```js
tri({
  a: { $call: 'fn1', $params: { param1: 7 } },
  $definitions: {
    fn1: { $call: 'fn2', $params: { param2: 10 } },
    fn2: { result1: '$param1', result2: '$param2' },
  },
});
// Result:
// { a: { result1: 7, result2: 10 } }
```

Finally, you can also use `$forEach` with an array of objects to call a function for each of them:

```js
tri({
  a: {
    $call: 'fooize',
    $forEach: [{ name: 'John' }, { name: 'Jane' }],
  },
  $definitions: {
    fooize: { foo: '$name' },
  },
});
// Result
// { a: [{ foo: 'John' }, { foo: 'Jane' }] }
```

## String interpolation

You can use string interpolation to perform function calls and modify the result at the same time. _tri_ processes Mustache templates with a view containing the current context as `$`:

```js
tri({
  a: 'Hi, <<$.name>>!',
  $definitions: { name: 'John' },
});
// Result:
// { a: 'Hi, John!' }
```

_tri_ only processes tags marked with delimiters `<<` and `>>`. After this processing, you can still use the default Mustache delimiters `{{` and `}}` for your content, in case you want to use Mustache (or Handlebars) yourself.

Note that _tri_ disables Mustache's default escapes while processing, so you don't need to use triple-Mustache yourself. For instance, `<<{$.lt}>>` is not needed in the following example:

```js
tri({
  a: 'This is the lower-than sign: <<$.lt>>',
  $definitions: { lt: '<' },
});
// Result:
// { a: 'This is the lower than sign: <' }
```

## `$merge` and `$concatenate`

`$merge` and `$concatenate` can be handy to define how to combine results from multiple function calls. Both are used with an array. `$merge` returns a single object merging all results (each of them should be an object):

```js
tri({
  obj: {
    $merge: [
      '$fn1',
      { $call: 'fn2', $params: { param: 'foo' } },
      { $call: 'fn3', $params: { param: 3.14 } },
      { some: 'constant' },
    ],
  },
  $definitions: {
    fn1: { a: 3 },
    fn2: { b: 'Hi <<$.param>>!' },
    fn3: { c: '$param' },
  },
});
// Result:
// { obj: { a: 3, b: 'Hi foo!', c: 3.14, some: 'constant' } }
```

`$concatenate` returns a single array concatenating (`Array.prototype.concat`) all results (each of them should be either an array or a single item).

```js
tri({
  arr: {
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
});
// Result:
// { arr:
//    [ 'Hi',
//      '----',
//      'Nice to see you!',
//      '----',
//      'What time is it?',
//      '----' ] }
```

A simpler way to concatenate results is to use _exploded_ calls (note the shorthand `$*` syntax, equivalent to an exploded `$call`):

```js
tri({
  arr: [
    '$*salute',
    { $call: 'say', $explode: true, $params: { param: 'Nice to see you' } },
    { $call: 'ask', $explode: true, $params: { param: 'What time is it' } },
  ],
  $definitions: {
    salute: ['Hi', '----'],
    say: ['<<$.param>>!', '----'],
    ask: ['<<$.param>>?', '----'],
  },
});
// Result:
// { arr:
//   [ 'Hi',
//     '----',
//     'Nice to see you!',
//     '----',
//     'What time is it?',
//     '----' ] }
```

## CSV parsing

`$csv` can be used to parse CSV data. Here is a simple example with inline CSV content:

```js
tri({
  arr: {
    $csv: `name,age
John,30
Jane,28`,
  },
});
// Result:
// { arr: [
//   { name: 'John', age: 30 },
//   { name: 'Jane', age: 28 }
// ] }
```

Alternatively, you can ask _tri_ to open a CSV file:

```js
tri({
  arr: {
    // Relative path
    $csv: './myFile.csv',
    // Absolute path
    $csv: 'file:///home/user/myFile.csv',
  },
});
```

You can tell _tri_ to treat some fields as JSON and parse them into JS objects. We use the `$json` parameter for that:

```js
tri({
  arr: {
    $csv: `name,age,info
John,30,"{""foo"":""bar""}"
Jane,28,"{""foo"":""baz""}"`,
    $json: ['info'],
  },
});
// Result:
// { arr: [
//   { name: 'John', age: 30, info: { foo: 'bar' } },
//   { name: 'Jane', age: 28, info: { foo: 'baz' } }
// ] }
```

You can also use interpolated content within CSV, just as in any other string in _tri_:

```js
tri({
  arr: {
    $csv: `name,favColor
John,<<$.color>>
Jane,blue`,
  },
  $definitions: { color: '#a0c0d0' },
});
// Result:
// { arr: [
//   { name: 'John', favColor: '#a0c0d0' },
//   { name: 'Jane', favColor: 'blue' }
// ] }
```

Finally, you can combine `$csv` with `$forEach` to convert CSV records to an arbitrary template:

```js
tri({
  arr: {
    $call: 'helloTemplate',
    $forEach: {
      $csv: `name,age
John,30
Jane,28`,
    },
  },
  $definitions: { helloTemplate: { hello: '$name' } },
});
// Result:
// { arr: [ { hello: 'John' }, { hello: 'Jane' } ] }
```

## Including external YAML files

Similar to CSV, _tri_ can include external YAML files at any position of the tree using the `$yaml` parameter. Here is a simple example:

```js
tri({
  rules: {
    $yaml: './myFile.yaml',
  },
});
// Result (assuming myFile.yaml contains foo: bar and baz: 42):
// { rules: { foo: 'bar', baz: 42 } }
```

The included file is processed exactly as if the content was inline. This means you can use all the features of _tri_ within the included file, including function calls and string interpolation.

## Contributing

Currently we don't accept PR's from external collaborators.