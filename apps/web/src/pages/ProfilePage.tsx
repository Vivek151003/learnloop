import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { UserDto } from '@learnloop/shared';
import { Alert, Button, Input, Modal, PageHeader, Panel, PanelHeader } from '../components/ui';
import { api, errorMessage, setSession } from '../lib/api';
import { useAuth, useUser } from '../lib/auth';
import { shortDate } from '../lib/format';

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
    <div className="max-w-2xl">
      <PageHeader eyebrow="Account" title="Profile" />

      <Panel as="section">
        <PanelHeader title="Details" />
        <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-y-3 border-b border-rule px-5 py-4 text-sm">
          <dt className="text-ink-3">Email</dt>
          <dd className="font-mono">{user.email}</dd>
          <dt className="text-ink-3">Role</dt>
          <dd className="capitalize">{user.role}</dd>
          <dt className="text-ink-3">Joined</dt>
          <dd className="font-mono">{shortDate(user.createdAt)}</dd>
        </dl>
        <form className="space-y-4 px-5 py-5" onSubmit={onSubmit}>
          <Input
            label="Display name"
            hint="Shown to your teacher and classmates."
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          {save.isError && <Alert tone="wrong">{errorMessage(save.error)}</Alert>}
          {save.isSuccess && <Alert tone="right">Saved.</Alert>}
          <Button
            type="submit"
            loading={save.isPending}
            disabled={!name.trim() || name === user.displayName}
          >
            Save
          </Button>
        </form>
      </Panel>

      <section className="mt-10 border-t border-rule pt-6">
        <h2 className="font-serif text-xl font-semibold">Delete account</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-2">
          Removes your account, every answer you’ve given and your progress. This can’t be undone.
        </p>
        <Button
          variant="secondary"
          className="mt-4 text-incorrect"
          onClick={() => setConfirmOpen(true)}
        >
          Delete my account…
        </Button>
      </section>

      <Modal title="Delete your account?" open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <p className="text-sm text-ink-2">
          Type <span className="font-mono font-medium text-ink">DELETE</span> to confirm.
        </p>
        <Input
          className="mt-4"
          label="Confirmation"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
        />
        {remove.isError && (
          <div className="mt-3">
            <Alert tone="wrong">{errorMessage(remove.error)}</Alert>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="quiet" onClick={() => setConfirmOpen(false)}>
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
