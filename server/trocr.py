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

# Set Tesseract to use our higher quality training data
TESSDATA_PREFIX = os.path.join(os.getcwd(), 'tessdata')
os.environ['TESSDATA_PREFIX'] = TESSDATA_PREFIX

# Configure tesseract
print(f"Using Tesseract data directory: {TESSDATA_PREFIX}")
if os.path.exists(os.path.join(TESSDATA_PREFIX, 'eng.traineddata')):
    print("Found English training data")
if os.path.exists(os.path.join(TESSDATA_PREFIX, 'ces.traineddata')):
    print("Found Czech training data")

def preprocess_image(image_path, variant=0):
    """
    Preprocess image for better OCR results
    
    Args:
        image_path: Path to the image file
        variant: Preprocessing variant (0-9)
    
    Returns:
        Preprocessed image as NumPy array
    """
    try:
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            print(f"Error: Could not load image from {image_path}")
            # Return empty image
            return np.zeros((100, 100), dtype=np.uint8)
        
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Processing pipeline based on variant
        processed = None
        
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
            # Convert to PIL for contrast enhancement
            pil_img = Image.fromarray(gray)
            enhancer = ImageEnhance.Contrast(pil_img)
            enhanced = enhancer.enhance(2.0)
            enhanced_array = np.array(enhanced)
            
            # Apply adaptive thresholding
            processed = cv2.adaptiveThreshold(
                enhanced_array, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 15, 12
            )
            
        elif variant == 4:
            # Blur and adaptive thresholding with larger block size
            blur = cv2.GaussianBlur(gray, (3, 3), 0)
            processed = cv2.adaptiveThreshold(
                blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 25, 10
            )
            
        elif variant == 5:
            # Sharpen image
            kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
            sharpened = cv2.filter2D(gray, -1, kernel)
            
            # Adaptive threshold
            processed = cv2.adaptiveThreshold(
                sharpened, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 8
            )
            
        elif variant == 6:
            # Noise reduction with morphological operations
            blur = cv2.GaussianBlur(gray, (5, 5), 0)
            _, binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # Create kernel for morphological operations
            kernel = np.ones((2, 2), np.uint8)
            
            # Remove small noise (erosion followed by dilation)
            opening = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
            
            # Fill small holes (dilation followed by erosion)
            processed = cv2.morphologyEx(opening, cv2.MORPH_CLOSE, kernel, iterations=1)
            
        elif variant == 7:
            # Create a PIL image for more advanced processing
            pil_img = Image.fromarray(gray)
            
            # Enhance contrast
            enhancer = ImageEnhance.Contrast(pil_img)
            enhanced = enhancer.enhance(2.0)
            
            # Apply sharpening
            enhanced = enhanced.filter(ImageFilter.SHARPEN)
            
            # Convert back to OpenCV
            enhanced_array = np.array(enhanced)
            
            # Apply binary threshold
            _, processed = cv2.threshold(enhanced_array, 180, 255, cv2.THRESH_BINARY)
            
        elif variant == 8:
            # Apply bilateral filter to reduce noise while preserving edges
            bilateral = cv2.bilateralFilter(gray, 11, 17, 17)
            
            # Apply binary threshold with high value to isolate text
            _, processed = cv2.threshold(bilateral, 200, 255, cv2.THRESH_BINARY)
            
        elif variant == 9:
            # Create a PIL image
            pil_img = Image.fromarray(gray)
            
            # Enhance brightness slightly
            brightness = ImageEnhance.Brightness(pil_img)
            bright_img = brightness.enhance(1.2)
            
            # Enhance contrast
            contrast = ImageEnhance.Contrast(bright_img)
            contrast_img = contrast.enhance(1.8)
            
            # Convert back to OpenCV
            enhanced_array = np.array(contrast_img)
            
            # Apply adaptive threshold
            processed = cv2.adaptiveThreshold(
                enhanced_array, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 13, 7
            )
        
        # If processing failed, use original grayscale as fallback
        if processed is None:
            print(f"Warning: Preprocessing variant {variant} failed, using original image")
            processed = gray
        
        # Debugging files disabled for performance
        return processed
        
    except Exception as e:
        print(f"Error in preprocessing variant {variant}: {str(e)}")
        # Return a blank image as fallback if we can't access 'gray'
        try:
            return gray
        except:
            print("Could not access grayscale image, returning blank")
            return np.zeros((100, 100), dtype=np.uint8)

def recognize_text(image, orientation=0, lang='eng'):
    """
    Recognize text from image using Tesseract OCR with optimized settings
    
    Args:
        image: Preprocessed image as NumPy array
        orientation: Image orientation in degrees (0, 90, 180, 270)
        lang: Language for OCR
    
    Returns:
        Tuple of (text, confidence)
    """
    try:
        # Rotate image if needed
        if orientation != 0:
            h, w = image.shape[:2]
            center = (w // 2, h // 2)
            rotation_matrix = cv2.getRotationMatrix2D(center, orientation, 1.0)
            image = cv2.warpAffine(image, rotation_matrix, (w, h), 
                                  flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        
        # Check if we have the language data, fallback to 'eng' if not
        if lang != 'eng' and not os.path.exists(os.path.join(TESSDATA_PREFIX, f'{lang}.traineddata')):
            print(f"Warning: Training data for {lang} not found, falling back to eng")
            lang = 'eng'
        
        # PERFORMANCE OPTIMIZATION: Use only the most promising configurations
        # Define different combinations of PSM and OEM to try - reduced set for speed
        configs = [
            {'psm': 6, 'oem': 3, 'params': ''},  # Default neural net LSTM model
            {'psm': 3, 'oem': 3, 'params': ''},  # LSTM model, full page
        ]
        
        best_text = ""
        best_conf = 0
        best_config = None
        
        for config_params in configs:
            try:
                # Configure Tesseract parameters
                config = f"--psm {config_params['psm']} --oem {config_params['oem']} -l {lang} {config_params['params']}"
                
                print(f"Trying configuration: {config}")
                
                # Get OCR result with confidence - OPTIMIZED: direct string output for speed
                if config_params == configs[0]:  # Only do detailed analysis for the first config
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
                else:
                    # For subsequent configs, just get the text quickly
                    text = pytesseract.image_to_string(image, config=config)
                    confidence = 75.0  # Estimated confidence
                
                # Quick quality assessment
                if not text.strip():
                    continue
                
                # Calculate quality score (simplified for speed)
                alpha_count = sum(c.isalnum() for c in text)
                total_count = max(1, len(text))
                char_ratio = alpha_count / total_count
                quality_score = confidence * (min(len(text), 200) / 100) * char_ratio
                
                print(f"Config {config_params['psm']}: {text[:40]}... (score: {quality_score:.2f})")
                
                if quality_score > best_conf:
                    best_text = text
                    best_conf = confidence
                    best_config = config_params
            except Exception as e:
                print(f"OCR error with config {config_params['psm']}: {str(e)}")
                continue
        
        if best_text:
            if best_config:
                print(f"Selected best result from PSM {best_config['psm']}")
            return best_text, best_conf
        else:
            # Quick fallback
            try:
                text = pytesseract.image_to_string(image, lang=lang)
                return text, 50.0  # Default confidence for fallback
            except Exception as e:
                print(f"Fallback OCR error: {str(e)}")
                return "", 0
    except Exception as e:
        print(f"Error in recognize_text: {str(e)}")
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
        print(f"Starting advanced handwriting recognition on: {image_path}")
        print(f"Using language: {language}")
        
        # Check if image exists
        if not os.path.exists(image_path):
            print(f"Error: Image file not found: {image_path}")
            return {
                "success": False,
                "error": f"Image file not found: {image_path}"
            }
        
        # JEŠTĚ VÍCE OPTIMALIZOVÁNO pro rychlost v prostředí Replit
        # Použijeme jen minimální počet nejúčinnějších variant a orientací
        variants = [1, 2]  # Pouze nejúčinnější varianty předzpracování
        orientations = [0]  # Pouze základní orientace
        
        print(f"Processing with {len(variants)} preprocessing variants × {len(orientations)} orientations = {len(variants) * len(orientations)} combinations")
        
        best_text = ""
        best_confidence = 0
        best_combo = (0, 0)  # Default to first variant and orientation
        
        results = []
        
        # Try selected combinations of preprocessing and orientations
        for variant_idx, variant in enumerate(variants):
            print(f"Applying preprocessing variant {variant}...")
            processed_image = preprocess_image(image_path, variant)
            
            for orientation in orientations:
                print(f"Checking orientation {orientation}° with variant {variant}...")
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
                
                # Calculate a quality score
                alpha_count = sum(c.isalnum() for c in text)
                total_length = max(1, len(text))
                char_ratio = alpha_count / total_length
                
                # We want a balance - not too short, not gibberish
                length_factor = min(1.0, total_length / 100)  # Cap at 100 chars
                
                # Calculate final score
                quality_score = confidence * length_factor * char_ratio * 1.5
                
                print(f"Variant {variant}, Orientation {orientation}°: Score {quality_score:.2f}, Confidence {confidence:.2f}, Length {len(text)}")
                print(f"Sample text: {text[:50]}..." if len(text) > 50 else f"Full text: {text}")
                
                # Update best result based on quality score
                if quality_score > best_confidence:
                    best_confidence = confidence
                    best_text = text
                    best_combo = (variant, orientation)
                    print(f"New best result! Variant {variant}, Orientation {orientation}°")
        
        if not best_text:
            print("No valid text detected in any variant/orientation")
            return {
                "success": False,
                "error": "No valid text detected in image"
            }
            
        # Post-process the best text
        print(f"Post-processing best text from variant {best_combo[0]}, orientation {best_combo[1]}°")
        processed_text = post_process_text(best_text)
        
        # Calculate improvement
        improvement = "Text improved by post-processing" if processed_text != best_text else "No post-processing improvements"
        print(improvement)
        
        print(f"Final result: {processed_text[:100]}..." if len(processed_text) > 100 else f"Final result: {processed_text}")
        print(f"Confidence: {best_confidence}")
        
        return {
            "success": True,
            "text": processed_text,
            "confidence": best_confidence,
            "best_variant": best_combo[0],
            "best_orientation": best_combo[1]
        }
    
    except Exception as e:
        print(f"Handwriting recognition error: {str(e)}")
        import traceback
        traceback.print_exc(file=sys.stderr)
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
    
    # Import regex here to avoid potential import errors
    import re
    
    try:
        # Replace consecutive special characters with spaces
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
    except Exception as e:
        print(f"Error during text post-processing: {str(e)}")
    
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