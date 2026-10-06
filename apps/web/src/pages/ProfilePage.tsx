import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { UserDto } from '@learnloop/shared';
import { Alert, Button, Card, Input, Modal, PageHeader } from '../components/ui';
import { api, errorMessage, setSession } from '../lib/api';
import { useAuth, useUser } from '../lib/auth';

/** FR-5: view and edit profile, delete account. */
export function ProfilePage() {
  const user = useUser();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user.displayName);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const save = useMutation({
    mutationFn: () => api.patch<UserDto>('/me', { displayName: name }),
    onSuccess: (u) => setUser(u),
  });
  const remove = useMutation({
    mutationFn: () => api.del('/me'),
    onSuccess: () => {
      setSession(null);
      setUser(null);
      navigate('/login', { replace: true });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Profile" subtitle={`${user.email} · ${user.role}`} />
      <Card>
        <form className="space-y-4" onSubmit={onSubmit}>
          <Input
            label="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          {save.isError && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
          {save.isSuccess && <Alert tone="success">Saved.</Alert>}
          <Button
            type="submit"
            loading={save.isPending}
            disabled={!name.trim() || name === user.displayName}
          >
            Save changes
          </Button>
        </form>
      </Card>

      <Card className="mt-6 border-danger-line">
        <h2 className="font-semibold text-ink">Delete account</h2>
        <p className="mt-1 text-sm text-ink-muted">
          This permanently removes your account, practice history and progress.
        </p>
        <Button variant="danger" className="mt-4" onClick={() => setConfirmOpen(true)}>
          Delete my account
        </Button>
      </Card>

      <Modal title="Delete your account?" open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <p className="text-sm text-ink-muted">
          Type <strong className="text-ink">DELETE</strong> to confirm. This can’t be undone.
        </p>
        <Input
          className="mt-4"
          label="Confirmation"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
        />
        {remove.isError && (
          <div className="mt-3">
            <Alert tone="danger">{errorMessage(remove.error)}</Alert>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={confirmText !== 'DELETE'}
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Delete account
          </Button>
        </div>
      </Modal>
    </div>
  );
}
