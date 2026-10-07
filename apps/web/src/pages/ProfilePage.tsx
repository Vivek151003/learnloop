import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { UserDto } from '@learnloop/shared';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  Modal,
  PageHeader,
} from '../components/ui';
import { useToast } from '../components/toast';
import { api, errorMessage, setSession } from '../lib/api';
import { useAuth, useUser } from '../lib/auth';
import { shortDate } from '../lib/format';

/** FR-5: view and edit profile, delete account. */
export function ProfilePage() {
  const user = useUser();
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(user.displayName);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const save = useMutation({
    mutationFn: () => api.patch<UserDto>('/me', { displayName: name }),
    onSuccess: (u) => {
      setUser(u);
      toast.success('Profile updated');
    },
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
      <PageHeader title="Profile" description="Manage your account details." />

      <Card>
        <div className="flex items-center gap-4 border-b border-gray-200 px-5 py-5">
          <Avatar name={user.displayName} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-900">{user.displayName}</p>
            <p className="truncate text-gray-500">{user.email}</p>
          </div>
          <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
            <Badge tone="brand">{user.role}</Badge>
            <span className="text-xs text-gray-500">Joined {shortDate(user.createdAt)}</span>
          </div>
        </div>
        <form className="space-y-4 p-5" onSubmit={onSubmit}>
          <Input
            label="Display name"
            hint="Shown to your teacher and classmates."
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          {save.isError && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
          <div className="flex justify-end">
            <Button
              type="submit"
              loading={save.isPending}
              disabled={!name.trim() || name === user.displayName}
            >
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-6 border-danger-100">
        <CardHeader
          title="Delete account"
          description="Permanently removes your account, every answer you’ve given and your progress. This can’t be undone."
        />
        <div className="px-5 py-4">
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Delete account
          </Button>
        </div>
      </Card>

      <Modal
        title="Delete your account?"
        description="This permanently removes all of your data."
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
      >
        <Input
          label="Type DELETE to confirm"
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
