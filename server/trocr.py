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
    # Load image
    image = cv2.imread(image_path)
    
    # Get dimensions
    height, width = image.shape[:2]
    
    # Create debug directory for saving intermediate results
    debug_dir = os.path.join(os.getcwd(), 'debug_images')
    os.makedirs(debug_dir, exist_ok=True)
    
    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Save original grayscale for debugging
    cv2.imwrite(os.path.join(debug_dir, 'original_gray.png'), gray)
    
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
        # Adaptive thresholding with small block size
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
    
    elif variant == 5:
        # Specialized technique for handwriting - deskew + enhanced contrast
        
        # Deskew
        coords = np.column_stack(np.where(gray > 0))
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        
        # Rotate the image to deskew it
        (h, w) = gray.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        deskewed = cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        
        # Enhance contrast
        pil_img = Image.fromarray(deskewed)
        enhancer = ImageEnhance.Contrast(pil_img)
        enhanced = enhancer.enhance(2.0)
        enhanced_array = np.array(enhanced)
        
        # Apply adaptive threshold
        processed = cv2.adaptiveThreshold(
            enhanced_array, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 8
        )
    
    elif variant == 6:
        # Noise reduction with morphological operations
        # First apply blur
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Apply binary threshold
        _, binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Create kernel for morphological operations
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        
        # Clean image with opening operation (erosion followed by dilation)
        # This removes small noise
        opening = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
        
        # Clean further with closing operation (dilation followed by erosion)
        # This fills small holes in the foreground
        processed = cv2.morphologyEx(opening, cv2.MORPH_CLOSE, kernel, iterations=1)
    
    elif variant == 7:
        # Edge enhancement technique
        # Apply Bilateral filter (preserves edges while reducing noise)
        bilateral = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # Apply Canny edge detector with automatic threshold
        median_val = float(np.median(bilateral))
        sigma = 0.33
        lower = int(max(0, (1.0 - sigma) * median_val))
        upper = int(min(255, (1.0 + sigma) * median_val))
        edges = cv2.Canny(bilateral, lower, upper)
        
        # Dilate edges to make them more visible
        kernel = np.ones((2, 2), np.uint8)
        dilated = cv2.dilate(edges, kernel, iterations=1)
        
        # Invert (we want white text on black background for OCR)
        processed = 255 - dilated
        
        # Ensure we have white background and black text
        processed = 255 - processed
    
    elif variant == 8:
        # Document-specific preprocessing
        # Sharpen image
        kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
        sharpened = cv2.filter2D(gray, -1, kernel)
        
        # Normalize before binarization for better contrast
        normalized = cv2.normalize(sharpened, dst=np.zeros_like(sharpened), alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
        
        # Adaptive threshold with larger block size for document text
        processed = cv2.adaptiveThreshold(
            normalized, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 10
        )
    
    elif variant == 9:
        # Create a PIL image
        pil_img = Image.fromarray(gray)
        
        # Enhance contrast
        enhancer = ImageEnhance.Contrast(pil_img)
        pil_img = enhancer.enhance(1.5)
        
        # Sharpen
        pil_img = pil_img.filter(ImageFilter.SHARPEN)
        
        # Convert back to numpy
        enhanced = np.array(pil_img)
        
        # Apply Gaussian blur
        blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)
        
        # Apply adaptive threshold
        processed = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 13, 8
        )
    
    # Save the processed variant for debugging
    cv2.imwrite(os.path.join(debug_dir, f'variant_{variant}.png'), processed)
    
    return processed

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
    # Rotate image if needed
    if orientation != 0:
        h, w = image.shape[:2]
        center = (w // 2, h // 2)
        rotation_matrix = cv2.getRotationMatrix2D(center, orientation, 1.0)
        image = cv2.warpAffine(image, rotation_matrix, (w, h), 
                              flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    
    # Save temporary image for debugging
    debug_dir = os.path.join(os.getcwd(), 'debug_images')
    os.makedirs(debug_dir, exist_ok=True)
    debug_path = os.path.join(debug_dir, f'debug_orient_{orientation}_var.png')
    cv2.imwrite(debug_path, image)
    
    # Check if we have the language data, fallback to 'eng' if not
    if lang != 'eng' and not os.path.exists(os.path.join(TESSDATA_PREFIX, f'{lang}.traineddata')):
        print(f"Warning: Training data for {lang} not found, falling back to eng")
        lang = 'eng'
    
    # Try different Tesseract PSM (Page Segmentation Mode) settings for better results
    # PSM Options:
    # 1 = Automatic page segmentation with OSD (Orientation and Script Detection)
    # 3 = Fully automatic page segmentation, but no OSD. (Default)
    # 4 = Assume a single column of text of variable sizes.
    # 6 = Assume a single uniform block of text.
    # 8 = Treat the image as a single word.
    # 11 = Sparse text. Find as much text as possible in no particular order.
    # 13 = Raw line. Treat the image as a single text line.
    
    # Define different combinations of PSM and OEM to try
    configs = [
        {'psm': 6, 'oem': 3, 'params': ''},  # Default neural net LSTM model
        {'psm': 4, 'oem': 3, 'params': ''},  # Default LSTM with column mode
        {'psm': 3, 'oem': 3, 'params': ''},  # LSTM model, full page
        {'psm': 11, 'oem': 3, 'params': ''}, # LSTM model, sparse text
        {'psm': 13, 'oem': 3, 'params': ''}, # LSTM model, single line
        {'psm': 6, 'oem': 1, 'params': ''},  # Legacy engine only
        {'psm': 6, 'oem': 0, 'params': '-c tessedit_char_whitelist=abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,?!():; '}  # Legacy with whitelist
    ]
    
    best_text = ""
    best_conf = 0
    best_config = None
    
    for config_params in configs:
        try:
            # Configure Tesseract parameters
            config = f"--psm {config_params['psm']} --oem {config_params['oem']} -l {lang} {config_params['params']}"
            
            print(f"Trying configuration: {config}")
            
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
            
            # Prefer results with more alphanumeric characters
            if len(text) > 10:
                quality_score = confidence * (min(len(text), 200) / 100) * char_ratio * 1.5
            else:
                quality_score = confidence * (len(text) / 100) * char_ratio
            
            print(f"PSM {config_params['psm']}, OEM {config_params['oem']}: {text[:40]}... (score: {quality_score:.2f}, conf: {confidence:.2f})")
            
            if quality_score > best_conf:
                best_text = text
                best_conf = confidence
                best_config = config_params
        
        except Exception as e:
            print(f"OCR error with PSM {config_params['psm']}, OEM {config_params['oem']}: {str(e)}", file=sys.stderr)
            continue
    
    if best_text:
        print(f"Selected best result from PSM {best_config['psm']}, OEM {best_config['oem']}")
        return best_text, best_conf
    else:
        # Fall back to basic OCR if all PSM modes failed
        try:
            # Simple text extraction without data
            text = pytesseract.image_to_string(image, lang=lang)
            print(f"Using fallback method, got: {text[:40]}...")
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
        print(f"Starting advanced handwriting recognition on: {image_path}")
        print(f"Using language: {language}")
        
        variants = 10  # Number of preprocessing variants (0-9)
        orientations = [0, 90, 180, 270]  # Degrees
        
        best_text = ""
        best_confidence = 0
        best_combo = None
        
        results = []
        
        # Save original image for debugging
        debug_dir = os.path.join(os.getcwd(), 'debug_images')
        os.makedirs(debug_dir, exist_ok=True)
        
        # Copy the original file to the debug directory
        import shutil
        shutil.copy(image_path, os.path.join(debug_dir, 'original.png'))
        
        print(f"Processing with {variants} preprocessing variants × {len(orientations)} orientations = {variants * len(orientations)} combinations")
        
        # Try all combinations of preprocessing and orientations
        for variant in range(variants):
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
                
                # Calculate a quality score that considers:
                # 1. Confidence
                # 2. Text length (but not too short or too long)
                # 3. Ratio of alphanumeric characters to total length
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
            "best_variant": best_combo[0] if best_combo else None,
            "best_orientation": best_combo[1] if best_combo else None
        }
    
    except Exception as e:
        print(f"Handwriting recognition error: {str(e)}", file=sys.stderr)
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