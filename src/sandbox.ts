import { tri } from "./index";

const tree = {
  streams: [
    {
      $call: "foo",
      $explode: true,
      $forEach: [{ item: "A" }, { item: "B" }, { item: "C" }],
    },
  ],
  $definitions: { foo: { bar: "<<$.item>>1" } },
};
const result = tri(tree);
console.log(JSON.stringify(result, null, 2));
