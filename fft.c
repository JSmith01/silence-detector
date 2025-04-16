#include <math.h>
#include <stdint.h>
#include <stddef.h>
#include <emscripten.h>

#define FFT_SIZE 128

// emcc -O3 -msimd128 fft.c -o fft.wasm --no-entry -sIMPORTED_MEMORY -sERROR_ON_UNDEFINED_SYMBOLS=0

// Make these functions visible to JavaScript
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
        float real = 0;
        float imag = 0;
        int32_t n = 0;
        int32_t coeffIndex = k * FFT_SIZE;
        while (n < FFT_SIZE) {
            // 0
            real += input_buffer[n] * ((float *)cos_table)[coeffIndex];
            imag -= input_buffer[n] * ((float *)sin_table)[coeffIndex];

            n++;
            coeffIndex++;

            // 1
            real += input_buffer[n] * ((float *)cos_table)[coeffIndex];
            imag -= input_buffer[n] * ((float *)sin_table)[coeffIndex];

            n++;
            coeffIndex++;

            // 2
            real += input_buffer[n] * ((float *)cos_table)[coeffIndex];
            imag -= input_buffer[n] * ((float *)sin_table)[coeffIndex];

            n++;
            coeffIndex++;

            // 3
            real += input_buffer[n] * ((float *)cos_table)[coeffIndex];
            imag -= input_buffer[n] * ((float *)sin_table)[coeffIndex];

            n++;
            coeffIndex++;
        }

        output_bins[k] = sqrtf(real * real + imag * imag);
    }
}
