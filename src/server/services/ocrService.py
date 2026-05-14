
import sys
import json
import logging
import os

# Set environment variables for CPU stability
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

# Silence logs
logging.getLogger("easyocr").setLevel(logging.ERROR)

try:
    import easyocr
    import numpy as np
except ImportError:
    print(json.dumps({"error": "OCR dependencies (easyocr/numpy) not found. Please install them."}))
    sys.exit(1)

def process_image(image_path):
    try:
        # Initialize EasyOCR (English only for speed and stability)
        # verbose=False silences progress bars which can crash console logs
        reader = easyocr.Reader(['en'], gpu=False, verbose=False)
        
        # Run OCR
        results = reader.readtext(image_path)
        
        if not results:
            print(json.dumps({"text": "", "lines": [], "average_confidence": 0}))
            return

        lines = []
        total_conf = 0
        count = 0
        
        for (bbox, text, prob) in results:
            # bbox is a list of [x,y] coordinates
            # Convert numpy arrays/types to standard python types for JSON
            lines.append({
                "text": text,
                "confidence": float(prob),
                "box": [[float(coord) for coord in point] for point in bbox]
            })
            total_conf += float(prob)
            count += 1
        
        full_text = "\n".join([l["text"] for l in lines])
        avg_conf = (total_conf / count) if count > 0 else 0
        
        output = {
            "text": full_text,
            "lines": lines,
            "average_confidence": avg_conf
        }
        
        # Print JSON to stdout
        print(json.dumps(output))
        
    except Exception as e:
        # Output error JSON
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python ocrService.py <image_path>"}))
        sys.exit(1)
        
    image_path = sys.argv[1]
    process_image(image_path)
