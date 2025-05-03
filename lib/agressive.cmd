call terser ./jng.mjs ^
  --compress passes=3,unsafe=true,unsafe_arrows=true,unsafe_methods=true,drop_debugger=true ^
  --mangle toplevel=true,properties=true ^
  --mangle-props reserved=['desynchronized','willReadFrequently','fromBase64','memory','merge_alpha'] ^
  --ecma 2020 ^
  --module ^
  --toplevel ^
  --output ./jng.min.mjs
