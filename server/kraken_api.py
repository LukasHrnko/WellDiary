#!/usr/bin/env python3
"""
Kraken-inspired OCR REST API service
Falls back to pytesseract when Kraken is not available

This module implements a simple Flask server that provides OCR capabilities
through a REST API endpoint. It's designed to be used from Node.js.
"""

import os
import sys
import json
import cv2
import numpy as np
import tempfile
import traceback
from flask import Flask, request, jsonify

# Set up tessdata path for pytesseract fallback
TESSDATA_PREFIX = os.path.join(os.getcwd(), 'tessdata')
os.environ['TESSDATA_PREFIX'] = TESSDATA_PREFIX

# Initialize Flask app
app = Flask(__name__)

# Try to import Kraken
try:
    import kraken
    KRAKEN_AVAILABLE = True
    print("Kraken OCR is available and will be used for handwriting recognition")
except ImportError:
    KRAKEN_AVAILABLE = False
    # Fallback to pytesseract
    import pytesseract
    from pytesseract import Output
    print("Kraken is not available, falling back to pytesseract")

# Optional: Try to import more advanced image processing libraries
try:
    from PIL import Image, ImageEnhance, ImageFilter
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

def preprocess_image(image_path):
    """
    Preprocess image for better OCR results
    
    Args:
        image_path: Path to the image file
    
    Returns:
        Preprocessed image as NumPy array
    """
    # Load image
    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: Could not load image from {image_path}")
        return None
    
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Apply adaptive thresholding
    processed = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )
    
    return processed

def recognize_with_kraken(image_path, language='eng'):
    """
    Recognize text using Kraken OCR library (if available)
    
    Args:
        image_path: Path to the image file
        language: Language for OCR
        
    Returns:
        Dictionary with recognition results
    """
    try:
        import kraken
        from kraken import binarization
        from kraken.pageseg import segment
        from kraken import rpred
        
        # Load image
        image = Image.open(image_path)
        
        # Binarize
        bw_img = binarization.nlbin(image)
        
        # Segment
        res = segment(bw_img)
        
        # Use default model or specify one if needed
        # Note: In production, you'd download appropriate models
        model = 'en_best.mlmodel'  # This is a placeholder, not an actual path
        
        # Recognize text
        result = rpred.rpred(model, res.segments)
        
        # Extract text
        text = result['text']
        confidence = 0.9  # Kraken doesn't provide confidence scores as easily as tesseract
        
        return {
            "success": True,
            "text": text,
            "confidence": confidence
        }
    except Exception as e:
        print(f"Error using Kraken: {str(e)}")
        traceback.print_exc()
        return {
            "success": False,
            "error": f"Kraken OCR failed: {str(e)}"
        }

def recognize_with_tesseract(image_path, language='eng'):
    """
    Recognize text using pytesseract
    
    Args:
        image_path: Path to the image file
        language: Language for OCR
        
    Returns:
        Dictionary with recognition results
    """
    try:
        # Check if we have the language data, fallback to 'eng' if not
        if language != 'eng' and not os.path.exists(os.path.join(TESSDATA_PREFIX, f'{language}.traineddata')):
            print(f"Warning: Training data for {language} not found, falling back to eng")
            language = 'eng'
        
        # Preprocess the image
        processed_image = preprocess_image(image_path)
        if processed_image is None:
            return {
                "success": False,
                "error": "Failed to preprocess image"
            }
        
        # Configure Tesseract parameters
        config = f'--oem 3 --psm 6 -l {language}'
        
        # Get data with confidence
        data = pytesseract.image_to_data(processed_image, config=config, output_type=Output.DICT)
        
        # Extract text and confidence
        text_parts = []
        confidence_sum = 0
        confidence_count = 0
        
        for i in range(len(data['text'])):
            if data['text'][i].strip():
                text_parts.append(data['text'][i])
                confidence_sum += float(data['conf'][i])
                confidence_count += 1
        
        if confidence_count == 0:
            # Fall back to simple string extraction
            text = pytesseract.image_to_string(processed_image, config=config)
            confidence = 0.5  # Default confidence
        else:
            text = ' '.join(text_parts)
            confidence = confidence_sum / confidence_count / 100.0  # Normalize to 0-1 range
        
        return {
            "success": True,
            "text": text,
            "confidence": confidence
        }
    except Exception as e:
        print(f"Error using pytesseract: {str(e)}")
        traceback.print_exc()
        return {
            "success": False,
            "error": f"Tesseract OCR failed: {str(e)}"
        }

@app.route('/ocr', methods=['POST'])
def ocr():
    """
    OCR endpoint that processes uploaded images
    
    Returns:
        JSON response with recognized text
    """
    try:
        # Check if file was uploaded
        if 'image' not in request.files:
            return jsonify({
                "success": False,
                "error": "No image file uploaded"
            }), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({
                "success": False,
                "error": "Empty filename"
            }), 400
            
        # Get language parameter, default to 'eng'
        language = request.form.get('language', 'eng')
        
        # Save uploaded file to temp location
        temp_dir = tempfile.gettempdir()
        image_path = os.path.join(temp_dir, file.filename)
        file.save(image_path)
        
        # Process with appropriate OCR engine
        if KRAKEN_AVAILABLE:
            print(f"Processing image with Kraken: {image_path}")
            result = recognize_with_kraken(image_path, language)
        else:
            print(f"Processing image with pytesseract: {image_path}")
            result = recognize_with_tesseract(image_path, language)
        
        # Clean up temporary file
        try:
            os.remove(image_path)
        except:
            pass
            
        return jsonify(result)
    
    except Exception as e:
        print(f"Error in OCR endpoint: {str(e)}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == "__main__":
    # If running directly, start the server
    port = int(os.environ.get('FLASK_PORT', 5001))  # Use different port than main app
    app.run(host='0.0.0.0', port=port)
    
    print(f"OCR API server running at http://0.0.0.0:{port}/ocr")