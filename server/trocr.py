#!/usr/bin/env python3
"""
TrOCR-inspired HTR implementation using pytesseract and OpenCV
Designed for improved handwriting recognition with preprocessing techniques
"""

import sys
import os
import json
import cv2
import numpy as np
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter

def preprocess_image(image_path, variant=0):
    """
    Preprocess image for better OCR results
    
    Args:
        image_path: Path to the image file
        variant: Preprocessing variant (0-4)
    
    Returns:
        Preprocessed image as NumPy array
    """
    # Load image
    image = cv2.imread(image_path)
    
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    if variant == 0:
        # Adaptive thresholding
        processed = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
        )
        # Noise removal
        processed = cv2.medianBlur(processed, 3)
    
    elif variant == 1:
        # Otsu's thresholding
        _, processed = cv2.threshold(
            gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )
        # Noise removal
        processed = cv2.GaussianBlur(processed, (3, 3), 0)
    
    elif variant == 2:
        # Contrast enhancement
        pil_img = Image.fromarray(gray)
        enhancer = ImageEnhance.Contrast(pil_img)
        enhanced = enhancer.enhance(2.0)  # Increase contrast
        processed = np.array(enhanced)
        # Apply thresholding
        _, processed = cv2.threshold(
            processed, 127, 255, cv2.THRESH_BINARY_INV
        )
    
    elif variant == 3:
        # Morphological operations
        kernel = np.ones((2, 2), np.uint8)
        processed = cv2.dilate(gray, kernel, iterations=1)
        processed = cv2.erode(processed, kernel, iterations=1)
        # Apply thresholding
        _, processed = cv2.threshold(
            processed, 127, 255, cv2.THRESH_BINARY_INV
        )
    
    elif variant == 4:
        # Edge enhancement
        pil_img = Image.fromarray(gray)
        pil_img = pil_img.filter(ImageFilter.EDGE_ENHANCE)
        processed = np.array(pil_img)
        # Apply thresholding
        _, processed = cv2.threshold(
            processed, 127, 255, cv2.THRESH_BINARY_INV
        )
    
    # Invert back for OCR
    processed = cv2.bitwise_not(processed)
    
    return processed

def recognize_text(image, orientation=0, lang='eng'):
    """
    Recognize text from image using Tesseract OCR
    
    Args:
        image: Preprocessed image as NumPy array
        orientation: Image orientation in degrees (0, 90, 180, 270)
        lang: Language for OCR
    
    Returns:
        Tuple of (text, confidence)
    """
    # Rotate image if needed
    if orientation != 0:
        h, w = image.shape[:2]
        center = (w // 2, h // 2)
        rotation_matrix = cv2.getRotationMatrix2D(center, orientation, 1.0)
        image = cv2.warpAffine(image, rotation_matrix, (w, h), 
                              flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    
    # Configure Tesseract parameters for handwriting
    config = f'--psm 6 --oem 3 -l {lang}'
    
    try:
        # Get OCR result with confidence
        data = pytesseract.image_to_data(image, config=config, output_type=pytesseract.Output.DICT)
        
        # Extract text and calculate average confidence
        text_parts = []
        confidence_sum = 0
        confidence_count = 0
        
        for i in range(len(data['text'])):
            if data['text'][i].strip():
                text_parts.append(data['text'][i])
                confidence_sum += float(data['conf'][i])
                confidence_count += 1
        
        text = ' '.join(text_parts)
        confidence = confidence_sum / max(1, confidence_count)
        
        return text, confidence
    
    except Exception as e:
        print(f"OCR error: {str(e)}", file=sys.stderr)
        return "", 0

def perform_handwriting_recognition(image_path, language='eng'):
    """
    Perform enhanced handwriting recognition with multiple preprocessing variants
    
    Args:
        image_path: Path to the image file
        language: Language for OCR
    
    Returns:
        Dictionary with results
    """
    try:
        variants = 5  # Number of preprocessing variants
        orientations = [0, 90, 180, 270]  # Degrees
        
        best_text = ""
        best_confidence = 0
        best_combo = None
        
        results = []
        
        # Try all combinations of preprocessing and orientations
        for variant in range(variants):
            processed_image = preprocess_image(image_path, variant)
            
            for orientation in orientations:
                text, confidence = recognize_text(processed_image, orientation, language)
                
                # Store result
                result = {
                    "variant": variant,
                    "orientation": orientation,
                    "text": text,
                    "confidence": confidence,
                    "text_length": len(text)
                }
                results.append(result)
                
                # Update best result based on confidence and text length
                score = confidence * min(1, len(text) / 100)
                if score > best_confidence:
                    best_confidence = score
                    best_text = text
                    best_combo = (variant, orientation)
        
        # Post-process the best text
        processed_text = post_process_text(best_text)
        
        return {
            "success": True,
            "text": processed_text,
            "confidence": best_confidence,
            "best_variant": best_combo[0] if best_combo else None,
            "best_orientation": best_combo[1] if best_combo else None
        }
    
    except Exception as e:
        print(f"Handwriting recognition error: {str(e)}", file=sys.stderr)
        return {
            "success": False,
            "error": str(e)
        }

def post_process_text(text):
    """
    Post-process OCR text for better results
    
    Args:
        text: Raw OCR text
    
    Returns:
        Processed text
    """
    # Remove extra whitespace
    text = ' '.join(text.split())
    
    # Common OCR error corrections
    replacements = {
        'l': 'i',
        '0': 'o',
        '1': 'i',
        '|': 'i',
        '$': 's',
        '@': 'a',
        '\n\n': '\n',
    }
    
    for old, new in replacements.items():
        text = text.replace(old, new)
    
    return text

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
    
    # Perform handwriting recognition and print JSON result
    result = perform_handwriting_recognition(image_path, language)
    print(json.dumps(result))