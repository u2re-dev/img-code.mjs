function parsePngChunks(arrayBuffer) {
    const data = new DataView(arrayBuffer);
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < pngSignature.length; i++) {
        if (data.getUint8(i) !== pngSignature[i]) {
            throw new Error('Not a valid PNG file');
        }
    }

    let offset = 8; // skip signature
    const chunks = [];

    while (offset < data.byteLength) {
        if (offset + 8 > data.byteLength) break; // not enough data for length+type

        const length = data.getUint32(offset);
        const type = String.fromCharCode(
            data.getUint8(offset + 4),
            data.getUint8(offset + 5),
            data.getUint8(offset + 6),
            data.getUint8(offset + 7)
        );

        if (offset + 8 + length + 4 > data.byteLength) break; // not enough data for chunk

        // Сохраняем тип и "сырые" данные чанка (без разбора)
        const chunkData = new Uint8Array(arrayBuffer, offset + 8, length);

        chunks.push({
            type,
            data: chunkData
        });

        offset += 8 + length + 4; // length(4) + type(4) + data(length) + crc(4)
    }

    return chunks;
}

// Пример использования с File API (например, в браузере):
// const file = ... // PNG файл
// file.arrayBuffer().then(buffer => {
//     const chunks = parsePngChunks(buffer);
//     console.log(chunks);
// });
