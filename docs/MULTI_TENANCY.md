# Multi-Tenancy

Tenancy is based on customer users. Tenant IDs are the `users.id` values for customer accounts.

---

## Tenant Scoping Diagram

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart TB
	Admin[Admin] -->|Global access| AnyTenant[Any tenant]
	Admin -->|tenant_id filter| OneTenant[Single tenant]
	Customer[Customer] -->|Self scope| OwnTenant[Own tenant]
	Analyst[Analyst] -->|Assignments| AssignedTenants[Assigned customers]
	Viewer[Viewer] -->|Assignments| AssignedTenants
```

## Role Scoping Rules

- Admin: can access all tenants (or a specific tenant if requested).
- Analyst/Viewer: can access only assigned customer tenants.
- Customer: can access only their own tenant.

## Assignments

Analyst/Viewer assignments are stored in `user_customer_assignments`:

- `assigned_user_id` (analyst/viewer)
- `customer_user_id` (customer tenant)

## Backend Tenant Resolution

`get_accessible_tenant_ids()` returns:

- `None` for admins (global access)
- `[tenant_id]` for a requested tenant
- `[-1]` when no assignments exist (safe empty result)

---

## Assignment Flow

```mermaid
%%{init: {'theme': 'dark'}}%%
sequenceDiagram
	autonumber
	participant Admin
	participant API as FastAPI
	participant DB as Postgres

	Admin->>API: PUT /api/v1/users/{id}/customers
	API->>DB: Update user_customer_assignments
	DB-->>API: OK
	API-->>Admin: Assigned customers list
```

## Tenant-Aware Endpoints

Most data endpoints accept `tenant_id` as a query param, including:

- `/api/v1/topology/*`
- `/api/v1/traffic/*`
- `/api/v1/stream/*`
- `/api/v1/model/soc-health`

## Frontend Tenant Selector

- Admins can switch between tenants or Global View.
- Analyst/Viewer users are limited to assigned customers.
- Customer users do not see tenant switching.

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart LR
	Auth[AuthContext] --> Tenant[TenantContext]
	Tenant --> Fetch[fetchUserCustomers or fetchUsers]
	Fetch --> Assigned[Assigned customers]
	Tenant --> Selector[Tenant selector UI]
```
