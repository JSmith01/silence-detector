#include <wasm_simd128.h>
#include <math.h>
#include <stdint.h>
#include <stddef.h>

typedef float float32_t;

#define FFT_SIZE 512
#define PI 3.14159265358979323846

// Precalculated twiddle factors
static float32_t cos_table[FFT_SIZE];
static float32_t sin_table[FFT_SIZE];

// Initialize the twiddle factor tables
void init_twiddle_factors() {
    for (int32_t k = 0; k < FFT_SIZE; k++) {
        float32_t angle = 2.0f * PI * k / FFT_SIZE;
        cos_table[k] = cosf(angle);
        sin_table[k] = sinf(angle);
    }
}

void calculate_frequency_bins(float32_t* input_buffer, float32_t* output_bins) {
    // Process 4 samples at a time using WASM SIMD
    for (int32_t k = 0; k < FFT_SIZE/2; k += 4) {
        v128_t sum_real = wasm_f32x4_splat(0.0f);
        v128_t sum_imag = wasm_f32x4_splat(0.0f);
        
        for (int32_t n = 0; n < FFT_SIZE; n++) {
            int32_t idx = (k * n) & (FFT_SIZE - 1); // Modulo FFT_SIZE
            v128_t input = wasm_f32x4_splat(input_buffer[n]);
            v128_t cos_val = wasm_v128_load(&cos_table[idx]);
            v128_t sin_val = wasm_v128_load(&sin_table[idx]);
            
            sum_real = wasm_f32x4_add(sum_real, wasm_f32x4_mul(input, cos_val));
            sum_imag = wasm_f32x4_sub(sum_imag, wasm_f32x4_mul(input, sin_val));
        }
        
        // Calculate magnitude
        v128_t real_squared = wasm_f32x4_mul(sum_real, sum_real);
        v128_t imag_squared = wasm_f32x4_mul(sum_imag, sum_imag);
        v128_t magnitude = wasm_f32x4_sqrt(wasm_f32x4_add(real_squared, imag_squared));
        
        wasm_v128_store(&output_bins[k], magnitude);
    }
}
