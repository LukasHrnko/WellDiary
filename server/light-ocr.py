#!/usr/bin/env python3
"""
Super-lightweight OCR module using pytesseract
Designed for minimal processing time in resource-constrained environments
"""

import sys
import os
import json
import cv2
import numpy as np
import pytesseract
from pytesseract import Output

# Set Tesseract to use our higher quality training data
TESSDATA_PREFIX = os.path.join(os.getcwd(), 'tessdata')
os.environ['TESSDATA_PREFIX'] = TESSDATA_PREFIX

def perform_quick_ocr(image_path, language='eng'):
    """
    Perform quick OCR using minimal preprocessing
    
    Args:
        image_path: Path to the image file
        language: Language for OCR
    
    Returns:
        Dictionary with OCR results
    """
    try:
        print(f"Starting quick OCR on: {image_path}")
        print(f"Using language: {language}")
        
        # Check if image exists
        if not os.path.exists(image_path):
            print(f"Error: Image file not found: {image_path}")
            return {
                "success": False,
                "error": f"Image file not found: {image_path}"
            }
            
        # Simple image loading
        image = cv2.imread(image_path)
        if image is None:
            return {
                "success": False,
                "error": "Failed to load image"
            }
            
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Simple preprocessing - just thresholding
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Check if we have the language data, fallback to 'eng' if not
        if language != 'eng' and not os.path.exists(os.path.join(TESSDATA_PREFIX, f'{language}.traineddata')):
            print(f"Warning: Training data for {language} not found, falling back to eng")
            language = 'eng'
        
        # Simple OCR without fancy options
        config = f'--oem 3 --psm 6 -l {language}'
        
        # Get data with confidence
        data = pytesseract.image_to_data(binary, config=config, output_type=Output.DICT)
        
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
            text = pytesseract.image_to_string(binary, config=config)
            confidence = 50.0
        else:
            text = ' '.join(text_parts)
            confidence = confidence_sum / confidence_count
        
        # Basic post-processing
        text = ' '.join(text.split())
        
        print(f"OCR complete. Confidence: {confidence}")
        print(f"Text sample: {text[:100]}...")
        
        return {
            "success": True,
            "text": text,
            "confidence": confidence
        }
        
    except Exception as e:
        print(f"OCR error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }
        
if __name__ == "__main__":
    # Get image path from command line argument
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No image path provided"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    # Get language if provided
    language = 'eng'
    if len(sys.argv) >= 3:
        language = sys.argv[2]
    
    # Perform OCR and print JSON result
    result = perform_quick_ocr(image_path, language)
    print(json.dumps(result))