
import sys
import json
import logging
from paddleocr import PaddleOCR

# Configure logging to stderr so it doesn't pollute stdout (which is used for JSON)
logging.basicConfig(level=logging.INFO, stream=sys.stderr)

def process_image(image_path):
    try:
        # Initialize PaddleOCR
        # use_angle_cls=True enables angle classification
        # lang='en' for English (or 'ch' for Chinese/English mix which is default and robust)
        ocr = PaddleOCR(use_angle_cls=True, lang='en')
        
        logging.info(f"Processing image: {image_path}")
        result = ocr.ocr(image_path)
        
        # Result is a list of lists (one for each page)
        # We assume single page
        if not result or result[0] is None:
            print(json.dumps({"text": "", "lines": [], "average_confidence": 0}))
            return

        # Check result structure
        data = result[0]
        lines = []
        total_conf = 0
        count = 0
        
        if isinstance(data, dict) and 'rec_texts' in data:
            # New format (PP-OCRv5 / PaddleX)
            texts = data.get('rec_texts', [])
            scores = data.get('rec_scores', [])
            boxes = data.get('dt_polys', [])
            
            for i in range(len(texts)):
                text = texts[i]
                score = scores[i]
                # Convert numpy array to list if needed
                box = boxes[i].tolist() if hasattr(boxes[i], 'tolist') else boxes[i]
                
                lines.append({
                    "text": text,
                    "confidence": score,
                    "box": box
                })
                total_conf += score
                count += 1
                
        elif isinstance(data, list):
            # Old format (List of [box, [text, score]])
            for line in data:
                box = line[0]
                text = line[1][0]
                score = line[1][1]
                
                lines.append({
                    "text": text,
                    "confidence": score,
                    "box": box
                })
                total_conf += score
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
        logging.error(f"Error processing image: {str(e)}")
        # Output error JSON
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        logging.error("Usage: python ocr_service.py <image_path>")
        sys.exit(1)
        
    image_path = sys.argv[1]
    process_image(image_path)
