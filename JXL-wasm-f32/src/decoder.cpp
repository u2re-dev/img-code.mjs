//
#define INT2VOIDP(i) (void*)(uintptr_t)(i)

//
#include <jxl/decode.h>
#include <jxl/decode_cxx.h>
#include <jxl/parallel_runner.h>
#include <jxl/resizable_parallel_runner.h>
#include <jxl/resizable_parallel_runner_cxx.h>
#include <vector>
#include <iostream>
#include <cstdint>
#include <stdexcept>
#include <emscripten/bind.h>
#include <emscripten/val.h>

//
enum class OutputType {
    UINT8 = 0,
    FLOAT16 = 1,
    FLOAT32 = 2
};

//
struct DecodedImage {
    uint32_t width;
    uint32_t height;
    uint32_t num_channels;
    OutputType type;
    std::vector<uint8_t> pixels;
};

//
struct JxlWasmResult {
    uint32_t width;
    uint32_t height;
    uint32_t num_channels;
    int output_type;
    size_t pixel_data_size;
    uint8_t* pixel_data;
    int error_code;
};

//
void PRINT_ERROR(std::string str) {
    std::cerr << str << std::endl;
    throw std::runtime_error("Unhandled exception");
}

//
DecodedImage decode_jxl(const uint8_t* data, size_t size, OutputType out_type) {
    JxlDecoderPtr dec = JxlDecoderMake(nullptr); if (!dec) PRINT_ERROR("Failed to create JxlDecoder");
    JxlResizableParallelRunnerPtr runner = JxlResizableParallelRunnerMake(nullptr); if (!runner) PRINT_ERROR("Failed to create JxlParallelRunner");
    if (JXL_DEC_SUCCESS != JxlDecoderSubscribeEvents(dec.get(),  JXL_DEC_BASIC_INFO | JXL_DEC_COLOR_ENCODING | JXL_DEC_FULL_IMAGE)) { PRINT_ERROR("JxlDecoderSubscribeEvents failed (basic info)\n"); }
    if (JXL_DEC_SUCCESS != JxlDecoderSetParallelRunner(dec.get(), JxlResizableParallelRunner, runner.get())) PRINT_ERROR("JxlDecoderSetParallelRunner failed\n");
    if (JXL_DEC_SUCCESS != JxlDecoderSetInput(dec.get(), data, size)) PRINT_ERROR("Failed to set input");
    JxlDecoderCloseInput(dec.get());

    //
    JxlPixelFormat format;
    format.num_channels = 4;
    format.endianness   = JXL_NATIVE_ENDIAN;
    format.align = 16;
    switch (out_type) {
        case OutputType::UINT8:   format.data_type = JXL_TYPE_UINT8;   break;
        case OutputType::FLOAT16: format.data_type = JXL_TYPE_FLOAT16; break;
        case OutputType::FLOAT32: format.data_type = JXL_TYPE_FLOAT;   break;
    }

    //
    bool got_image = false; bool got_basic_info = false;
    std::vector<uint8_t> pixels = {};
    JxlBasicInfo info;
    for (;;) {
        JxlDecoderStatus status = JxlDecoderProcessInput(dec.get());
        if (status == JXL_DEC_BASIC_INFO) {
            if (JXL_DEC_SUCCESS != JxlDecoderGetBasicInfo(dec.get(), &info)) PRINT_ERROR("Failed to get basic info");
            got_basic_info = true;
        } else
        if (status == JXL_DEC_NEED_MORE_INPUT) { std::cerr << "WARN: Need more input" << std::endl; } else
        if (status == JXL_DEC_NEED_IMAGE_OUT_BUFFER) {
            size_t buffer_size = 0;
            if (JXL_DEC_SUCCESS != JxlDecoderImageOutBufferSize(dec.get(), &format, &buffer_size)) PRINT_ERROR("Failed to get buffer size");

            //
            pixels.resize(buffer_size);
            if (JXL_DEC_SUCCESS != JxlDecoderSetImageOutBuffer(dec.get(), &format, pixels.data(), buffer_size)) PRINT_ERROR("Failed to set image out buffer");
        } else
        if (status == JXL_DEC_FULL_IMAGE) { got_image = true; break; } else
        if (status == JXL_DEC_ERROR)   { std::cerr << "Decoding error" << std::endl; break; } else
        if (status == JXL_DEC_SUCCESS) { break; }
    }

    //
    if (!got_image) PRINT_ERROR("No image decoded");

    //
    return DecodedImage{
        info.xsize,
        info.ysize,
        info.num_color_channels + (info.alpha_bits ? 1 : 0),
        out_type,
        std::move(pixels)
    };
}

//
DecodedImage decode_jxl_bind(const emscripten::val& js_array, OutputType out_type) {
    const size_t size = js_array["length"].as<size_t>();
    std::vector<uint8_t> data(size);
    emscripten::val memoryView{ emscripten::typed_memory_view(size, data.data()) };
    memoryView.call<void>("set", js_array);
    return decode_jxl(data.data(), size, out_type);
}

//
emscripten::val decode_jxl_async(const emscripten::val& js_array, OutputType out_type) {
    return emscripten::val::global("Promise").new_(
        emscripten::val::module_property("dynCall_vii").call<emscripten::val>(
            "bind", emscripten::val::undefined(), emscripten::val([js_array, out_type](emscripten::val resolve, emscripten::val reject) {
                try {
                    DecodedImage img = decode_jxl_bind(js_array, out_type);
                    emscripten::val result = emscripten::val::object();
                    result.set("width", img.width);
                    result.set("height", img.height);
                    result.set("numChannels", img.num_channels);
                    result.set("type", static_cast<int>(img.type));
                    emscripten::val uint8arr = emscripten::val::global("Uint8Array").new_(emscripten::typed_memory_view(img.pixels.size(), img.pixels.data()));
                    result.set("pixelData", uint8arr);
                    resolve(result);
                } catch (const std::exception& e) {
                    reject(emscripten::val(e.what()));
                }
            })
        )
    );
}

// Embind bindings
EMSCRIPTEN_BINDINGS(jxl_module) {
    emscripten::enum_<OutputType>("OutputType")
        .value("UINT8", OutputType::UINT8)
        .value("FLOAT16", OutputType::FLOAT16)
        .value("FLOAT32", OutputType::FLOAT32);

    emscripten::value_object<DecodedImage>("DecodedImage")
        .field("pixels", &DecodedImage::pixels)
        .field("width", &DecodedImage::width)
        .field("height", &DecodedImage::height)
        .field("num_channels", &DecodedImage::num_channels)
        .field("type", &DecodedImage::type);

    emscripten::function("decode_jxl_bind", &decode_jxl_bind);
    emscripten::function("decode_jxl_async", &decode_jxl_async);
}

//
extern "C" {
    void jxl_wasm_free(uint8_t* ptr) { free(ptr); }
    JxlWasmResult jxl_wasm_decode(const uint8_t* data, size_t size, int output_type) {
        auto decoded = decode_jxl(data, size, reinterpret_cast<OutputType const&>(output_type));
        auto pixels  = (uint8_t*)calloc(1, decoded.pixels.size());
        memcpy(pixels, decoded.pixels.data(), decoded.pixels.size());

        //
        JxlWasmResult res   = {};
        res.pixel_data      = pixels;
        res.pixel_data_size = decoded.pixels.size();
        res.width           = decoded.width;
        res.height          = decoded.height;
        res.num_channels    = decoded.num_channels;
        res.output_type     = output_type;
        res.error_code      = 1;
        return res;
    }
}
