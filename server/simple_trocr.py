#!/usr/bin/env python3
"""
Zjednodušená implementace TrOCR s podporou českého jazyka
Využívá jen základní knihovny a Tesseract pro OCR zpracování
"""

import sys
import os
import json
import subprocess
import tempfile
from PIL import Image, ImageEnhance

# Kontrola vstupních parametrů
if len(sys.argv) < 2:
    print("Použití: python simple_trocr.py <cesta_k_obrazku> [jazyk]")
    sys.exit(1)

# Získání vstupních parametrů
image_path = sys.argv[1]
language = sys.argv[2] if len(sys.argv) > 2 else 'eng'

# Kontrola existence souboru
if not os.path.exists(image_path):
    result = {
        "success": False,
        "text": "",
        "error": f"Soubor {image_path} nebyl nalezen"
    }
    print(json.dumps(result))
    sys.exit(1)

# Funkce pro vylepšení kvality obrázku
def enhance_image(image):
    # Zvýšení kontrastu
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(1.5)
    
    # Zvýšení ostrosti
    enhancer = ImageEnhance.Sharpness(image)
    image = enhancer.enhance(1.5)
    
    return image

try:
    # Načtení a preprocessing obrázku
    img = Image.open(image_path)
    
    # Konverze do šedotónového obrazu
    img = img.convert('L')
    
    # Vylepšení kvality
    img = enhance_image(img)
    
    # Uložení preprocessovaného obrazu
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
    temp_path = temp_file.name
    temp_file.close()
    img.save(temp_path)
    
    # Pro české texty přidat i podporu angličtiny jako zálohu
    lang_param = f"{language}+eng" if language == 'ces' else language
    
    # Spuštění Tesseract OCR
    cmd = ["tesseract", temp_path, "stdout", "-l", lang_param, "--psm", "6"]
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, stderr = process.communicate()
    
    # Kontrola chyb
    if process.returncode != 0:
        result = {
            "success": False,
            "text": "",
            "error": f"Tesseract vrátil chybu: {stderr.decode('utf-8', errors='replace')}"
        }
    else:
        # Zpracování výstupu
        text = stdout.decode('utf-8', errors='replace').strip()
        result = {
            "success": True,
            "text": text,
            "confidence": 0.85  # Pevná hodnota důvěryhodnosti - nelze snadno získat z tesseract stdout
        }
    
    # Odstranění dočasného souboru
    os.unlink(temp_path)
    
except Exception as e:
    result = {
        "success": False,
        "text": "",
        "error": f"Zpracování selhalo: {str(e)}"
    }

# Vrácení výsledku jako JSON
print(json.dumps(result))