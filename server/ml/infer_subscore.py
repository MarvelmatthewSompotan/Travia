#!/usr/bin/env python3
"""
Sub-score predictor inference script.
Input (stdin): JSON string (single review text)
Output (stdout): JSON object with predicted sub-scores
"""

import sys
import json
import os
import torch
from torch import nn
from transformers import DistilBertTokenizerFast, DistilBertModel

MODEL_DIR = "./models/subscore_final"
BASE_MODEL_NAME = "distilbert-base-uncased"


class DistilBertForMultiRegression(nn.Module):
    """Must match the training architecture exactly."""
    def __init__(self, model_name, num_outputs=6):
        super().__init__()
        self.num_outputs = num_outputs
        self.distilbert = DistilBertModel.from_pretrained(model_name)
        hidden_size = self.distilbert.config.hidden_size
        self.pre_classifier = nn.Linear(hidden_size, hidden_size)
        self.classifier = nn.Linear(hidden_size, num_outputs)
        self.dropout = nn.Dropout(0.3)
        self.relu = nn.ReLU()
        self.sigmoid = nn.Sigmoid()

    def forward(self, input_ids=None, attention_mask=None):
        outputs = self.distilbert(input_ids=input_ids, attention_mask=attention_mask)
        pooled = outputs.last_hidden_state[:, 0]
        pooled = self.pre_classifier(pooled)
        pooled = self.relu(pooled)
        pooled = self.dropout(pooled)
        return self.sigmoid(self.classifier(pooled))


_model = None
_tokenizer = None
_device = None
_subscores = None

def load_model():
    global _model, _tokenizer, _device, _subscores
    if _model is not None:
        return

    if torch.backends.mps.is_available():
        _device = torch.device("mps")
    elif torch.cuda.is_available():
        _device = torch.device("cuda")
    else:
        _device = torch.device("cpu")

    _tokenizer = DistilBertTokenizerFast.from_pretrained(BASE_MODEL_NAME)
    _model = DistilBertForMultiRegression(BASE_MODEL_NAME, num_outputs=6)

    weights_path = os.path.join(MODEL_DIR, "pytorch_model.bin")
    state_dict = torch.load(weights_path, map_location="cpu")
    _model.load_state_dict(state_dict)

    _model.to(_device)
    _model.eval()

    with open(os.path.join(MODEL_DIR, "subscores.json")) as f:
        _subscores = json.load(f)


def predict(text):
    load_model()

    encoding = _tokenizer(
        text[:1000],
        max_length=256,
        padding="max_length",
        truncation=True,
        return_tensors="pt",
    )
    encoding = {k: v.to(_device) for k, v in encoding.items()}

    with torch.no_grad():
        outputs = _model(**encoding)
        scores_normalized = outputs[0].cpu().numpy()
        scores_1_to_5 = (scores_normalized * 4) + 1

    return {name: round(float(scores_1_to_5[i]), 2) for i, name in enumerate(_subscores)}


if __name__ == "__main__":
    try:
        input_data = json.loads(sys.stdin.read())
        text = input_data if isinstance(input_data, str) else input_data.get("text", "")
        output = predict(text)
        print(json.dumps(output))
        sys.stdout.flush()
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
