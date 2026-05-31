#!/usr/bin/env python3
"""
Deal-breaker detector inference script.
Input (stdin): JSON array of review text strings
Output (stdout): JSON array of predictions
"""

import sys
import json
import torch
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification

MODEL_DIR = "./models/dealbreaker_final"

_model = None
_tokenizer = None
_device = None

def load_model():
    global _model, _tokenizer, _device
    if _model is not None:
        return

    if torch.backends.mps.is_available():
        _device = torch.device("mps")
    elif torch.cuda.is_available():
        _device = torch.device("cuda")
    else:
        _device = torch.device("cpu")

    _tokenizer = DistilBertTokenizerFast.from_pretrained(MODEL_DIR)
    _model = DistilBertForSequenceClassification.from_pretrained(MODEL_DIR)
    _model.to(_device)
    _model.eval()


def predict(texts):
    load_model()

    results = []
    for text in texts:
        encoding = _tokenizer(
            text[:1000],
            max_length=256,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        encoding = {k: v.to(_device) for k, v in encoding.items()}

        with torch.no_grad():
            logits = _model(**encoding).logits
            probs = torch.softmax(logits, dim=-1)
            pred_id = torch.argmax(probs, dim=-1).item()
            confidence = probs[0][pred_id].item()

        label = _model.config.id2label[pred_id]
        results.append({
            "label": label,
            "confidence": round(confidence, 4),
            "is_dealbreaker": label == "DEALBREAKER",
            "is_warning": label == "WARNING",
        })

    return results


if __name__ == "__main__":
    try:
        input_data = json.loads(sys.stdin.read())
        texts = input_data if isinstance(input_data, list) else [input_data]
        output = predict(texts)
        print(json.dumps(output))
        sys.stdout.flush()
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
