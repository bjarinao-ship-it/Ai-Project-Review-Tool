from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Project, Module, User
from backend.schemas import ProjectCreate, ProjectOut, ModuleCreate, ModuleOut
from backend.auth import get_current_user, require_admin

router = APIRouter(prefix="/projects", tags=["Projects & Modules"])

@router.post("", response_model=ProjectOut)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    project = Project(
        name=payload.name.strip(),
        description=payload.description or "",
        created_by_id=admin.id
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

@router.get("", response_model=List[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return projects

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/{project_id}/modules", response_model=ModuleOut)
def add_module_to_project(
    project_id: int,
    payload: ModuleCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    module = Module(
        project_id=project.id,
        name=payload.name.strip(),
        description=payload.description or ""
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    return module

