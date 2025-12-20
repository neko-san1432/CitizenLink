import json
import sys

def parse_lint(filename):
    with open(filename, 'r', encoding='utf-16le') as f:
        data = json.load(f)
    
    unused_items = []
    for file_info in data:
        for message in file_info['messages']:
            if message['ruleId'] == 'no-unused-vars':
                unused_items.append({
                    'file': file_info['filePath'],
                    'line': message['line'],
                    'message': message['message']
                })
    
    for item in unused_items:
        print(f"{item['file']}:{item['line']} - {item['message']}")

if __name__ == '__main__':
    parse_lint('lint_results.json')
