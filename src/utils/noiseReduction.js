// Advanced noise reduction utilities using FFT-based spectral subtraction

export class NoiseReducer {
  constructor(bufferSize = 4096, sampleRate = 44100) {
    this.bufferSize = bufferSize;
    this.sampleRate = sampleRate;
    this.noiseProfile = null;
    this.noiseProfileFrames = 0;
    this.maxNoiseProfileFrames = 50; // Collect noise profile over more frames
    this.noiseGateThreshold = 0.005; // Lower threshold for better sensitivity
    this.noiseReductionFactor = 0.7; // How much noise to reduce (0.7 = 70% reduction)

    // FFT buffers
    this.fftSize = bufferSize;
    this.real = new Float32Array(this.fftSize);
    this.imag = new Float32Array(this.fftSize);
    this.magnitude = new Float32Array(this.fftSize / 2);
    this.phase = new Float32Array(this.fftSize / 2);

    // Noise profile in frequency domain
    this.noiseMagnitude = new Float32Array(this.fftSize / 2);
    this.noiseProfileReady = false;
  }

  // Simple FFT implementation (for educational purposes)
  fft(real, imag) {
    const n = real.length;
    if (n === 1) return;

    const evenReal = new Float32Array(n / 2);
    const evenImag = new Float32Array(n / 2);
    const oddReal = new Float32Array(n / 2);
    const oddImag = new Float32Array(n / 2);

    for (let i = 0; i < n / 2; i++) {
      evenReal[i] = real[i * 2];
      evenImag[i] = imag[i * 2];
      oddReal[i] = real[i * 2 + 1];
      oddImag[i] = imag[i * 2 + 1];
    }

    this.fft(evenReal, evenImag);
    this.fft(oddReal, oddImag);

    for (let i = 0; i < n / 2; i++) {
      const angle = (-2 * Math.PI * i) / n;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const tempReal = cos * oddReal[i] - sin * oddImag[i];
      const tempImag = cos * oddImag[i] + sin * oddReal[i];

      real[i] = evenReal[i] + tempReal;
      imag[i] = evenImag[i] + tempImag;
      real[i + n / 2] = evenReal[i] - tempReal;
      imag[i + n / 2] = evenImag[i] - tempImag;
    }
  }

  // Inverse FFT
  ifft(real, imag) {
    const n = real.length;

    // Conjugate the imaginary part
    for (let i = 0; i < n; i++) {
      imag[i] = -imag[i];
    }

    this.fft(real, imag);

    // Conjugate again and scale
    for (let i = 0; i < n; i++) {
      real[i] /= n;
      imag[i] = -imag[i] / n;
    }
  }

  // Calculate magnitude and phase from FFT
  calculateMagnitudePhase(real, imag) {
    for (let i = 0; i < this.fftSize / 2; i++) {
      this.magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
      this.phase[i] = Math.atan2(imag[i], real[i]);
    }
  }

  // Reconstruct signal from magnitude and phase
  reconstructSignal(real, imag) {
    for (let i = 0; i < this.fftSize / 2; i++) {
      real[i] = this.magnitude[i] * Math.cos(this.phase[i]);
      imag[i] = this.magnitude[i] * Math.sin(this.phase[i]);
    }

    // Mirror for negative frequencies
    for (let i = 1; i < this.fftSize / 2; i++) {
      real[this.fftSize - i] = real[i];
      imag[this.fftSize - i] = -imag[i];
    }
  }

  // Calculate RMS energy
  calculateRMS(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

  // Update noise profile
  updateNoiseProfile(inputData) {
    if (this.noiseProfileFrames < this.maxNoiseProfileFrames) {
      // Copy input data to FFT buffers
      for (let i = 0; i < Math.min(inputData.length, this.fftSize); i++) {
        this.real[i] = inputData[i];
        this.imag[i] = 0;
      }

      // Zero-pad if necessary
      for (let i = inputData.length; i < this.fftSize; i++) {
        this.real[i] = 0;
        this.imag[i] = 0;
      }

      // Apply window function (Hanning window)
      for (let i = 0; i < this.fftSize; i++) {
        const window =
          0.5 * (1 - Math.cos((2 * Math.PI * i) / (this.fftSize - 1)));
        this.real[i] *= window;
      }

      // Perform FFT
      this.fft(this.real, this.imag);

      // Calculate magnitude
      this.calculateMagnitudePhase(this.real, this.imag);

      // Update noise profile
      if (!this.noiseProfileReady) {
        for (let i = 0; i < this.fftSize / 2; i++) {
          this.noiseMagnitude[i] = this.magnitude[i];
        }
        this.noiseProfileReady = true;
      } else {
        // Average with existing profile
        for (let i = 0; i < this.fftSize / 2; i++) {
          this.noiseMagnitude[i] =
            (this.noiseMagnitude[i] * this.noiseProfileFrames +
              this.magnitude[i]) /
            (this.noiseProfileFrames + 1);
        }
      }

      this.noiseProfileFrames++;
    }
  }

  // Apply spectral subtraction noise reduction
  applyNoiseReduction(inputData) {
    const outputData = new Float32Array(inputData.length);

    // Copy input data to FFT buffers
    for (let i = 0; i < Math.min(inputData.length, this.fftSize); i++) {
      this.real[i] = inputData[i];
      this.imag[i] = 0;
    }

    // Zero-pad if necessary
    for (let i = inputData.length; i < this.fftSize; i++) {
      this.real[i] = 0;
      this.imag[i] = 0;
    }

    // Apply window function
    for (let i = 0; i < this.fftSize; i++) {
      const window =
        0.5 * (1 - Math.cos((2 * Math.PI * i) / (this.fftSize - 1)));
      this.real[i] *= window;
    }

    // Perform FFT
    this.fft(this.real, this.imag);

    // Calculate magnitude and phase
    this.calculateMagnitudePhase(this.real, this.imag);

    // Apply spectral subtraction if noise profile is ready
    if (this.noiseProfileReady) {
      for (let i = 0; i < this.fftSize / 2; i++) {
        // Spectral subtraction: subtract noise magnitude from signal magnitude
        const noiseReducedMagnitude = Math.max(
          0,
          this.magnitude[i] - this.noiseReductionFactor * this.noiseMagnitude[i]
        );

        // Apply over-subtraction factor for better noise reduction
        const overSubtractionFactor =
          1 + this.noiseMagnitude[i] / (this.magnitude[i] + 1e-10);
        const finalMagnitude = Math.max(
          0,
          this.magnitude[i] -
            overSubtractionFactor *
              this.noiseReductionFactor *
              this.noiseMagnitude[i]
        );

        this.magnitude[i] = finalMagnitude;
      }
    }

    // Reconstruct signal
    this.reconstructSignal(this.real, this.imag);

    // Perform inverse FFT
    this.ifft(this.real, this.imag);

    // Copy result to output
    for (let i = 0; i < inputData.length; i++) {
      outputData[i] = this.real[i];
    }

    return outputData;
  }

  // Process audio data with noise reduction
  process(inputData) {
    const rms = this.calculateRMS(inputData);

    // If signal is too weak, treat as noise
    if (rms < this.noiseGateThreshold) {
      this.updateNoiseProfile(inputData);
      // Return silence for noise
      return new Float32Array(inputData.length);
    } else {
      // Apply noise reduction
      return this.applyNoiseReduction(inputData);
    }
  }
}
