import os

file_path = 'c:/Users/ASUS/Documents/Semester 6/Project 2/ics/frontend/src/pages/AdminUsersPage.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    '  updateUser,\n  type ActiveThreatResponse,',
    '  updateUser,\n  fetchUserCustomers,\n  updateUserCustomers,\n  type ActiveThreatResponse,'
)

# 2. Add state
state_code = '''  const [error, setError] = useState("");

  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [assignmentUser, setAssignmentUser] = useState<UserAdminResponse | null>(null);
  const [assignedCustomerIds, setAssignedCustomerIds] = useState<number[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");'''
content = content.replace('  const [error, setError] = useState("");', state_code)

# 3. Add handlers
handlers_code = '''  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    if (!editUsername.trim() || !editEmail.trim()) {
      setError("Username and email are required.");
      return;
    }
    if (editPassword && editPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      await updateUser(selectedUser.id, {
        username: editUsername.trim(),
        email: editEmail.trim(),
        role: editRole,
        is_active: editActive,
        is_email_verified: editEmailVerified,
        is_admin_approved: editAdminApproved,
        password: editPassword ? editPassword : undefined
      });
      await loadUsers(query.trim() || undefined);
      closeUserModal();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user.");
    } finally {
      setSaving(false);
    }
  };

  const openAssignmentModal = async (user: UserAdminResponse) => {
    setAssignmentUser(user);
    setIsAssignmentModalOpen(true);
    setAssignmentLoading(true);
    setAssignmentError("");
    try {
      const res = await fetchUserCustomers(user.id);
      setAssignedCustomerIds(res.assigned_customers.map(c => c.id));
    } catch (err) {
      setAssignmentError(err instanceof Error ? err.message : "Unable to load assignments.");
    } finally {
      setAssignmentLoading(false);
    }
  };

  const closeAssignmentModal = () => {
    setAssignmentUser(null);
    setIsAssignmentModalOpen(false);
  };

  const handleSaveAssignments = async () => {
    if (!assignmentUser) return;
    setAssignmentLoading(true);
    setAssignmentError("");
    try {
      await updateUserCustomers(assignmentUser.id, assignedCustomerIds);
      closeAssignmentModal();
    } catch (err) {
      setAssignmentError(err instanceof Error ? err.message : "Unable to save assignments.");
    } finally {
      setAssignmentLoading(false);
    }
  };
'''

content = content.replace(
'''  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    if (!editUsername.trim() || !editEmail.trim()) {
      setError("Username and email are required.");
      return;
    }
    if (editPassword && editPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      await updateUser(selectedUser.id, {
        username: editUsername.trim(),
        email: editEmail.trim(),
        role: editRole,
        is_active: editActive,
        is_email_verified: editEmailVerified,
        is_admin_approved: editAdminApproved,
        password: editPassword ? editPassword : undefined
      });
      await loadUsers(query.trim() || undefined);
      closeUserModal();
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user.");
    } finally {
      setSaving(false);
    }
  };''', handlers_code)

# 4. Add button
btn_code = '''{canManageUsers ? (
                        <Button size="sm" variant="outline" onClick={() => openEditModal(user)}>Edit</Button>
                      ) : null}
                      {canManageUsers && (user.role === "analyst" || user.role === "viewer") ? (
                        <Button size="sm" variant="outline" onClick={() => openAssignmentModal(user)}>Assign</Button>
                      ) : null}'''
content = content.replace('{canManageUsers ? (\n                        <Button size="sm" variant="outline" onClick={() => openEditModal(user)}>Edit</Button>\n                      ) : null}', btn_code)

# 5. Add modal
modal_code = '''
      {isAssignmentModalOpen && assignmentUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0c152d]/95 p-6 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-brand">Admin</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Assign Customers</h2>
                <p className="mt-1 text-sm text-muted">Select customers for {assignmentUser.username} to access.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeAssignmentModal}>Close</Button>
            </div>

            {assignmentLoading && !users.length ? (
              <p className="mt-4 text-sm text-muted">Loading...</p>
            ) : (
              <div className="mt-5 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                {users.filter(u => u.role === "customer").map(c => (
                  <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={assignedCustomerIds.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAssignedCustomerIds(prev => [...prev, c.id]);
                        } else {
                          setAssignedCustomerIds(prev => prev.filter(id => id !== c.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-white/20 bg-white/10 text-brand"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm text-white">{c.company_name || c.username}</span>
                      <span className="text-xs text-muted">{c.email}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {assignmentError ? <p className="mt-3 text-sm text-danger">{assignmentError}</p> : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={handleSaveAssignments} loading={assignmentLoading}>Save assignments</Button>
              <Button variant="outline" onClick={closeAssignmentModal}>Cancel</Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>'''
content = content.replace('    </section>', modal_code)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
