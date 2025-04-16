#include <math.h>
#include <stdint.h>
#include <stddef.h>
#include <emscripten.h>
#include <wasm_simd128.h>

#define FFT_SIZE 128

// emcc -O3 -msimd128 fft.c -o fft.wasm --no-entry -sIMPORTED_MEMORY -sERROR_ON_UNDEFINED_SYMBOLS=0

EMSCRIPTEN_KEEPALIVE
void init_twiddle_factors(uintptr_t cos_table, uintptr_t sin_table) {
    for (int32_t k = 0; k < FFT_SIZE / 2; k++) {
        for (int32_t n = 0; n < FFT_SIZE; n++) {
            float angle = (2.0f * M_PI * k * n) / FFT_SIZE;
            int32_t index = k * FFT_SIZE + n;
            ((float *)cos_table)[index] = cosf(angle);
            ((float *)sin_table)[index] = sinf(angle);
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void calculate_frequency_bins(uintptr_t cos_table, uintptr_t sin_table, uintptr_t input_ptr, uintptr_t output_ptr) {
    float* input_buffer = (float*)input_ptr;
    float* output_bins = (float*)output_ptr;
    
    for (int32_t k = 0; k < FFT_SIZE / 2; k++) {
        v128_t real_sum = wasm_f32x4_splat(0.0f);
        v128_t imag_sum = wasm_f32x4_splat(0.0f);

        // Process 4 elements at a time using SIMD
        for (int32_t n = 0, coeffIndex = k * FFT_SIZE; n < FFT_SIZE; n += 4, coeffIndex += 4) {
            v128_t input = wasm_v128_load(&input_buffer[n]);
            v128_t cos_vals = wasm_v128_load(&((float *)cos_table)[coeffIndex]);
            v128_t sin_vals = wasm_v128_load(&((float *)sin_table)[coeffIndex]);

            // Real part: input * cos
            real_sum = wasm_f32x4_add(real_sum, wasm_f32x4_mul(input, cos_vals));

            // Imaginary part: -(input * sin)
            imag_sum = wasm_f32x4_sub(imag_sum, wasm_f32x4_mul(input, sin_vals));
        }

        // Horizontal sum of the vectors
        float real = wasm_f32x4_extract_lane(real_sum, 0) +
                    wasm_f32x4_extract_lane(real_sum, 1) +
                    wasm_f32x4_extract_lane(real_sum, 2) +
                    wasm_f32x4_extract_lane(real_sum, 3);

        float imag = wasm_f32x4_extract_lane(imag_sum, 0) +
                    wasm_f32x4_extract_lane(imag_sum, 1) +
                    wasm_f32x4_extract_lane(imag_sum, 2) +
                    wasm_f32x4_extract_lane(imag_sum, 3);

        output_bins[k] = sqrtf(real * real + imag * imag);
    }
}
