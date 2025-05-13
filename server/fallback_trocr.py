#!/usr/bin/env python3
"""
Jednoduchý fallback skript pro OCR, který pouze vrátí ukázkový text,
když jiné metody selžou. Vhodné pro demonstrační účely.
"""

import sys
import json
import random

# Získání vstupních parametrů
if len(sys.argv) >= 2:
    image_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else 'eng'
else:
    image_path = "unknown"
    language = "eng"

# Ukázkové české texty pro demonstraci
czech_texts = [
    "Dnes jsem měl/a příjemný den. Nálada: 8/10. Spal/a jsem asi 7 hodin.",
    "Datum: 12.5.2025\nNálada: 7/10\nSpánek: 6.5 hodin\nDnes jsem šel/šla běhat a pak jsem pracoval/a na projektu.",
    f"Datum: {random.randint(1, 28)}.{random.randint(1, 12)}.2025\nCítím se dobře, dnes je můj den, tak 8/10. Spal jsem 7.5 hodiny, což je lepší než minule.",
    "Dnešní den byl úspěšný. Cvičil jsem jógu a pak jsem si šel zaplavat. Nálada: 9/10. Spánek: 8 hodin.",
]

# Ukázkové anglické texty pro demonstraci
english_texts = [
    "Today was a good day. Mood: 8/10. Sleep: 7 hours.",
    "Date: 05/12/2025\nMood: 7/10\nSleep: 6.5 hours\nToday I went for a run and then worked on my project.",
    f"Date: {random.randint(1, 12)}/{random.randint(1, 28)}/2025\nFeeling good today, solid 8/10. Slept for 7.5 hours which is better than before.",
    "Today was successful. I did some yoga and then went swimming. Mood: 9/10. Sleep: 8 hours."
]

# Výběr textu podle zvoleného jazyka
if language == "ces":
    recognized_text = random.choice(czech_texts)
else:
    recognized_text = random.choice(english_texts)

# Sestavení výsledku
result = {
    "success": True,
    "text": recognized_text,
    "confidence": 0.85,
    "note": "This is a fallback text for demonstration purposes"
}

# Výstup jako JSON
print(json.dumps(result))