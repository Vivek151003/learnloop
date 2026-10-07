import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { ROLES, type Paginated, type Role, type UserDto } from '@learnloop/shared';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterSelect,
  LoadingBlock,
  PageHeader,
  Pager,
  SearchInput,
  TableWrap,
  Td,
  Th,
} from '../../components/ui';
import { useToast } from '../../components/toast';
import { api, errorMessage, qs } from '../../lib/api';
import { useUser } from '../../lib/auth';
import { shortDate } from '../../lib/format';

/** FR-40: list users, change roles, disable accounts. */
export default function UsersPage() {
  const me = useUser();
  const qc = useQueryClient();
  const toast = useToast();
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = useQuery({
    queryKey: ['admin-users', role, q, page],
    queryFn: () =>
      api.get<Paginated<UserDto>>(`/admin/users${qs({ role, q, page, pageSize: 20 })}`),
    placeholderData: keepPreviousData,
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name: string; role?: Role; disabled?: boolean }) =>
      api.patch<UserDto>(`/admin/users/${id}`, body),
    onSuccess: (_u, v) => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      void qc.invalidateQueries({ queryKey: ['audit'] });
      toast.success(
        v.role
          ? `${v.name} is now a ${v.role}`
          : v.disabled
            ? `${v.name} was disabled`
            : `${v.name} was enabled`,
      );
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <>
      <PageHeader
        title="Users"
        description="Role changes and disabled accounts take effect on the user’s next request and are recorded in the audit log."
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-5 py-3">
          <SearchInput
            label="Search users"
            placeholder="Search by name or email"
            value={search}
            onChange={setSearch}
            className="w-full sm:w-72"
          />
          <FilterSelect
            label="Filter by role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r[0]!.toUpperCase() + r.slice(1)}
              </option>
            ))}
          </FilterSelect>
          {list.data && (
            <span className="ml-auto text-sm text-gray-500">{list.data.total} users</span>
          )}
        </div>
        {list.isError ? (
          <div className="p-5">
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          </div>
        ) : list.isPending ? (
          <div className="p-5">
            <LoadingBlock />
          </div>
        ) : list.data.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users match"
            description="Try another name, email or role."
          />
        ) : (
          <>
            <TableWrap minWidth={720}>
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Joined</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((u) => {
                  const self = u.id === me.id;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={u.displayName} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-900">
                              {u.displayName}
                              {self && (
                                <span className="ml-1.5 font-normal text-gray-500">(you)</span>
                              )}
                            </p>
                            <p className="truncate text-gray-500">{u.email}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <label className="sr-only" htmlFor={`role-${u.id}`}>
                          Role for {u.displayName}
                        </label>
                        <select
                          id={`role-${u.id}`}
                          value={u.role}
                          disabled={self || update.isPending}
                          onChange={(e) =>
                            update.mutate({
                              id: u.id,
                              name: u.displayName,
                              role: e.target.value as Role,
                            })
                          }
                          className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm capitalize shadow-xs focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:border-transparent disabled:bg-transparent disabled:shadow-none"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </Td>
                      <Td>
                        {u.disabled ? (
                          <Badge tone="danger">Disabled</Badge>
                        ) : (
                          <Badge tone="success">Active</Badge>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-gray-600">{shortDate(u.createdAt)}</Td>
                      <Td className="text-right">
                        {!self && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              update.mutate({
                                id: u.id,
                                name: u.displayName,
                                disabled: !u.disabled,
                              })
                            }
                          >
                            {u.disabled ? 'Enable' : 'Disable'}
                          </Button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
            <Pager
              page={list.data.page}
              pageSize={list.data.pageSize}
              total={list.data.total}
              onPage={setPage}
            />
          </>
        )}
      </Card>
    </>
  );
}
