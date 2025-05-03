// Примерные данные для 4 пикселей (16 байт)
const src_rgbx = new Uint8Array([
  10, 20, 30, 0,    // R,G,B,X
  40, 50, 60, 0,
  70, 80, 90, 0,
  100, 110, 120, 0
]);
const src_axxx = new Uint8Array([
  1, 0, 0, 0,       // A,X,X,X
  2, 0, 0, 0,
  3, 0, 0, 0,
  4, 0, 0, 0
]);

// Загружаем и инициализируем модуль
const wasmCode = await fetch('merge_rgbx_axxx_to_rgba.wasm').then(r => r.arrayBuffer());
const { instance } = await WebAssembly.instantiate(wasmCode);
const { memory, merge_rgbx_axxx_to_rgba } = instance.exports;

// Выделяем память под массивы
const mem = new Uint8Array(memory.buffer);
const ptr_rgbx = 0;
const ptr_axxx = 64;
const ptr_dst = 128;
mem.set(src_rgbx, ptr_rgbx);
mem.set(src_axxx, ptr_axxx);

// Вызываем функцию (16 байт = 4 пикселя)
merge_rgbx_axxx_to_rgba(ptr_dst, ptr_rgbx, ptr_axxx, 16);

// Читаем результат
const result = mem.slice(ptr_dst, ptr_dst + 16);
console.log('Result RGBA:', Array.from(result));

// Ожидаемый результат:
// [
//   10, 20, 30, 1,    // R,G,B,A
//   40, 50, 60, 2,
//   70, 80, 90, 3,
//   100, 110, 120, 4
// ]
