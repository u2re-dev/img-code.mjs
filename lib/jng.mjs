const COLOR_MERGE_CODE = "AGFzbQEAAAABCAFgBH9/f38AAwIBAAUFAQEQgEAHGAIGbWVtb3J5AgALbWVyZ2VfYWxwaGEAAArUAQHRAQMBfwR7A38CQANAIAQgA08NASABIARq/QAEACEFIAIgBGr9AAQAIQYgBiAG/Q0ABAgMAAQIDAAECAwABAgMIQcgBSAH/Q0AAQIQBAUGEQgJChIMDQ4TIQggACAEaiAI/QsEACAEQRBqIQQMAAsLAkADQCAEIANPDQEgASAEaiEJIAIgBGohCyAAIARqIQogCiAJLQAAOgAAIApBAWogCUEBai0AADoAACAKQQJqIAlBAmotAAA6AAAgCkEDaiALLQAAOgAAIARBBGohBAwACwsL";
const filc = (chunks, name)=>{ return chunks.filter(({code})=>(new TextDecoder().decode(code).toUpperCase())==name); }
const table = (() => { const tb = []; for (let i=0; i<256; i++) { let c = i; for (let k=0; k<8; k++) c = ((c&1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1)); tb.push(c); } return tb; })();
const jsig = new Uint8Array([0x8b, 0x4a, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const psig = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const IEND = new Uint8Array([
    0x00, 0x00, 0x00, 0x00, // length
    0x49, 0x45, 0x4E, 0x44, // 'IEND'
    0xAE, 0x42, 0x60, 0x82  // CRC32
]);

//
if (!Uint8Array.fromBase64) {
    Uint8Array.fromBase64 = function (b64) {
        if (typeof atob === "undefined") { throw new Error("atob not available"); }
        const bin = atob(b64), len = bin.length, arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i); return arr;
    };
}

//
const readJNG = (binary)=>{
    if (new Uint8Array(binary, 0, 8).some((n,i)=>jsig[i]!=n)) throw new Error('Not a valid JNG file');

    //
    let offset = 8;
    const chunks = []; const dataView  = new DataView(binary, 0);
    while(offset < dataView.byteLength) {
        const length = dataView.getUint32(offset, false);
        if ((length + 12 + offset) > binary.byteLength) break; // wrong data
        const code   = new Uint8Array(binary, offset + 4, 4);
        const crc    = dataView.getUint32(offset + length + 8, false);
        const data   = new Uint8Array(binary, offset + 8, length);
        const whole  = new Uint8Array(binary, offset, length + 12);
        chunks.push({length, code, crc, data, whole});
        offset += length + 12;
    }

    //
    const jdat = filc(chunks, "JDAT").map(({data})=>data);
    const jdaa = filc(chunks, "JDAA").map(({data})=>data);
    const idat = filc(chunks, "IDAT").map(({whole})=>whole);
    return {chunks, jdat, jdaa, idat};
}

//
const crc32 = (arr, initial = ~0) => {
    let crc = initial;
    for (let i=0; i<arr.length; i++) crc = (crc>>>8) ^ table[(crc^arr[i])&0xFF];
    return (crc ^ -1) >>> 0;
}

//
const JHDR2IHDR = jhdr => {
    if (jhdr[13]) throw new Error('Only PNG alpha compression supported');
    const chunk = new Uint8Array(25);
    chunk.set(new Uint8Array([0,0,0,13, 0x49,0x48,0x44,0x52]), 0); // length + 'IHDR'
    chunk.set(new Uint8Array(jhdr.buffer, jhdr.byteOffset + 0, 8), 8); // width+height
    chunk.set(new Uint8Array([jhdr[12], 0,0, jhdr[14], jhdr[15]]), 16); // IHDR fields
    const crc = crc32(chunk.subarray(4, 21));
    chunk.set(new Uint8Array([(crc>>>24)&255, (crc>>>16)&255, (crc>>>8)&255, crc&255]), 21);
    return chunk;
}

//
const extractRGBA = (src, buffer)=>{
    const frame = new VideoFrame(src, {timestamp: 0, alpha: "discard"});
    frame.copyTo(buffer, {format: "RGBX"}); frame.close(); return buffer;
    //const canvas = new OffscreenCanvas(src.width, src.height);
    //const ctx = canvas.getContext('2d', {desynchronized: true, willReadFrequently: true, antialias: false, powerPreference: "low-power", premultipliedAlpha: false}); ctx.drawImage(src, 0, 0);
    //buffer.set(ctx.getImageData(0, 0, src.width, src.height).data);
    //return buffer;
}

//
const rm_sRGB = (arrayBuffer) => {
    const data = new Uint8Array(arrayBuffer);
    let pos = 8; const out = [data.subarray(0, 8)];
    while (pos < data.length) {
        const len = (data[pos]<<24)|(data[pos+1]<<16)|(data[pos+2]<<8)|data[pos+3];
        const type = String.fromCharCode(...data.subarray(pos+4, pos+8));
        if (type !== 'sRGB') { out.push(data.subarray(pos, pos+12+len)); }
        pos += 12 + len;
    }
    return out;
}

//
const injectPNG = async(blob, chunks) => {
    const exc = new Set(["JDAT", "JDAA", "IDAT", "IHDR", "JHDR", "IEND", "JSEP"]);
    const enc = chunks.filter(({code})=>(!exc.has(new TextDecoder().decode(code).toUpperCase()))).map(({whole})=>whole);
    const ptr = rm_sRGB(await blob.arrayBuffer()); ptr.splice(2, 0, ...enc);
    return new Blob(ptr, {type: "image/png"});
    //const p0  = new Uint8Array(ab, 0, 33);
    //const pe  = removeSRGB(new Uint8Array(ab, 33));
    //return new Blob([p0, ...enc, pe], {type: "image/png"});
}

//
export const decodeJNG = async (ab)=>{
    const chunks = readJNG(ab);
    const jpg = new Blob(chunks.jdat, {type: "image/jpeg"}); let alpha = null;
    if (chunks.idat?.length > 0) {
        const jhdr = chunks.chunks.find(({code})=>(new TextDecoder().decode(code) === "JHDR"));
        alpha = new Blob([ psig, JHDR2IHDR(jhdr.data), ...chunks.idat, IEND ], {type: "image/png"})
    } else
    if (chunks.jdaa?.length > 0) {
        alpha = new Blob(chunks.jdaa, {type: "image/jpeg"});
    }

    //
    const opt  = { premultiplyAlpha: "none", colorSpaceConversion: "default" };
    const rgbx = await createImageBitmap(jpg, opt);
    const axxx = alpha ? (await createImageBitmap(alpha, opt)) : null;
    const rgba = (axxx ? await Promise.try(async ()=>{
        const bufferSize = rgbx.width * rgbx.height * 4;
        const ptr_rgbx = 0;
        const ptr_axxx = ptr_rgbx + bufferSize;
        const ptr_dst = ptr_rgbx;//ptr_axxx + axxx.allocationSize();//ptr_rgbx;

        // broken 'exp.*'
        const wasm = Uint8Array.fromBase64(COLOR_MERGE_CODE);
        const exp = (await WebAssembly.instantiate(wasm)).instance.exports;
        exp.memory.grow((bufferSize * 2) / (1024 * 64)); const buf = exp.memory.buffer;
        extractRGBA(rgbx, new Uint8ClampedArray(buf, ptr_rgbx, bufferSize));
        extractRGBA(axxx, new Uint8ClampedArray(buf, ptr_axxx, bufferSize));
        exp.merge_alpha(ptr_dst, ptr_rgbx, ptr_axxx, bufferSize);

        //
        const data = new Uint8ClampedArray(buf, ptr_dst, bufferSize);
        return new ImageData(data, rgbx.width, rgbx.height, { /*colorSpace: "srgb-linear"*/ });
        //return new VideoFrame(data, { format: "RGBA", timestamp: 0, codedWidth: rgbx.width, codedHeight: rgbx.height, });
    })?.catch?.(console.warn.bind(console)) : null) ?? rgbx;

    //
    const off = new OffscreenCanvas(rgbx.width, rgbx.height);
    off.getContext('2d', {desynchronized: true, willReadFrequently: true, antialias: false, powerPreference: "low-power", premultipliedAlpha: false, /*colorSpace: "srgb-linear"*/})?.[rgba instanceof ImageData ? "putImageData" : "drawImage"]?.(rgba, 0, 0);
    //off.getContext("bitmaprenderer")?.transferFromImageBitmap?.(rgba instanceof ImageBitmap ? rgba : (await createImageBitmap(rgba, {})));

    // ending...
    const pre_png = await off.convertToBlob({type: "image/png"});
    return injectPNG(pre_png, chunks.chunks);
    //return pre_png;
}
