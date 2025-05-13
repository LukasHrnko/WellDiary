#!/usr/bin/env python3
"""
Handwritten Text Recognition REST API
Specialized OCR REST API service optimized for handwritten text

This module implements a Flask server that provides optimized OCR capabilities
through a REST API endpoint, designed to be used from Node.js.
"""

import os
import sys
import json
import cv2
import numpy as np
import tempfile
import traceback
import time
from flask import Flask, request, jsonify

# Set up tessdata path for pytesseract
TESSDATA_PREFIX = os.path.join(os.getcwd(), 'tessdata')
os.environ['TESSDATA_PREFIX'] = TESSDATA_PREFIX

# Initialize Flask app
app = Flask(__name__)

# Import pytesseract
import pytesseract
from pytesseract import Output
print(f"Using Tesseract data directory: {TESSDATA_PREFIX}")

# Import PIL for enhanced image processing
from PIL import Image, ImageEnhance, ImageFilter
print("PIL/Pillow is available for enhanced image processing")

def preprocess_image(image_path):
    """
    Basic preprocessing of image for OCR
    
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

def perform_adaptive_preprocessing(image_path, language='eng'):
    """
    Perform adaptive preprocessing depending on image characteristics
    
    Args:
        image_path: Path to the image file
        language: Language for OCR
        
    Returns:
        List of preprocessed images for multiple recognition attempts
    """
    try:
        # Read the image
        image = cv2.imread(image_path)
        if image is None:
            print(f"Error: Could not load image from {image_path}")
            return []
            
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Create variants for different handwriting styles
        preprocessed_variants = []
        
        # 1. Basic adaptive thresholding
        thresh1 = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        preprocessed_variants.append(thresh1)
        
        # 2. Stronger adaptive thresholding
        thresh2 = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 5
        )
        preprocessed_variants.append(thresh2)
        
        # 3. Advanced image processing with PIL
        try:
            # Convert to PIL Image
            pil_img = Image.fromarray(gray)
            
            # Enhance contrast
            enhancer = ImageEnhance.Contrast(pil_img)
            enhanced_img = enhancer.enhance(2.0)
            
            # Sharpen
            enhanced_img = enhanced_img.filter(ImageFilter.SHARPEN)
            
            # Convert back to numpy array
            enhanced_array = np.array(enhanced_img)
            
            # Apply thresholding
            _, thresh3 = cv2.threshold(enhanced_array, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            preprocessed_variants.append(thresh3)
        except Exception as e:
            print(f"Error during PIL processing: {str(e)}")
        
        return preprocessed_variants
    except Exception as e:
        print(f"Error during adaptive preprocessing: {str(e)}")
        traceback.print_exc()
        return []

def recognize_handwritten_text(image_path, language='eng'):
    """
    Enhanced handwritten text recognition using multiple preprocessing variants
    
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
        
        # Get preprocessed variants
        preprocessed_variants = perform_adaptive_preprocessing(image_path, language)
        if not preprocessed_variants:
            # Fallback to basic preprocessing if adaptive failed
            basic_processed = preprocess_image(image_path)
            if basic_processed is None:
                return {
                    "success": False,
                    "error": "Failed to preprocess image"
                }
            preprocessed_variants = [basic_processed]
        
        # Configure Tesseract parameters, optimized for handwriting
        # PSM modes to try:
        # 6 = Assume a single uniform block of text
        # 4 = Assume a single column of text of variable sizes
        # Use OEM 1 (LSTM) for handwritten text
        psm_modes = [6, 4]
        oem_modes = [1, 3]  # Try LSTM only (1) first, then combined (3)
        
        best_result = {
            "text": "",
            "confidence": 0.0
        }
        
        # Try different combinations of preprocessing and OCR parameters
        for processed_image in preprocessed_variants:
            for psm in psm_modes:
                for oem in oem_modes:
                    config = f'--oem {oem} --psm {psm} -l {language}'
                    
                    try:
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
                            # Fallback to simple string extraction if no confidence data
                            text = pytesseract.image_to_string(processed_image, config=config)
                            confidence = 0.5  # Default confidence
                        else:
                            text = ' '.join(text_parts)
                            confidence = confidence_sum / confidence_count / 100.0  # Normalize to 0-1 range
                        
                        # Keep the best result (highest confidence or longest text if confidence is similar)
                        if (confidence > best_result["confidence"] or 
                           (abs(confidence - best_result["confidence"]) < 0.1 and len(text) > len(best_result["text"]))):
                            best_result["text"] = text
                            best_result["confidence"] = confidence
                            
                    except Exception as e:
                        print(f"Error in OCR attempt (psm={psm}, oem={oem}): {str(e)}")
                        # Continue with next configuration
        
        if best_result["text"]:
            return {
                "success": True,
                "text": best_result["text"],
                "confidence": best_result["confidence"]
            }
        else:
            return {
                "success": False,
                "error": "Failed to recognize text with any configuration"
            }
    except Exception as e:
        print(f"Error in handwritten text recognition: {str(e)}")
        traceback.print_exc()
        return {
            "success": False,
            "error": f"Handwritten text recognition failed: {str(e)}"
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
        unique_filename = f"{int(time.time())}_{file.filename}"
        image_path = os.path.join(temp_dir, unique_filename)
        file.save(image_path)
        
        print(f"Starting OCR processing on: {image_path}")
        print(f"Using language: {language}")
        
        # Process with enhanced handwritten text recognition
        result = recognize_handwritten_text(image_path, language)
        
        # Clean up temporary file
        try:
            os.remove(image_path)
        except Exception as e:
            print(f"Warning: Failed to remove temp file: {str(e)}")
            
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