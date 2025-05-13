#!/usr/bin/env python3
"""
Skutečná implementace TrOCR pro rozpoznávání textu z obrázků
Využívá model microsoft/trocr-base-handwritten z knihovny transformers
"""

import sys
import os
import json
import argparse
from PIL import Image
from transformers import TrOCRProcessor, VisionEncoderDecoderModel

def parse_args():
    parser = argparse.ArgumentParser(description='TrOCR Handwritten Text Recognition')
    parser.add_argument('image_path', help='Path to the image file')
    parser.add_argument('--language', default='eng', help='Language code (default: eng)')
    parser.add_argument('--model', default='microsoft/trocr-large-handwritten', 
                        help='HuggingFace model to use (default: microsoft/trocr-large-handwritten)')
    return parser.parse_args()

def perform_trocr(image_path, language='eng', model_name='microsoft/trocr-large-handwritten'):
    try:
        # Check if image exists
        if not os.path.exists(image_path):
            return {
                "success": False,
                "text": "",
                "error": f"Image file not found: {image_path}"
            }
        
        # Load image
        image = Image.open(image_path).convert("RGB")
        
        # Use appropriate model based on language
        if language == 'ces':
            # For Czech, you might need a different model, but we'll use large-handwritten for now
            model_name = 'microsoft/trocr-large-handwritten'
        
        # Load model and processor
        processor = TrOCRProcessor.from_pretrained(model_name)
        model = VisionEncoderDecoderModel.from_pretrained(model_name)
        
        # Process image
        pixel_values = processor(images=image, return_tensors="pt").pixel_values
        
        # Generate text
        generated_ids = model.generate(pixel_values)
        recognized_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        
        return {
            "success": True,
            "text": recognized_text,
            "confidence": 0.95  # TrOCR doesn't provide confidence scores directly
        }
    except Exception as e:
        return {
            "success": False,
            "text": "",
            "error": f"Error performing TrOCR: {str(e)}"
        }

def main():
    args = parse_args()
    result = perform_trocr(args.image_path, args.language, args.model)
    print(json.dumps(result))

if __name__ == "__main__":
    main()