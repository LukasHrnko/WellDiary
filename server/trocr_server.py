#!/usr/bin/env python
"""
TrOCR Server pro rozpoznávání rukopisu
Používá model microsoft/trocr-base-handwritten
"""

import os
import sys
import json
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
import cgi
import io
from PIL import Image

# Tyto importy je třeba nainstalovat pomocí pip
from transformers import TrOCRProcessor, VisionEncoderDecoderModel

# Nastavení portu
PORT = 5500

# Globální instance pro sdílení napříč požadavky
processor = None
model = None

def initialize_model():
    """
    Načte model a procesor pro TrOCR
    """
    global processor, model
    print("Načítám TrOCR model...")
    try:
        processor = TrOCRProcessor.from_pretrained('microsoft/trocr-base-handwritten')
        model = VisionEncoderDecoderModel.from_pretrained('microsoft/trocr-base-handwritten')
        print("Model úspěšně načten!")
        return True
    except Exception as e:
        print(f"Chyba při načítání modelu: {str(e)}")
        traceback.print_exc()
        return False

def recognize_text(image_path, language='eng'):
    """
    Rozpozná text z obrázku pomocí TrOCR
    """
    global processor, model
    
    try:
        # Kontrola, zda byl model načten
        if processor is None or model is None:
            if not initialize_model():
                return {
                    "success": False,
                    "text": "",
                    "error": "Model se nepodařilo inicializovat"
                }
        
        # Otevření a předzpracování obrázku
        image = Image.open(image_path).convert("RGB")
        
        # Zpracování obrázku
        pixel_values = processor(images=image, return_tensors="pt").pixel_values
        
        # Generování textu
        generated_ids = model.generate(pixel_values)
        generated_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
        
        return {
            "success": True,
            "text": generated_text,
            "confidence": 0.95  # TrOCR neposkytuje přímo confidence score
        }
    except Exception as e:
        print(f"Chyba při rozpoznávání textu: {str(e)}")
        traceback.print_exc()
        return {
            "success": False,
            "text": "",
            "error": f"Chyba při rozpoznávání textu: {str(e)}"
        }

class TrOCRHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        """
        Zpracování GET požadavků (jen pro kontrolu, zda server běží)
        """
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == "/health":
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            response = {
                "status": "ok",
                "message": "TrOCR server běží"
            }
            
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            response = {
                "error": "Endpoint nenalezen",
                "message": "Použijte /ocr pro rozpoznávání textu nebo /health pro kontrolu stavu"
            }
            
            self.wfile.write(json.dumps(response).encode())
    
    def do_POST(self):
        """
        Zpracování POST požadavků (hlavní funkcionalita OCR)
        """
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == "/ocr":
            content_type, pdict = cgi.parse_header(self.headers.get('Content-Type', ''))
            
            if content_type == 'multipart/form-data':
                form = cgi.FieldStorage(
                    fp=self.rfile,
                    headers=self.headers,
                    environ={'REQUEST_METHOD': 'POST'}
                )
                
                # Kontrola, zda byl nahrán obrázek
                if 'image' not in form:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    
                    response = {
                        "success": False,
                        "error": "Nebyl nahrán žádný obrázek"
                    }
                    
                    self.wfile.write(json.dumps(response).encode())
                    return
                
                # Získání parametrů
                image_item = form['image']
                language = form.getvalue('language', 'eng')
                
                # Vytvoření dočasného souboru pro obrázek
                image_path = f"/tmp/trocr_temp_{os.getpid()}.png"
                
                with open(image_path, 'wb') as f:
                    f.write(image_item.file.read())
                
                # Rozpoznání textu
                result = recognize_text(image_path, language)
                
                # Odstranění dočasného souboru
                if os.path.exists(image_path):
                    os.remove(image_path)
                
                # Odeslání odpovědi
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                
                self.wfile.write(json.dumps(result).encode())
            else:
                self.send_response(415)  # Unsupported Media Type
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                
                response = {
                    "success": False,
                    "error": "Nepodporovaný typ obsahu, použijte multipart/form-data"
                }
                
                self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            response = {
                "success": False,
                "error": "Endpoint nenalezen",
                "message": "Použijte /ocr pro rozpoznávání textu"
            }
            
            self.wfile.write(json.dumps(response).encode())

def run_server(port=PORT):
    """
    Spustí HTTP server na zadaném portu
    """
    server_address = ('', port)
    httpd = HTTPServer(server_address, TrOCRHandler)
    print(f"Spouštím TrOCR server na portu {port}...")
    
    # Inicializace modelu
    initialize_model()
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    print("Server zastaven")

if __name__ == "__main__":
    # Možnost zadat jiný port jako argument
    if len(sys.argv) > 1:
        run_server(int(sys.argv[1]))
    else:
        run_server()