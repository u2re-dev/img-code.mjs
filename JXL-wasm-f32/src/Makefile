CODEC_DIR = ../../libjxl/build-wasm32/
OUT_JS = ../lib/jxl.js

SRCS = decoder.cpp
OBJS = $(SRCS:.c=.o)

CFLAGS = -I$(CODEC_DIR)/lib/include/
LDFLAGS = \
	$(CODEC_DIR)/third_party/brotli/libbrotlidec.a \
	$(CODEC_DIR)/third_party/brotli/libbrotlienc.a \
	$(CODEC_DIR)/third_party/brotli/libbrotlicommon.a \
	$(CODEC_DIR)/third_party/highway/libhwy.a \
	$(CODEC_DIR)/lib/libjxl.a \
	$(CODEC_DIR)/lib/libjxl_threads.a

EMCC_FLAGS = -mavx2 -msimd128 -mrelaxed-simd -g3 -O3 -flto --bind -fexceptions -gsource-map --source-map-base decoder.cpp --emit-symbol-map \
	-Wno-int-to-void-pointer-cast \
	-s USE_PTHREADS=1 \
	-s FILESYSTEM=0 \
	-s EXPORTED_RUNTIME_METHODS=ccall,cwrap \
	-s DISABLE_EXCEPTION_CATCHING=0 \
	-s INITIAL_MEMORY=67108864 \
	-s MAXIMUM_MEMORY=67108864 \
	-s ALLOW_MEMORY_GROWTH=0 \
	-s ERROR_ON_UNDEFINED_SYMBOLS=0 \
	-s ABORTING_MALLOC=1 \
    -s EXPORTED_RUNTIME_METHODS=wasmMemory \
	-s WASM=1 \
	-s EXPORT_ES6=1 \
	-s DYNAMIC_EXECUTION=0 \
	-s EXPORTED_FUNCTIONS="['_jxl_wasm_decode', '_malloc', '_calloc']" \
	-s MODULARIZE=1

all: $(OUT_JS)

$(OUT_JS): $(SRCS)
	emcc $(CFLAGS) $(SRCS) $(LDFLAGS) $(EMCC_FLAGS) -o $(OUT_JS)

#-s EXCEPTION_HANDLING=1
#-s MEMORY64
