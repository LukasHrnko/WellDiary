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
    
    # Default value for processed (in case no variant matches)
    processed = gray.copy()
    
    if variant == 0:
        # Simple binary thresholding with high threshold
        _, processed = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY)
    
    elif variant == 1:
        # Otsu's thresholding after Gaussian blur
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        _, processed = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    elif variant == 2:
        # Adaptive thresholding
        processed = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
    
    elif variant == 3:
        # Contrast enhancement and adaptive thresholding
        # Normalize histogram to improve contrast
        processed = cv2.equalizeHist(gray)
        processed = cv2.adaptiveThreshold(
            processed, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 15, 12
        )
    
    elif variant == 4:
        # Blur and adaptive thresholding with larger block size
        blur = cv2.GaussianBlur(gray, (3, 3), 0)
        processed = cv2.adaptiveThreshold(
            blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 25, 10
        )
    
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
    
    # Try different Tesseract PSM (Page Segmentation Mode) settings for better results
    # PSM Options:
    # 3 = Fully automatic page segmentation, but no OCR. (Default)
    # 4 = Assume a single column of text of variable sizes.
    # 6 = Assume a single uniform block of text.
    # 8 = Treat the image as a single word.
    # 9 = Treat the image as a single word in a circle.
    # 10 = Treat the image as a single character.
    psm_modes = [6, 4, 3, 8]
    best_text = ""
    best_conf = 0
    
    for psm in psm_modes:
        try:
            # Configure Tesseract parameters
            config = f'--psm {psm} --oem 3 -l {lang}'
            
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
            
            if confidence_count == 0:
                continue
                
            text = ' '.join(text_parts)
            confidence = confidence_sum / confidence_count
            
            # Calculate quality score based on:
            # 1. Confidence
            # 2. Text length (prefer longer text)
            # 3. Number of alphanumeric characters vs. special symbols
            alpha_count = sum(c.isalnum() for c in text)
            total_count = max(1, len(text))
            char_ratio = alpha_count / total_count
            
            quality_score = confidence * (len(text) / 100) * char_ratio
            
            if quality_score > best_conf:
                best_text = text
                best_conf = confidence
        
        except Exception as e:
            print(f"OCR error with PSM {psm}: {str(e)}", file=sys.stderr)
            continue
    
    if best_text:
        return best_text, best_conf
    else:
        # Fall back to basic OCR if all PSM modes failed
        try:
            # Simple text extraction without data
            text = pytesseract.image_to_string(image, lang=lang)
            return text, 50.0  # Default confidence for fallback
        except Exception as e:
            print(f"Fallback OCR error: {str(e)}", file=sys.stderr)
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
    if not text:
        return ""
        
    # Remove extra whitespace
    text = ' '.join(text.split())
    
    # Replace common OCR errors with correct versions
    # But only whole symbol replacements would be risky here
    # Try to detect more special cases
    
    # Replace consecutive special characters with spaces
    import re
    text = re.sub(r'[^\w\s\.\,\?\!]{2,}', ' ', text)
    
    # Replace single/double curly/straight quotes with standard quotes
    text = re.sub(r'[''`´]', "'", text)
    text = re.sub(r'[""„]', '"', text)
    
    # Replace unusual dashes with regular dash
    text = re.sub(r'[–—−]', '-', text)
    
    # Remove isolated characters (likely OCR errors)
    # (but keep common single-letter words like 'a', 'I')
    text = re.sub(r'\s[bcdefghjklmnopqrstuvwxyz]\s', ' ', text)
    
    # Try to detect date patterns and standardize them
    # MM/DD/YYYY or DD.MM.YYYY
    text = re.sub(r'(\d{1,2})[/\.-](\d{1,2})[/\.-](\d{2,4})', r'\1/\2/\3', text)
    
    # Replace multiple dots with ellipsis
    text = re.sub(r'\.{3,}', '...', text)
    
    # Remove random symbols with no textual meaning 
    text = re.sub(r'[§†‡¶©®™]', '', text)
    
    # Try to detect entries that look like deníkový záznam
    if "dení" in text.lower() or "diary" in text.lower():
        # Enhance diary-specific content
        text = re.sub(r'mood[^a-zA-Z0-9]*(\d+)', r'Mood: \1', text, flags=re.IGNORECASE)
        text = re.sub(r'spánek[^a-zA-Z0-9]*(\d+)', r'Sleep: \1', text, flags=re.IGNORECASE)
        text = re.sub(r'sleep[^a-zA-Z0-9]*(\d+)', r'Sleep: \1', text, flags=re.IGNORECASE)
    
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