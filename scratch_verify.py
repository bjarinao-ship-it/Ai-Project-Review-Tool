from backend.auth import create_access_token, hash_password, verify_password
from backend.database import SessionLocal
from backend.models import User
import jwt
from backend.config import settings

db = SessionLocal()
admin = db.query(User).filter(User.email == "admin@reviewtool.local").first()
assert admin is not None, "Admin not in DB"
assert verify_password("admin123", admin.password_hash), "Wrong password"

token = create_access_token({"sub": str(admin.id), "role": admin.role})
payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"], options={"verify_sub": False})

print("Token payload:", payload)
print("sub type:", type(payload["sub"]).__name__)
print("token_version:", payload.get("tv"))
assert payload.get("tv") == "v2", "Token version mismatch!"

user_id = int(payload["sub"])
user = db.query(User).filter(User.id == user_id).first()
print("User found:", user.name, user.role)
db.close()
print("")
print("ALL CHECKS PASSED - Token auth is fully working")
