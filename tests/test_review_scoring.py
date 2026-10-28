import pytest
from backend.services.ai_reviewer import validate_and_normalize_review_json
from backend.services.llm_service import extract_json_from_text

def test_extract_json_from_markdown():
    markdown_output = """
Here is my evaluation:
```json
{
  "overall_score": 88,
  "summary": "Solid implementation with good documentation.",
  "requirement_statuses": [
    {"requirement": "JWT Authentication", "status": "Met", "evidence": "Document shows Bearer token handling."},
    {"requirement": "Unit Tests", "status": "Unable to Verify", "evidence": "Mentions tests but no code execution proof."}
  ],
  "missing_requirements": [],
  "strengths": ["Clear API specifications"],
  "weaknesses": ["Lack of deployment guide"],
  "improvement_suggestions": ["Add Dockerfile"],
  "recommended_next_steps": ["Prepare demo"]
}
```
Thank you!
"""
    parsed = extract_json_from_text(markdown_output)
    assert parsed["overall_score"] == 88
    assert len(parsed["requirement_statuses"]) == 2

def test_score_normalization_and_clamping():
    # Test exceeding score
    high_score_data = {
        "overall_score": 150,
        "requirement_statuses": [{"requirement": "Feature A", "status": "Met"}]
    }
    validated = validate_and_normalize_review_json(high_score_data)
    assert validated["overall_score"] == 100

    # Test negative score
    low_score_data = {
        "overall_score": -10,
        "requirement_statuses": [{"requirement": "Feature A", "status": "Not Met"}]
    }
    validated = validate_and_normalize_review_json(low_score_data)
    assert validated["overall_score"] == 0

def test_status_normalization():
    data = {
        "overall_score": 65,
        "requirement_statuses": [
            {"requirement": "Req 1", "status": "met"},
            {"requirement": "Req 2", "status": "partially completed"},
            {"requirement": "Req 3", "status": "failed"},
            {"requirement": "Req 4", "status": "cannot check without running"}
        ]
    }
    validated = validate_and_normalize_review_json(data)
    statuses = [item["status"] for item in validated["requirement_statuses"]]
    assert statuses == ["Met", "Partially Met", "Not Met", "Unable to Verify"]

