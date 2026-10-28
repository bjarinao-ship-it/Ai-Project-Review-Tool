import json
from sqlalchemy.orm import Session
from backend.models import Task, Submission, ReviewReport
from backend.services.llm_service import call_llm, extract_json_from_text
from backend.services.ai_mentor import build_task_context

VALID_STATUSES = {"Met", "Partially Met", "Not Met", "Unable to Verify"}

def validate_and_normalize_review_json(data: dict) -> dict:
    """
    Validates and normalizes structured review output from LLM.
    Ensures correct types, bounded score, and valid status values.
    """
    # 1. Overall score
    score = data.get("overall_score", 0)
    try:
        score = int(round(float(score)))
        score = max(0, min(100, score))
    except (ValueError, TypeError):
        score = 50

    # 2. Requirement statuses
    raw_reqs = data.get("requirement_statuses", [])
    normalized_reqs = []
    if isinstance(raw_reqs, list):
        for item in raw_reqs:
            if isinstance(item, dict):
                status = item.get("status", "Unable to Verify")
                if status not in VALID_STATUSES:
                    # Map fuzzy status values
                    low = str(status).lower()
                    if "unable" in low or "verify" in low or "unverified" in low or "check" in low or "unknown" in low:
                        status = "Unable to Verify"
                    elif "part" in low:
                        status = "Partially Met"
                    elif "not" in low or "unmet" in low or "fail" in low:
                        status = "Not Met"
                    elif "met" in low or "pass" in low or "complete" in low:
                        status = "Met"
                    else:
                        status = "Unable to Verify"

                normalized_reqs.append({
                    "requirement": str(item.get("requirement", "Unnamed requirement")),
                    "status": status,
                    "evidence": str(item.get("evidence", "No evidence identified in text.")),
                    "notes": str(item.get("notes", ""))
                })

    def ensure_str_list(key: str) -> list:
        val = data.get(key, [])
        if isinstance(val, list):
            return [str(x) for x in val if x]
        elif isinstance(val, str) and val.strip():
            return [val.strip()]
        return []

    return {
        "overall_score": score,
        "summary": str(data.get("summary", "Review completed successfully.")),
        "requirement_statuses": normalized_reqs,
        "missing_requirements": ensure_str_list("missing_requirements"),
        "strengths": ensure_str_list("strengths"),
        "weaknesses": ensure_str_list("weaknesses"),
        "improvement_suggestions": ensure_str_list("improvement_suggestions"),
        "recommended_next_steps": ensure_str_list("recommended_next_steps"),
    }


async def generate_ai_review(task: Task, submission: Submission, db: Session) -> ReviewReport:
    """
    Analyzes submitted project documentation against the task requirements.
    Returns and stores a ReviewReport in the database.
    """
    task_context = build_task_context(task, db)
    doc_text = submission.extracted_text or ""
    
    # Truncate documentation if extraordinarily long to keep token usage within bounds
    if len(doc_text) > 12000:
        doc_text = doc_text[:12000] + "\n...[Remaining document truncated for evaluation]..."

    system_prompt = (
        "You are an objective, rigorous AI Technical Assessor and Code Reviewer. "
        "Your job is to evaluate a candidate's submitted project documentation against the original task specifications.\n\n"
        "STRICT EVALUATION PRINCIPLES:\n"
        "1. Do not claim that code works merely because the documentation says it works. "
        "Explicitly mark status as 'Unable to Verify' for claims that cannot be proven from documentation alone without runtime testing.\n"
        "2. Requirement status MUST be strictly one of: 'Met', 'Partially Met', 'Not Met', 'Unable to Verify'.\n"
        "3. Provide direct evidence from the submitted text for each claim.\n"
        "4. Be objective, constructive, and thorough.\n"
        "5. You MUST return ONLY a valid JSON object matching the requested schema."
    )

    user_prompt = f"""
ORIGINAL TASK SPECIFICATION & ACCEPTANCE CRITERIA:
{task_context}

---------------------------------------------------------
CANDIDATE SUBMITTED DOCUMENTATION ({submission.filename}, Version {submission.version}):
{doc_text if doc_text.strip() else "[NO TEXT EXTRACTED OR EMPTY DOCUMENT]"}
---------------------------------------------------------

Analyze the candidate's documentation against each requirement.
Return a single JSON object with this exact structure:
{{
  "overall_score": <integer from 0 to 100>,
  "summary": "<2-3 sentence overview of the submission quality and adherence>",
  "requirement_statuses": [
    {{
      "requirement": "<Requirement name or description>",
      "status": "Met" | "Partially Met" | "Not Met" | "Unable to Verify",
      "evidence": "<Direct excerpt, summary of proof, or explanation of why missing>",
      "notes": "<Brief evaluator commentary>"
    }}
  ],
  "missing_requirements": [
    "<List of requirements completely missing or unaddressed>"
  ],
  "strengths": [
    "<Key strengths identified in the documentation>"
  ],
  "weaknesses": [
    "<Key gaps, missing verification, or unclear sections>"
  ],
  "improvement_suggestions": [
    "<Specific, actionable suggestions to improve the implementation or documentation>"
  ],
  "recommended_next_steps": [
    "<Actionable next steps before the scheduled review meeting>"
  ]
}}
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    raw_response = await call_llm(messages, max_tokens=2500, temperature=0.1)

    try:
        parsed_json = extract_json_from_text(raw_response)
    except Exception as e:
        # Fallback if raw JSON extraction had an issue
        parsed_json = {
            "overall_score": 50,
            "summary": "Evaluation could not parse strict JSON from model.",
            "requirement_statuses": [
                {
                    "requirement": "General Deliverables",
                    "status": "Unable to Verify",
                    "evidence": "Raw evaluation output captured.",
                    "notes": str(e)
                }
            ],
            "missing_requirements": ["Parsing error occurred; review raw response."],
            "strengths": [],
            "weaknesses": ["Model response was not cleanly formatted JSON."],
            "improvement_suggestions": ["Re-run evaluation."],
            "recommended_next_steps": ["Review raw report output."]
        }

    validated = validate_and_normalize_review_json(parsed_json)

    # Save to database
    report = ReviewReport(
        task_id=task.id,
        submission_id=submission.id,
        overall_score=validated["overall_score"],
        requirement_statuses=json.dumps(validated["requirement_statuses"]),
        missing_requirements=json.dumps(validated["missing_requirements"]),
        strengths=json.dumps(validated["strengths"]),
        weaknesses=json.dumps(validated["weaknesses"]),
        improvement_suggestions=json.dumps(validated["improvement_suggestions"]),
        recommended_next_steps=json.dumps(validated["recommended_next_steps"]),
        raw_llm_response=raw_response
    )

    db.add(report)
    
    # Update task status: if score >= passing_score, 'Submitted' or 'Needs Revision'
    if validated["overall_score"] < task.passing_score:
        task.status = "Needs Revision"
    else:
        task.status = "Submitted"

    db.commit()
    db.refresh(report)
    db.refresh(task)

    return report
