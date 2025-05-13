#!/usr/bin/env python3
"""
Optimalizované TrOCR (Microsoft-inspired) rozpoznávání rukopisu
Využívá kombinaci OpenCV a pytesseract s pokročilými technikami zpracování obrazu

Tato implementace je optimalizována pro rychlost a přesnost s těmito vylepšeními:
- Paralelní zpracování variant předzpracování obrazu
- Optimalizované konfigurace pytesseract
- Pokročilé post-processingové algoritmy pro vyčištění textu
- Inteligentní výběr nejvhodnějšího výsledku
"""

import sys
import os
import json
import cv2
import numpy as np
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
import multiprocessing
from concurrent.futures import ProcessPoolExecutor
import time

# Měření celkového času zpracování
start_time = time.time()

# Set Tesseract to use our higher quality training data
TESSDATA_PREFIX = os.path.join(os.getcwd(), 'tessdata')
os.environ['TESSDATA_PREFIX'] = TESSDATA_PREFIX

# Nastavení maximálního počtu procesů pro paralelní zpracování
# Použití multiprocessing.cpu_count() - 1 zajistí, že jeden procesor zůstane volný pro systém
MAX_WORKERS = max(1, multiprocessing.cpu_count() - 1)
print(f"Využívám {MAX_WORKERS} procesů pro paralelní zpracování")

# Konfigurační zprávy
print(f"Používám Tesseract data directory: {TESSDATA_PREFIX}")
if os.path.exists(os.path.join(TESSDATA_PREFIX, 'eng.traineddata')):
    print("Nalezena anglická trénovací data")
if os.path.exists(os.path.join(TESSDATA_PREFIX, 'ces.traineddata')):
    print("Nalezena česká trénovací data")

def preprocess_image(image_path, variant=0):
    """
    Optimalizované předzpracování obrazu pro lepší OCR rozpoznávání rukopisu
    
    Args:
        image_path: Cesta k souboru s obrázkem
        variant: Varianta předzpracování (0-11) - přidáno více optimalizovaných metod
    
    Returns:
        Předzpracovaný obraz jako NumPy pole
    """
    try:
        # Načtení obrázku
        image = cv2.imread(image_path)
        if image is None:
            print(f"Chyba: Nelze načíst obrázek z {image_path}")
            # Vrátit prázdný obrázek v případě chyby
            return np.zeros((100, 100), dtype=np.uint8)
        
        # Měření velikosti obrázku pro optimalizaci
        height, width = image.shape[:2]
        print(f"Zpracovávám obrázek {width}x{height} pixelů")
        
        # Pokud je obrázek příliš velký, zmenšíme ho pro rychlejší zpracování
        # Zachováme poměr stran, ale omezíme maximální velikost na 2000 pixelů
        max_dimension = 2000
        if max(height, width) > max_dimension:
            scale = max_dimension / max(height, width)
            new_width = int(width * scale)
            new_height = int(height * scale)
            print(f"Obrázek zmenšen na {new_width}x{new_height} pro rychlejší zpracování")
            image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
            height, width = new_height, new_width
        
        # Převod na stupně šedi
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Zpracování podle varianty
        processed = None
        
        if variant == 0:
            # Ruční písmo varianta 1: Otsu prahování s Gaussovým rozostřením
            # Dobrá základní metoda pro většinu rukopisů s dobrým kontrastem
            blur = cv2.GaussianBlur(gray, (5, 5), 0)
            _, processed = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
        elif variant == 1:
            # Ruční písmo varianta 2: Adaptivní prahování s menším blokem
            # Dobrá pro rukopis s měnícím se osvětlením nebo jasem
            processed = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 5
            )
            
        elif variant == 2:
            # Ruční písmo varianta 3: Zvýšení kontrastu a adaptivní prahování
            # Dobrá pro slabý rukopis nebo světlý inkoust
            pil_img = Image.fromarray(gray)
            enhancer = ImageEnhance.Contrast(pil_img)
            enhanced = enhancer.enhance(2.2)  # Zvýšili jsme hodnotu pro lepší kontrast
            enhanced_array = np.array(enhanced)
            
            processed = cv2.adaptiveThreshold(
                enhanced_array, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 15, 8
            )
            
        elif variant == 3:
            # Ruční písmo varianta 4: Střední rozostření a adaptivní prahování s větším blokem
            # Dobrá pro středně velký rukopis a nepravidelné rozestupy
            blur = cv2.GaussianBlur(gray, (3, 3), 0)
            processed = cv2.adaptiveThreshold(
                blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 7
            )
            
        elif variant == 4:
            # Ruční písmo varianta 5: Zostření obrazu a adaptivní prahování
            # Dobrá pro neostré rukopisy nebo skenované dokumenty s nízkou kvalitou
            kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
            sharpened = cv2.filter2D(gray, -1, kernel)
            
            processed = cv2.adaptiveThreshold(
                sharpened, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 17, 6
            )
            
        elif variant == 5:
            # Ruční písmo varianta 6: Redukce šumu s morfologickými operacemi
            # Dobrá pro rukopisy s šumem nebo drobnými skvrnami
            blur = cv2.GaussianBlur(gray, (5, 5), 0)
            _, binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            kernel = np.ones((2, 2), np.uint8)
            opening = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
            processed = cv2.morphologyEx(opening, cv2.MORPH_CLOSE, kernel, iterations=1)
            
        elif variant == 6:
            # Ruční písmo varianta 7: Pokročilé zpracování PIL s vylepšeným kontrastem a zaostřením
            # Dobrá pro složité rukopisy s jemnými tahy
            pil_img = Image.fromarray(gray)
            
            # Zvýšení kontrastu
            enhancer = ImageEnhance.Contrast(pil_img)
            enhanced = enhancer.enhance(2.4)  # Zvýšili jsme hodnotu kontrastu
            
            # Zaostření dvakrát pro lepší výsledky
            enhanced = enhanced.filter(ImageFilter.SHARPEN)
            enhanced = enhanced.filter(ImageFilter.SHARPEN)
            
            enhanced_array = np.array(enhanced)
            _, processed = cv2.threshold(enhanced_array, 175, 255, cv2.THRESH_BINARY)
            
        elif variant == 7:
            # Ruční písmo varianta 8: Bilaterální filtr pro redukci šumu se zachováním hran
            # Dobrá pro rukopisy na texturovaném pozadí
            bilateral = cv2.bilateralFilter(gray, 9, 25, 25)  # Upraveny parametry pro lepší výsledky
            _, processed = cv2.threshold(bilateral, 180, 255, cv2.THRESH_BINARY)
            
        elif variant == 8:
            # Ruční písmo varianta 9: Souhrnné vylepšení jasu a kontrastu s adaptivním prahováním
            # Dobrá pro tmavé nebo bledé rukopisy
            pil_img = Image.fromarray(gray)
            
            brightness = ImageEnhance.Brightness(pil_img)
            bright_img = brightness.enhance(1.3)  # Zvýšen jas
            
            contrast = ImageEnhance.Contrast(bright_img)
            contrast_img = contrast.enhance(2.0)  # Zvýšen kontrast
            
            enhanced_array = np.array(contrast_img)
            processed = cv2.adaptiveThreshold(
                enhanced_array, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 13, 5
            )
            
        elif variant == 9:
            # NOVÁ Ruční písmo varianta 10: Kombinace kanálových filtrů
            # Dobrá pro rukopisy s barevným inkoustem
            # Extrahujeme kanály BGR
            b, g, r = cv2.split(image)
            
            # Pro modrý inkoust, více váhy dáme červenému a zelenému kanálu
            weighted = cv2.addWeighted(r, 0.4, g, 0.6, 0)
            
            # Prahování
            _, processed = cv2.threshold(weighted, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
        elif variant == 10:
            # NOVÁ Ruční písmo varianta 11: Pokročilé vyrovnání histogramu a adaptivní prahování
            # Dobrá pro rukopisy s nerovnoměrným osvětlením nebo kontrastem
            # CLAHE - Contrast Limited Adaptive Histogram Equalization
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            equalized = clahe.apply(gray)
            
            # Adaptivní prahování na vyrovnaném obrazu
            processed = cv2.adaptiveThreshold(
                equalized, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 7
            )
            
        elif variant == 11:
            # NOVÁ Ruční písmo varianta 12: Morfologické operace pro tenké nebo přerušované tahy
            # Dobrá pro jemné rukopisy nebo tužkou psané texty
            # Nejprve prahování
            _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # Kernel pro dilataci (rozšíření) - pomáhá spojit přerušené tahy
            kernel = np.ones((2, 2), np.uint8)
            dilated = cv2.dilate(binary, kernel, iterations=1)
            
            # Pak eroze, aby se písmo ztenčilo, ale zůstalo spojené
            processed = cv2.erode(dilated, kernel, iterations=1)
        
        # Pokud nebyla aplikována žádná metoda zpracování, vrátíme obraz ve stupních šedi
        if processed is None:
            processed = gray
            
        return processed
        
    except Exception as e:
        print(f"Chyba při předzpracování obrazu (varianta {variant}): {str(e)}")
        # V případě chyby vrátíme původní obrázek ve stupních šedi nebo prázdný obrázek
        try:
            return gray
        except:
            return np.zeros((100, 100), dtype=np.uint8)

def process_image_variant(args):
    """
    Zpracovat jednu variantu obrazu paralelně - helper funkce pro ProcessPoolExecutor
    
    Args:
        args: Tuple obsahující (image_path, variant, orientation, lang)
    
    Returns:
        Dictionary s výsledky rozpoznávání
    """
    image_path, variant, orientation, lang = args
    
    try:
        # Předzpracování obrazu
        processed_image = preprocess_image(image_path, variant)
        
        # Rotace obrazu podle potřeby
        if orientation == 90:
            processed_image = cv2.rotate(processed_image, cv2.ROTATE_90_CLOCKWISE)
        elif orientation == 180:
            processed_image = cv2.rotate(processed_image, cv2.ROTATE_180)
        elif orientation == 270:
            processed_image = cv2.rotate(processed_image, cv2.ROTATE_90_COUNTERCLOCKWISE)
        
        # Rozpoznávání textu s optimálním nastavením pro variantu
        if variant in [0, 1, 6, 7, 10]:
            # Pro jasné a čisté obrazy nebo jemné rukopisy použijeme psm=6 (jednoduché bloky textu)
            psm = 6 
        elif variant in [2, 3, 8, 11]:
            # Pro složitější rukopisy použijeme psm=4 (text v jedné koloně)
            psm = 4
        else:
            # Pro ostatní použijeme psm=3 (plná automatická segmentace stránky)
            psm = 3
        
        # Pro české texty přidáme i angličtinu jako zálohu
        if lang == 'ces':
            lang_param = f"{lang}+eng"
        else:
            lang_param = lang
            
        # Konfigurace rozpoznávání
        config = f"--psm {psm} --oem 1 -l {lang_param}"
        
        # Pokročilé rozpoznávání textu
        data = pytesseract.image_to_data(processed_image, config=config, output_type=pytesseract.Output.DICT)
        
        # Extrakce textu a výpočet průměrné důvěryhodnosti
        text_parts = []
        confidence_sum = 0
        confidence_count = 0
        
        for i in range(len(data['text'])):
            if data['text'][i].strip():
                text_parts.append(data['text'][i])
                confidence_sum += float(data['conf'][i])
                confidence_count += 1
        
        if confidence_count == 0:
            text = ""
            confidence = 0
        else:
            text = ' '.join(text_parts)
            confidence = confidence_sum / confidence_count
        
        # Hodnocení kvality výsledku
        if not text.strip():
            quality_score = 0
        else:
            # Výpočet poměru alfanumerických znaků
            alpha_count = sum(c.isalnum() for c in text)
            total_count = max(1, len(text))
            char_ratio = alpha_count / total_count
            
            # Hodnocení na základě počtu znaků (očekáváme alespoň 10 znaků v rukopisu)
            text_length_score = min(len(text), 200) / 100
            
            # Výpočet celkového skóre kvality s větší váhou pro důvěryhodnost
            quality_score = (confidence * 0.6) + (text_length_score * 0.2) + (char_ratio * 100 * 0.2)
        
        variant_name = f"Varianta {variant}, Orientace {orientation}"
        print(f"{variant_name}: {text[:30]}... (skóre: {quality_score:.2f}, důvěra: {confidence:.2f})")
        
        # Vrácení výsledků
        return {
            "variant": variant,
            "orientation": orientation,
            "text": text,
            "confidence": confidence,
            "quality_score": quality_score
        }
        
    except Exception as e:
        print(f"Chyba při zpracování varianty {variant}, orientace {orientation}: {str(e)}")
        return {
            "variant": variant,
            "orientation": orientation,
            "text": "",
            "confidence": 0,
            "quality_score": 0,
            "error": str(e)
        }

def post_process_text(text):
    """
    Pokročilé post-processingové úpravy rozpoznaného textu
    
    Args:
        text: Rozpoznaný text z OCR
    
    Returns:
        Vyčištěný a vylepšený text
    """
    if not text:
        return ""
        
    # Odstranění nadbytečných mezer
    text = ' '.join(text.split())
    
    # Import regex zde pro minimalizaci importů
    import re
    
    try:
        # Nahrazení po sobě jdoucích speciálních znaků mezerami
        text = re.sub(r'[^\w\s\.\,\?\!]{2,}', ' ', text)
        
        # Standardizace uvozovek a apostrofů
        text = re.sub(r'[''`´]', "'", text)
        text = re.sub(r'[""„]', '"', text)
        
        # Náhrada neobvyklých pomlček za standardní
        text = re.sub(r'[–—−]', '-', text)
        
        # Odstranění znaků smetí z OCR
        text = re.sub(r'[|]', 'I', text)  # Svislice často zaměněná za 'I'
        text = re.sub(r'[\\\/]', '/', text)  # Standardizace lomítek
        
        # Oprava běžných chyb rozpoznávání
        text = re.sub(r'0([A-Za-z])', 'O\\1', text)  # '0' často zaměněné za 'O' před písmenem
        text = re.sub(r'([A-Za-z])0', '\\1O', text)  # '0' často zaměněné za 'O' po písmenu
        text = re.sub(r'1([A-Za-z])', 'I\\1', text)  # '1' často zaměněné za 'I' před písmenem
        
        # Oprava velkých písmen na začátku vět
        text = re.sub(r'([\.!?]\s+)([a-z])', lambda m: m.group(1) + m.group(2).upper(), text)
        
        # Speciální opravy pro české znaky
        text = re.sub(r'c\s*v', 'č', text)  # 'c v' často zaměněné za 'č'
        text = re.sub(r'e\s*s', 'ě', text)  # 'e s' často zaměněné za 'ě'
        
        # Oprava mezer kolem interpunkce
        text = re.sub(r'\s+([,.!?:;])', '\\1', text)
        text = re.sub(r'([,.!?:;])([A-Za-z0-9])', '\\1 \\2', text)
        
        # Odstranění osamocených písmen (kromě 'a', 'i', 'k', 's', 'v', 'z', 'A', 'I', 'K', 'O', 'S', 'V', 'Z')
        text = re.sub(r'\s+([b-hj-uw-yB-HJ-NPQ-UW-Y])\s+', ' ', text)
        
        # Sloučení rozdělených slov (lze dále rozšířit pro běžné české prefixy a sufixy)
        common_prefixes = ['ne', 'po', 'pro', 'pře', 'při', 'roz', 'vy', 'za']
        for prefix in common_prefixes:
            text = re.sub(f'\\b({prefix})\\s+', f'\\1', text, flags=re.IGNORECASE)
        
        return text
        
    except Exception as e:
        print(f"Chyba při post-processingu textu: {str(e)}")
        return text

def recognize_text_parallel(image_path, lang='eng'):
    """
    Paralelní rozpoznávání textu z obrázku s více variantami předzpracování a orientacemi
    
    Args:
        image_path: Cesta k souboru s obrázkem
        lang: Jazyk pro OCR
    
    Returns:
        Dictionary obsahující nejlepší výsledek, včetně textu a důvěryhodnosti
    """
    # Seznam variant předzpracování, které chceme vyzkoušet
    # Vybíráme pouze nejlepší varianty pro úsporu času, jinak máme k dispozici 0-11
    preprocessing_variants = [0, 2, 5, 7, 10]
    
    # Seznam orientací obrazu, které chceme vyzkoušet (stupně)
    # Pro rukopis obvykle stačí 0 a 270 (aby se urychlilo zpracování)
    orientations = [0, 270]  
    
    # Vytvoření seznamu úloh pro paralelní zpracování
    tasks = [(image_path, variant, orientation, lang) 
             for variant in preprocessing_variants 
             for orientation in orientations]
    
    print(f"Paralelní zpracování {len(tasks)} kombinací variant a orientací")
    
    # Zpracování v paralelních procesech
    results = []
    with ProcessPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Zpracování všech variant paralelně
        for result in executor.map(process_image_variant, tasks):
            results.append(result)
    
    # Najít nejlepší výsledek podle skóre kvality
    if not results:
        return "", 0, 0, 0
    
    # Seřazení výsledků podle skóre kvality
    results.sort(key=lambda x: x["quality_score"], reverse=True)
    
    # Pokud máme více dobrých výsledků, můžeme je kombinovat
    good_results = [r for r in results if r["quality_score"] > 50]
    
    if len(good_results) > 1:
        print(f"Nalezeno {len(good_results)} dobrých výsledků s podobným skóre")
        
        # Vypsat podrobnosti o nejlepších výsledcích
        for i, result in enumerate(good_results[:3]):
            print(f"Top {i+1}: Varianta {result['variant']}, Orientace {result['orientation']}, "
                  f"Skóre: {result['quality_score']:.2f}, Důvěra: {result['confidence']:.2f}")
            print(f"   Text: {result['text'][:50]}...")
    
    # Vrátit nejlepší výsledek
    best_result = results[0]
    best_text = post_process_text(best_result["text"])
    
    return best_text, best_result["confidence"], best_result["variant"], best_result["orientation"]

def main():
    """
    Hlavní funkce pro zpracování obrázku z příkazové řádky
    """
    if len(sys.argv) < 2:
        print("Použití: python optimized_trocr.py <cesta k obrázku> [jazyk]")
        sys.exit(1)
    
    image_path = sys.argv[1]
    lang = sys.argv[2] if len(sys.argv) > 2 else 'eng'
    
    if not os.path.exists(image_path):
        print(f"Chyba: Soubor {image_path} neexistuje")
        sys.exit(1)
    
    text, confidence, best_variant, best_orientation = recognize_text_parallel(image_path, lang)
    
    execution_time = time.time() - start_time
    
    result = {
        "success": bool(text),
        "text": text,
        "confidence": float(confidence),
        "execution_time": execution_time,
        "best_variant": int(best_variant),
        "best_orientation": int(best_orientation)
    }
    
    print(f"\nCelkový čas zpracování: {execution_time:.2f} sekund")
    print(f"Nejlepší varianta: {best_variant}, Orientace: {best_orientation}")
    print(f"Důvěryhodnost: {confidence:.2f}")
    print("\nRozpoznaný text:")
    print("---------------")
    print(text)
    print("---------------")
    
    # Výstup do JSON
    print(json.dumps(result))

if __name__ == "__main__":
    main()