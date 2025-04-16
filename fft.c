#include <wasm_simd128.h>
#include <math.h>
#include <stdint.h>
#include <stddef.h>

#define FFT_SIZE 512
#define PI 3.14159265358979323846

// Precalculated twiddle factors
static float cos_table[FFT_SIZE] __attribute__((aligned(16)));
static float sin_table[FFT_SIZE] __attribute__((aligned(16)));

// Initialize the twiddle factor tables
void init_twiddle_factors() {
    for (int32_t k = 0; k < FFT_SIZE; k++) {
        float angle = 2.0f * PI * k / FFT_SIZE;
        cos_table[k] = cosf(angle);
        sin_table[k] = sinf(angle);
    }
}

void calculate_frequency_bins(float* input_buffer, float* output_bins) {
    // Process 4 frequency bins at a time using SIMD
    for (int32_t k = 0; k < FFT_SIZE/2; k += 4) {
        // Initialize accumulators for 4 bins
        v128_t sum_real = wasm_f32x4_splat(0.0f);
        v128_t sum_imag = wasm_f32x4_splat(0.0f);
        
        // Process all time domain samples
        for (int32_t n = 0; n < FFT_SIZE; n++) {
            // Load input value and broadcast to all SIMD lanes
            v128_t input = wasm_f32x4_splat(input_buffer[n]);
            
            // Calculate indices for 4 consecutive bins
            int32_t idx0 = ((k + 0) * n) & (FFT_SIZE - 1);
            int32_t idx1 = ((k + 1) * n) & (FFT_SIZE - 1);
            int32_t idx2 = ((k + 2) * n) & (FFT_SIZE - 1);
            int32_t idx3 = ((k + 3) * n) & (FFT_SIZE - 1);
            
            // Load cos/sin values for 4 bins
            v128_t cos_vals = wasm_v128_load(&cos_table[idx0]);
            v128_t sin_vals = wasm_v128_load(&sin_table[idx0]);
            
            // Multiply and accumulate
            v128_t prod_real = wasm_f32x4_mul(input, cos_vals);
            v128_t prod_imag = wasm_f32x4_mul(input, sin_vals);
            
            sum_real = wasm_f32x4_add(sum_real, prod_real);
            sum_imag = wasm_f32x4_sub(sum_imag, prod_imag);
        }
        
        // Calculate magnitudes
        v128_t real_squared = wasm_f32x4_mul(sum_real, sum_real);
        v128_t imag_squared = wasm_f32x4_mul(sum_imag, sum_imag);
        v128_t magnitude = wasm_f32x4_sqrt(wasm_f32x4_add(real_squared, imag_squared));
        
        // Store results
        wasm_v128_store(&output_bins[k], magnitude);
    }
}
