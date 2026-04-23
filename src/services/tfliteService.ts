/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Use global types from script tags
declare const tf: any;
declare const tflite: any;

// Placeholders for the model and labels
const MODEL_URL = 'https://storage.googleapis.com/tfjs-models/tflite/mobilenet_v1_0.25_224_quant.tflite'; 
const LABELS = [
  'Healthy (ആരോഗ്യകരമായ വിള)',
  'Paddy Blast (നെല്ല് ബ്ലാസ്റ്റ്)',
  'Paddy Blight (നെല്ല് ബ്ലൈറ്റ്)',
  'Coconut Bud Rot (തെങ്ങ് കൊമ്പൻ ചെല്ലി)',
  'Banana Wilt (വാഴ വാട്ടം)',
  'Other / Unknown'
];

let model: any = null;

export async function loadModel() {
  if (model) return model;
  
  if (typeof tflite === 'undefined') {
    throw new Error('TFLite library not loaded. Check internet connection or script tags.');
  }

  try {
    // Set up TFLite WASM path - MUST match the script version for compatibility
    tflite.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.10/dist/');
    
    console.log('Loading TFLite model from:', MODEL_URL);
    
    // Explicitly fetch as array buffer for better cross-origin reliability in some browsers
    try {
      const response = await fetch(MODEL_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const buffer = await response.arrayBuffer();
      model = await tflite.loadTFLiteModel(buffer);
    } catch (fetchErr) {
      console.warn('Direct fetch failed, trying loadTFLiteModel(URL) fallback:', fetchErr);
      model = await tflite.loadTFLiteModel(MODEL_URL);
    }

    console.log('TFLite model loaded successfully');
    return model;
  } catch (error: any) {
    console.error('Failed to load TFLite model details:', error);
    if (error.message?.includes('initialize')) {
      throw new Error('Model initialization failed. This can happen due to browser restrictions or incompatible model format.');
    }
    throw error;
  }
}

export async function detectOffline(imageSrc: string): Promise<{ 
  disease: string; 
  confidence: number; 
  crop: string;
  recommendations: string[];
}> {
  const tfliteModel = await loadModel();
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    
    img.onload = async () => {
      try {
        // Pre-process the image
        const input = tf.browser.fromPixels(img)
          .resizeBilinear([224, 224])
          .expandDims(0);
          
        // Run inference
        const output = tfliteModel.predict(input);
        const data = await output.data();
        
        let maxIdx = 0;
        let maxProb = 0;
        for (let i = 0; i < data.length; i++) {
          if (data[i] > maxProb) {
            maxProb = data[i];
            maxIdx = i;
          }
        }
        
        const labelIdx = maxIdx % LABELS.length;
        const label = LABELS[labelIdx];
        
        let crop = 'Unknown';
        if (label.includes('Paddy')) crop = 'Paddy';
        if (label.includes('Coconut')) crop = 'Coconut';
        if (label.includes('Banana')) crop = 'Banana';
        
        const recommendations = [
          'Maintain proper irrigation levels.',
          'Prune affected leaves immediately.',
          'Apply organic fertilizers to boost immunity.'
        ];

        resolve({
          disease: label,
          confidence: Math.round((maxProb / 255) * 100),
          crop,
          recommendations
        });
        
        // Cleanup
        input.dispose();
        output.dispose();
      } catch (err) {
        reject(err);
      }
    };
    
    img.onerror = reject;
  });
}
