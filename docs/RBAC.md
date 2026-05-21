# RBAC

The platform uses a hybrid RBAC model with a primary role on `users.role` and optional many-to-many role assignments via `user_roles`.

---

## RBAC Resolution Flow

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart TD
	User[User] --> Primary[users.role]
	User --> Extra[user_roles]
	Primary --> Map[Static Role Map]
	Primary --> DbRole[roles + role_permissions]
	Extra --> DbRole
	Map --> Perms[Effective Permissions]
	DbRole --> Perms
	Admin[admin role] -->|Bypass| Perms
```

## Data Model

- `users.role`: primary role (admin, customer, analyst, viewer).
- `roles`: role definitions (name, description, system flag).
- `permissions`: permission codes.
- `role_permissions`: role-to-permission mapping.
- `user_roles`: optional extra role assignments.

## Permission Resolution

1. Admin role grants all permissions.
2. A static role-to-permission map provides fallback permissions.
3. DB role permissions are added if present (role name matches).
4. Extra roles from `user_roles` are merged.

This ensures the system works even if role permissions have not been seeded yet.

---

## Permission Enforcement

```mermaid
%%{init: {'theme': 'dark'}}%%
sequenceDiagram
	autonumber
	participant Client
	participant API as FastAPI
	participant RBAC as require_permission

	Client->>API: Request /api/v1/*
	API->>RBAC: Resolve permissions
	RBAC-->>API: Allow or deny
	API-->>Client: 2xx or 403
```

## System Roles

The system expects four base roles:

- admin
- customer
- analyst
- viewer

These are defined in `UserRole` and used by tenant scoping, onboarding gates, and permission mapping.

## Enforcement

- Backend enforces permissions via dependency guards.
- Frontend checks are UX-only.
- Permission checks occur on every protected route.

## Role Assignment Counting

Role counts and role-user listings are resolved from both:

- `user_roles` association table, and
- `users.role` (normalized name matching).

## Approval Flow

- Self-registration creates `onboarding_status=pending` and `is_email_verified=false`.
- User must verify their email before they enter the admin approval queue (or auto-approve).
- Analyst/Viewer roles are auto-approved upon email verification.
- Customer roles remain pending after verification until an Admin approves them.

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart LR
	Register[Self-register] --> Verify[Verify Email]
	Verify -->|Customer| Pending[Admin Approval Queue]
	Verify -->|Analyst/Viewer| Auto[Auto-Approved]
	Pending -->|Approve| Approved[Access Granted]
	Pending -->|Reject| Rejected[Access Denied]
	Auto --> Approved
```

## Assignment Endpoints

- `GET /api/v1/rbac/roles` (with assigned user counts)
- `GET /api/v1/rbac/roles/{id}/users`
- `PUT /api/v1/users/{id}/roles` (role assignment list)
- `PUT /api/v1/users/{id}/customers` (analyst/viewer tenant assignments)

## Protected Roles

System roles cannot be renamed or deleted. Permission changes for system roles are blocked to protect RBAC invariants.
