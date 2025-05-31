//
const JxlModulePromise  = import('./jxl.js').then(mod => mod.default());
const readJxlWasmResult = (Module, resPtr) => {
    const dataView = new DataView(Module.wasmMemory.buffer, resPtr, 64);
    const width           = dataView.getUint32(0, true);
    const height          = dataView.getUint32(4, true);
    const num_channels    = dataView.getUint32(8, true);
    const output_type     = dataView.getUint32(12, true);
    const pixel_data_size = dataView.getUint32(16, true);
    const pixel_data_ptr  = dataView.getUint32(20, true);
    const error_code      = dataView.getUint32(24, true);
    return {
        width,
        height,
        num_channels,
        output_type,
        pixel_data_size,
        pixel_data_ptr,
        error_code,
        pixelData: new Uint8Array(Module.wasmMemory.buffer, pixel_data_ptr, pixel_data_size)
    };
}

//
export async function loadJXL(url = './img/test.jxl') {
    const Module = await JxlModulePromise;
    const response    = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array  = new Uint8Array(arrayBuffer);

    //
    const dataPtr = Module._malloc(uint8Array.length);
    new Uint8Array(Module.wasmMemory.buffer, dataPtr, uint8Array.length).set(uint8Array);

    //
    const outPtr = Module._malloc(32);
    const res    = Module._jxl_wasm_decode?.(outPtr, dataPtr, uint8Array.length, 2);
    const info   = readJxlWasmResult(Module, outPtr);

    // @ts-ignore
    const imageData = new ImageData(info.width, info.height, {pixelFormat:  "rgba-float32", storageFormat: "float32"/*, colorSpace: "display-p3"*/});
    new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength).set(info.pixelData);

    //
    Module._jxl_wasm_free?.(res.pixel_data);
    Module._free?.(dataPtr);
    return imageData;
}
